import React, { useState, useEffect, useMemo } from 'react';

const QUICK_CODES = [
  { code: 'R', label: 'Weekly Rest', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.35)' },
  { code: 'S', label: 'Sick / Medical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.4)' },
  { code: 'LAP', label: 'Leave on Avg Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.4)' },
  { code: 'CL', label: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.4)' },
  { code: 'CR', label: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.4)' },
  { code: 'L', label: 'Leave', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' },
  { code: 'CAP', label: 'Child Care / CAP', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)' }
];

const NON_DAILY_MULTI_DAY_SERVICES = [
  {
    id: '22882_22881',
    name: 'BBS-PUNE Exp (Link #60)',
    linkNumber: 60,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '22882', from: 'GNT', to: 'WADI', depTime: '10:35', arrTime: '21:10', coaches: 'SL / AC', dutyCode: '22882', remarks: 'BBS-PUNE Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '22881', from: 'WADI', to: 'GNT', depTime: '16:55', arrTime: '02:05', coaches: 'SL / AC', dutyCode: '22881', remarks: 'PUNE-BBS Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '02:05', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 02:05 • 8h HQ Rest till 10:05 • Available (AVL)' }
    ]
  },
  {
    id: '17221_17222_WED',
    name: 'COA-LTT Exp (Link #61 - Wed Run)',
    linkNumber: 61,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '17221', from: 'GNT', to: 'WADI', depTime: '13:35', arrTime: '00:05', coaches: 'SL / AC', dutyCode: '17221', remarks: 'COA-LTT Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '17222', from: 'WADI', to: 'GNT', depTime: '23:00', arrTime: '08:15', coaches: 'SL / AC', dutyCode: '17222', remarks: 'LTT-COA Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '08:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 08:15 • 8h HQ Rest till 16:15 • Available (AVL)' }
    ]
  },
  {
    id: '17221_17222_SAT',
    name: 'COA-LTT Exp (Link #61 - Sat Run)',
    linkNumber: 61,
    serviceDays: ['SAT'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '17221', from: 'GNT', to: 'WADI', depTime: '13:35', arrTime: '00:05', coaches: 'SL / AC', dutyCode: '17221', remarks: 'COA-LTT Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN)', train: '17222', from: 'WADI', to: 'GNT', depTime: '23:00', arrTime: '08:15', coaches: 'SL / AC', dutyCode: '17222', remarks: 'LTT-COA Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (MON)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '08:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 08:15 • 8h HQ Rest till 16:15 • Available (AVL)' }
    ]
  },
  {
    id: '17069_17262',
    name: 'GNT-TPTY / RU-GNT Exp (Link #62)',
    linkNumber: 62,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '17069', from: 'GNT', to: 'RU', depTime: '22:40', arrTime: '07:15', coaches: 'SL / AC', dutyCode: '17069', remarks: 'GNT-TPTY / RU Exp (GNT-RU)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '17262', from: 'TPTY', to: 'GNT', depTime: '19:25', arrTime: '07:20', coaches: 'SL / AC', dutyCode: '17262', remarks: 'TPTY-GNT Exp (TPTY-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '07:20', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 07:20 • 8h HQ Rest till 15:20 • Available (AVL)' }
    ]
  },
  {
    id: '17261_17070',
    name: 'GNT-TPTY-RU-GNT Exp',
    linkNumber: null,
    serviceDays: ['THU'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (THU)', train: '17261', from: 'GNT', to: 'TPTY', depTime: '16:30', arrTime: '03:50', coaches: 'SL / AC', dutyCode: '17261', remarks: 'GNT-TPTY Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (FRI)', train: '17070', from: 'RU', to: 'GNT', depTime: '22:40', arrTime: '05:15', coaches: 'SL / AC', dutyCode: '17070', remarks: 'RU-GNT Exp' },
      { dayIndex: 3, dayLabel: 'Day 3 (SAT)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '05:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 05:15 • 8h HQ Rest till 13:15 • Available (AVL)' }
    ]
  },
  {
    id: '17231_17232_SUN',
    name: 'BZA-CHZ-BZA Exp (Sun Run)',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '17231', from: 'BZA', to: 'CHZ', depTime: '13:50', arrTime: '20:40', coaches: 'SL / AC', dutyCode: '17231', remarks: 'BZA-CHZ Exp (or 07029)' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '17232', from: 'CHZ', to: 'BZA', depTime: '23:40', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17232', remarks: 'CHZ-BZA Exp (Arr 06:25)' }
    ]
  },
  {
    id: '17231_17232_FRI',
    name: 'BZA-CHZ-BZA Exp (Fri Run)',
    linkNumber: null,
    serviceDays: ['FRI'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (FRI)', train: '17231', from: 'BZA', to: 'CHZ', depTime: '13:50', arrTime: '20:40', coaches: 'SL / AC', dutyCode: '17231', remarks: 'BZA-CHZ Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SAT)', train: '17232', from: 'CHZ', to: 'BZA', depTime: '23:40', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17232', remarks: 'CHZ-BZA Exp (Arr 06:25)' }
    ]
  },
  {
    id: '02811_02812',
    name: 'GNT-DMM-BZA Spl',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '02811', from: 'GNT', to: 'DMM', depTime: '08:30', arrTime: '21:00', coaches: 'SL / AC', dutyCode: '02811', remarks: 'GNT-DMM Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '02812', from: 'DMM', to: 'BZA', depTime: '08:30', arrTime: '18:00', coaches: 'SL / AC', dutyCode: '02812', remarks: 'DMM-BZA Spl' }
    ]
  },
  {
    id: '07609_07610',
    name: 'GNT-RU-GNT Spl',
    linkNumber: null,
    serviceDays: ['MON'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (MON)', train: '07609', from: 'GNT', to: 'RU', depTime: '02:55', arrTime: '09:30', coaches: 'SL / AC', dutyCode: '07609', remarks: 'GNT-RU Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (TUE)', train: '07610', from: 'RU', to: 'GNT', depTime: '13:35', arrTime: '10:00', coaches: 'SL / AC', dutyCode: '07610', remarks: 'RU-GNT Spl (Arr 10:00)' }
    ]
  },
  {
    id: '07615_07616',
    name: 'GNT-RU-GNT Spl',
    linkNumber: null,
    serviceDays: ['TUE'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (TUE)', train: '07615', from: 'GNT', to: 'RU', depTime: '23:10', arrTime: '08:10', coaches: 'SL / AC', dutyCode: '07615', remarks: 'GNT-RU Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (WED)', train: '07616', from: 'RU', to: 'GNT', depTime: '07:30', arrTime: '15:05', coaches: 'SL / AC', dutyCode: '07616', remarks: 'RU-GNT Spl' }
    ]
  },
  {
    id: '17041_17042',
    name: 'GNT-RU-GNT Exp',
    linkNumber: null,
    serviceDays: ['TUE'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (TUE)', train: '17041', from: 'GNT', to: 'RU', depTime: '12:20', arrTime: '19:20', coaches: 'SL / AC', dutyCode: '17041', remarks: 'GNT-RU Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (WED)', train: '17042', from: 'RU', to: 'GNT', depTime: '10:40', arrTime: '17:40', coaches: 'SL / AC', dutyCode: '17042', remarks: 'RU-GNT Exp' }
    ]
  },
  {
    id: '12604_16357',
    name: 'GNT-MAS-MS-GNT Exp',
    linkNumber: null,
    serviceDays: ['THU'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (THU)', train: '12604', from: 'GNT', to: 'MAS', depTime: '22:00', arrTime: '05:40', coaches: 'SL / AC', dutyCode: '12604', remarks: 'GNT-MAS Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (FRI)', train: '16357', from: 'MS', to: 'GNT', depTime: '13:00', arrTime: '21:10', coaches: 'SL / AC', dutyCode: '16357', remarks: 'MS-GNT Exp' }
    ]
  },
  {
    id: '18063_18064',
    name: 'GNT-DMM-GNT Exp',
    linkNumber: null,
    serviceDays: ['FRI'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (FRI)', train: '18063', from: 'GNT', to: 'DMM', depTime: '09:45', arrTime: '20:30', coaches: 'SL / AC', dutyCode: '18063', remarks: 'GNT-DMM Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SAT)', train: '18064', from: 'DMM', to: 'GNT', depTime: '08:15', arrTime: '19:25', coaches: 'SL / AC', dutyCode: '18064', remarks: 'DMM-GNT Exp' }
    ]
  },
  {
    id: '07193_07194',
    name: 'GNT-KPD-GNT Spl',
    linkNumber: null,
    serviceDays: ['SAT'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '07193', from: 'GNT', to: 'KPD', depTime: '05:30', arrTime: '16:30', coaches: 'SL / AC', dutyCode: '07193', remarks: 'GNT-KPD Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN/TUE)', train: '07194', from: 'KPD', to: 'GNT', depTime: '01:00', arrTime: '10:40', coaches: 'SL / AC', dutyCode: '07194', remarks: 'KPD-GNT Spl' }
    ]
  },
  {
    id: '16358_12603',
    name: 'GNT-MS-MAS-GNT Exp',
    linkNumber: null,
    serviceDays: ['SAT'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '16358', from: 'GNT', to: 'MS', depTime: '14:00', arrTime: '22:55', coaches: 'SL / AC', dutyCode: '16358', remarks: 'GNT-MS Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN)', train: '12603', from: 'MAS', to: 'GNT', depTime: '16:45', arrTime: '23:25', coaches: 'SL / AC', dutyCode: '12603', remarks: 'MAS-GNT Exp' }
    ]
  },
  {
    id: '17646_17625',
    name: 'GNT-SC-KCG-RAL Exp',
    linkNumber: null,
    serviceDays: ['MON'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (MON)', train: '17646', from: 'GNT', to: 'SC', depTime: '08:50', arrTime: '16:00', coaches: 'SL / AC', dutyCode: '17646', remarks: 'GNT-SC Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (TUE)', train: '17625', from: 'KCG', to: 'RAL', depTime: '22:20', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17625', remarks: 'KCG-RAL Exp' }
    ]
  },
  {
    id: '17425_17426',
    name: 'GNT-SC-GNT Exp',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '17425', from: 'GNT', to: 'SC', depTime: '10:40', arrTime: '16:00', coaches: 'SL / AC', dutyCode: '17425', remarks: 'GNT-SC Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '17426', from: 'SC', to: 'GNT', depTime: '11:40', arrTime: '17:10', coaches: 'SL / AC', dutyCode: '17426', remarks: 'SC-GNT Exp' }
    ]
  }
];

export default function LRList({ isAdmin, authToken, API_BASE = '/api' }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active cell edit modal
  const [editModal, setEditModal] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [inputRemarks, setInputRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncingDaily, setSyncingDaily] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  // Reference Drawer / Modal for 2-Day & 3-Day Non-Daily Services
  const [showNonDailyRefModal, setShowNonDailyRefModal] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const [refDayFilter, setRefDayFilter] = useState('ALL');

  const fetchSheet = async (targetYear = year, targetMonth = month) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/lr-sheet?year=${targetYear}&month=${targetMonth}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch Leave Reserve sheet');
      }
      setSheetData(data);
    } catch (err) {
      console.error('Error loading LR sheet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromDailyDuty = async () => {
    try {
      setSyncingDaily(true);
      const res = await fetch(`${API_BASE}/lr-sheet/sync-from-daily-duty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Daily Duty Sheet');
      }
      setSyncNotice(data.message || 'Daily duty sheet checked and synchronized up to date.');
      await fetchSheet(year, month);
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err) {
      alert('Sync error: ' + err.message);
    } finally {
      setSyncingDaily(false);
    }
  };

  useEffect(() => {
    fetchSheet(year, month);
  }, [year, month]);

  // Real-time reactive listener: when duties are assigned anywhere in the system, auto-refresh LR sheet
  useEffect(() => {
    const handleDutyUpdate = (e) => {
      if (e && e.detail && e.detail.source === 'lr_sheet') return;
      fetchSheet(year, month);
    };
    window.addEventListener('railway_duty_allotment_updated', handleDutyUpdate);
    window.addEventListener('railway_roster_data_updated', handleDutyUpdate);
    return () => {
      window.removeEventListener('railway_duty_allotment_updated', handleDutyUpdate);
      window.removeEventListener('railway_roster_data_updated', handleDutyUpdate);
    };
  }, [year, month]);

  const handleSaveCell = async (newCode, newRemarks = '') => {
    if (!editModal) return;
    const targetStaffId = editModal.staff.staffId;
    const targetDateStr = editModal.day.dateStr;
    try {
      setSaving(true);
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/lr-sheet/cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          staff_id: targetStaffId,
          date: targetDateStr,
          duty_code: newCode,
          remarks: newRemarks
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update cell');
      }

      // Update local state smoothly
      setSheetData(prev => {
        if (!prev) return prev;
        const newRecords = { ...prev.records };
        const key = `${targetStaffId}_${targetDateStr}`;
        if (!newCode || newCode.trim() === '') {
          delete newRecords[key];
        } else {
          newRecords[key] = { dutyCode: newCode.trim(), remarks: newRemarks };
        }
        return { ...prev, records: newRecords };
      });

      setEditModal(null);
      setSelectedService(null);
      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: targetStaffId, date: targetDateStr, source: 'lr_sheet', timestamp: Date.now() }
      }));
    } catch (err) {
      alert('Error updating cell: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 1-Click Multi-Day Round Trip Booking
  const handleAssignMultiDayService = async (service) => {
    if (!editModal || !service) return;
    const staffId = editModal.staff.staffId;
    const startDateObj = new Date(editModal.day.dateStr + 'T12:00:00');

    const updates = [];
    const localRecordUpdates = {};

    for (let i = 0; i < service.legs.length; i++) {
      const leg = service.legs[i];
      const legDate = new Date(startDateObj);
      legDate.setDate(legDate.getDate() + i);
      const y = legDate.getFullYear();
      const m = String(legDate.getMonth() + 1).padStart(2, '0');
      const d = String(legDate.getDate()).padStart(2, '0');
      const legDateStr = `${y}-${m}-${d}`;

      updates.push({
        staff_id: staffId,
        date: legDateStr,
        duty_code: leg.dutyCode,
        remarks: leg.remarks
      });

      localRecordUpdates[`${staffId}_${legDateStr}`] = {
        dutyCode: leg.dutyCode,
        remarks: leg.remarks,
        isNonDaily: true,
        multiDayInfo: {
          serviceName: service.name,
          dayNumber: i + 1,
          totalDays: service.totalDays,
          dayRole: leg.dayLabel,
          trainNo: leg.train,
          route: `${leg.from} ➔ ${leg.to}`,
          depTime: leg.depTime,
          arrTime: leg.arrTime,
          coaches: leg.coaches
        }
      };
    }

    try {
      setSaving(true);
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/lr-sheet/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ updates })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign multi-day service');
      }

      setSheetData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          records: {
            ...prev.records,
            ...localRecordUpdates
          }
        };
      });

      setSyncNotice(`⚡ Successfully booked ${service.name} (${service.totalDays} Days) for ${editModal.staff.name}!`);
      setTimeout(() => setSyncNotice(null), 6000);
      setEditModal(null);
      setSelectedService(null);

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId, source: 'lr_sheet', timestamp: Date.now() }
      }));
    } catch (err) {
      alert('Error booking multi-day service: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper to determine style for badge
  const getBadgeStyle = (code, record = null) => {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    if (clean === 'AVL' || clean === 'AVAILABLE') {
      return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', isAvailable: true };
    }
    if (clean === 'REST_HQ' || clean === 'HQ REST') {
      return { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)', isInHqRest: true };
    }
    if (clean === 'O' || clean === 'ABSENT') {
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.22)', border: 'rgba(239, 68, 68, 0.5)', isAbsent: true };
    }
    if (clean === 'R') {
      return { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.4)', isRest: true };
    }
    if (clean === 'S' || clean === 'SICK') {
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.45)', isSick: true };
    }
    if (clean === 'LAP') {
      return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.45)', isLeave: true };
    }
    if (clean === 'CL') {
      return { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.45)', isLeave: true };
    }
    if (clean.startsWith('CR')) {
      return { color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.45)', isCr: true };
    }
    if (clean === 'L' || clean === 'CAP' || clean === 'LHAP' || clean === 'SCL' || clean === 'CCL' || clean === 'OD') {
      return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.45)', isLeave: true };
    }

    // Check if non-daily train
    const isND = record?.isNonDaily || NON_DAILY_MULTI_DAY_SERVICES.some(s => s.legs.some(l => l.train === clean || l.dutyCode === clean));
    if (isND) {
      return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.5)', isTrain: true, isNonDaily: true };
    }

    // Regular train or station duty (e.g. 12603, GTL, TPTY)
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', isTrain: true };
  };

  const filteredStaff = useMemo(() => {
    if (!sheetData?.staff) return [];
    if (!searchQuery.trim()) return sheetData.staff;
    const q = searchQuery.toLowerCase().trim();
    return sheetData.staff.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.designation && s.designation.toLowerCase().includes(q)) ||
      (s.restDay && s.restDay.toLowerCase().includes(q))
    );
  }, [sheetData, searchQuery]);

  const filteredRefServices = useMemo(() => {
    const list = sheetData?.nonDailyServices || NON_DAILY_MULTI_DAY_SERVICES;
    return list.filter(s => {
      const matchDay = refDayFilter === 'ALL' || s.serviceDays.includes(refDayFilter);
      const matchQuery = !refSearch.trim() || 
        s.name.toLowerCase().includes(refSearch.toLowerCase()) ||
        s.legs.some(l => l.train.toLowerCase().includes(refSearch.toLowerCase()) || l.from.toLowerCase().includes(refSearch.toLowerCase()) || l.to.toLowerCase().includes(refSearch.toLowerCase()));
      return matchDay && matchQuery;
    });
  }, [sheetData, refDayFilter, refSearch]);

  // Compute staff row statistics
  const getStaffStats = (staff) => {
    if (!sheetData?.days || !sheetData?.records) return { duty: 0, rest: 0, sick: 0, leave: 0, total: 0 };
    let duty = 0, rest = 0, sick = 0, leave = 0;

    sheetData.days.forEach(day => {
      const rec = sheetData.records[`${staff.staffId}_${day.dateStr}`];
      const code = rec ? rec.dutyCode : (day.dayOfWeek === staff.restDay ? 'R' : null);
      if (!code) return;

      const style = getBadgeStyle(code, rec);
      if (style?.isTrain) duty++;
      else if (style?.isRest) rest++;
      else if (style?.isSick) sick++;
      else if (style?.isLeave || style?.isCr) leave++;
    });

    return { duty, rest, sick, leave, total: duty + rest + sick + leave };
  };

  return (
    <div style={{ padding: '4px 0 32px 0' }}>
      {/* Top Header Card */}
      <div className="card" style={{
        padding: '22px',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🚆</span>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                LEAVE RESERVE SHEET (LR LIST)
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Monthly Duty & Attendance Register for Leave Reserve Staff • <strong>{sheetData?.monthName || 'September 2026'}</strong></span>
                <span style={{ fontSize: '0.76rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  ● Live Synced with Daily Duty Sheet
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Month/Year picker & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Month:</span>
            <select
              className="form-input"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              style={{ padding: '4px 8px', fontSize: '0.84rem', width: 'auto', background: 'transparent', border: 'none' }}
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>

            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Year:</span>
            <select
              className="form-input"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              style={{ padding: '4px 8px', fontSize: '0.84rem', width: 'auto', background: 'transparent', border: 'none' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowNonDailyRefModal(true)}
            style={{
              padding: '7px 13px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.14)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              fontWeight: 700
            }}
            title="View 2-Day & 3-Day Non-Daily Services Timetable & Statutory Rest Reference"
          >
            <span>🚆</span> 2/3-Day Non-Daily Schedules
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (!sheetData?.days || !sheetData?.staff) return;
              let csv = 'SL. NO,NAME,DESG,REST';
              sheetData.days.forEach(d => { csv += `,${d.dayOfWeek} ${d.dayNum}`; });
              csv += ',DUTY DAYS,REST,SICK,LEAVES,TOTAL\n';

              sheetData.staff.forEach(s => {
                const stats = getStaffStats(s);
                csv += `"${s.slNo}","${s.name}","${s.designation || '-'}","${s.restDay || '-'}"`;
                if (s.isRelieved) {
                  sheetData.days.forEach(() => { csv += ',"RELIEVED TO ZRTI / MLY"'; });
                } else {
                  sheetData.days.forEach(d => {
                    const rec = sheetData.records[`${s.staffId}_${d.dateStr}`];
                    const val = rec ? rec.dutyCode : (d.dayOfWeek === s.restDay ? 'R' : '-');
                    csv += `,"${val}"`;
                  });
                }
                csv += `,${stats.duty},${stats.rest},${stats.sick},${stats.leave},${stats.total}\n`;
              });

              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.setAttribute('download', `LR_Sheet_${sheetData.monthName.replace(/\s+/g, '_')}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            style={{ padding: '7px 13px', fontSize: '0.84rem' }}
          >
            📥 Export CSV
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSyncFromDailyDuty}
            disabled={syncingDaily}
            title="Check and auto-update all LR duties from Daily Duty Sheet up to date"
            style={{
              padding: '7px 13px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              fontWeight: 700
            }}
          >
            <span>⚡</span> {syncingDaily ? 'Checking...' : 'Auto-Sync Duties'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchSheet(year, month)}
            title="Refresh Leave Reserve sheet from latest daily duty allotments"
            style={{ padding: '7px 13px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>🔄</span> Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{
              padding: '7px 13px',
              fontSize: '0.84rem',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              border: 'none',
              fontWeight: 700
            }}
          >
            📄 Print / PDF
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotice && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 700,
          fontSize: '0.9rem'
        }}>
          <span>✅ {syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Legend & Quick Filter Bar */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search LR employee name or rest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '8px', fontSize: '0.85rem', background: 'var(--bg-secondary)', paddingRight: searchQuery ? '32px' : '12px' }}
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
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Legend:</span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.45)', fontWeight: 700 }}>
            🚆 Multi-Day Non-Daily
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 700 }}>
            Train / Duty
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)', fontWeight: 700 }}>
            R (Rest)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}>
            S (Sick)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.18)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.4)', fontWeight: 700 }}>
            LAP (Leave)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.18)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.4)', fontWeight: 700 }}>
            CL
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.18)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.4)', fontWeight: 700 }}>
            CR
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading Leave Reserve Sheet...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '30px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444' }}>
          <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => fetchSheet(year, month)}>Retry</button>
        </div>
      ) : sheetData ? (
        <div className="table-responsive lr-table-container" style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          overflowX: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.36)'
        }}>
          <table className="roster-table lr-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '2px solid var(--border-glass)' }}>
                <th className="lr-col-slno">SL NO</th>
                <th className="lr-col-name">NAME</th>
                <th className="lr-col-desg">DESG</th>
                <th className="lr-col-rest">REST</th>

                {/* Day Columns */}
                {sheetData.days.map(d => (
                  <th
                    key={d.dateStr}
                    style={{
                      width: '78px',
                      minWidth: '72px',
                      textAlign: 'center',
                      padding: '8px 2px',
                      background: d.isSunday ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                      borderRight: '1px solid var(--border-glass)',
                      color: d.isSunday ? '#f87171' : 'inherit'
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.85 }}>
                      {d.dayOfWeek}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      {d.dayNum}
                    </div>
                  </th>
                ))}

                {/* Summary Columns */}
                <th style={{ width: '55px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#10b981', fontWeight: 700 }}>
                  DUTY
                </th>
                <th style={{ width: '50px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#9ca3af', fontWeight: 700 }}>
                  REST
                </th>
                <th style={{ width: '50px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#ef4444', fontWeight: 700 }}>
                  SICK
                </th>
                <th style={{ width: '55px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#f43f5e', fontWeight: 700 }}>
                  LEAVE
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff, sIdx) => {
                const isEven = sIdx % 2 === 0;
                const stats = getStaffStats(staff);

                return (
                  <tr
                    key={staff.staffId || sIdx}
                    style={{
                      background: isEven ? 'rgba(255,255,255,0.015)' : 'transparent',
                      borderBottom: '1px solid var(--border-glass)'
                    }}
                  >
                    {/* Fixed Columns */}
                    <td className="lr-col-slno">{staff.slNo}</td>
                    <td className="lr-col-name">{staff.name}</td>
                    <td className="lr-col-desg">{staff.designation || '-'}</td>
                    <td className="lr-col-rest">{staff.restDay || '-'}</td>

                    {/* Check if this row is K NAGA NAIK (relieved) */}
                    {staff.isRelieved ? (
                      <td
                        colSpan={sheetData.days.length}
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          background: 'rgba(239, 68, 68, 0.06)',
                          color: '#f87171',
                          fontWeight: 800,
                          letterSpacing: '2px',
                          fontSize: '0.85rem'
                        }}
                      >
                        ★ ★ ★ ★ ★ {staff.relievedNote || 'RELIEVED TO ZRTI / MLY'} ★ ★ ★ ★ ★
                      </td>
                    ) : (
                      sheetData.days.map(day => {
                        const rec = sheetData.records[`${staff.staffId}_${day.dateStr}`];
                        const isDefaultRest = !rec && (day.dayOfWeek === staff.restDay);
                        const displayCode = rec ? rec.dutyCode : (isDefaultRest ? 'R' : '');
                        const badgeStyle = getBadgeStyle(displayCode, rec);
                        const mdInfo = rec?.multiDayInfo;

                        // Build detailed multi-day tooltip
                        let cellTooltip = rec?.remarks || displayCode || '';
                        if (mdInfo) {
                          cellTooltip = `🚆 ${mdInfo.serviceName} (${mdInfo.totalDays}-Day Service)\n` +
                            `• Day ${mdInfo.dayNumber}: ${mdInfo.dayRole}\n` +
                            `• Train: ${mdInfo.trainNo || displayCode} (${mdInfo.route})\n` +
                            (mdInfo.depTime ? `• Departure: ${mdInfo.depTime}\n` : '') +
                            (mdInfo.arrTime ? `• Arrival: ${mdInfo.arrTime}\n` : '') +
                            (mdInfo.restTill ? `• 8h HQ Rest Completed By: ${mdInfo.restTill}\n` : '') +
                            (mdInfo.coaches && mdInfo.coaches !== '-' ? `• Coaches: ${mdInfo.coaches}\n` : '') +
                            (rec?.remarks ? `• Notes: ${rec.remarks}` : '');
                        } else if (isAdmin) {
                          cellTooltip = `Click to edit ${staff.name} on ${day.dateStr}${cellTooltip ? ' (' + cellTooltip + ')' : ''}`;
                        }

                        return (
                          <td
                            key={day.dateStr}
                            onClick={() => {
                              if (isAdmin) {
                                setEditModal({ staff, day, currentCode: displayCode, remarks: rec?.remarks || '' });
                                setInputCode(displayCode);
                                setInputRemarks(rec?.remarks || '');
                                setSelectedService(null);
                              }
                            }}
                            style={{
                              textAlign: 'center',
                              padding: '5px 2px',
                              borderRight: '1px solid var(--border-glass)',
                              background: day.isSunday ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                              cursor: isAdmin ? 'pointer' : 'default',
                              verticalAlign: 'middle',
                              transition: 'background 0.15s'
                            }}
                            title={cellTooltip}
                          >
                            {displayCode === 'AVL' || rec?.isAvailable ? (() => {
                              const arrMatch = rec?.arrivalTime || (rec?.remarks && rec.remarks.match(/arr\s+GNT\s+(\d{1,2}:\d{2})/i)?.[1]) || mdInfo?.arrTime;
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 4px',
                                    borderRadius: '5px',
                                    fontSize: '0.67rem',
                                    fontWeight: 700,
                                    color: '#34d399',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    letterSpacing: '0.2px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.15
                                  }}
                                >
                                  <span>Available</span>
                                  {arrMatch && <span style={{ fontSize: '0.58rem', color: '#6ee7b7', fontWeight: 600 }}>Arr {arrMatch}</span>}
                                </span>
                              );
                            })() : displayCode === 'REST_HQ' || rec?.isInHqRest ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 5px',
                                  borderRadius: '5px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.18)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                ⏳ HQ Rest
                              </span>
                            ) : displayCode ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '2px',
                                  padding: '3px 5px',
                                  borderRadius: '5px',
                                  fontSize: displayCode.length > 8 ? '0.65rem' : '0.74rem',
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                  maxWidth: '72px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  background: badgeStyle?.bg || 'rgba(255,255,255,0.06)',
                                  color: badgeStyle?.color || 'inherit',
                                  border: `1px solid ${badgeStyle?.border || 'transparent'}`,
                                  opacity: isDefaultRest ? 0.65 : 1,
                                  boxShadow: badgeStyle?.isNonDaily ? '0 0 6px rgba(56, 189, 248, 0.25)' : 'none'
                                }}
                              >
                                {badgeStyle?.isNonDaily && (
                                  <span style={{ fontSize: '0.60rem' }}>
                                    {mdInfo?.dayNumber === 1 ? '☀️' : (mdInfo?.dayNumber === 2 ? '🌙' : '🚆')}
                                  </span>
                                )}
                                <span>{displayCode}</span>
                              </span>
                            ) : (
                              isAdmin ? (
                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>+</span>
                              ) : null
                            )}
                          </td>
                        );
                      })
                    )}

                    {/* Stats */}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981', padding: '6px 2px' }}>
                      {stats.duty}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#9ca3af', padding: '6px 2px' }}>
                      {stats.rest}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444', padding: '6px 2px' }}>
                      {stats.sick}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#f43f5e', padding: '6px 2px' }}>
                      {stats.leave}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Admin Cell Edit Modal with 2/3-Day Non-Daily Itinerary Selector */}
      {editModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="card" style={{
            background: '#1a1a1d',
            border: '1px solid var(--border-gold)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                  Assign LR Duty / Attendance
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                  {editModal.staff.name} ({editModal.staff.designation}) • <strong>{editModal.day.dayOfWeek} {editModal.day.dateStr}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEditModal(null); setSelectedService(null); }}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Dedicated 2-Day & 3-Day Non-Daily Services Booking Panel */}
            <div style={{
              marginBottom: '18px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.35)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🚆</span> 2-Day & 3-Day Non-Daily Services (One-Click Booking)
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                  Selected: {editModal.day.dayOfWeek}
                </span>
              </div>

              {/* Service list options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                {(sheetData?.nonDailyServices || NON_DAILY_MULTI_DAY_SERVICES).map(service => {
                  const isDayMatch = service.serviceDays.includes(editModal.day.dayOfWeek);
                  const isSelected = selectedService?.id === service.id;

                  return (
                    <div
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service);
                        setInputCode(service.legs[0].dutyCode);
                        setInputRemarks(service.legs[0].remarks);
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isSelected ? 'rgba(56, 189, 248, 0.25)' : (isDayMatch ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.03)'),
                        border: `1px solid ${isSelected ? '#38bdf8' : (isDayMatch ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.08)')}`,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '2px 5px',
                          borderRadius: '4px',
                          background: isDayMatch ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                          color: isDayMatch ? '#000' : 'inherit'
                        }}>
                          {service.serviceDays.join('/')}
                        </span>
                        <span style={{ fontWeight: 700, color: isSelected ? '#fff' : (isDayMatch ? '#38bdf8' : 'inherit') }}>
                          {service.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.70rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        {service.totalDays} Days ({service.legs[0].train}/{service.legs[1].train})
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Service Preview & One-Click Multi-Day Assignment */}
              {selectedService && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(56, 189, 248, 0.4)'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginBottom: '6px' }}>
                    📅 Itinerary Breakdown for {selectedService.name}:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem' }}>
                    {selectedService.legs.map((leg, idx) => {
                      const legDateObj = new Date(editModal.day.dateStr + 'T12:00:00');
                      legDateObj.setDate(legDateObj.getDate() + idx);
                      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                      const legDow = dayNames[legDateObj.getDay()];
                      const legDateStr = legDateObj.toISOString().split('T')[0];

                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                          <span>
                            <strong>Day {leg.dayIndex} ({legDow} {legDateStr}):</strong> {leg.train !== '---' ? `Train ${leg.train} (${leg.from} ➔ ${leg.to})` : 'At Headquarters GNT'}
                          </span>
                          <span style={{ color: leg.dutyCode === 'AVL' ? '#34d399' : '#38bdf8', fontWeight: 700 }}>
                            {leg.dutyCode} {leg.depTime ? `(Dep ${leg.depTime})` : (leg.arrTime ? `(Arr ${leg.arrTime})` : '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => handleAssignMultiDayService(selectedService)}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>⚡</span> Assign Complete {selectedService.totalDays}-Day Round Trip ({selectedService.legs.map(l => l.train).filter(t => t !== '---').join(' / ')})
                  </button>
                </div>
              )}
            </div>

            {/* Quick Attendance / Rest Codes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                Quick Attendance / Rest Codes:
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {QUICK_CODES.map(q => (
                  <button
                    key={q.code}
                    type="button"
                    onClick={() => {
                      setInputCode(q.code);
                      setSelectedService(null);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: inputCode === q.code ? q.bg : 'rgba(255,255,255,0.06)',
                      color: inputCode === q.code ? q.color : 'inherit',
                      border: `1px solid ${inputCode === q.code ? q.color : 'rgba(255,255,255,0.1)'}`
                    }}
                  >
                    {q.code} ({q.label})
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Code / Train Number input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Train Number / Movement / Custom Duty:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 12603, 17221, 22882, 17254 / 12795, GTL, TPTY"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                style={{ borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Remarks (Optional):
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Relieved for special duty, CR ref 21/8"
                value={inputRemarks}
                onChange={(e) => setInputRemarks(e.target.value)}
                style={{ borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => handleSaveCell('', '')}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', fontSize: '0.84rem' }}
              >
                🗑️ Clear Cell
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => { setEditModal(null); setSelectedService(null); }}
                  style={{ fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => handleSaveCell(inputCode, inputRemarks)}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem'
                  }}
                >
                  {saving ? 'Saving...' : '💾 Save Single Day Duty'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Day & 3-Day Non-Daily Services Reference Drawer / Modal */}
      {showNonDailyRefModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{
            background: '#18181b',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '16px',
            maxWidth: '1050px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 25px 70px rgba(0,0,0,0.9)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.6rem' }}>🚆</span>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#38bdf8' }}>
                    2-Day & 3-Day Non-Daily Services Reference & Timetable
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                    Official Master Multi-Day Train Pairs, Routes, Departure/Arrival Times, and Statutory 8-Hour HQ Rest Schedules
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNonDailyRefModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['ALL', 'WED', 'SAT', 'SUN', 'THU', 'FRI', 'MON', 'TUE'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRefDayFilter(d)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: refDayFilter === d ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                      color: refDayFilter === d ? '#000' : 'inherit',
                      border: `1px solid ${refDayFilter === d ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="form-input"
                placeholder="🔍 Search train number, station or name..."
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                style={{ borderRadius: '8px', fontSize: '0.84rem', width: '280px', background: 'rgba(0,0,0,0.3)' }}
              />
            </div>

            {/* Reference Table */}
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(56, 189, 248, 0.12)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#38bdf8' }}>Service / Beat</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: '#38bdf8', width: '80px' }}>Days</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: '#38bdf8', width: '70px' }}>Duration</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#38bdf8' }}>Day 1: Outward Leg</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#38bdf8' }}>Day 2: Return Leg</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#38bdf8' }}>Day 3: HQ Arrival & Rest</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: '#38bdf8', width: '75px' }}>Coaches</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefServices.map((service, idx) => {
                    const isEven = idx % 2 === 0;
                    const leg1 = service.legs[0];
                    const leg2 = service.legs[1];
                    const leg3 = service.legs[2];

                    return (
                      <tr
                        key={service.id}
                        style={{
                          background: isEven ? 'rgba(255,255,255,0.02)' : 'transparent',
                          borderBottom: '1px solid var(--border-glass)'
                        }}
                      >
                        <td style={{ padding: '10px', fontWeight: 800, color: '#fff' }}>
                          <div>{service.name}</div>
                          {service.linkNumber && (
                            <span style={{ fontSize: '0.70rem', color: 'var(--primary)', fontWeight: 700 }}>
                              Link #{service.linkNumber} (Sleeper Roster)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontSize: '0.72rem' }}>
                            {service.serviceDays.join(', ')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: service.totalDays === 3 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                            color: service.totalDays === 3 ? '#fbbf24' : '#34d399',
                            fontWeight: 800,
                            fontSize: '0.72rem'
                          }}>
                            {service.totalDays} Days
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                            Train {leg1.train}
                          </div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.74rem' }}>
                            {leg1.from} ({leg1.depTime}) ➔ {leg1.to} ({leg1.arrTime})
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 700, color: '#34d399' }}>
                            Train {leg2.train}
                          </div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.74rem' }}>
                            {leg2.from} ({leg2.depTime}) ➔ {leg2.to} ({leg2.arrTime})
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          {leg3 ? (
                            <div>
                              <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                Arr GNT {leg3.arrTime}
                              </span>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}>
                                8h HQ Rest • Available (AVL) after rest
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                              Returns Day 2 ({leg2.arrTime || 'Evening'})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, color: '#cbd5e1' }}>
                          {service.coaches}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNonDailyRefModal(false)}
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
