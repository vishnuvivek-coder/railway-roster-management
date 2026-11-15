import React, { useState, useEffect } from 'react';
import { Staff, DutyItem } from './types/roster';

export interface StaffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff | DutyItem | null;
  allStaffList: Staff[];
  isAdmin: boolean;
  authToken: string | null;
  API_BASE: string;
  onStaffUpdated: (updatedStaff: Staff) => void;
}

export const StaffDetailsModal: React.FC<StaffDetailsModalProps> = ({
  isOpen,
  onClose,
  staff,
  allStaffList,
  isAdmin,
  authToken,
  API_BASE,
  onStaffUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'all'>('single');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    cug_number: '',
    contact_number: '',
    email: '',
    pf_no: '',
    hrms_id: ''
  });

  // Sync selected staff on prop change
  useEffect(() => {
    if (staff) {
      const staffId = (staff as any).staffId || staff.id;
      const full = allStaffList.find(s => 
        (staffId && String(s.id) === String(staffId)) ||
        (s.name && (staff as any).name && s.name.trim().toLowerCase() === (staff as any).name.trim().toLowerCase())
      ) || (staff as unknown as Staff);
      setSelectedStaff(full);
      setFormData({
        name: full.name || (staff as any).name || '',
        designation: full.designation || (staff as any).designation || '',
        cug_number: full.cug_number || (staff as any).cug_number || '',
        contact_number: full.contact_number || (staff as any).contact_number || '',
        email: full.email || (staff as any).email || '',
        pf_no: full.pf_no || (full as any).pf_number || (staff as any).pf_no || (staff as any).pf_number || '',
        hrms_id: full.hrms_id || (staff as any).hrms_id || ''
      });
      setIsEditing(false);
      setNotification(null);
      setActiveTab('single');
    }
  }, [staff, allStaffList]);

  if (!isOpen || !selectedStaff) return null;

  // Filter roster staff (only those in roster management, ignore vacant placeholders)
  const rosterStaffList = (allStaffList || []).filter(s => 
    s.name && !s.name.toUpperCase().includes('VACANT') &&
    s.category_id !== null && s.category_id !== undefined
  );

  const filteredDirectory = rosterStaffList.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.designation && s.designation.toLowerCase().includes(q)) ||
      (s.pf_no && s.pf_no.toLowerCase().includes(q)) ||
      (s.pf_number && s.pf_number.toLowerCase().includes(q)) ||
      (s.cug_number && s.cug_number.includes(q)) ||
      (s.contact_number && s.contact_number.includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.hrms_id && s.hrms_id.toLowerCase().includes(q))
    );
  });

  const handleSelectStaffFromDirectory = (target: Staff) => {
    setSelectedStaff(target);
    setFormData({
      name: target.name || '',
      designation: target.designation || '',
      cug_number: target.cug_number || '',
      contact_number: target.contact_number || '',
      email: target.email || '',
      pf_no: target.pf_no || target.pf_number || '',
      hrms_id: target.hrms_id || ''
    });
    setIsEditing(false);
    setNotification(null);
    setActiveTab('single');
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      alert('Access Denied: Only Master Administrators can edit employee official and contact details.');
      return;
    }
    if (!selectedStaff || !selectedStaff.id) return;

    setSaving(true);
    setNotification(null);

    try {
      const res = await fetch(`${API_BASE}/staff/${selectedStaff.id}/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update employee details');
      }

      setSelectedStaff(data.staff);
      onStaffUpdated(data.staff);
      setIsEditing(false);
      setNotification({
        text: `✅ Details updated successfully for ${data.staff.name}`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        text: `❌ Error: ${err.message}`,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
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
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: activeTab === 'all' ? '1180px' : '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #18181b)',
          border: '1.5px solid var(--border-gold, #d4a15c)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          color: 'var(--color-text-primary, #f4f4f5)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.12), rgba(0, 0, 0, 0.3))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🪪</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary, #d4a15c)' }}>
                Employee Details & Contact Directory
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary, #a1a1aa)' }}>
                Official Railway Contact & Identification Records for Roster Management
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted, #71717a)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              lineHeight: 1
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'single' ? 800 : 600,
              border: activeTab === 'single' ? '1px solid var(--primary, #d4a15c)' : '1px solid transparent',
              background: activeTab === 'single' ? 'rgba(212, 161, 92, 0.2)' : 'transparent',
              color: activeTab === 'single' ? 'var(--primary, #d4a15c)' : 'var(--color-text-secondary, #a1a1aa)',
              cursor: 'pointer'
            }}
          >
            👤 {selectedStaff.name} ({selectedStaff.designation || 'Staff'})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'all' ? 800 : 600,
              border: activeTab === 'all' ? '1px solid var(--primary, #d4a15c)' : '1px solid transparent',
              background: activeTab === 'all' ? 'rgba(212, 161, 92, 0.2)' : 'transparent',
              color: activeTab === 'all' ? 'var(--primary, #d4a15c)' : 'var(--color-text-secondary, #a1a1aa)',
              cursor: 'pointer'
            }}
          >
            📋 All Roster Staff Table ({rosterStaffList.length} Employees)
          </button>
        </div>

        {/* Notification Alert */}
        {notification && (
          <div
            style={{
              margin: '12px 24px 0',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '0.86rem',
              fontWeight: 700,
              background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: notification.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
              color: notification.type === 'success' ? '#34d399' : '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{notification.text}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'single' ? (
            <div>
              {/* Header Info & Action Controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f4f4f5' }}>
                    Official Details for <span style={{ color: 'var(--primary, #d4a15c)' }}>{selectedStaff.name}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #a1a1aa)', marginTop: '2px' }}>
                    Designation: <strong>{selectedStaff.designation || '-'}</strong> • Category ID: {selectedStaff.category_id || '-'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isAdmin ? (
                    !isEditing ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit Details (Admin)
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setIsEditing(false);
                            setFormData({
                              name: selectedStaff.name || '',
                              designation: selectedStaff.designation || '',
                              cug_number: selectedStaff.cug_number || '',
                              contact_number: selectedStaff.contact_number || '',
                              email: selectedStaff.email || '',
                              pf_no: selectedStaff.pf_no || selectedStaff.pf_number || '',
                              hrms_id: selectedStaff.hrms_id || ''
                            });
                          }}
                          disabled={saving}
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                          ✕ Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSave()}
                          disabled={saving}
                          style={{
                            padding: '6px 16px',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {saving ? 'Saving...' : '💾 Save Changes'}
                        </button>
                      </div>
                    )
                  ) : (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted, #71717a)',
                        padding: '4px 10px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-glass, rgba(255,255,255,0.08))'
                      }}
                    >
                      🔒 Read-Only (Admin Edit Access)
                    </span>
                  )}
                </div>
              </div>

              {/* Column Table Component */}
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-glass, rgba(255,255,255,0.12))' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>Employee Name</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>Designation</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>CUG Mobile</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>Personal Contact</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>Email ID</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>PF Number</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))' }}>HRMS ID</th>
                      {isAdmin && (
                        <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.1))', textAlign: 'center' }}>Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {!isEditing ? (
                      /* VIEW MODE ROW */
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#f4f4f5' }}>
                          {selectedStaff.name}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary, #a1a1aa)' }}>
                          {selectedStaff.designation || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {selectedStaff.cug_number ? (
                            <a
                              href={`tel:${selectedStaff.cug_number}`}
                              style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              📞 {selectedStaff.cug_number}
                            </a>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {selectedStaff.contact_number ? (
                            <a
                              href={`tel:${selectedStaff.contact_number}`}
                              style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              📱 {selectedStaff.contact_number}
                            </a>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {selectedStaff.email ? (
                            <a
                              href={`mailto:${selectedStaff.email}`}
                              style={{ color: '#34d399', textDecoration: 'none', fontSize: '0.82rem' }}
                            >
                              ✉️ {selectedStaff.email}
                            </a>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--primary, #d4a15c)' }}>
                          {selectedStaff.pf_no || selectedStaff.pf_number || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#a78bfa' }}>
                          {selectedStaff.hrms_id || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setIsEditing(true)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.76rem',
                                borderRadius: '5px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ) : (
                      /* EDIT MODE ROW (ADMIN ONLY) */
                      <tr style={{ background: 'rgba(212, 161, 92, 0.08)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            required
                            className="form-input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', minWidth: '130px', padding: '6px 8px', fontSize: '0.82rem', fontWeight: 700 }}
                            placeholder="Employee Name"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.designation}
                            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                            style={{ width: '100%', minWidth: '90px', padding: '6px 8px', fontSize: '0.82rem' }}
                            placeholder="Designation"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.cug_number}
                            onChange={(e) => setFormData({ ...formData, cug_number: e.target.value })}
                            style={{ width: '100%', minWidth: '110px', padding: '6px 8px', fontSize: '0.82rem' }}
                            placeholder="CUG Number"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.contact_number}
                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                            style={{ width: '100%', minWidth: '110px', padding: '6px 8px', fontSize: '0.82rem' }}
                            placeholder="Personal Contact"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="email"
                            className="form-input"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', minWidth: '140px', padding: '6px 8px', fontSize: '0.82rem' }}
                            placeholder="Email ID"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.pf_no}
                            onChange={(e) => setFormData({ ...formData, pf_no: e.target.value })}
                            style={{ width: '100%', minWidth: '110px', padding: '6px 8px', fontSize: '0.82rem', fontWeight: 700 }}
                            placeholder="PF Number"
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.hrms_id}
                            onChange={(e) => setFormData({ ...formData, hrms_id: e.target.value })}
                            style={{ width: '100%', minWidth: '90px', padding: '6px 8px', fontSize: '0.82rem' }}
                            placeholder="HRMS ID"
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleSave()}
                            disabled={saving}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              background: '#10b981',
                              color: '#000',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              marginRight: '6px'
                            }}
                          >
                            {saving ? '...' : '💾 Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsEditing(false)}
                            style={{ padding: '5px 8px', fontSize: '0.76rem', borderRadius: '5px' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Informational Guidance */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass, rgba(255,255,255,0.06))',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-secondary, #a1a1aa)',
                  lineHeight: 1.5
                }}
              >
                💡 <strong>Data Policy:</strong> Only employees actively present in Roster Management are included. Columns for missing data (such as HRMS ID or optional CUG) are kept vacant. All duty allocations, cyclic links, and historical journals remain undisturbed.
              </div>
            </div>
          ) : (
            /* ALL ROSTER EMPLOYEES DIRECTORY TABLE VIEW */
            <div>
              {/* Directory Filter & Search Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f4f4f5' }}>
                    Complete Division Staff Contact Table ({filteredDirectory.length} of {rosterStaffList.length})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #a1a1aa)' }}>
                    Exclusively collecting Ticket Checking Staff active in Roster Management.
                  </div>
                </div>

                <div style={{ width: '280px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search name, designation, PF, phone..."
                    style={{ width: '100%', padding: '7px 12px', fontSize: '0.82rem', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Full Multi-Column Table */}
              <div
                style={{
                  maxHeight: '52vh',
                  overflowY: 'auto',
                  border: '1px solid var(--border-glass, rgba(255,255,255,0.12))',
                  borderRadius: '10px'
                }}
              >
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#202024' }}>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.15))' }}>
                      <th style={{ padding: '8px 10px' }}>SL NO</th>
                      <th style={{ padding: '8px 10px' }}>Employee Name</th>
                      <th style={{ padding: '8px 10px' }}>Designation</th>
                      <th style={{ padding: '8px 10px' }}>CUG Number</th>
                      <th style={{ padding: '8px 10px' }}>Personal Contact</th>
                      <th style={{ padding: '8px 10px' }}>Email ID</th>
                      <th style={{ padding: '8px 10px' }}>PF Number</th>
                      <th style={{ padding: '8px 10px' }}>HRMS ID</th>
                      {isAdmin && (
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirectory.map((emp, idx) => (
                      <tr
                        key={emp.id}
                        style={{
                          background: selectedStaff.id === emp.id ? 'rgba(212, 161, 92, 0.12)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'),
                          borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.05))',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleSelectStaffFromDirectory(emp)}
                        title="Click to view/edit this employee in single view"
                      >
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary, #a1a1aa)', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: selectedStaff.id === emp.id ? 'var(--primary, #d4a15c)' : '#f4f4f5' }}>
                          {emp.name}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary, #a1a1aa)' }}>
                          {emp.designation || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {emp.cug_number ? (
                            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{emp.cug_number}</span>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {emp.contact_number ? (
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{emp.contact_number}</span>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {emp.email ? (
                            <span style={{ color: '#34d399', fontSize: '0.78rem' }}>{emp.email}</span>
                          ) : (
                            <span style={{ opacity: 0.35 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--primary, #d4a15c)' }}>
                          {emp.pf_no || emp.pf_number || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#a78bfa' }}>
                          {emp.hrms_id || <span style={{ opacity: 0.35 }}>-</span>}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStaffFromDirectory(emp);
                                setIsEditing(true);
                              }}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.35)',
                                cursor: 'pointer'
                              }}
                              title={`Edit ${emp.name}'s details`}
                            >
                              ✏️ Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {filteredDirectory.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary, #a1a1aa)' }}>
                          No roster employees matched "{searchQuery}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #71717a)' }}>
            Showing records for active Roster Management personnel • Access Level: <strong>{isAdmin ? '👑 Master Admin (Full Edit)' : 'Viewer (Read-Only)'}</strong>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 18px', fontSize: '0.84rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
