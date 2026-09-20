import React, { useState, useEffect, useMemo } from 'react';

export default function UpgradeToCorModal({
  isOpen,
  staff,
  allStaffList = [],
  categories = [],
  authToken,
  onClose,
  onSuccess
}) {
  const [selectedStaffId, setSelectedStaffId] = useState(staff ? staff.id : '');
  const [corLinksData, setCorLinksData] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [targetLink, setTargetLink] = useState(1);
  const [targetAction, setTargetAction] = useState('FILL_VACANT'); // 'FILL_VACANT' | 'REPLACE_TO_VACANT' | 'SWAP' | 'INSERT_SHIFT'
  const [newDesignation, setNewDesignation] = useState('CTI');
  const [newRestDay, setNewRestDay] = useState('MON');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [searchStaffText, setSearchStaffText] = useState('');

  // Formula for COR rest days
  const COR_REST_DAYS = {
    1: 'MON', 2: 'SUN', 3: 'SAT', 4: 'FRI', 5: 'THU', 6: 'WED', 7: 'TUE',
    8: 'MON', 9: 'SUN', 10: 'SAT', 11: 'FRI', 12: 'THU', 13: 'WED', 14: 'TUE',
    15: 'MON', 16: 'SUN', 17: 'SAT', 18: 'FRI', 19: 'THU', 20: 'WED', 21: 'TUE'
  };

  const getCorRest = (row) => {
    const norm = ((row - 1) % 21) + 1;
    return COR_REST_DAYS[norm] || 'MON';
  };

  // Sync selectedStaffId if staff prop changes
  useEffect(() => {
    if (staff) {
      setSelectedStaffId(staff.id);
    }
  }, [staff]);

  // Fetch COR links summary whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchCorLinks = async () => {
      try {
        setLoadingLinks(true);
        setError(null);
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch('/api/staff/cor-links-summary', { headers });
        if (!res.ok) throw new Error(`Failed to load COR links: ${res.statusText}`);
        const data = await res.json();
        setCorLinksData(data.links || []);

        // Find first vacant link if any, otherwise default to link 1
        const vacantLink = (data.links || []).find(l => l.is_vacant);
        if (vacantLink) {
          setTargetLink(vacantLink.link_number);
          setTargetAction('FILL_VACANT');
          setNewRestDay(vacantLink.scheduled_rest_day || getCorRest(vacantLink.link_number));
        } else {
          setTargetLink(1);
          setTargetAction('REPLACE_TO_VACANT');
          setNewRestDay(getCorRest(1));
        }
      } catch (err) {
        console.error('Error fetching COR links:', err);
        setError(err.message);
      } finally {
        setLoadingLinks(false);
      }
    };

    fetchCorLinks();
  }, [isOpen, authToken]);

  // When targetLink changes, auto-update the rest day
  const handleLinkChange = (linkNum) => {
    const num = parseInt(linkNum, 10);
    setTargetLink(num);
    const selectedDef = corLinksData.find(l => l.link_number === num);
    const expectedRest = selectedDef?.scheduled_rest_day || getCorRest(num);
    setNewRestDay(expectedRest);

    if (selectedDef?.is_vacant) {
      setTargetAction('FILL_VACANT');
    } else if (targetAction === 'FILL_VACANT') {
      setTargetAction('REPLACE_TO_VACANT');
    }
  };

  // Currently selected candidate staff object
  const currentCandidate = useMemo(() => {
    if (!selectedStaffId) return null;
    return allStaffList.find(s => s.id === parseInt(selectedStaffId, 10)) || staff || null;
  }, [selectedStaffId, allStaffList, staff]);

  // Current category of candidate
  const candidateCategory = useMemo(() => {
    if (!currentCandidate) return null;
    return categories.find(c => c.id === currentCandidate.category_id) || null;
  }, [currentCandidate, categories]);

  // Filter non-COR candidate list for dropdown
  const eligibleCandidates = useMemo(() => {
    return allStaffList.filter(s => {
      // Must not be in COR (Cat 1) and must not be a vacant slot
      if (s.category_id === 1) return false;
      // Exclude Depot Incharges (MV PRASAD, P PRATHAP)
      if (!s.category_id || s.row_position === 0 || ['MV PRASAD', 'P PRATHAP'].includes((s.name || '').trim().toUpperCase())) return false;
      const n = (s.name || '').toUpperCase();
      if (n.includes('VACANT') || n === 'V' || n === '(V)') return false;
      if (searchStaffText.trim()) {
        const q = searchStaffText.toLowerCase().trim();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchDesig = (s.designation || '').toLowerCase().includes(q);
        const matchPf = (s.pf_no || '').toLowerCase().includes(q);
        return matchName || matchDesig || matchPf;
      }
      return true;
    });
  }, [allStaffList, searchStaffText]);

  // Selected COR link definition
  const selectedCorLinkDef = useMemo(() => {
    return corLinksData.find(l => l.link_number === targetLink) || null;
  }, [corLinksData, targetLink]);

  // Handle Form Submit
  const handleUpgradeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setError('Please select an employee to upgrade.');
      return;
    }
    if (!targetLink) {
      setError('Please select a target COR link.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const payload = {
        staff_id: parseInt(selectedStaffId, 10),
        target_cor_row: targetLink,
        target_action: targetAction,
        new_designation: newDesignation || 'CTI',
        new_rest_day: newRestDay
      };

      const res = await fetch('/api/staff/upgrade-to-cor', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Upgrade failed with status ${res.status}`);
      }

      alert(`✅ Success: ${json.message}`);
      if (onSuccess) onSuccess(json);
      if (onClose) onClose();
    } catch (err) {
      console.error('Error upgrading employee:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.78)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-card, #1e2430)',
        border: '1px solid var(--border-glass, rgba(212, 161, 92, 0.3))',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(212, 161, 92, 0.15)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.15) 0%, rgba(212, 161, 92, 0.03) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>⭐</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary, #d4a15c)', fontWeight: 800 }}>
                Upgrade Employee to Conductors (COR)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
                Cadre promotion • Preserves old slot as VACANT (V) • Adjusts COR link & rest day
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #94a3b8)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleUpgradeSubmit} style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Candidate Employee */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary, #d4a15c)', fontWeight: 700, marginBottom: '8px' }}>
              👤 Employee Being Upgraded
            </label>

            {!staff ? (
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search candidate by name or designation..."
                  value={searchStaffText}
                  onChange={(e) => setSearchStaffText(e.target.value)}
                  style={{ marginBottom: '8px', fontSize: '0.85rem' }}
                />
                <select
                  className="form-input"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  required
                  style={{ fontWeight: 600 }}
                >
                  <option value="">-- Choose Employee to Upgrade --</option>
                  {eligibleCandidates.map(c => {
                    const cat = categories.find(cat => cat.id === c.category_id);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.designation || 'Staff'} • {cat?.name || `Cat ${c.category_id}`} • Row {c.row_position})
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            {currentCandidate && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: !staff ? '8px' : 0
              }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary, #fff)' }}>
                    {currentCandidate.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '2px' }}>
                    <span>Current Designation: <strong>{currentCandidate.designation || 'Staff'}</strong></span>
                    {currentCandidate.pf_no && <span> • PF No: <strong>{currentCandidate.pf_no}</strong></span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary, #d4a15c)' }}>
                    {candidateCategory?.name || `Category ${currentCandidate.category_id}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '2px' }}>
                    Seniority Row: <strong>{currentCandidate.row_position}</strong> • Rest: <strong>{currentCandidate.rest_day || 'Cyclic'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Vacancy Preservation Guarantee */}
          {currentCandidate && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.03) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <span style={{ fontSize: '1.3rem' }}>🛡️</span>
              <div style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                <strong style={{ color: '#10b981' }}>Old Place Shows Vacant:</strong>
                <div style={{ color: 'var(--color-text-secondary, #cbd5e1)', marginTop: '2px' }}>
                  Upon upgrade, <strong>Row {currentCandidate.row_position}</strong> in <strong>{candidateCategory?.name || 'his current category'}</strong> will automatically be preserved and marked as <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>VACANT (V)</span>.
                  The category cycle length and remaining staff links will not be disrupted!
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Target COR Link & Cadre Details */}
          <div style={{
            borderTop: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
            paddingTop: '16px'
          }}>
            <label style={{ display: 'block', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary, #d4a15c)', fontWeight: 700, marginBottom: '10px' }}>
              🚆 Select Target Link in Conductors (COR) Category
            </label>

            {loadingLinks ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Loading COR links...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Link Selector */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    COR Link / Row Position:
                  </label>
                  <select
                    className="form-input"
                    value={targetLink}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    required
                    style={{ fontWeight: 700 }}
                  >
                    {corLinksData.map(l => (
                      <option key={l.link_number} value={l.link_number}>
                        Link {l.link_number}: {l.train_numbers} {l.is_vacant ? '🟢 (VACANT)' : `(Occ: ${l.occupant?.name || 'Filled'})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* New Designation */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    Upgraded Designation:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="e.g. CTI"
                    required
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </div>
            )}

            {/* Target Link Information Card */}
            {selectedCorLinkDef && (
              <div style={{
                background: selectedCorLinkDef.is_vacant ? 'rgba(16, 185, 129, 0.06)' : 'rgba(212, 161, 92, 0.06)',
                border: selectedCorLinkDef.is_vacant ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(212, 161, 92, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginTop: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{selectedCorLinkDef.is_rest ? '💤' : '🚆'}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-primary, #fff)' }}>
                      Link {selectedCorLinkDef.link_number}: {selectedCorLinkDef.train_numbers}
                    </span>
                  </div>

                  {selectedCorLinkDef.is_vacant ? (
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800, border: '1px solid #10b981' }}>
                      🟢 VACANT SLOT (Ready to Occupy)
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 800 }}>
                      ⚠️ Currently Occupied
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '8px' }}>
                  {selectedCorLinkDef.from_station && (
                    <span>Route: <strong>{selectedCorLinkDef.from_station} ➔ {selectedCorLinkDef.to_station}</strong></span>
                  )}
                  {selectedCorLinkDef.coaches && (
                    <span>Coaches: <strong>{selectedCorLinkDef.coaches}</strong></span>
                  )}
                  <span>Scheduled Rest Day: <strong style={{ color: 'var(--primary, #d4a15c)' }}>{selectedCorLinkDef.scheduled_rest_day}</strong></span>
                </div>

                {/* Current Occupant Details & Action Picker if occupied */}
                {!selectedCorLinkDef.is_vacant && selectedCorLinkDef.occupant && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ marginBottom: '6px' }}>
                      Current Occupant: <strong>{selectedCorLinkDef.occupant.name}</strong> ({selectedCorLinkDef.occupant.designation || 'CTI'})
                    </div>

                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Action on Current Conductor:</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="targetAction"
                          value="REPLACE_TO_VACANT"
                          checked={targetAction === 'REPLACE_TO_VACANT'}
                          onChange={() => setTargetAction('REPLACE_TO_VACANT')}
                        />
                        <span>Replace Conductor</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="targetAction"
                          value="SWAP"
                          checked={targetAction === 'SWAP'}
                          onChange={() => setTargetAction('SWAP')}
                        />
                        <span>Swap Positions</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rest Day Confirmation */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Adjusted Weekly Rest Day:
              </label>
              <select
                className="form-input"
                value={newRestDay}
                onChange={(e) => setNewRestDay(e.target.value)}
                style={{ width: '160px', padding: '6px 12px', fontWeight: 800, color: 'var(--primary)' }}
              >
                <option value="MON">MON (Monday)</option>
                <option value="TUE">TUE (Tuesday)</option>
                <option value="WED">WED (Wednesday)</option>
                <option value="THU">THU (Thursday)</option>
                <option value="FRI">FRI (Friday)</option>
                <option value="SAT">SAT (Saturday)</option>
                <option value="SUN">SUN (Sunday)</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                (Automatically aligned with Link {targetLink} 21-day rotation)
              </span>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '12px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedStaffId}
              style={{
                padding: '8px 24px',
                fontSize: '0.88rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #d4a15c 0%, #b8860b 100%)',
                color: '#000',
                border: 'none',
                boxShadow: '0 4px 14px rgba(212, 161, 92, 0.4)'
              }}
            >
              {submitting ? '⏳ Upgrading...' : '⭐ Confirm Upgrade to COR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
