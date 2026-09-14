import React, { useState, useEffect } from 'react';

const DAYS_OF_WEEK = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
];

export default function NonDailyTrainModal({
  isOpen,
  onClose,
  trainData,
  initialDay,
  allStaffList,
  restStaffList = [],
  onSaveSuccess,
  authToken,
  API_BASE
}) {
  const [formData, setFormData] = useState({
    day_of_week: 'SUNDAY',
    train_number: '',
    departure_station: '',
    departure_time: '',
    arrival_station: '',
    arrival_time: '',
    coaches: 'SL / AC',
    remarks: '',
    assigned_staff_id: '',
    assigned_staff_name: ''
  });

  const [assignMode, setAssignMode] = useState('REST'); // 'REST', 'LR', 'ALL', 'CUSTOM', 'NONE'
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. LR Staff (Category 4 only, excluding VACANT posts)
  const lrStaffList = (allStaffList || []).filter(s => 
    s.category_id === 4 && 
    (!s.name || !s.name.toUpperCase().includes('VACANT'))
  );
  
  // 2. Other master staff (all staff not in Category 4, excluding VACANT)
  const otherStaffList = (allStaffList || []).filter(s => 
    s.category_id !== 4 && 
    (!s.name || !s.name.toUpperCase().includes('VACANT'))
  );

  useEffect(() => {
    if (trainData) {
      const staffIdStr = trainData.assigned_staff_id ? String(trainData.assigned_staff_id) : '';
      const isRestStaff = restStaffList.some(s => String(s.id || s.staffId) === staffIdStr);
      const isLrStaff = lrStaffList.some(s => String(s.id) === staffIdStr);

      setFormData({
        day_of_week: trainData.day_of_week || initialDay || 'SUNDAY',
        train_number: trainData.train_number || '',
        departure_station: trainData.departure_station || '',
        departure_time: trainData.departure_time || '',
        arrival_station: trainData.arrival_station || '',
        arrival_time: trainData.arrival_time || '',
        coaches: trainData.coaches || 'SL / AC',
        remarks: trainData.remarks || '',
        assigned_staff_id: staffIdStr,
        assigned_staff_name: trainData.assigned_staff_name || ''
      });

      if (isRestStaff) {
        setAssignMode('REST');
      } else if (isLrStaff) {
        setAssignMode('LR');
      } else if (trainData.assigned_staff_name && !staffIdStr) {
        setAssignMode('CUSTOM');
      } else if (staffIdStr) {
        setAssignMode('ALL');
      } else {
        setAssignMode(restStaffList.length > 0 ? 'REST' : 'LR');
      }
    } else {
      setFormData({
        day_of_week: initialDay ? initialDay.toUpperCase() : 'SUNDAY',
        train_number: '',
        departure_station: '',
        departure_time: '',
        arrival_station: '',
        arrival_time: '',
        coaches: 'SL / AC',
        remarks: '',
        assigned_staff_id: '',
        assigned_staff_name: ''
      });
      setAssignMode(restStaffList.length > 0 ? 'REST' : 'LR');
    }
    setErrorMsg('');
  }, [trainData, initialDay, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(trainData && trainData.id);

  const selectStaff = (staff) => {
    if (!staff) {
      setFormData(prev => ({ ...prev, assigned_staff_id: '', assigned_staff_name: '' }));
      return;
    }
    const id = staff.id || staff.staffId;
    setFormData(prev => ({
      ...prev,
      assigned_staff_id: String(id),
      assigned_staff_name: staff.name || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.train_number.trim()) {
      setErrorMsg('Train Number is required');
      return;
    }
    if (!formData.day_of_week) {
      setErrorMsg('Day of the Week is required');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const url = isEditing
        ? `${API_BASE}/non-daily-trains/${trainData.id}`
        : `${API_BASE}/non-daily-trains`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...formData,
          assigned_staff_id: formData.assigned_staff_id ? parseInt(formData.assigned_staff_id, 10) : null,
          assigned_staff_name: formData.assigned_staff_name || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save non-daily train details');
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!window.confirm(`Are you sure you want to delete Train ${trainData.train_number} for ${trainData.day_of_week}?`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/non-daily-trains/${trainData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      onSaveSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '16px',
      overflowY: 'auto'
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content card" style={{
        maxWidth: '640px',
        width: '100%',
        maxHeight: '90vh',
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        overflow: 'hidden',
        border: '1px solid var(--border-gold)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        borderRadius: '16px',
        background: 'var(--bg-secondary)'
      }}>
        {/* Pinned Header */}
        <div style={{
          flexShrink: 0,
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
              {isEditing ? `✏️ Edit Non-Daily Train #${formData.train_number}` : '➕ Add New Non-Daily Train'}
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Configure train timings and assign crew from Weekly Rest or LR Sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1rem',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '0.85rem'
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Day of Week & Train Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Day of Week:</label>
                <select
                  className="form-input"
                  required
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                >
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Train Number:</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 07029, 17231, 02811"
                  value={formData.train_number}
                  onChange={(e) => setFormData({ ...formData, train_number: e.target.value })}
                />
              </div>
            </div>

            {/* Departure Station & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Departure Station:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. GNT, BZA, SC, RU, WADI"
                  value={formData.departure_station}
                  onChange={(e) => setFormData({ ...formData, departure_station: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Departure Time (HH:MM):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 11:05, 13:50, 23:40"
                  value={formData.departure_time}
                  onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                />
              </div>
            </div>

            {/* Arrival Station & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Arrival Station:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CHZ, DMM, SC, RAL, MAS, KPD"
                  value={formData.arrival_station}
                  onChange={(e) => setFormData({ ...formData, arrival_station: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Arrival Time (HH:MM):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 12:40, 20:40, 06:25"
                  value={formData.arrival_time}
                  onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                />
              </div>
            </div>

            {/* Coaches & Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Coaches / Composition:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SL / AC, AC, 2S"
                  value={formData.coaches}
                  onChange={(e) => setFormData({ ...formData, coaches: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Remarks / Notes:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Returns MON, Runs TUE, Special"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>

            {/* CREW / EMPLOYEE ASSIGNMENT SECTION */}
            <div style={{
              background: 'rgba(212, 161, 92, 0.08)',
              border: '1px solid rgba(212, 161, 92, 0.3)',
              borderRadius: '10px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👤 Assign Employee / Relief Crew:</span>
                </div>
                {formData.assigned_staff_name && (
                  <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                    Assigned: {formData.assigned_staff_name}
                  </span>
                )}
              </div>

              {/* Assignment Source Switcher Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {[
                  { id: 'REST', label: `😴 Employees on Rest (${restStaffList.length})`, color: '#60a5fa' },
                  { id: 'LR', label: `📋 LR Sheet Staff (${lrStaffList.length})`, color: '#d4a15c' },
                  { id: 'ALL', label: '🔀 All Master Staff', color: '#c084fc' },
                  { id: 'CUSTOM', label: '✍️ Custom Name', color: '#34d399' },
                  { id: 'NONE', label: '🚫 Unassigned', color: '#9ca3af' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAssignMode(opt.id);
                      if (opt.id === 'NONE') {
                        setFormData(prev => ({ ...prev, assigned_staff_id: '', assigned_staff_name: '' }));
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: assignMode === opt.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: assignMode === opt.id ? 'rgba(212, 161, 92, 0.22)' : 'rgba(255,255,255,0.03)',
                      color: assignMode === opt.id ? 'var(--primary)' : 'var(--color-text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: assignMode === opt.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: FROM STAFF HAVING REST TODAY */}
              {assignMode === 'REST' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
                    Select an Employee currently on Weekly Rest today ({formData.day_of_week}):
                  </label>
                  <select
                    className="form-input"
                    value={formData.assigned_staff_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const staff = restStaffList.find(s => String(s.id || s.staffId) === selectedId);
                      selectStaff(staff);
                    }}
                  >
                    <option value="">-- Choose Employee on Rest today --</option>
                    {restStaffList.map(s => {
                      const id = s.id || s.staffId;
                      const cat = s.categoryName || (s.categoryId === 1 ? 'Conductor' : s.categoryId === 2 ? 'Sleeper' : 'Ladies');
                      return (
                        <option key={id} value={id}>
                          {s.name} ({s.designation || 'Staff'}) — [{cat} - REST]
                        </option>
                      );
                    })}
                  </select>
                  {restStaffList.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '6px 0 0 0' }}>
                      💡 No employees found on fixed rest for this date. You can select from the <strong>LR Sheet Staff</strong> tab above.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: FROM LR SHEET STAFF */}
              {assignMode === 'LR' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
                    Select from Leave Reserve (LR) Roster Pool:
                  </label>
                  <select
                    className="form-input"
                    value={formData.assigned_staff_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const staff = lrStaffList.find(s => String(s.id) === selectedId);
                      selectStaff(staff);
                    }}
                  >
                    <option value="">-- Choose Employee from LR Sheet --</option>
                    {lrStaffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.designation || 'Staff'}) {s.rest_day && s.rest_day !== '-' ? `[Rest: ${s.rest_day}]` : ''} — [LR Row #{s.row_position}]
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '6px 0 0 0' }}>
                    💡 Official Leave Reserve (LR) staff list with designated weekly rest days.
                  </p>
                </div>
              )}

              {/* TAB 3: FROM ALL MASTER STAFF */}
              {assignMode === 'ALL' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
                    Select from All Registered Staff:
                  </label>
                  <select
                    className="form-input"
                    value={formData.assigned_staff_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const staff = (allStaffList || []).find(s => String(s.id) === selectedId);
                      selectStaff(staff);
                    }}
                  >
                    <option value="">-- Choose Employee from Roster --</option>
                    {otherStaffList.map(s => {
                      const catName = s.category_id === 1 ? 'COR' : s.category_id === 2 ? 'Sleeper' : 'Ladies';
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.designation || 'Staff'}) — [{catName} Row #{s.row_position}]
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* TAB 4: CUSTOM VISITING CREW NAME */}
              {assignMode === 'CUSTOM' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
                    Enter Custom Crew / Relief Employee Name:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Visiting Crew / Ad-hoc relief staff"
                    value={formData.assigned_staff_name}
                    onChange={(e) => setFormData({ ...formData, assigned_staff_id: '', assigned_staff_name: e.target.value })}
                  />
                </div>
              )}

              {/* TAB 5: UNASSIGNED */}
              {assignMode === 'NONE' && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', fontStyle: 'italic', padding: '6px 0' }}>
                  This non-daily train will remain unassigned (unmanned / ad-hoc).
                </div>
              )}
            </div>
          </div>

          {/* Pinned Modal Footer */}
          <div style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderTop: '1px solid var(--border-glass)',
            background: 'rgba(12, 12, 16, 0.95)',
            display: 'flex',
            gap: '10px',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {isEditing ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                🗑️ Delete Train
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ minWidth: '140px', padding: '8px 20px', fontWeight: 700 }}
              >
                {saving ? 'Saving...' : isEditing ? 'Update Train' : 'Add Train'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
