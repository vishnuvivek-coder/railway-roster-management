import React, { useState, useEffect, useMemo } from 'react';
import LRList from './LRList';
import { printElement, downloadPdfFromElement } from './printUtils';

const MUSTER_CODES = [
  { code: 'P', label: 'Present / Regular / Outstation Duty', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
  { code: 'OD', label: 'On Duty (Official / Special Duty)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.4)' },
  { code: 'R', label: 'Weekly Rest', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.3)' },
  { code: 'O', label: 'Absent (Not Attended Duty)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
  { code: 'E', label: 'Emergency / Extra Duty', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' },
  { code: 'CR', label: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.4)' },
  { code: 'CL', label: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' },
  { code: 'CCL', label: 'Child Care / Comp Leave', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)' },
  { code: 'SCL', label: 'Special Casual Leave', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.35)' },
  { code: 'LAP', label: 'Leave on Average Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' },
  { code: 'LHAP', label: 'Leave on Half Avg Pay', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)' },
  { code: 'SICK', label: 'Sick / Medical Leave', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.4)' },
  { code: 'NH', label: 'National Holiday', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' }
];

const CODE_MAP = {};
MUSTER_CODES.forEach(c => { CODE_MAP[c.code] = c; });

export default function MusterRoll({ isAdmin, categories = [], authToken, API_BASE = '/api', initialTab = 'wage-period' }) {
  const [musterTab, setMusterTab] = useState(initialTab);
  const [cycleData, setCycleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCycleStart, setSelectedCycleStart] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active cell edit modal
  const [activeCellModal, setActiveCellModal] = useState(null);
  const [cellRemarks, setCellRemarks] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [rangeEditModal, setRangeEditModal] = useState(null);

  // Select Employee & Edit Muster Details state
  const [selectedStaffIdForEdit, setSelectedStaffIdForEdit] = useState('');
  const [staffRangeFromDate, setStaffRangeFromDate] = useState('');
  const [staffRangeToDate, setStaffRangeToDate] = useState('');
  const [staffRangeCode, setStaffRangeCode] = useState('P');
  const [staffRangeRemarks, setStaffRangeRemarks] = useState('');
  const [savingStaffRange, setSavingStaffRange] = useState(false);
  const [filterOnlySelectedStaff, setFilterOnlySelectedStaff] = useState(false);

  // Name, Designation & HRMS ID editing state
  const [editNameModal, setEditNameModal] = useState(null);
  const [editDesgModal, setEditDesgModal] = useState(null);
  const [customDesgInput, setCustomDesgInput] = useState('');
  const [editingHrmsId, setEditingHrmsId] = useState(null);
  const [hrmsInputVal, setHrmsInputVal] = useState('');
  const [savingStaffField, setSavingStaffField] = useState(false);

  // Drag & Drop reordering state for the combined 3 columns
  const [draggedStaffId, setDraggedStaffId] = useState(null);
  const [dragOverStaffId, setDragOverStaffId] = useState(null);
  const [dragOverPos, setDragOverPos] = useState(null); // 'above' | 'below'
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleDragStart = (e, staff, index) => {
    if (!isAdmin) return;
    setDraggedStaffId(staff.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: staff.id, index }));
  };

  const handleDragOverRow = (e, staff, index) => {
    if (!isAdmin || !draggedStaffId || draggedStaffId === staff.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';

    if (dragOverStaffId !== staff.id || dragOverPos !== pos) {
      setDragOverStaffId(staff.id);
      setDragOverPos(pos);
    }
  };

  const handleDragLeaveRow = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverStaffId(null);
    setDragOverPos(null);
  };

  const handleDropRow = async (e, targetStaff, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceId = draggedStaffId;
    const pos = dragOverPos;
    setDraggedStaffId(null);
    setDragOverStaffId(null);
    setDragOverPos(null);

    if (!isAdmin || !sourceId || sourceId === targetStaff.id) return;
    if (!cycleData || !cycleData.staff) return;

    const currentList = [...cycleData.staff];
    const fromIdx = currentList.findIndex(s => s.id === sourceId);
    if (fromIdx === -1) return;

    const [movedItem] = currentList.splice(fromIdx, 1);
    const targetIdxAfterSplice = currentList.findIndex(s => s.id === targetStaff.id);
    if (targetIdxAfterSplice === -1) return;

    const insertIdx = pos === 'below' ? targetIdxAfterSplice + 1 : targetIdxAfterSplice;
    currentList.splice(insertIdx, 0, movedItem);

    // Optimistically update list in state
    setCycleData(prev => ({
      ...prev,
      staff: currentList
    }));

    showToast(`✓ Moved "${movedItem.name}" to position #${insertIdx + 1}`);

    // Persist new ordering to backend database
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const staffIds = currentList.map(s => s.id);
      const res = await fetch('/api/muster/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ staff_ids: staffIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to persist order');
    } catch (err) {
      console.error('Failed to reorder staff in database:', err);
      showToast('⚠️ Could not save new order: ' + err.message);
    }
  };

  // Generate available cycles for quick jump (last 6 months to next 3 months)
  const availableCycles = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let offset = -6; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 11);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const startStr = `${y}-${m}-11`;
      
      const nextM = new Date(y, d.getMonth() + 1, 10);
      const nextY = nextM.getFullYear();
      const nextMonthShort = nextM.toLocaleString('default', { month: 'short' });
      const curMonthShort = d.toLocaleString('default', { month: 'short' });
      
      list.push({
        value: startStr,
        label: `${curMonthShort} 11 - ${nextMonthShort} 10, ${nextY}`
      });
    }
    return list;
  }, []);

  const fetchMuster = async (cycleStart = selectedCycleStart) => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/muster?';
      if (cycleStart) url += 'cycle_start=' + encodeURIComponent(cycleStart) + '&';
      if (selectedCategory && selectedCategory !== 'ALL') url += 'category_id=' + encodeURIComponent(selectedCategory) + '&';

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch muster roll data');
      }
      setCycleData(data);
      if (!selectedCycleStart && data.cycle && data.cycle.startDateStr) {
        setSelectedCycleStart(data.cycle.startDateStr);
      }
    } catch (err) {
      console.error('Error loading muster roll:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuster(selectedCycleStart);
  }, [selectedCycleStart, selectedCategory]);

  // Real-time synchronization across all tabs and sheets
  useEffect(() => {
    const handleRosterUpdate = (e) => {
      if (e.detail && e.detail.source === 'muster_roll') return;
      fetchMuster(selectedCycleStart);
    };
    window.addEventListener('railway_roster_data_updated', handleRosterUpdate);
    return () => window.removeEventListener('railway_roster_data_updated', handleRosterUpdate);
  }, [selectedCycleStart, selectedCategory]);

  const handleUpdateCode = async (staffId, dateStr, newCode, remarks = '') => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch('/api/muster/update-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: dateStr,
          code: newCode,
          remarks
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update muster code');

      setCycleData(prev => {
        if (!prev) return prev;
        const newStaff = prev.staff.map(s => {
          if (s.id !== staffId) return s;
          const oldCode = (s.days[dateStr] && s.days[dateStr].code) || 'P';
          const newCounts = { ...s.counts };
          if (newCounts[oldCode] !== undefined && newCounts[oldCode] > 0) newCounts[oldCode]--;
          if (newCounts[newCode] !== undefined) newCounts[newCode]++;
          
          newCounts.totalLeaves = (newCounts.CL || 0) + (newCounts.CCL || 0) + (newCounts.SCL || 0) + (newCounts.LAP || 0) + (newCounts.LHAP || 0) + (newCounts.NH || 0);

          return {
            ...s,
            counts: newCounts,
            days: {
              ...s.days,
              [dateStr]: {
                code: newCode,
                isManual: true,
                remarks
              }
            }
          };
        });

        return { ...prev, staff: newStaff };
      });

      setActiveCellModal(null);
      showToast('✅ Attendance code saved permanently to database');
      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId, date: dateStr, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      alert('Error updating muster code: ' + err.message);
    } finally {
      setSavingCell(false);
    }
  };

  const handleResetCell = async (staffId, dateStr) => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch('/api/muster/reset-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ staff_id: staffId, date: dateStr })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset cell');

      setActiveCellModal(null);
      showToast('🔄 Cell reset and saved permanently to database');
      await fetchMuster(selectedCycleStart);
      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId, date: dateStr, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      alert('Error resetting cell: ' + err.message);
    } finally {
      setSavingCell(false);
    }
  };

  const handleBatchUpdateMuster = async (staffId, fromDate, toDate, code, remarks = '') => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');

      const dates = [];
      let curr = new Date(fromDate + 'T12:00:00');
      const end = new Date(toDate + 'T12:00:00');
      while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
      }

      if (dates.length === 0) {
        showToast('⚠️ No valid dates in selected range');
        return;
      }

      const updates = dates.map(d => ({
        staff_id: staffId,
        date: d,
        code,
        remarks: remarks.trim() || undefined
      }));

      const res = await fetch('/api/muster/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ updates })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update muster range');

      setRangeEditModal(null);
      await fetchMuster(selectedCycleStart);
      showToast(`✓ Updated ${dates.length} days (${fromDate} to ${toDate}) to ${code}`);

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId, dates, source: 'muster_roll', timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId, dates, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      console.error('Batch muster update error:', err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSavingCell(false);
    }
  };

  const handleBatchResetMuster = async (staffId, fromDate, toDate) => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');

      const dates = [];
      let curr = new Date(fromDate + 'T12:00:00');
      const end = new Date(toDate + 'T12:00:00');
      while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
      }

      if (dates.length === 0) return;

      const resets = dates.map(d => ({ staff_id: staffId, date: d }));

      const res = await fetch('/api/muster/batch-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ resets })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset muster cells');

      setRangeEditModal(null);
      await fetchMuster(selectedCycleStart);
      showToast(`✓ Reset ${dates.length} days back to baseline`);

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId, dates, source: 'muster_roll', timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId, dates, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      console.error('Batch reset error:', err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSavingCell(false);
    }
  };

  const handleSaveStaffField = async (staffId, updates) => {
    try {
      setSavingStaffField(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee details');

      // Optimistically update cycleData.staff
      setCycleData(prev => {
        if (!prev || !prev.staff) return prev;
        const newStaff = prev.staff.map(s => {
          if (s.id !== staffId) return s;
          return {
            ...s,
            ...(updates.name !== undefined ? { name: updates.name } : {}),
            ...(updates.pf_no !== undefined ? { pf_no: updates.pf_no } : {}),
            ...(updates.designation !== undefined ? { designation: updates.designation } : {}),
            ...(updates.hrms_id !== undefined ? { hrms_id: updates.hrms_id } : {})
          };
        });
        return { ...prev, staff: newStaff };
      });

      setEditNameModal(null);
      setEditDesgModal(null);
      setEditingHrmsId(null);
      showToast(`✓ Updated employee details`);
    } catch (err) {
      alert('Error updating employee details: ' + err.message);
    } finally {
      setSavingStaffField(false);
    }
  };

  // Sync date boundaries when cycle loads
  useEffect(() => {
    if (cycleData && cycleData.cycle && cycleData.cycle.dates && cycleData.cycle.dates.length > 0) {
      const fDate = cycleData.cycle.dates[0].dateStr;
      const lDate = cycleData.cycle.dates[cycleData.cycle.dates.length - 1].dateStr;
      if (!staffRangeFromDate) setStaffRangeFromDate(fDate);
      if (!staffRangeToDate) setStaffRangeToDate(lDate);
    }
  }, [cycleData]);

  // Handler: Selecting staff for editing
  const handleSelectStaffForEdit = (staffId) => {
    setSelectedStaffIdForEdit(staffId);
    if (!staffId) return;
    const dates = cycleData?.cycle?.dates || [];
    const fDate = dates.length > 0 ? dates[0].dateStr : '';
    const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : '';
    setStaffRangeFromDate(fDate);
    setStaffRangeToDate(lDate);
    setStaffRangeCode('P');
    setStaffRangeRemarks('');
  };

  const selectedStaffObj = useMemo(() => {
    if (!cycleData || !cycleData.staff || !selectedStaffIdForEdit) return null;
    return cycleData.staff.find(s => s.id === parseInt(selectedStaffIdForEdit, 10)) || null;
  }, [cycleData, selectedStaffIdForEdit]);

  const staffRangeDatesList = useMemo(() => {
    if (!staffRangeFromDate || !staffRangeToDate || staffRangeFromDate > staffRangeToDate) return [];
    const list = [];
    let curr = new Date(staffRangeFromDate + 'T12:00:00');
    const end = new Date(staffRangeToDate + 'T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [staffRangeFromDate, staffRangeToDate]);

  const handleApplyStaffBatchRange = async () => {
    if (!selectedStaffIdForEdit) {
      showToast('⚠️ Please select an employee first');
      return;
    }
    if (!staffRangeFromDate || !staffRangeToDate || staffRangeFromDate > staffRangeToDate) {
      showToast('⚠️ Please select a valid From Date and Upto Date');
      return;
    }
    if (staffRangeDatesList.length === 0) return;

    try {
      setSavingStaffRange(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const updates = staffRangeDatesList.map(d => ({
        staff_id: parseInt(selectedStaffIdForEdit, 10),
        date: d,
        code: staffRangeCode,
        remarks: staffRangeRemarks.trim() || undefined
      }));

      const res = await fetch('/api/muster/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ updates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update muster records');

      await fetchMuster(selectedCycleStart);
      showToast(`✓ Successfully updated ${staffRangeDatesList.length} days (${staffRangeFromDate} to ${staffRangeToDate}) to "${staffRangeCode}" for ${selectedStaffObj?.name || 'employee'}!`);

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffIdForEdit, dates: staffRangeDatesList, source: 'muster_roll', timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffIdForEdit, dates: staffRangeDatesList, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      console.error('Batch muster update error:', err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSavingStaffRange(false);
    }
  };

  const handleResetStaffBatchRange = async () => {
    if (!selectedStaffIdForEdit || staffRangeDatesList.length === 0) return;
    if (!window.confirm(`Reset ${staffRangeDatesList.length} days to default baseline cyclic duty for ${selectedStaffObj?.name}?`)) {
      return;
    }

    try {
      setSavingStaffRange(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const resets = staffRangeDatesList.map(d => ({
        staff_id: parseInt(selectedStaffIdForEdit, 10),
        date: d
      }));

      const res = await fetch('/api/muster/batch-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ resets })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset muster cells');

      await fetchMuster(selectedCycleStart);
      showToast(`✓ Successfully reset ${staffRangeDatesList.length} days to cyclic baseline for ${selectedStaffObj?.name}!`);

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffIdForEdit, dates: staffRangeDatesList, source: 'muster_roll', timestamp: Date.now() }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffIdForEdit, dates: staffRangeDatesList, source: 'muster_roll', timestamp: Date.now() }
      }));
    } catch (err) {
      console.error('Batch muster reset error:', err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setSavingStaffRange(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!cycleData || !cycleData.staff) return [];
    let list = cycleData.staff;
    if (filterOnlySelectedStaff && selectedStaffIdForEdit) {
      list = list.filter(s => s.id === parseInt(selectedStaffIdForEdit, 10));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.pf_no && s.pf_no.toLowerCase().includes(q)) ||
      (s.hrms_id && s.hrms_id.toLowerCase().includes(q)) ||
      (s.designation && s.designation.toLowerCase().includes(q)) ||
      (s.categoryName && s.categoryName.toLowerCase().includes(q))
    );
  }, [cycleData, searchQuery, selectedStaffIdForEdit, filterOnlySelectedStaff]);

  const handleExportCSV = () => {
    if (!cycleData || !cycleData.cycle || !cycleData.cycle.dates || !filteredStaff.length) return;

    const headers = [
      'S.No',
      'Name of Employee',
      'PF No',
      'Designation',
      'HRMS ID',
      'Category',
      ...cycleData.cycle.dates.map(d => `${d.dayNumber} (${d.dayOfWeek})`),
      'P (Present / Outstation Duty)',
      'R (Rest)',
      'O (Absent)',
      'E (Emergency)',
      'CR',
      'CL',
      'CCL',
      'SCL',
      'LAP',
      'LHAP',
      'NH',
      'Total Leaves',
      'Total Days'
    ];

    const rows = filteredStaff.map((s, idx) => [
      idx + 1,
      '"' + s.name + '"',
      '"' + (s.pf_no || '') + '"',
      '"' + (s.designation || '-') + '"',
      '"' + (s.hrms_id || '-') + '"',
      '"' + (s.categoryName || '-') + '"',
      ...cycleData.cycle.dates.map(d => (s.days[d.dateStr] && s.days[d.dateStr].code) || 'P'),
      s.counts.P,
      s.counts.R,
      s.counts.O,
      s.counts.E,
      s.counts.CR,
      s.counts.CL,
      s.counts.CCL,
      s.counts.SCL,
      s.counts.LAP,
      s.counts.LHAP,
      s.counts.NH || 0,
      s.counts.totalLeaves,
      s.counts.totalDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Railway_Muster_Roll_' + cycleData.cycle.periodLabel.replace(/[\s,]+/g, '_') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    showToast('⏳ Generating and downloading Muster Roll PDF...');
    try {
      await downloadPdfFromElement('.muster-roll-container', `Railway_Muster_Roll_${cycleData?.cycle?.periodLabel?.replace(/[\s,]+/g, '_') || 'Sheet'}`, {
        orientation: 'landscape',
        format: 'a3',
        margin: [4, 4, 4, 4]
      });
      showToast('✅ Muster Roll PDF downloaded successfully!');
    } catch (err) {
      console.error(err);
      showToast('⚠️ PDF generation failed, opened print window instead.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="muster-roll-container" style={{ padding: '4px 0 40px 0' }}>
      {/* Muster Roll vs LR List Navigation Tabs */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '6px 8px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid var(--border-glass)',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setMusterTab('wage-period')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            border: musterTab === 'wage-period' ? '1.5px solid var(--border-gold)' : '1px solid transparent',
            background: musterTab === 'wage-period' ? 'linear-gradient(135deg, rgba(212, 161, 92, 0.22), rgba(212, 161, 92, 0.08))' : 'transparent',
            color: musterTab === 'wage-period' ? 'var(--primary)' : 'var(--color-text-secondary)',
            boxShadow: musterTab === 'wage-period' ? '0 4px 14px rgba(212, 161, 92, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📅</span> Muster Roll (11th – 10th Wage Period)
        </button>
        <button
          type="button"
          onClick={() => setMusterTab('lr-list')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            border: musterTab === 'lr-list' ? '1.5px solid var(--border-gold)' : '1px solid transparent',
            background: musterTab === 'lr-list' ? 'linear-gradient(135deg, rgba(212, 161, 92, 0.22), rgba(212, 161, 92, 0.08))' : 'transparent',
            color: musterTab === 'lr-list' ? 'var(--primary)' : 'var(--color-text-secondary)',
            boxShadow: musterTab === 'lr-list' ? '0 4px 14px rgba(212, 161, 92, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📋</span> LR List (Monthly Leave Reserve Sheet)
        </button>
      </div>

      {musterTab === 'lr-list' && (
        <LRList isAdmin={isAdmin} authToken={authToken} API_BASE={API_BASE} />
      )}

      {musterTab === 'wage-period' && (
        <>
      {/* 1. Header Card */}
      <div className="card no-print" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '20px',
        border: '1.5px solid var(--border-gold)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                📅 Railway Attendance & Muster Roll
              </h2>
              <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.18)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.82rem', border: '1px solid var(--border-gold)' }}>
                Wage Period Cycle: 11th - 10th
              </span>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', fontWeight: 800, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                ✅ Auto-Save Active (Instant Database Sync)
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
              Monthly attendance register running continuously from the 11th of the current month to the 10th of the following month. All code updates and edits save automatically in real time.
            </p>
          </div>

          {/* Action Buttons: Print & Export */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                cursor: 'pointer'
              }}
            >
              📥 Export CSV / Excel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await fetchMuster(selectedCycleStart);
                showToast('✅ All attendance codes, remarks, and employee edits are saved permanently in the database.');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Verify and save all muster attendance codes to database"
            >
              💾 Save Muster
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Print formatted Muster Roll"
            >
              🖨️ Print
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Directly download Muster Roll PDF"
            >
              {downloadingPdf ? '⏳ Generating PDF...' : '📄 Download PDF'}
            </button>
          </div>
        </div>

        <hr style={{ margin: '18px 0', borderColor: 'var(--border-glass)' }} />

        {/* Cycle Navigation & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Cycle Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cycleData && cycleData.cycle && cycleData.cycle.prevCycleStart && setSelectedCycleStart(cycleData.cycle.prevCycleStart)}
              disabled={loading || !cycleData || !cycleData.cycle || !cycleData.cycle.prevCycleStart}
              style={{ padding: '6px 12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px' }}
              title="Previous Wage Cycle"
            >
              ◀ Previous Cycle
            </button>

            <div style={{
              background: 'rgba(212, 161, 92, 0.12)',
              border: '1px solid var(--border-gold)',
              padding: '6px 16px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: 'var(--primary)',
              minWidth: '220px',
              textAlign: 'center'
            }}>
              📅 {(cycleData && cycleData.cycle && cycleData.cycle.periodLabel) || 'Loading Cycle...'}
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                ({(cycleData && cycleData.cycle && cycleData.cycle.totalDays) || 0} Days)
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cycleData && cycleData.cycle && cycleData.cycle.nextCycleStart && setSelectedCycleStart(cycleData.cycle.nextCycleStart)}
              disabled={loading || !cycleData || !cycleData.cycle || !cycleData.cycle.nextCycleStart}
              style={{ padding: '6px 12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px' }}
              title="Next Wage Cycle"
            >
              Next Cycle ▶
            </button>

            {/* Quick Cycle Dropdown */}
            <select
              className="form-input"
              value={selectedCycleStart || (cycleData && cycleData.cycle && cycleData.cycle.startDateStr) || ''}
              onChange={(e) => setSelectedCycleStart(e.target.value)}
              style={{
                width: 'auto',
                fontSize: '0.84rem',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'var(--bg-card)'
              }}
            >
              {availableCycles.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search employee name, desg..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingRight: searchQuery ? '32px' : '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                fontSize: '0.84rem',
                borderRadius: '8px'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {searchQuery && filteredStaff.length > 0 && isAdmin && (
            <button
              type="button"
              className="no-print"
              onClick={() => {
                const target = filteredStaff[0];
                const dates = cycleData?.cycle?.dates || [];
                const fDate = dates.length > 0 ? dates[0].dateStr : '';
                const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : '';
                setRangeEditModal({
                  staffId: target.id,
                  staffName: target.name,
                  designation: target.designation,
                  fromDate: fDate,
                  toDate: lDate,
                  code: 'P',
                  remarks: ''
                });
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.25), rgba(212, 161, 92, 0.45))',
                border: '1.5px solid var(--border-gold)',
                color: 'var(--primary)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
              title={`Edit date range (From - Upto) for ${filteredStaff[0].name}`}
            >
              <span>⚡ Range Edit: {filteredStaff[0].name.split(' ')[0]}</span>
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginRight: '4px' }}>
            Category:
          </span>
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: '1', label: 'Conductors (COR)' },
            { id: '2', label: 'TTI / Sleeper Staff' },
            { id: '3', label: 'Ladies Staff / TTE' },
            { id: '4', label: '📋 Leave Reserve (LR)' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: selectedCategory === cat.id ? 800 : 500,
                background: selectedCategory === cat.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: selectedCategory === cat.id ? '#000' : 'var(--color-text-secondary)',
                border: selectedCategory === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Muster Code Color Legend */}
        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          fontSize: '0.78rem'
        }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>Muster Codes:</span>
          {MUSTER_CODES.map(c => (
            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                background: c.bg,
                color: c.color,
                border: '1px solid ' + c.border,
                fontWeight: 800,
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '4px',
                minWidth: '22px',
                textAlign: 'center'
              }}>
                {c.code}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2b. Select Employee & Edit Muster Details (From & Upto Date) Panel */}
      {isAdmin && cycleData && cycleData.staff && cycleData.staff.length > 0 && (
        <div className="no-print card" style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(39, 39, 42, 0.95))',
          border: '1.5px solid var(--border-gold)',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
        }}>
          {/* Header row with Employee Selector Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: selectedStaffObj ? '14px' : '0',
            borderBottom: selectedStaffObj ? '1px solid rgba(255,255,255,0.08)' : 'none',
            paddingBottom: selectedStaffObj ? '12px' : '0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
              <span style={{ fontSize: '1.3rem' }}>👤</span>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.3px', margin: 0 }}>
                    SELECT ONE EMPLOYEE TO EDIT MUSTER DETAILS:
                  </label>
                  {selectedStaffObj && (
                    <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>
                      ✓ Employee Selected
                    </span>
                  )}
                </div>
                <select
                  className="form-input"
                  value={selectedStaffIdForEdit || ''}
                  onChange={(e) => handleSelectStaffForEdit(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '0.88rem',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#09090b',
                    border: '1.5px solid rgba(212, 161, 92, 0.5)',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Choose Employee ({cycleData.staff.length} Employees Available in This Cycle) --</option>
                  {cycleData.staff.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      #{idx + 1} - {s.name} ({s.designation || 'Staff'}) {s.pf_no ? `[PF: ${s.pf_no}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedStaffObj && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setFilterOnlySelectedStaff(!filterOnlySelectedStaff)}
                  style={{
                    background: filterOnlySelectedStaff ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                    color: filterOnlySelectedStaff ? '#000000' : '#e2e8f0',
                    border: '1px solid ' + (filterOnlySelectedStaff ? 'var(--primary)' : 'rgba(255,255,255,0.2)'),
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title={filterOnlySelectedStaff ? "Show all employees in grid" : "Filter grid below to show only this employee"}
                >
                  <span>{filterOnlySelectedStaff ? '👁️ Showing Only This Employee' : '🔍 View Only This Employee in Grid'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStaffIdForEdit('')}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* Expanded Date-Wise Muster Range Editor for the Selected Employee */}
          {selectedStaffObj && (
            <div>
              {/* Employee Summary Card */}
              <div style={{
                background: 'rgba(212, 161, 92, 0.08)',
                border: '1px solid rgba(212, 161, 92, 0.25)',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block' }}>Editing Muster Details For:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>{selectedStaffObj.name}</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--primary)', marginLeft: '10px', fontWeight: 600 }}>
                    {selectedStaffObj.designation || 'Staff'} (Commercial)
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', gap: '14px' }}>
                  <span>PF NO: <strong style={{ color: '#fff' }}>{selectedStaffObj.pf_no || '-'}</strong></span>
                  <span>Present (P): <strong style={{ color: '#10b981' }}>{selectedStaffObj.counts?.P || 0}</strong></span>
                  <span>Rest (R): <strong style={{ color: '#9ca3af' }}>{selectedStaffObj.counts?.R || 0}</strong></span>
                  <span>Leaves: <strong style={{ color: '#f59e0b' }}>{selectedStaffObj.counts?.totalLeaves || 0}</strong></span>
                </div>
              </div>

              {/* Date Pickers & Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '4px' }}>
                    From Date:
                  </label>
                  <input
                    type="date"
                    value={staffRangeFromDate}
                    onChange={(e) => setStaffRangeFromDate(e.target.value)}
                    style={{
                      background: '#09090b',
                      border: '1.5px solid rgba(212, 161, 92, 0.5)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '4px' }}>
                    Upto Date:
                  </label>
                  <input
                    type="date"
                    value={staffRangeToDate}
                    onChange={(e) => setStaffRangeToDate(e.target.value)}
                    style={{
                      background: '#09090b',
                      border: '1.5px solid rgba(212, 161, 92, 0.5)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Quick Range Presets:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(() => {
                      const dates = cycleData?.cycle?.dates || [];
                      const fDate = dates.length > 0 ? dates[0].dateStr : '';
                      const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : '';
                      const midDate = dates.length > 15 ? dates[14].dateStr : '';
                      const nextMid = dates.length > 15 ? dates[15].dateStr : '';
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => { setStaffRangeFromDate(fDate); setStaffRangeToDate(lDate); }}
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#e2e8f0',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            📅 Full Cycle (11th - 10th)
                          </button>
                          {midDate && (
                            <button
                              type="button"
                              onClick={() => { setStaffRangeFromDate(fDate); setStaffRangeToDate(midDate); }}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#e2e8f0',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              1️⃣ 11th to 25th
                            </button>
                          )}
                          {nextMid && (
                            <button
                              type="button"
                              onClick={() => { setStaffRangeFromDate(nextMid); setStaffRangeToDate(lDate); }}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#e2e8f0',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              2️⃣ 26th to 10th
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (dates.length >= 7) {
                                setStaffRangeFromDate(fDate);
                                setStaffRangeToDate(dates[6].dateStr);
                              }
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#e2e8f0',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            7️⃣ First 7 Days
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Attendance Code Selection */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                    Select Attendance Code to Apply:
                  </label>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                    Active: <strong style={{ color: 'var(--primary)' }}>{staffRangeCode}</strong> ({MUSTER_CODES.find(o => o.code === staffRangeCode)?.label || staffRangeCode})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  {MUSTER_CODES.map(c => {
                    const isSelected = staffRangeCode === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setStaffRangeCode(c.code)}
                        style={{
                          background: isSelected ? c.color : 'rgba(255,255,255,0.06)',
                          color: isSelected ? '#ffffff' : c.color,
                          border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.14)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSelected ? `0 0 12px ${c.color}80` : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.92rem' }}>{c.code}</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.9, fontWeight: 500 }}>
                          {c.code === 'P' ? 'Duty' : c.code === 'R' ? 'Rest' : c.code === 'O' ? 'Absent' : c.code === 'E' ? 'Emerg' : c.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Remarks and Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <input
                    type="text"
                    placeholder="Remarks / Reason (Optional - e.g. Approved leave, Sick memo, Spl order)"
                    value={staffRangeRemarks}
                    onChange={(e) => setStaffRangeRemarks(e.target.value)}
                    style={{
                      background: '#09090b',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      width: '100%'
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingStaffRange || staffRangeDatesList.length === 0}
                  onClick={handleApplyStaffBatchRange}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    fontWeight: 800,
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: (savingStaffRange || staffRangeDatesList.length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                    fontSize: '0.9rem'
                  }}
                >
                  {savingStaffRange ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      <span>Saving {staffRangeDatesList.length} Days...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Apply & Save to Selected Dates ({staffRangeDatesList.length} {staffRangeDatesList.length === 1 ? 'Day' : 'Days'})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingStaffRange || staffRangeDatesList.length === 0}
                  onClick={handleResetStaffBatchRange}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: (savingStaffRange || staffRangeDatesList.length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="Reset selected dates back to cyclic link duty"
                >
                  <span>↺ Reset Range to Baseline</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Loading / Error States */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto', width: '36px', height: '36px' }}></div>
          <strong>Generating Railway Muster Roll ({(cycleData && cycleData.cycle && cycleData.cycle.periodLabel) || 'Wage Cycle'})...</strong>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Main Master Muster Grid */}
      {!loading && !error && cycleData && (
        <div className="muster-grid-wrapper">
          {/* Print-Only Title Header */}
          <div className="print-only muster-print-title-banner">
            <div className="muster-print-railway">SOUTH CENTRAL RAILWAY — GUNTUR DIVISION</div>
            <div className="muster-print-period">
              STAFF ATTENDANCE & MUSTER ROLL — {cycleData.cycle?.periodLabel || 'WAGE PERIOD'}
            </div>
          </div>

          <div className="card muster-card" style={{
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-glass)',
            overflow: 'hidden'
          }}>
            <div className="muster-table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxHeight: '72vh' }}>
              <table className="roster-table muster-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>
                  {/* Top Row: Headers */}
                  <tr>
                    <th className="muster-col-sno" title={isAdmin ? "Drag rows to reorder employees" : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        {isAdmin && <span className="no-print muster-drag-handle" style={{ fontSize: '0.75rem', opacity: 0.7 }} title="Drag rows to reorder">⠿</span>}
                        <span>S.No</span>
                      </div>
                    </th>
                    <th className="muster-col-name" title={isAdmin ? "Click any name or ✏️ to edit Name / PF No" : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Name of Employee</span>
                        {isAdmin && <span className="no-print muster-edit-pencil" style={{ fontSize: '0.7rem', opacity: 0.8, color: 'var(--primary)' }}>✏️</span>}
                      </div>
                    </th>
                    <th className="muster-col-desg" title={isAdmin ? "Click on any employee's designation to edit" : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span>Designation</span>
                        {isAdmin && <span className="no-print muster-edit-pencil" style={{ fontSize: '0.7rem', opacity: 0.8, color: 'var(--primary)' }}>✏️</span>}
                      </div>
                    </th>
                    <th className="muster-col-hrms" title={isAdmin ? "Click on any employee's HRMS ID to edit" : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span>HRMS ID</span>
                        {isAdmin && <span className="no-print muster-edit-pencil" style={{ fontSize: '0.7rem', opacity: 0.8, color: 'var(--primary)' }}>✏️</span>}
                      </div>
                    </th>

                  {/* Day Date Headers */}
                  {cycleData.cycle.dates.map(d => (
                    <th
                      key={d.dateStr}
                      style={{
                        width: '38px',
                        minWidth: '38px',
                        maxWidth: '42px',
                        textAlign: 'center',
                        padding: '6px 2px',
                        background: d.isSunday ? 'rgba(239, 68, 68, 0.12)' : '#18181b',
                        color: d.isSunday ? '#f87171' : 'inherit',
                        borderBottom: '2px solid var(--border-gold)'
                      }}
                    >
                      <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{d.dayNumber}</div>
                      <div style={{ fontSize: '0.64rem', color: d.isSunday ? '#fca5a5' : 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        {d.dayOfWeek}
                      </div>
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: 800 }} title="Present / Regular / Outstation Duty (P)">P</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(156, 163, 175, 0.12)', color: '#d1d5db', fontWeight: 800 }} title="Weekly Rest (R)">R</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 800 }} title="Absent / Not Attended Duty (O)">O</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', fontWeight: 800 }} title="Emergency Duty (E)">E</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(139, 92, 246, 0.12)', color: '#c4b5fd', fontWeight: 800 }} title="Compensatory Rest (CR)">CR</th>
                  <th style={{ width: '48px', textAlign: 'center', background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185', fontWeight: 800 }} title="Approved Leaves (CL, CCL, SCL, LAP, LHAP, NH)">Leaves</th>
                  <th style={{ width: '50px', textAlign: 'center', background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', fontWeight: 800 }}>Total</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((staff, sIdx) => {
                  const isDraggingThis = draggedStaffId === staff.id;
                  const isDragOverThis = dragOverStaffId === staff.id;
                  const dragClass = isDraggingThis
                    ? 'muster-row-dragging'
                    : isDragOverThis
                    ? dragOverPos === 'above'
                      ? 'muster-row-drag-over-above'
                      : 'muster-row-drag-over-below'
                    : '';

                  return (
                    <tr
                      key={staff.id}
                      draggable={isAdmin}
                      onDragStart={(e) => handleDragStart(e, staff, sIdx)}
                      onDragOver={(e) => handleDragOverRow(e, staff, sIdx)}
                      onDragLeave={handleDragLeaveRow}
                      onDrop={(e) => handleDropRow(e, staff, sIdx)}
                      className={`muster-row-draggable ${dragClass}`}
                      style={{
                        borderBottom: '1px solid var(--border-glass)',
                        background: selectedStaffIdForEdit === staff.id ? 'rgba(212, 161, 92, 0.08)' : undefined
                      }}
                    >
                      {/* Fixed Left S.No with Drag Grip */}
                      <td className="muster-col-sno" style={{ userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                          {isAdmin && (
                            <span
                              className="no-print muster-drag-handle"
                              title="Drag to reorder employee row (all 3 columns combinedly)"
                              style={{ cursor: 'grab', fontSize: '0.85rem' }}
                            >
                              ⠿
                            </span>
                          )}
                          <span>{sIdx + 1}</span>
                        </div>
                      </td>

                      {/* Fixed Left Name with PF NO below - Editable */}
                      <td
                        className="muster-col-name muster-editable-hover"
                        onClick={() => {
                          if (isAdmin) {
                            setEditNameModal({
                              staffId: staff.id,
                              name: staff.name,
                              pfNo: staff.pf_no || ''
                            });
                          }
                        }}
                        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                        title={isAdmin ? `Click to edit Name / PF NO for ${staff.name}` : undefined}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <strong style={{ fontSize: '0.84rem', color: '#f8fafc' }} className="muster-print-name">
                                {staff.name}
                              </strong>
                              {isAdmin && (
                                <span className="no-print muster-edit-pencil" style={{ fontSize: '0.62rem', opacity: 0.6 }} title="Edit Name & PF">
                                  ✏️
                                </span>
                              )}
                            </div>
                            <span className="muster-print-pf" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', letterSpacing: '0.3px', marginTop: '1px' }}>
                              PF NO: {staff.pf_no || '-'}
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStaffForEdit(staff.id);
                                const dates = cycleData?.cycle?.dates || [];
                                const fDate = dates.length > 0 ? dates[0].dateStr : '';
                                const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : '';
                                setRangeEditModal({
                                  staffId: staff.id,
                                  staffName: staff.name,
                                  designation: staff.designation,
                                  fromDate: fDate,
                                  toDate: lDate,
                                  code: 'P',
                                  remarks: ''
                                });
                              }}
                              style={{
                                background: selectedStaffIdForEdit === staff.id ? 'var(--primary)' : 'rgba(212, 161, 92, 0.22)',
                                border: '1px solid var(--border-gold)',
                                color: selectedStaffIdForEdit === staff.id ? '#000000' : 'var(--primary)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                              }}
                              title={`Select ${staff.name} and edit muster details date-wise`}
                            >
                              <span>⚡</span>
                              <span>Edit Muster</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Fixed Left Designation - Editable */}
                      <td
                        className="muster-col-desg muster-editable-hover"
                        onClick={() => {
                          if (isAdmin) {
                            setEditDesgModal({
                              staffId: staff.id,
                              staffName: staff.name,
                              currentDesg: staff.designation || 'TTI',
                              pfNo: staff.pf_no
                            });
                            setCustomDesgInput('');
                          }
                        }}
                        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                        title={isAdmin ? `Click to edit designation for ${staff.name} (Current: ${staff.designation || '-'})` : undefined}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
                          <span className="muster-desg-val" style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            cursor: isAdmin ? 'pointer' : 'default',
                            borderRadius: '4px'
                          }}>
                            {staff.designation || '-'}
                          </span>
                          {isAdmin && (
                            <span className="no-print muster-edit-pencil" style={{ fontSize: '0.62rem', opacity: 0.55 }} title="Edit Designation">
                              ✏️
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fixed Left HRMS ID - Editable */}
                      <td
                        className="muster-col-hrms muster-editable-hover"
                        onClick={() => {
                          if (isAdmin && editingHrmsId !== staff.id) {
                            setEditingHrmsId(staff.id);
                            setHrmsInputVal(staff.hrms_id || '');
                          }
                        }}
                        style={{ cursor: isAdmin && editingHrmsId !== staff.id ? 'pointer' : 'default' }}
                        title={isAdmin && editingHrmsId !== staff.id ? `Click to edit HRMS ID for ${staff.name}` : undefined}
                      >
                      {editingHrmsId === staff.id ? (
                        <>
                          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              className="form-input"
                              style={{
                                width: '70px',
                                fontSize: '0.74rem',
                                padding: '2px 4px',
                                textTransform: 'uppercase',
                                textAlign: 'center',
                                fontWeight: 700,
                                background: '#27272a',
                                border: '1px solid var(--border-gold)',
                                borderRadius: '4px',
                                color: '#fff'
                              }}
                              value={hrmsInputVal}
                              onChange={e => setHrmsInputVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handleSaveStaffField(staff.id, { hrms_id: hrmsInputVal.trim().toUpperCase() });
                                } else if (e.key === 'Escape') {
                                  setEditingHrmsId(null);
                                }
                              }}
                              placeholder="HRMS"
                            />
                            <button
                              type="button"
                              disabled={savingStaffField}
                              onClick={() => handleSaveStaffField(staff.id, { hrms_id: hrmsInputVal.trim().toUpperCase() })}
                              style={{
                                background: 'rgba(16, 185, 129, 0.25)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.5)',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="Save HRMS ID"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingHrmsId(null)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                          <span className="print-only muster-hrms-val">
                            {staff.hrms_id || '-'}
                          </span>
                        </>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span className="muster-hrms-val" style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: staff.hrms_id ? '#f1f5f9' : 'var(--color-text-muted)',
                            letterSpacing: '0.5px'
                          }}>
                            {staff.hrms_id || '-'}
                          </span>
                          {isAdmin && (
                            <span className="no-print muster-edit-pencil" style={{ fontSize: '0.62rem', opacity: 0.55 }} title="Edit HRMS ID">
                              ✏️
                            </span>
                          )}
                        </div>
                      )}
                      </td>

                    {/* Daily Muster Cells */}
                    {cycleData.cycle.dates.map(d => {
                      const dayData = staff.days[d.dateStr] || { code: 'P', isManual: false };
                      const meta = CODE_MAP[dayData.code] || CODE_MAP.P;

                      return (
                        <td
                          key={d.dateStr}
                          onClick={() => {
                            if (isAdmin) {
                              setActiveCellModal({
                                staffId: staff.id,
                                staffName: staff.name,
                                designation: staff.designation,
                                dateStr: d.dateStr,
                                dayNumber: d.dayNumber,
                                dayOfWeek: d.dayOfWeek,
                                currentCode: dayData.code,
                                isManual: dayData.isManual,
                                remarks: dayData.remarks || ''
                              });
                              setCellRemarks(dayData.remarks || '');
                            }
                          }}
                          style={{
                            textAlign: 'center',
                            padding: '3px 1px',
                            cursor: isAdmin ? 'pointer' : 'default',
                            background: d.isSunday ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                            userSelect: 'none'
                          }}
                          title={dayData.remarks ? `${staff.name} on ${d.dateStr}: ${dayData.code} (${dayData.remarks})` : (isAdmin ? 'Click to change code for ' + staff.name + ' on ' + d.dateStr + ' (Current: ' + dayData.code + ')' : undefined)}
                        >
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '28px',
                            borderRadius: '5px',
                            background: meta.bg,
                            color: meta.color,
                            border: dayData.isRestDayWorked ? '1.5px solid #a78bfa' : (dayData.isManual ? '1.5px solid ' + meta.color : '1px solid ' + meta.border),
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            position: 'relative',
                            boxShadow: dayData.isRestDayWorked ? '0 0 7px rgba(167, 139, 250, 0.45)' : (dayData.isManual ? '0 0 6px rgba(212, 161, 92, 0.35)' : 'none')
                          }}>
                            {dayData.code}
                            {dayData.isManual && (
                              <span className="no-print muster-cell-dot" style={{
                                position: 'absolute',
                                top: '1px',
                                right: '2px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: 'var(--primary)'
                              }} />
                            )}
                            {dayData.isRestDayWorked && (
                              <span className="no-print muster-cell-dot" style={{
                                position: 'absolute',
                                bottom: '1px',
                                right: '2px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#a78bfa'
                              }} title={`Rest Day Worked (+1 CR earned for ${d.dateStr})`} />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Summary Columns */}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981', fontSize: '0.84rem' }}>{staff.counts.P}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#9ca3af', fontSize: '0.84rem' }}>{staff.counts.R}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#ef4444', fontSize: '0.84rem' }}>{staff.counts.O}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#f59e0b', fontSize: '0.84rem' }}>{staff.counts.E}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#a78bfa', fontSize: '0.84rem' }} title={staff.cr_available ? `CR Balance: ${staff.cr_available} | Redeemed: ${staff.counts.CR}` : `Redeemed CR: ${staff.counts.CR}`}>
                      {staff.counts.CR > 0 ? staff.counts.CR : 0}
                      {staff.cr_count > 0 && (
                        <div className="no-print" style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 800, marginTop: '1px' }} title={staff.cr_available}>
                          +{staff.cr_count} Avail
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#f43f5e', fontSize: '0.84rem' }}>{staff.counts.totalLeaves}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--primary)', fontSize: '0.88rem' }}>{staff.counts.totalDays}</td>
                  </tr>
                );
              })}
              </tbody>

              {/* Table Footer: Division Totals */}
              <tfoot className="muster-tfoot" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#18181b', borderTop: '2px solid var(--border-gold)' }}>
                <tr>
                  <td colSpan={2} className="muster-footer-label">
                    DIVISION TOTALS ({filteredStaff.length} Employees)
                  </td>
                  <td className="muster-col-desg"></td>
                  <td className="muster-col-hrms"></td>

                  {cycleData.cycle.dates.map(d => (
                    <td key={d.dateStr} style={{ textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-secondary)', padding: '6px 2px' }}>
                      {d.dayNumber}
                    </td>
                  ))}

                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#10b981' }}>{cycleData.grandTotals.P}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#9ca3af' }}>{cycleData.grandTotals.R}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#ef4444' }}>{cycleData.grandTotals.O}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#f59e0b' }}>{cycleData.grandTotals.E}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#a78bfa' }}>{cycleData.grandTotals.CR}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#f43f5e' }}>{cycleData.grandTotals.totalLeaves}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--primary)' }}>
                    {cycleData.grandTotals.staffCount * cycleData.cycle.totalDays}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* 4. Cell Assignment Modal */}
      {activeCellModal && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '460px',
            maxWidth: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            padding: '24px',
            border: '1.5px solid var(--border-gold)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                ✍️ Assign Muster Code
              </h3>
              <button
                type="button"
                onClick={() => setActiveCellModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.84rem'
            }}>
              <div>Employee: <strong style={{ color: '#f3f4f6' }}>{activeCellModal.staffName}</strong> ({activeCellModal.designation || 'Staff'})</div>
              <div style={{ marginTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Date: <strong>{activeCellModal.dateStr}</strong> ({activeCellModal.dayOfWeek}) | Current: <strong>{activeCellModal.currentCode}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    const dates = cycleData?.cycle?.dates || [];
                    const fDate = activeCellModal.dateStr;
                    const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : fDate;
                    setRangeEditModal({
                      staffId: activeCellModal.staffId,
                      staffName: activeCellModal.staffName,
                      designation: activeCellModal.designation,
                      fromDate: fDate,
                      toDate: lDate,
                      code: activeCellModal.currentCode || 'P',
                      remarks: cellRemarks || ''
                    });
                    setActiveCellModal(null);
                  }}
                  style={{
                    background: 'rgba(212, 161, 92, 0.2)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--primary)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Switch to date-range editor"
                >
                  📅 Edit Range
                </button>
              </div>
            </div>

            <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
              Select Attendance / Muster Code:
            </label>

            {/* Grid of 10 Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '18px' }}>
              {MUSTER_CODES.map(c => {
                const isSelected = activeCellModal.currentCode === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    disabled={savingCell}
                    onClick={() => handleUpdateCode(activeCellModal.staffId, activeCellModal.dateStr, c.code, cellRemarks)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid ' + c.color : '1px solid var(--border-glass)',
                      background: isSelected ? c.bg : 'rgba(255,255,255,0.03)',
                      color: c.color,
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{c.code}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.1 }}>
                      {c.code === 'P' ? 'Duty' : c.code === 'R' ? 'Rest' : c.code === 'O' ? 'Absent' : c.code === 'E' ? 'Emerg' : c.code === 'NH' ? 'Nat Hol' : c.code}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Remarks */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Remarks / Reason (Optional):</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sanctioned Emergency Duty, Leave Certificate"
                value={cellRemarks}
                onChange={(e) => setCellRemarks(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '7px 10px' }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {activeCellModal.isManual && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingCell}
                  onClick={() => handleResetCell(activeCellModal.staffId, activeCellModal.dateStr)}
                  style={{ fontSize: '0.78rem', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                >
                  🔄 Reset to Cyclic Baseline
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveCellModal(null)}
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Batch Edit Modal */}
      {rangeEditModal && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '560px',
            maxWidth: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '24px',
            border: '2px solid var(--border-gold)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📅</span>
                  <span>Date-Wise Muster Range Editor</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  Set muster attendance across multiple dates for the whole month or custom range
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRangeEditModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.3rem' }}
              >
                ✕
              </button>
            </div>

            {/* Employee Info */}
            <div style={{
              background: 'rgba(212, 161, 92, 0.1)',
              border: '1px solid rgba(212, 161, 92, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', display: 'block' }}>Employee</span>
                <strong style={{ fontSize: '1rem', color: '#ffffff' }}>{rangeEditModal.staffName}</strong>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                {rangeEditModal.designation || 'Staff'}
              </span>
            </div>

            {/* Date Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>From Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={rangeEditModal.fromDate}
                  onChange={(e) => setRangeEditModal(prev => ({ ...prev, fromDate: e.target.value }))}
                  style={{ fontSize: '0.88rem', padding: '8px 12px', background: '#09090b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>Upto Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={rangeEditModal.toDate}
                  onChange={(e) => setRangeEditModal(prev => ({ ...prev, toDate: e.target.value }))}
                  style={{ fontSize: '0.88rem', padding: '8px 12px', background: '#09090b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Quick Date Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(() => {
                  const dates = cycleData?.cycle?.dates || [];
                  const fDate = dates.length > 0 ? dates[0].dateStr : '';
                  const lDate = dates.length > 0 ? dates[dates.length - 1].dateStr : '';
                  const midDate = dates.length > 15 ? dates[14].dateStr : '';
                  const nextMid = dates.length > 15 ? dates[15].dateStr : '';
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setRangeEditModal(prev => ({ ...prev, fromDate: fDate, toDate: lDate }))}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Full Cycle ({cycleData?.cycle?.dates?.[0]?.dayStr || '11'} - {cycleData?.cycle?.dates?.[cycleData?.cycle?.dates?.length - 1]?.dayStr || '10'})
                      </button>
                      {midDate && (
                        <button
                          type="button"
                          onClick={() => setRangeEditModal(prev => ({ ...prev, fromDate: fDate, toDate: midDate }))}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          First Half (11th - 25th)
                        </button>
                      )}
                      {nextMid && (
                        <button
                          type="button"
                          onClick={() => setRangeEditModal(prev => ({ ...prev, fromDate: nextMid, toDate: lDate }))}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Second Half (26th - 10th)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Attendance Code Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                Select Attendance Code:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {MUSTER_CODES.map(c => {
                  const isSelected = rangeEditModal.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setRangeEditModal(prev => ({ ...prev, code: c.code }))}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #ffffff' : '1px solid var(--border-glass)',
                        background: isSelected ? c.color : 'rgba(255,255,255,0.04)',
                        color: isSelected ? '#ffffff' : c.color,
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        boxShadow: isSelected ? `0 0 10px ${c.color}88` : 'none'
                      }}
                    >
                      <span>{c.code}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>
                        {c.code === 'P' ? 'Duty' : c.code === 'R' ? 'Rest' : c.code === 'O' ? 'Absent' : c.code === 'E' ? 'Emerg' : c.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remarks */}
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Remarks / Reason (Optional):</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sanctioned leave, Medical certificate, Special order"
                value={rangeEditModal.remarks || ''}
                onChange={(e) => setRangeEditModal(prev => ({ ...prev, remarks: e.target.value }))}
                style={{ fontSize: '0.82rem', padding: '8px 12px', background: '#09090b', color: '#fff' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingCell}
                onClick={() => handleBatchResetMuster(rangeEditModal.staffId, rangeEditModal.fromDate, rangeEditModal.toDate)}
                style={{ fontSize: '0.78rem', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                title="Reset this range to default cyclic baseline"
              >
                ↺ Reset Range to Baseline
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRangeEditModal(null)}
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingCell || !rangeEditModal.fromDate || !rangeEditModal.toDate || rangeEditModal.fromDate > rangeEditModal.toDate}
                  onClick={() => handleBatchUpdateMuster(
                    rangeEditModal.staffId,
                    rangeEditModal.fromDate,
                    rangeEditModal.toDate,
                    rangeEditModal.code,
                    rangeEditModal.remarks
                  )}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    padding: '8px 20px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {savingCell ? 'Saving...' : '⚡ Apply & Save Range'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Designation Edit Modal */}
      {editDesgModal && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '420px',
            maxWidth: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            padding: '24px',
            border: '1.5px solid var(--border-gold)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                👔 Edit Employee Designation
              </h3>
              <button
                type="button"
                onClick={() => setEditDesgModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.84rem' }}>
              <div>Employee: <strong style={{ color: '#f3f4f6' }}>{editDesgModal.staffName}</strong></div>
              <div style={{ marginTop: '3px', color: 'var(--color-text-muted)' }}>
                PF NO: <span style={{ color: '#cbd5e1' }}>{editDesgModal.pfNo || '-'}</span> | Current: <strong style={{ color: '#93c5fd' }}>{editDesgModal.currentDesg}</strong>
              </div>
            </div>

            <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
              Select Official Designation:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {['CTI', 'TTI', 'SRTE', 'Sr.CCTC', 'CCTC', 'DY.CTI'].map(desg => {
                const isSelected = editDesgModal.currentDesg === desg;
                return (
                  <button
                    key={desg}
                    type="button"
                    disabled={savingStaffField}
                    onClick={() => handleSaveStaffField(editDesgModal.staffId, { designation: desg })}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: isSelected ? 'rgba(212, 161, 92, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? 'var(--primary)' : '#e2e8f0',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {desg}
                  </button>
                );
              })}
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Or Enter Custom Designation:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DY.SMR, CH.OS"
                  value={customDesgInput}
                  onChange={e => setCustomDesgInput(e.target.value)}
                  style={{ fontSize: '0.84rem', padding: '7px 10px', textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingStaffField || !customDesgInput.trim()}
                  onClick={() => handleSaveStaffField(editDesgModal.staffId, { designation: customDesgInput.trim().toUpperCase() })}
                  style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: 800 }}
                >
                  Save
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditDesgModal(null)}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Name & PF Number Edit Modal */}
      {editNameModal && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '420px',
            maxWidth: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            padding: '24px',
            border: '1.5px solid var(--border-gold)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                👤 Edit Employee Name & PF No
              </h3>
              <button
                type="button"
                onClick={() => setEditNameModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '6px', display: 'block', fontWeight: 700 }}>
                Employee Full Name:
              </label>
              <input
                type="text"
                autoFocus
                className="form-input"
                placeholder="e.g. BRK REDDY"
                value={editNameModal.name}
                onChange={e => setEditNameModal(prev => ({ ...prev, name: e.target.value }))}
                style={{ fontSize: '0.88rem', padding: '8px 12px', textTransform: 'uppercase', width: '100%', borderRadius: '8px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '6px', display: 'block', fontWeight: 700 }}>
                PF Number (PF NO):
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 24609273846"
                value={editNameModal.pfNo}
                onChange={e => setEditNameModal(prev => ({ ...prev, pfNo: e.target.value }))}
                style={{ fontSize: '0.88rem', padding: '8px 12px', textTransform: 'uppercase', width: '100%', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditNameModal(null)}
                style={{ fontSize: '0.82rem', padding: '7px 16px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingStaffField || !editNameModal.name.trim()}
                onClick={() => handleSaveStaffField(editNameModal.staffId, {
                  name: editNameModal.name.trim().toUpperCase(),
                  pf_no: editNameModal.pfNo.trim().toUpperCase()
                })}
                style={{ fontSize: '0.82rem', padding: '7px 18px', fontWeight: 800, borderRadius: '8px' }}
              >
                {savingStaffField ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          fontWeight: 800,
          fontSize: '0.86rem',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <span>{toastMessage}</span>
        </div>
      )}
      </>
      )}
    </div>
  );
}
