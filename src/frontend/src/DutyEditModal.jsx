import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Multi-day link sets for Indian Railways train roster
export const KNOWN_LINK_SETS = {
  1: [
    [1, 2, 3],
    [4, 5, 6],
    [8, 9],
    [10, 11],
    [12, 13],
    [15, 16, 17],
    [18, 19, 20]
  ],
  2: [
    [1, 2],
    [3, 4],
    [5, 6],
    [8, 9, 10],
    [11, 12, 13],
    [15, 16],
    [17, 18],
    [19, 20],
    [22, 23, 24],
    [25, 26, 27],
    [29, 30],
    [31, 32],
    [33, 34],
    [36, 37, 38],
    [39, 40, 41],
    [43, 44, 45, 46],
    [47, 48],
    [50, 51, 52],
    [53, 54, 55],
    [57, 58, 59]
  ],
  3: [
    [1, 2, 3],
    [4, 5, 6]
  ]
};

export function getLinkSetDetails(categoryId, linkNumber) {
  const catId = parseInt(categoryId, 10);
  const linkNum = parseInt(linkNumber, 10);
  if (!catId || !linkNum) return null;

  const sets = KNOWN_LINK_SETS[catId];
  if (sets) {
    for (const s of sets) {
      const idx = s.indexOf(linkNum);
      if (idx !== -1) {
        return {
          setLength: s.length,
          dayIndexInSet: idx + 1,
          isFirstDayOfSet: idx === 0,
          setLinks: s,
          remainingLinks: s.slice(idx + 1)
        };
      }
    }
  }
  return null;
}

export function isHqArrivalDuty(linkNum, trainNumbers, toStation, fromStation) {
  if (!trainNumbers && !linkNum) return false;
  const to = (toStation || '').toUpperCase();
  const tr = (trainNumbers || '').toUpperCase();
  
  // Specific return/arrival trains arriving at GNT in morning/night
  const hqArrivalTrains = ['20630', '12703', '17252', '12603', '17240', '17226', '12806', '17262', '17254', '17646', '17244', '17282', '18048', '17216', '17070', '07002', '07194', '07128', '17232', '17608', '22881'];
  
  // Link numbers in Cat 2 and Cat 1 that are return legs to GNT
  const cat2ReturnLinks = [2, 4, 10, 13, 16, 18, 20, 24, 27, 30, 32, 34, 38, 41, 46, 48, 52, 55, 59];
  const cat1ReturnLinks = [3, 6, 10, 13, 17, 20];

  if (linkNum && (cat2ReturnLinks.includes(Number(linkNum)) || cat1ReturnLinks.includes(Number(linkNum)))) {
    return true;
  }

  if (to === 'GNT' || to.endsWith('/GNT') || to.endsWith(', GNT')) {
    return true;
  }

  for (const t of hqArrivalTrains) {
    if (tr.includes(t)) return true;
  }

  return false;
}

function getDayOffset(anchorDateStr, targetDateStr) {
  if (!anchorDateStr || !targetDateStr) return 1;
  const d1 = new Date(anchorDateStr + 'T00:00:00');
  const d2 = new Date(targetDateStr + 'T00:00:00');
  const diffMs = d2 - d1;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function getBaseLinkNumber(rowPosition, dayOffset, cycleLength) {
  if (!cycleLength || cycleLength <= 0) return 1;
  const result = ((rowPosition - 1) + (dayOffset - 1)) % cycleLength;
  const wrapped = result < 0 ? (result + cycleLength) : result;
  return wrapped + 1;
}

export function StaffRecentDutiesView({ staffId, staffName, targetDate, authToken, compact = false }) {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!staffId) {
      setDuties([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/staff/${staffId}/recent-duties?date=${targetDate}&limit=5`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load recent duties');
        return res.json();
      })
      .then(data => {
        setDuties(data.recent_duties || []);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [staffId, targetDate, authToken]);

  if (!staffId) return null;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(212, 161, 92, 0.3)',
      borderRadius: '8px',
      padding: compact ? '8px 12px' : '10px 14px',
      marginTop: '6px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '4px'
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>🕒 Last Duties Performed by <strong>{staffName || 'Employee'}</strong> (Past 5 Days):</span>
        </div>
        {loading && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Loading...</span>}
      </div>

      {loading && duties.length === 0 && (
        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', padding: '4px 0' }}>
          ⏳ Fetching recent duty history...
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.74rem', color: '#f87171', padding: '4px 0' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && duties.length === 0 && (
        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
          No previous recorded duties found in the last 14 days.
        </div>
      )}

      {duties.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {duties.map((d, idx) => {
            let badgeBg = 'rgba(59, 130, 246, 0.15)';
            let badgeColor = '#60a5fa';
            let badgeBorder = '1px solid rgba(59, 130, 246, 0.35)';

            if (d.duty_type === 'REST') {
              badgeBg = 'rgba(16, 185, 129, 0.15)';
              badgeColor = '#34d399';
              badgeBorder = '1px solid rgba(16, 185, 129, 0.35)';
            } else if (d.duty_type === 'LEAVE' || d.duty_type === 'SICK' || d.duty_type === 'ABSENT') {
              badgeBg = 'rgba(239, 68, 68, 0.15)';
              badgeColor = '#f87171';
              badgeBorder = '1px solid rgba(239, 68, 68, 0.35)';
            } else if (d.duty_type === 'STANDBY') {
              badgeBg = 'rgba(168, 85, 247, 0.15)';
              badgeColor = '#c084fc';
              badgeBorder = '1px solid rgba(168, 85, 247, 0.35)';
            }

            const dateParts = d.date.split('-');
            const dFormatted = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}` : d.date;

            return (
              <div key={d.date} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 6px',
                borderRadius: '4px',
                background: idx === 0 ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                fontSize: '0.75rem',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '110px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{dFormatted}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>({d.day_of_week.substring(0, 3)})</span>
                  {idx === 0 && <span style={{ fontSize: '0.66rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.2)', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>Yesterday</span>}
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <span className="badge" style={{
                    background: badgeBg,
                    color: badgeColor,
                    border: badgeBorder,
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    {d.duty_text}
                  </span>
                  {d.route && (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.route}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DutyEditModal({
  dutyModal,
  categories,
  allStaffList,
  allLinksList,
  nonDailyList,
  dailyDuties,
  authToken,
  isAdmin,
  onClose,
  onSuccess
}) {
  const [selectedDate, setSelectedDate] = useState(dutyModal.date || new Date().toISOString().split('T')[0]);

  // Determine whether slot is vacant
  const isSlotVacant = Boolean(
    dutyModal.isVacant || 
    dutyModal.isVacantAdvance || 
    dutyModal.isVacantUpgrade || 
    dutyModal.isVacantShifted ||
    (dutyModal.name && dutyModal.name.toUpperCase().includes('VACANT')) ||
    dutyModal.status === 'AVAILABLE_FOR_BOOKING'
  );

  // EXACTLY TWO OPTIONS: 'DELETE' or 'ASSIGN_DUTY'
  const [activeMode, setActiveMode] = useState(() => {
    if (dutyModal.initialMode === 'ASSIGN_DUTY' || dutyModal.initialMode === 'ASSIGN_DAILY' || dutyModal.initialMode === 'REPLACE_STAFF') return 'ASSIGN_DUTY';
    if (isSlotVacant) return 'ASSIGN_DUTY';
    return 'DELETE';
  });

  // Toggle to show busy / already-assigned staff to shift them to this duty
  const [showAlreadyAssigned, setShowAlreadyAssigned] = useState(false);
  const [showSlotStaffDuties, setShowSlotStaffDuties] = useState(false);
  // Shift confirmation modal state: { staffName, currentTrainDesc, targetDesc, onConfirm }
  const [shiftConfirmDialog, setShiftConfirmDialog] = useState(null);

  // SUB-OPTIONS UNDER DELETE: 'LEAVE', 'SICK', 'ADVANCE_BOOKED', 'ABSENT', 'SHIFTED'
  const [deleteReason, setDeleteReason] = useState(() => {
    if (dutyModal.isVacantShifted || dutyModal.status === 'SHIFTED') return 'SHIFTED';
    if (dutyModal.status === 'SICK') return 'SICK';
    if (dutyModal.status === 'ABSENT') return 'ABSENT';
    if (dutyModal.isVacantAdvance || dutyModal.status === 'UTILISED_ADVANCE') return 'ADVANCE_BOOKED';
    return 'LEAVE';
  });

  // All 9 Leave / Rest Types under Leave: CL, LAP, LHAP, SCL, OD, CCL, CR, NH, REST
  const [leaveType, setLeaveType] = useState(() => {
    if (dutyModal.leave_type) return dutyModal.leave_type.toUpperCase();
    if (dutyModal.overrideReason) {
      const match = dutyModal.overrideReason.match(/\b(CL|LAP|LHAP|SCL|OD|CCL|CR|NH|REST|R)\b/i);
      if (match) return match[1].toUpperCase();
    }
    return 'CL';
  });

  // Compensatory Rest (CR) tracking & due dates for the employee being relieved/edited
  const currentStaffId = dutyModal.staffId || dutyModal.originalStaffId;
  const initialStaffObj = allStaffList?.find(s => String(s.id) === String(currentStaffId));

  const [staffCrDetails, setStaffCrDetails] = useState(() => {
    if (initialStaffObj && initialStaffObj.cr_due_dates) {
      return {
        count: initialStaffObj.cr_count || 0,
        due_dates: initialStaffObj.cr_due_dates || [],
        redeemed_dates: []
      };
    }
    return null;
  });
  const [selectedCrEarnedDate, setSelectedCrEarnedDate] = useState(null);
  const [showRedeemedHistory, setShowRedeemedHistory] = useState(false);

  useEffect(() => {
    if (!currentStaffId) return;
    if (leaveType === 'CR' || deleteReason === 'LEAVE') {
      fetch(`/api/staff/${currentStaffId}/cr-details`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setStaffCrDetails(data);
          }
        })
        .catch(() => {});
    }
  }, [currentStaffId, leaveType, deleteReason, authToken]);

  const crCount = staffCrDetails?.count ?? (initialStaffObj?.cr_count || 0);
  const dueDates = staffCrDetails?.due_dates || initialStaffObj?.cr_due_dates || [];
  const redeemedDates = staffCrDetails?.redeemed_dates || [];

  // Sick medical classification: LHAP (MC), SICK (Hospital), CL (Minor)
  const [sickType, setSickType] = useState(() => {
    if (dutyModal.leave_type) return dutyModal.leave_type.toUpperCase();
    return 'LHAP';
  });

  // Advance Booked inputs
  const [advanceTrainNo, setAdvanceTrainNo] = useState(dutyModal.advanceTrainNo || '');
  const [advanceVacateNext, setAdvanceVacateNext] = useState(true);

  // Shifted Place inputs
  const [shiftedMode, setShiftedMode] = useState('CUSTOM'); // 'CUSTOM', 'LINK', 'NON_DAILY', or 'MUTUAL'
  const [shiftedPlace, setShiftedPlace] = useState(() => {
    if (dutyModal.shifted_place) return dutyModal.shifted_place;
    if (dutyModal.overrideReason && /Shifted to/i.test(dutyModal.overrideReason)) {
      return dutyModal.overrideReason.replace(/^Shifted to\s*/i, '');
    }
    return '';
  });
  const [shiftedLinkNum, setShiftedLinkNum] = useState('');
  const [shiftedCatId, setShiftedCatId] = useState(() => {
    return dutyModal.categoryId ? String(dutyModal.categoryId) : '1';
  });
  const [shiftedNonDailyId, setShiftedNonDailyId] = useState('');
  const [shiftedNonDailyTrainNo, setShiftedNonDailyTrainNo] = useState('');
  const [shiftedNonDailyDayFilter, setShiftedNonDailyDayFilter] = useState('AUTO'); // 'AUTO' | 'ALL' | 'SUNDAY' ... 'SATURDAY'

  // Mutual Shift of Places inputs
  const [mutualStaffId, setMutualStaffId] = useState('');
  const [mutualCatFilter, setMutualCatFilter] = useState('ENTIRE_ROSTER');
  const [mutualReason, setMutualReason] = useState('');
  const [mutualSearchQuery, setMutualSearchQuery] = useState('');

  const selectedDateDayOfWeek = useMemo(() => {
    if (!selectedDate) return 'SUNDAY';
    const d = new Date(selectedDate + 'T12:00:00');
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return isNaN(d.getDay()) ? 'SUNDAY' : dayNames[d.getDay()];
  }, [selectedDate]);

  const effectiveNonDailyDay = shiftedNonDailyDayFilter === 'AUTO' ? selectedDateDayOfWeek : shiftedNonDailyDayFilter;

  const availableNonDailyTrains = useMemo(() => {
    if (!Array.isArray(nonDailyList)) return [];
    if (effectiveNonDailyDay === 'ALL') return nonDailyList;
    return nonDailyList.filter(t => (t.day_of_week || '').toUpperCase() === effectiveNonDailyDay.toUpperCase());
  }, [nonDailyList, effectiveNonDailyDay]);

  const selectedNonDailyObj = useMemo(() => {
    if (!Array.isArray(nonDailyList)) return null;
    if (shiftedNonDailyId) {
      return nonDailyList.find(t => String(t.id) === String(shiftedNonDailyId)) || null;
    }
    if (shiftedNonDailyTrainNo) {
      return nonDailyList.find(t => String(t.train_number) === String(shiftedNonDailyTrainNo).trim()) || null;
    }
    return null;
  }, [nonDailyList, shiftedNonDailyId, shiftedNonDailyTrainNo]);

  // Multi-day date range for Leave / Sick / Absent / Shifted
  const [leaveToDate, setLeaveToDate] = useState(dutyModal.date || selectedDate);

  // All 9 official Leave / Rest Types definition
  const LEAVE_TYPES = useMemo(() => [
    { code: 'CL', label: 'CL', title: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)' },
    { code: 'LAP', label: 'LAP', title: 'Leave Avg Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)' },
    { code: 'LHAP', label: 'LHAP', title: 'Half Avg Pay', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.18)' },
    { code: 'SCL', label: 'SCL', title: 'Special Casual', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.18)' },
    { code: 'OD', label: 'OD', title: 'On Duty', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' },
    { code: 'CCL', label: 'CCL', title: 'Child Care', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)' },
    { code: 'CR', label: 'CR', title: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.18)' },
    { code: 'NH', label: 'NH', title: 'National Holiday', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' },
    { code: 'REST', label: 'REST', title: 'Weekly Rest', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.18)' }
  ], []);

  // Multi-day date array between selectedDate and leaveToDate
  const leaveDates = useMemo(() => {
    if (!selectedDate) return [];
    const start = new Date(selectedDate + 'T12:00:00');
    const end = (leaveToDate && leaveToDate >= selectedDate) ? new Date(leaveToDate + 'T12:00:00') : start;
    const dates = [];
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [selectedDate, leaveToDate]);

  // Day-wise leave assignments: { [dateStr]: { leaveType, reason, crEarnedDate } }
  const [dayWiseLeaves, setDayWiseLeaves] = useState({});

  // Check if any day has CR selected (either as global default or in day-wise map)
  const hasCrInLeave = useMemo(() => {
    if (leaveType === 'CR') return true;
    if (leaveDates.length > 1) {
      return leaveDates.some(d => (dayWiseLeaves[d]?.leaveType || leaveType) === 'CR');
    }
    return false;
  }, [leaveType, leaveDates, dayWiseLeaves]);

  // Handler when clicking top-level default leave type
  const handleSelectPrimaryLeaveType = (code) => {
    setLeaveType(code);
    setDayWiseLeaves(prev => {
      const updated = { ...prev };
      leaveDates.forEach(d => {
        updated[d] = {
          ...(updated[d] || {}),
          leaveType: code,
          reason: code === 'REST' ? 'Weekly Rest' : (code === 'CR' ? (updated[d]?.reason || 'Compensatory Rest (CR)') : `${code} Leave`),
          ...(code === 'CR' && !updated[d]?.crEarnedDate && dueDates.length > 0 ? {
            crEarnedDate: dueDates[0].date,
            reason: `CR availed against rest day worked on ${dueDates[0].dateDisplay || dueDates[0].date} (${dueDates[0].duty})`
          } : {})
        };
      });
      return updated;
    });
  };

  // Handler for individual day leave type pill clicks
  const handleDayLeaveTypeChange = (dStr, code) => {
    setDayWiseLeaves(prev => {
      const cur = prev[dStr] || { leaveType };
      let newCrDate = cur.crEarnedDate;
      let newReason = cur.reason || '';

      if (code === 'CR') {
        if (!newCrDate && dueDates.length > 0) {
          const pickedDates = Object.entries(prev)
            .filter(([k, v]) => k !== dStr && v && v.leaveType === 'CR' && v.crEarnedDate)
            .map(([k, v]) => v.crEarnedDate);
          const availableDueDate = dueDates.find(dd => !pickedDates.includes(dd.date)) || dueDates[0];
          newCrDate = availableDueDate.date;
          newReason = `CR availed against rest day worked on ${availableDueDate.dateDisplay || availableDueDate.date} (${availableDueDate.duty})`;
        } else if (!newReason) {
          newReason = 'Compensatory Rest (CR)';
        }
      } else if (code === 'REST') {
        newReason = 'Weekly Rest';
      } else {
        newReason = `${code} Leave`;
      }

      return {
        ...prev,
        [dStr]: {
          ...cur,
          leaveType: code,
          crEarnedDate: code === 'CR' ? newCrDate : null,
          reason: newReason
        }
      };
    });
  };

  // Handler for selecting specific CR due date for a specific day
  const handleDayCrDateSelect = (dStr, crItem) => {
    setDayWiseLeaves(prev => ({
      ...prev,
      [dStr]: {
        ...(prev[dStr] || {}),
        leaveType: 'CR',
        crEarnedDate: crItem.date,
        reason: `CR availed against rest day worked on ${crItem.dateDisplay || crItem.date} (${crItem.duty})`
      }
    }));
  };

  // Slot action under Delete: 'REPLACE' (name changes, link fixed) or 'VACANT'
  const [deleteSlotAction, setDeleteSlotAction] = useState('REPLACE');
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [replacementCatId, setReplacementCatId] = useState('ENTIRE_ROSTER');
  // Assign Duty state (name changes, link fixed)
  const [assignStaffId, setAssignStaffId] = useState(
    isSlotVacant ? '' : (dutyModal.staffId ? String(dutyModal.staffId) : '')
  );
  const [assignCatId, setAssignCatId] = useState('ENTIRE_ROSTER');
  const [assignReason, setAssignReason] = useState('');

  // Remarks & general reason
  const [reason, setReason] = useState(dutyModal.overrideReason || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fixed link & category calculation:
  // "In delete and assign duty option name of the employe should only change there is no any change in link"
  const targetCategoryId = useMemo(() => {
    if (dutyModal.target_category_id) return String(dutyModal.target_category_id);
    if (dutyModal.targetCategoryId) return String(dutyModal.targetCategoryId);
    const linkNum = dutyModal.link_number ?? dutyModal.currentLink ?? dutyModal.originalLink;
    if (linkNum !== null && linkNum !== undefined && linkNum !== '' && allLinksList) {
      const parsedLinkNum = parseInt(linkNum, 10);
      if (dutyModal.categoryId && dutyModal.categoryId !== 4) {
        const directMatch = allLinksList.find(l => l.link_number === parsedLinkNum && l.category_id === dutyModal.categoryId);
        if (directMatch) return String(directMatch.category_id);
      }
      const anyMatch = allLinksList.find(l => l.link_number === parsedLinkNum);
      if (anyMatch) return String(anyMatch.category_id);
    }
    if (dutyModal.categoryId && dutyModal.categoryId !== 4) return String(dutyModal.categoryId);
    return '1';
  }, [dutyModal, allLinksList]);

  const targetLink = useMemo(() => {
    if (dutyModal.currentLink !== null && dutyModal.currentLink !== undefined && dutyModal.currentLink !== '') {
      return String(dutyModal.currentLink);
    }
    if (dutyModal.originalLink !== null && dutyModal.originalLink !== undefined && dutyModal.originalLink !== '') {
      return String(dutyModal.originalLink);
    }
    if (dutyModal.link_number !== null && dutyModal.link_number !== undefined && dutyModal.link_number !== '') {
      return String(dutyModal.link_number);
    }
    return '';
  }, [dutyModal]);

  // Find link details if present
  const linkDetails = useMemo(() => {
    if (!targetLink || !allLinksList) return null;
    return allLinksList.find(l => 
      String(l.category_id) === String(targetCategoryId) && 
      String(l.link_number) === String(targetLink)
    ) || null;
  }, [targetLink, targetCategoryId, allLinksList]);

  // Day of week
  const dObj = new Date(selectedDate);
  const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = weekdayNames[dObj.getDay()];

  // Flatten active daily duties for real-time duty lookups
  const allDailyStaffDuties = useMemo(() => {
    if (!dailyDuties || !dailyDuties.categories) return [];
    return dailyDuties.categories.reduce((acc, cat) => {
      return acc.concat((cat.staff || []).map(s => ({
        ...s,
        categoryId: cat.categoryId,
        categoryCode: cat.categoryCode
      })));
    }, []);
  }, [dailyDuties]);

  // Helper to determine what any employee is doing on selectedDate
  const getStaffDutyInfo = useCallback((staffMember, targetDateStr) => {
    if (!staffMember) return { label: 'Unknown', isRest: false, isLr: false, linkNum: null };

    const matchesSelectedDate = !dailyDuties?.date || dailyDuties.date === targetDateStr;
    if (matchesSelectedDate && allDailyStaffDuties.length > 0) {
      const activeDuty = allDailyStaffDuties.find(d => String(d.staffId) === String(staffMember.id));
      if (activeDuty) {
        // 1. Extra / Non-daily train
        if (activeDuty.extra_train_no) {
          return {
            label: `Train ${activeDuty.extra_train_no} (Extra)`,
            isRest: false,
            isLr: false,
            linkNum: null
          };
        }

        // 2. Substitute assignment
        const subDuty = allDailyStaffDuties.find(s => s.substituteStaffId === staffMember.id);
        if (subDuty) {
          const lNum = subDuty.link_number ? parseInt(subDuty.link_number, 10) : null;
          const isHqArr = isHqArrivalDuty(lNum, subDuty.train_numbers, subDuty.to_station || subDuty.to, subDuty.from_station || subDuty.from);
          if (isHqArr && (staffMember.category_id === 4 || activeDuty.categoryId === 4)) {
            const tr = subDuty.train_numbers ? ` (Arr Tr ${subDuty.train_numbers})` : '';
            return {
              label: `🟢 LR Standby Pool (Available)${tr}`,
              isRest: false,
              isLr: true,
              linkNum: subDuty.link_number
            };
          }
          const tr = subDuty.train_numbers ? ` (Tr ${subDuty.train_numbers})` : '';
          return {
            label: `Substitute on Link #${subDuty.link_number}${tr}`,
            isRest: false,
            isLr: false,
            linkNum: subDuty.link_number
          };
        }

        // 3. Rest & Leaves
        if (['SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.status) || activeDuty.leave_type) {
          const code = activeDuty.leave_type || activeDuty.status;
          return {
            label: `${activeDuty.status} [${code}]`,
            isRest: true,
            isLr: false,
            linkNum: null
          };
        }
        if (activeDuty.isRest || activeDuty.status === 'REST' || activeDuty.train_numbers === 'REST') {
          if (staffMember.category_id === 4 || activeDuty.categoryId === 4) {
            return {
              label: '🟢 LR Standby Pool (Available)',
              isRest: false,
              isLr: true,
              linkNum: activeDuty.link_number || null
            };
          }
          return {
            label: '🏖️ Weekly REST',
            isRest: true,
            isLr: false,
            linkNum: activeDuty.link_number
          };
        }
        if (activeDuty.status === 'AVAILABLE_FOR_BOOKING') {
          return {
            label: '⚡ Available for Booking (HQ)',
            isRest: false,
            isLr: false,
            linkNum: null
          };
        }

        // 4. Category 4 (LR Relief Pool)
        if (staffMember.category_id === 4 || activeDuty.categoryId === 4) {
          if (activeDuty.isOverridden && (activeDuty.link_number || activeDuty.train_numbers) && activeDuty.status !== 'REST' && activeDuty.status !== 'AVAILABLE_FOR_BOOKING') {
            const lNum = activeDuty.link_number ? parseInt(activeDuty.link_number, 10) : null;
            const isHqArr = isHqArrivalDuty(lNum, activeDuty.train_numbers, activeDuty.to_station || activeDuty.to);
            if (isHqArr) {
              const tr = activeDuty.train_numbers ? ` (Arr Tr ${activeDuty.train_numbers})` : '';
              return {
                label: `🟢 LR Standby Pool (Available)${tr}`,
                isRest: false,
                isLr: true,
                linkNum: activeDuty.link_number
              };
            }
            const tr = activeDuty.train_numbers ? ` (Tr ${activeDuty.train_numbers})` : '';
            return {
              label: `Link #${activeDuty.link_number || 'Duty'}${tr}`,
              isRest: false,
              isLr: true,
              linkNum: activeDuty.link_number
            };
          }
          return {
            label: '🟢 LR Standby Pool (Available)',
            isRest: false,
            isLr: true,
            linkNum: null
          };
        }

        // 5. Working cyclic train link
        if (activeDuty.link_number !== null && activeDuty.link_number !== undefined) {
          const lNum = parseInt(activeDuty.link_number, 10);
          const isNonDaily = [60, 61, 62].includes(lNum) || (activeDuty.train_numbers && String(activeDuty.train_numbers).toUpperCase().includes('NON DAILY'));
          if (isNonDaily && !activeDuty.extra_train_no) {
            return {
              label: `🟢 Non-Daily Link #${lNum} (Available)`,
              isRest: false,
              isLr: false,
              linkNum: lNum
            };
          }
          const trStr = activeDuty.train_numbers && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.train_numbers)
            ? `Tr ${activeDuty.train_numbers}`
            : '';
          return {
            label: `Link #${lNum}${trStr ? ` (${trStr})` : ''}`,
            isRest: false,
            isLr: false,
            linkNum: lNum
          };
        }
      }
    }

    if (staffMember.category_id === 4) {
      return {
        label: '🟢 LR Standby Pool (Available)',
        isRest: false,
        isLr: true,
        linkNum: null
      };
    }

    const cat = (categories || []).find(c => c.id === staffMember.category_id);
    if (!cat) return { label: 'Regular Duty', isRest: false, isLr: false, linkNum: null };

    const dOffset = getDayOffset(cat.anchor_date, targetDateStr);
    const linkNum = getBaseLinkNumber(staffMember.row_position, dOffset, cat.cycle_length);
    const linkDef = (allLinksList || []).find(l => String(l.category_id) === String(cat.id) && l.link_number === linkNum);

    if (!linkDef || linkDef.is_rest) {
      return { label: `Link #${linkNum} (Weekly REST)`, isRest: true, isLr: false, linkNum };
    }
    const isNonDaily = [60, 61, 62].includes(linkNum) || (linkDef.train_numbers && String(linkDef.train_numbers).toUpperCase().includes('NON DAILY'));
    if (isNonDaily) {
      return {
        label: `🟢 Non-Daily Link #${linkNum} (Available)`,
        isRest: false,
        isLr: false,
        linkNum
      };
    }
    return {
      label: `Link #${linkNum} (${linkDef.train_numbers ? `Tr ${linkDef.train_numbers}` : 'Duty'})`,
      isRest: false,
      isLr: false,
      linkNum
    };
  }, [categories, allLinksList, dailyDuties, allDailyStaffDuties]);

  // Helper to determine whether an employee is already assigned to a train or active duty on targetDateStr,
  // or is completely unavailable for booking (Weekly REST, Sick, Leave, CR, Absent)
  const getStaffAssignmentStatus = useCallback((staffMember, targetDateStr) => {
    if (!staffMember) {
      return { isAssigned: false, isUnavailable: true, unavailableReason: 'Unknown', trainDesc: '', linkNum: null, trainNo: null };
    }

    const isCat4 = staffMember.category_id === 4;

    const matchesSelectedDate = !dailyDuties?.date || dailyDuties.date === targetDateStr;
    if (matchesSelectedDate && allDailyStaffDuties.length > 0) {
      const activeDuty = allDailyStaffDuties.find(d => String(d.staffId) === String(staffMember.id));
      if (activeDuty) {
        // 1. Extra / Non-daily train assignment
        if (activeDuty.extra_train_no) {
          return {
            isAssigned: true,
            isUnavailable: false,
            unavailableReason: '',
            trainDesc: `Train ${activeDuty.extra_train_no} (Non-Daily / Extra)`,
            linkNum: null,
            trainNo: activeDuty.extra_train_no
          };
        }

        // 2. Substitute assignment on another staff's duty
        const subDuty = allDailyStaffDuties.find(s => s.substituteStaffId === staffMember.id);
        if (subDuty) {
          const lNum = subDuty.link_number ? parseInt(subDuty.link_number, 10) : null;
          const isHqArr = isHqArrivalDuty(lNum, subDuty.train_numbers, subDuty.to_station || subDuty.to, subDuty.from_station || subDuty.from);
          if (isHqArr && (isCat4 || staffMember.category_id === 4)) {
            return {
              isAssigned: false,
              isUnavailable: false,
              unavailableReason: '',
              trainDesc: 'LR Standby Pool (Available)',
              linkNum: subDuty.link_number,
              trainNo: subDuty.train_numbers
            };
          }
          const tr = subDuty.train_numbers ? ` (Tr ${subDuty.train_numbers})` : '';
          return {
            isAssigned: true,
            isUnavailable: false,
            unavailableReason: '',
            trainDesc: `Substitute on Link #${subDuty.link_number}${tr} for ${subDuty.name}`,
            linkNum: subDuty.link_number,
            trainNo: subDuty.train_numbers
          };
        }

        // 3. Leave, Sick, CR, Absent (applies to all staff including LR)
        if (
          ['SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.status) ||
          activeDuty.leave_type ||
          (activeDuty.muster_code && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH', 'SICK', 'CR', 'O', 'R'].includes(activeDuty.muster_code.toUpperCase()))
        ) {
          const reason = activeDuty.leave_type || activeDuty.muster_code || activeDuty.status;
          return {
            isAssigned: false,
            isUnavailable: true,
            unavailableReason: reason,
            trainDesc: reason,
            linkNum: null,
            trainNo: null
          };
        }

        // 4. Weekly REST checks (cyclic rest link for Categories 1, 2, 3; for LR staff, nominated rest is for reference only)
        if (
          !isCat4 &&
          (activeDuty.status === 'REST' ||
           activeDuty.train_numbers === 'REST' ||
           (activeDuty.isRest && activeDuty.status !== 'AVAILABLE_FOR_BOOKING'))
        ) {
          return {
            isAssigned: false,
            isUnavailable: true,
            unavailableReason: 'Weekly REST',
            trainDesc: 'Weekly REST',
            linkNum: activeDuty.link_number || null,
            trainNo: null
          };
        }

        // 5. Released / Available for booking at HQ
        if (activeDuty.status === 'AVAILABLE_FOR_BOOKING') {
          return {
            isAssigned: false,
            isUnavailable: false,
            unavailableReason: '',
            trainDesc: 'Available for Booking (HQ)',
            linkNum: null,
            trainNo: null
          };
        }

        // 6. Category 4 (LR Relief Pool) - Nominated rest is reference only, always available in standby pool unless on Leave/Sick/CR/Absent or working active outbound train
        if (isCat4 || activeDuty.categoryId === 4) {
          if (activeDuty.isOverridden && (activeDuty.link_number || activeDuty.train_numbers) && activeDuty.status !== 'REST' && activeDuty.status !== 'AVAILABLE_FOR_BOOKING') {
            const lNum = activeDuty.link_number ? parseInt(activeDuty.link_number, 10) : null;
            const isHqArr = isHqArrivalDuty(lNum, activeDuty.train_numbers, activeDuty.to_station || activeDuty.to);
            if (isHqArr) {
              return {
                isAssigned: false, // Arrived at HQ in morning -> Available for booking!
                isUnavailable: false,
                unavailableReason: '',
                trainDesc: 'LR Standby Pool (Available)',
                linkNum: activeDuty.link_number,
                trainNo: activeDuty.train_numbers
              };
            }
            const tr = activeDuty.train_numbers ? ` (Tr ${activeDuty.train_numbers})` : '';
            return {
              isAssigned: true,
              isUnavailable: false,
              unavailableReason: '',
              trainDesc: `Link #${activeDuty.link_number || 'Duty'}${tr}`,
              linkNum: activeDuty.link_number,
              trainNo: activeDuty.train_numbers
            };
          }
          return {
            isAssigned: false,
            isUnavailable: false,
            unavailableReason: '',
            trainDesc: 'LR Standby Pool (Available)',
            linkNum: null,
            trainNo: null
          };
        }

        // 7. Regular cyclic link duty (Cat 1, 2, 3)
        if (activeDuty.link_number !== null && activeDuty.link_number !== undefined) {
          const lNum = parseInt(activeDuty.link_number, 10);
          const isNonDaily = [60, 61, 62].includes(lNum) || (activeDuty.train_numbers && String(activeDuty.train_numbers).toUpperCase().includes('NON DAILY'));
          if (isNonDaily && !activeDuty.extra_train_no) {
            return {
              isAssigned: false,
              isUnavailable: false,
              unavailableReason: '',
              trainDesc: `Non-Daily Link #${lNum} (Available)`,
              linkNum: lNum,
              trainNo: null
            };
          }
          const trStr = activeDuty.train_numbers && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.train_numbers)
            ? `Tr ${activeDuty.train_numbers}`
            : '';
          return {
            isAssigned: true,
            isUnavailable: false,
            unavailableReason: '',
            trainDesc: `Link #${lNum}${trStr ? ` (${trStr})` : ''}`,
            linkNum: lNum,
            trainNo: trStr
          };
        }
      }
    }

    // Fallback when activeDuty not found in allDailyStaffDuties
    if (isCat4) {
      return {
        isAssigned: false,
        isUnavailable: false,
        unavailableReason: '',
        trainDesc: 'LR Standby Pool (Available)',
        linkNum: null,
        trainNo: null
      };
    }

    const cat = (categories || []).find(c => c.id === staffMember.category_id);
    if (!cat) return { isAssigned: false, isUnavailable: false, unavailableReason: '', trainDesc: '', linkNum: null, trainNo: null };

    const dOffset = getDayOffset(cat.anchor_date, targetDateStr);
    const linkNum = getBaseLinkNumber(staffMember.row_position, dOffset, cat.cycle_length);
    const linkDef = (allLinksList || []).find(l => String(l.category_id) === String(cat.id) && l.link_number === linkNum);

    if (!linkDef || linkDef.is_rest) {
      return {
        isAssigned: false,
        isUnavailable: true,
        unavailableReason: 'Weekly REST',
        trainDesc: `Link #${linkNum} (Weekly REST)`,
        linkNum,
        trainNo: null
      };
    }
    const isNonDaily = [60, 61, 62].includes(linkNum) || (linkDef.train_numbers && String(linkDef.train_numbers).toUpperCase().includes('NON DAILY'));
    if (isNonDaily) {
      return {
        isAssigned: false,
        isUnavailable: false,
        unavailableReason: '',
        trainDesc: `Non-Daily Link #${linkNum} (Available)`,
        linkNum,
        trainNo: null
      };
    }
    return {
      isAssigned: true,
      isUnavailable: false,
      unavailableReason: '',
      trainDesc: `Link #${linkNum} (${linkDef.train_numbers ? `Tr ${linkDef.train_numbers}` : 'Duty'})`,
      linkNum,
      trainNo: linkDef.train_numbers
    };
  }, [categories, allLinksList, dailyDuties, allDailyStaffDuties]);

  // Eligible replacement staff for Delete mode (Strictly in Alphabetical Order A to Z)
  // When replacementCatId === 'ENTIRE_ROSTER': ALL staff members across the entire roster are included!
  // When specific category or ALL is selected: filters apply according to category and availability
  const eligibleReplacementStaff = useMemo(() => {
    if (!allStaffList) return [];
    return allStaffList
      .filter(s => {
        if (s.id === dutyModal.staffId) return false;
        if (!s.name || s.name.toUpperCase().includes('VACANT')) return false;

        // Exclude Depot Incharges (MV PRASAD, P PRATHAP) from running duty bookings
        if (['MV PRASAD', 'P PRATHAP'].includes((s.name || '').trim().toUpperCase()) || !s.category_id || s.row_position === 0) {
          return false;
        }

        // When Entire Roster is selected, show every running employee without filtering
        if (replacementCatId === 'ENTIRE_ROSTER') {
          return true;
        }

        if (replacementCatId === 'NON_DAILY') {
          const assignStatus = getStaffAssignmentStatus(s, selectedDate);
          const dutyInfo = getStaffDutyInfo(s, selectedDate);
          const isND = (assignStatus.linkNum && [60, 61, 62].includes(assignStatus.linkNum)) ||
                       (dutyInfo.linkNum && [60, 61, 62].includes(dutyInfo.linkNum)) ||
                       (assignStatus.trainDesc && assignStatus.trainDesc.includes('Non-Daily')) ||
                       (dutyInfo.label && dutyInfo.label.includes('Non-Daily'));
          if (!isND) return false;
        } else if (replacementCatId && replacementCatId !== 'ALL') {
          if (String(s.category_id) !== String(replacementCatId)) return false;
        }
        const assignStatus = getStaffAssignmentStatus(s, selectedDate);
        if (assignStatus.isUnavailable) return false;
        if (!showAlreadyAssigned) {
          if (assignStatus.isAssigned) return false;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [allStaffList, dutyModal.staffId, replacementCatId, showAlreadyAssigned, selectedDate, getStaffAssignmentStatus, getStaffDutyInfo]);

  // Selected replacement staff object
  const selectedReplacementStaffObj = useMemo(() => {
    if (!replacementStaffId || !allStaffList) return null;
    return allStaffList.find(s => String(s.id) === String(replacementStaffId)) || null;
  }, [replacementStaffId, allStaffList]);

  // Eligible staff for Assign Duty mode (Strictly in Alphabetical Order A to Z)
  // When assignCatId === 'ENTIRE_ROSTER': ALL staff members across the entire roster are included!
  // When specific category or ALL is selected: filters apply according to category and availability
  const eligibleAssignStaff = useMemo(() => {
    if (!allStaffList) return [];
    return allStaffList
      .filter(s => {
        if (!s.name || s.name.toUpperCase().includes('VACANT')) return false;
        if (dutyModal.staffId && s.id === dutyModal.staffId && !isSlotVacant) return false;

        // Exclude Depot Incharges (MV PRASAD, P PRATHAP) from running duty bookings
        if (['MV PRASAD', 'P PRATHAP'].includes((s.name || '').trim().toUpperCase()) || !s.category_id || s.row_position === 0) {
          return false;
        }

        // When Entire Roster is selected, show every running employee without filtering
        if (assignCatId === 'ENTIRE_ROSTER') {
          return true;
        }

        if (assignCatId === 'NON_DAILY') {
          const assignStatus = getStaffAssignmentStatus(s, selectedDate);
          const dutyInfo = getStaffDutyInfo(s, selectedDate);
          const isND = (assignStatus.linkNum && [60, 61, 62].includes(assignStatus.linkNum)) ||
                       (dutyInfo.linkNum && [60, 61, 62].includes(dutyInfo.linkNum)) ||
                       (assignStatus.trainDesc && assignStatus.trainDesc.includes('Non-Daily')) ||
                       (dutyInfo.label && dutyInfo.label.includes('Non-Daily'));
          if (!isND) return false;
        } else if (assignCatId && assignCatId !== 'ALL') {
          if (String(s.category_id) !== String(assignCatId)) return false;
        }
        const assignStatus = getStaffAssignmentStatus(s, selectedDate);
        if (assignStatus.isUnavailable) return false;
        if (!showAlreadyAssigned) {
          if (assignStatus.isAssigned) return false;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [allStaffList, assignCatId, dutyModal.staffId, isSlotVacant, showAlreadyAssigned, selectedDate, getStaffAssignmentStatus, getStaffDutyInfo]);

  // Selected assign staff object
  const selectedAssignStaffObj = useMemo(() => {
    if (!assignStaffId || !allStaffList) return null;
    return allStaffList.find(s => String(s.id) === String(assignStaffId)) || null;
  }, [assignStaffId, allStaffList]);

  // Eligible staff for Mutual Shift of Places mode (Strictly in Alphabetical Order A to Z)
  const eligibleMutualStaff = useMemo(() => {
    if (!allStaffList) return [];
    return allStaffList
      .filter(s => {
        if (!s.name || s.name.toUpperCase().includes('VACANT')) return false;
        if (dutyModal.staffId && String(s.id) === String(dutyModal.staffId)) return false;

        // Exclude Depot Incharges (MV PRASAD, P PRATHAP) from running duty bookings
        if (['MV PRASAD', 'P PRATHAP'].includes((s.name || '').trim().toUpperCase()) || !s.category_id || s.row_position === 0) {
          return false;
        }

        if (mutualCatFilter === 'ENTIRE_ROSTER' || mutualCatFilter === 'ALL') {
          if (mutualSearchQuery.trim()) {
            const q = mutualSearchQuery.trim().toLowerCase();
            return s.name.toLowerCase().includes(q) ||
                   (s.hrms_id && s.hrms_id.toLowerCase().includes(q)) ||
                   (s.pf_number && s.pf_number.toLowerCase().includes(q));
          }
          return true;
        }

        if (mutualCatFilter === 'NON_DAILY') {
          const assignStatus = getStaffAssignmentStatus(s, selectedDate);
          const dutyInfo = getStaffDutyInfo(s, selectedDate);
          const isND = (assignStatus.linkNum && [60, 61, 62].includes(assignStatus.linkNum)) ||
                       (dutyInfo.linkNum && [60, 61, 62].includes(dutyInfo.linkNum)) ||
                       (assignStatus.trainDesc && assignStatus.trainDesc.includes('Non-Daily')) ||
                       (dutyInfo.label && dutyInfo.label.includes('Non-Daily'));
          if (!isND) return false;
        } else if (mutualCatFilter) {
          if (String(s.category_id) !== String(mutualCatFilter)) return false;
        }

        if (mutualSearchQuery.trim()) {
          const q = mutualSearchQuery.trim().toLowerCase();
          return s.name.toLowerCase().includes(q) ||
                 (s.hrms_id && s.hrms_id.toLowerCase().includes(q)) ||
                 (s.pf_number && s.pf_number.toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [allStaffList, dutyModal.staffId, mutualCatFilter, mutualSearchQuery, selectedDate, getStaffAssignmentStatus, getStaffDutyInfo]);

  // Selected mutual staff object (Staff B)
  const selectedMutualStaffObj = useMemo(() => {
    if (!mutualStaffId || !allStaffList) return null;
    return allStaffList.find(s => String(s.id) === String(mutualStaffId)) || null;
  }, [mutualStaffId, allStaffList]);

  // Real-time duty information for Staff A and Staff B
  const staffADutyInfo = useMemo(() => {
    const staffAObj = (allStaffList || []).find(s => String(s.id) === String(dutyModal.staffId || currentStaffId));
    if (staffAObj) return getStaffDutyInfo(staffAObj, selectedDate);
    if (targetLink) return { label: `Link #${targetLink} (${dutyModal.trainNumbers || 'Duty'})`, isRest: false, isLr: false, linkNum: parseInt(targetLink, 10) };
    return { label: 'Current Duty / Place', isRest: false, isLr: false, linkNum: null };
  }, [allStaffList, dutyModal, currentStaffId, selectedDate, getStaffDutyInfo, targetLink]);

  const staffBDutyInfo = useMemo(() => {
    if (!selectedMutualStaffObj) return null;
    return getStaffDutyInfo(selectedMutualStaffObj, selectedDate);
  }, [selectedMutualStaffObj, selectedDate, getStaffDutyInfo]);

  // Quick reset / undo handlers for administrative actions
  const handleReset = async () => {
    if (!window.confirm(`Reset duty override for ${dutyModal.name || 'this slot'} on ${selectedDate} back to regular cyclic roster?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          staff_id: dutyModal.staffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset duty');
      onSuccess(data.message || 'Duty override cleared and restored to regular cyclic roster!');
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async () => {
    const staffName = dutyModal.name || 'Employee';
    const linkDesc = targetLink ? `Link #${targetLink}` : 'Duty';
    if (!window.confirm(`Cancel leave for ${staffName} on ${selectedDate} and restore them to ${linkDesc}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          staff_id: dutyModal.staffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel leave');
      onSuccess(`Leave cancelled! ${staffName} restored to ${linkDesc}.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportFit = async () => {
    const staffName = dutyModal.name || 'Employee';
    if (!window.confirm(`Mark ${staffName} as Reported Fit (Came out of Sick Leave) on ${selectedDate}?\n\nThey will be shown as Available for Booking at HQ GNT.`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          staff_id: dutyModal.staffId || dutyModal.originalStaffId,
          date: selectedDate,
          action: 'AVAILABLE_FOR_BOOKING',
          reason: `Reported fit / came out of sick leave; spare at HQ GNT available for duty booking`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report fit');
      onSuccess(`Reported Fit! ${staffName} is now marked Available for Booking at HQ GNT.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoAdvance = async () => {
    const staffId = dutyModal.staffId || dutyModal.originalStaffId;
    const staffName = dutyModal.name || 'Employee';
    if (!window.confirm(`Undo advance duty utilisation for ${staffName} on ${selectedDate} and restore regular cyclic link?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          action: 'RESET'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo advance duty');
      onSuccess(`Advance duty undone! ${staffName} returned to regular cyclic link.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoShift = async () => {
    const staffId = dutyModal.staffId || dutyModal.originalStaffId || dutyModal.shiftedStaffId;
    const staffName = dutyModal.name || dutyModal.originalStaffName || 'Employee';
    if (!window.confirm(`Undo shift for ${staffName} on ${selectedDate} and restore them to Link #${targetLink || 'Duty'}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          action: 'UNDO_SHIFT'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo shift');
      onSuccess(data.message || `Shift undone! ${staffName} restored to Link #${targetLink || 'Duty'}.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const doExecuteDelete = async (payload) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update duty status');

      onSuccess(data.message || `Duty updated: ${dutyModal.name} marked ${deleteReason} on ${selectedDate}!`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const doExecuteAssign = async (assignedStaffObj, linkNum, targetCatIdNum) => {
    setSubmitting(true);
    try {
      const assignPayload = {
        staff_id: assignedStaffObj.id,
        date: selectedDate,
        action: 'CHANGED_LINK',
        new_link_number: linkNum,
        target_category_id: targetCatIdNum,
        reason: assignReason || (linkNum ? `Assigned to Link #${linkNum}` : 'Assigned duty link')
      };

      const res = await fetch('/api/duty/change-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(assignPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign employee to duty link');

      // If the slot had an original employee on leave/sick, link them as replacement
      const origId = dutyModal.originalStaffId || (dutyModal.staffId && isSlotVacant ? dutyModal.staffId : null);
      if (origId && origId !== assignedStaffObj.id) {
        await fetch('/api/duty/change-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({
            staff_id: origId,
            date: selectedDate,
            action: dutyModal.status || 'LEAVE',
            leave_type: dutyModal.leave_type || null,
            replacement_type: 'OTHER_COLUMN',
            replacement_staff_id: assignedStaffObj.id,
            replacement_name: assignedStaffObj.name,
            reason: dutyModal.overrideReason || `Covered by replacement ${assignedStaffObj.name}`
          })
        });
      }

      // If the current slot had an active incumbent employee who is not vacant and not the same person,
      // relieve them to HQ (Available for Booking / Standby)
      if (dutyModal.staffId && !isSlotVacant && dutyModal.staffId !== assignedStaffObj.id) {
        const relievePayload = {
          staff_id: dutyModal.staffId,
          date: selectedDate,
          action: 'CHANGED_LINK',
          new_link_number: null,
          target_category_id: dutyModal.categoryId || targetCatIdNum,
          reason: `Relieved from Link #${linkNum} by ${assignedStaffObj.name}`
        };
        await fetch('/api/duty/change-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify(relievePayload)
        });
      }

      onSuccess(`Assigned ${assignedStaffObj.name} to Link #${linkNum || 'Duty'} on ${selectedDate}!`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators can modify employee duties.');
      return;
    }
    setErrorMsg('');

    try {
      // ----------------------------------------------------
      // OPTION 1: DELETE
      // Sub-options: 1. Leave, 2. Sick, 3. Advance Booked, 4. Absent, 5. Shifted Place
      // "name of the employe should only change there is no any change in link"
      // ----------------------------------------------------
      if (activeMode === 'DELETE') {
        const staffId = dutyModal.staffId;
        if (!staffId && !isSlotVacant) {
          throw new Error('Employee ID missing for this slot.');
        }

        const effectiveToDate = leaveToDate && leaveToDate >= selectedDate ? leaveToDate : selectedDate;
        const repStaffIdNum = (deleteSlotAction === 'REPLACE' && replacementStaffId) ? parseInt(replacementStaffId, 10) : null;
        const repStaffName = (deleteSlotAction === 'REPLACE') ? (selectedReplacementStaffObj?.name || replacementName || null) : null;

        let actionCode = deleteReason;
        let selectedLeaveType = null;
        let finalReason = reason;
        let placeDesc = '';

        let dayWisePayload = null;
        if (deleteReason === 'LEAVE' && leaveDates.length > 1) {
          dayWisePayload = {};
          for (const dStr of leaveDates) {
            const dType = dayWiseLeaves[dStr]?.leaveType || leaveType;
            const curCrDate = dayWiseLeaves[dStr]?.crEarnedDate || (dType === 'CR' ? (dueDates[0]?.date || null) : null);
            const selectedDueDateObj = dueDates.find(dd => dd.date === curCrDate);
            const dReason = dayWiseLeaves[dStr]?.reason || (
              dType === 'CR' && selectedDueDateObj
                ? `CR availed against rest day worked on ${selectedDueDateObj.dateDisplay || selectedDueDateObj.date} (${selectedDueDateObj.duty})`
                : (dType === 'CR' ? 'Compensatory Rest (CR)' : (dType === 'REST' ? 'Weekly Rest' : `${dType} Leave`))
            );
            dayWisePayload[dStr] = {
              leave_type: dType,
              reason: dReason,
              cr_earned_date: curCrDate
            };
          }
        }

        if (deleteReason === 'LEAVE') {
          actionCode = 'LEAVE';
          selectedLeaveType = leaveType;
          if (!finalReason) {
            if (leaveDates.length > 1 && dayWisePayload) {
              const summaryParts = leaveDates.map(d => {
                const t = dayWisePayload[d]?.leave_type || leaveType;
                const dp = d.split('-');
                return `${dp[2]}/${dp[1]}: ${t}`;
              });
              finalReason = `Leave / Rest (${summaryParts.join(', ')})`;
            } else {
              finalReason = leaveType === 'REST' ? 'Weekly Rest' : `${leaveType} Leave`;
            }
          }
        } else if (deleteReason === 'SICK') {
          actionCode = 'SICK';
          selectedLeaveType = sickType;
          if (!finalReason) finalReason = `Sick Leave (${sickType})`;
        } else if (deleteReason === 'ADVANCE_BOOKED') {
          actionCode = 'ADVANCE_BOOKED';
          if (!advanceTrainNo) {
            throw new Error('Please enter the train number utilised in advance.');
          }
          if (!finalReason) finalReason = `Advance Booked on Train No ${advanceTrainNo}`;
        } else if (deleteReason === 'ABSENT') {
          actionCode = 'ABSENT';
          if (!finalReason) finalReason = 'Unauthorized Absence [O]';
        } else if (deleteReason === 'SHIFTED') {
          actionCode = shiftedMode === 'MUTUAL' ? 'MUTUAL_SHIFT' : 'SHIFTED';
          if (shiftedMode === 'MUTUAL') {
            if (!mutualStaffId) {
              throw new Error('Please select an employee (Staff B) to perform the mutual shift of places with.');
            }
            const bName = selectedMutualStaffObj?.name || 'Staff B';
            const aName = dutyModal.name || initialStaffObj?.name || 'Staff A';
            placeDesc = `Mutual Shift with ${bName} (${staffBDutyInfo?.label || 'Duty'})`;
            if (!finalReason) {
              finalReason = mutualReason.trim() || `Mutual shift between ${aName} and ${bName}`;
            }
          } else if (shiftedMode === 'CUSTOM') {
            placeDesc = shiftedPlace.trim();
          } else if (shiftedMode === 'LINK') {
            placeDesc = shiftedLinkNum ? `Link #${shiftedLinkNum}` : '';
          } else if (shiftedMode === 'NON_DAILY') {
            const chosenTrain = (nonDailyList || []).find(t => String(t.id) === String(shiftedNonDailyId) || String(t.train_number) === String(shiftedNonDailyTrainNo).trim());
            const trNo = chosenTrain ? (chosenTrain.train_number + (chosenTrain.last_day_train_number ? `/${chosenTrain.last_day_train_number}` : '')) : (shiftedNonDailyTrainNo.trim() || 'Non-Daily Train');
            const route = chosenTrain && chosenTrain.departure_station && chosenTrain.arrival_station ? ` (${chosenTrain.departure_station} ➔ ${chosenTrain.arrival_station})` : '';
            placeDesc = `Non-Daily Train ${trNo}${route}`;
          }

          if (!placeDesc) {
            throw new Error('Please enter a shifted place/duty or select a daily/non-daily train link.');
          }
          if (!finalReason) finalReason = `Shifted to ${placeDesc}`;
        } else if (deleteReason === 'WRONG_ALLOTMENT') {
          actionCode = 'WRONG_ALLOTMENT';
          if (!finalReason) finalReason = 'Wrong Allotment Removed';
          if (deleteSlotAction === 'REPLACE' && !repStaffIdNum) {
            throw new Error('Please choose a replacement employee to assign to this link duty.');
          }
        }

        const chosenNonDaily = shiftedMode === 'NON_DAILY'
          ? ((nonDailyList || []).find(t => String(t.id) === String(shiftedNonDailyId) || String(t.train_number) === String(shiftedNonDailyTrainNo).trim()))
          : null;
        const finalExtraTrainNo = chosenNonDaily
          ? chosenNonDaily.train_number
          : (shiftedMode === 'NON_DAILY' ? (shiftedNonDailyTrainNo.trim() || null) : null);

        const payload = {
          staff_id: staffId,
          staff_b_id: shiftedMode === 'MUTUAL' && mutualStaffId ? parseInt(mutualStaffId, 10) : null,
          date: selectedDate,
          to_date: effectiveToDate,
          action: actionCode,
          leave_type: selectedLeaveType,
          day_wise_leaves: dayWisePayload,
          advance_train_no: advanceTrainNo,
          vacate_next_link: advanceVacateNext,
          shifted_mode: shiftedMode,
          shifted_place: shiftedMode === 'CUSTOM' ? shiftedPlace.trim() : (shiftedMode === 'NON_DAILY' ? (placeDesc || 'NON_DAILY_TRAIN') : (shiftedMode === 'MUTUAL' ? placeDesc : null)),
          shifted_link_number: shiftedMode === 'LINK' && shiftedLinkNum ? parseInt(shiftedLinkNum, 10) : null,
          shifted_category_id: shiftedMode === 'LINK' && shiftedCatId ? parseInt(shiftedCatId, 10) : null,
          shifted_non_daily_id: shiftedMode === 'NON_DAILY' && shiftedNonDailyId ? parseInt(shiftedNonDailyId, 10) : null,
          extra_train_no: finalExtraTrainNo,
          is_extra: shiftedMode === 'NON_DAILY' ? 1 : 0,
          link_number: targetLink ? parseInt(targetLink, 10) : null,
          target_category_id: targetCategoryId ? parseInt(targetCategoryId, 10) : null,
          reason: finalReason,
          new_link_number: null,
          replacement_type: shiftedMode === 'MUTUAL' ? 'NONE' : (deleteSlotAction === 'REPLACE' ? 'OTHER_COLUMN' : (deleteSlotAction === 'RESET' ? 'RESET' : 'NONE')),
          replacement_staff_id: shiftedMode === 'MUTUAL' ? null : repStaffIdNum,
          replacement_name: shiftedMode === 'MUTUAL' ? null : repStaffName,
          wrong_allotment_action: deleteSlotAction
        };

        // If replacement employee is currently working another train/duty, confirm before shifting
        if (shiftedMode !== 'MUTUAL' && deleteSlotAction === 'REPLACE' && selectedReplacementStaffObj) {
          const repStatus = getStaffAssignmentStatus(selectedReplacementStaffObj, selectedDate);
          if (repStatus.isUnavailable && replacementCatId !== 'ENTIRE_ROSTER') {
            throw new Error(`${selectedReplacementStaffObj.name} is currently on ${repStatus.unavailableReason || 'Rest / Leave'} on ${selectedDate} and cannot be assigned as replacement. Choose 'All Employees (Entire Roster)' if you want to assign them.`);
          }
          if (repStatus.isAssigned) {
            setShiftConfirmDialog({
              staffName: selectedReplacementStaffObj.name,
              currentTrainDesc: repStatus.trainDesc,
              targetDesc: targetLink ? `Link #${targetLink}` : 'Duty',
              onConfirm: () => doExecuteDelete(payload)
            });
            return;
          }
        }

        await doExecuteDelete(payload);
        return;
      }

      // ----------------------------------------------------
      // OPTION 2: ADD OR ASSIGN DUTY
      // "In delete and assign duty option name of the employe should only change there is no any change in link"
      // ----------------------------------------------------
      if (activeMode === 'ASSIGN_DUTY') {
        if (!assignStaffId) {
          throw new Error('Please select an employee to assign to this link duty.');
        }

        const assignedStaffObj = allStaffList.find(s => String(s.id) === String(assignStaffId));
        if (!assignedStaffObj) {
          throw new Error('Selected employee not found.');
        }

        const linkNum = targetLink ? parseInt(targetLink, 10) : null;
        const targetCatIdNum = parseInt(targetCategoryId, 10);

        // If employee is unavailable and not entire roster selection, block assignment
        const assignStatus = getStaffAssignmentStatus(assignedStaffObj, selectedDate);
        if (assignStatus.isUnavailable && assignCatId !== 'ENTIRE_ROSTER') {
          throw new Error(`${assignedStaffObj.name} is currently on ${assignStatus.unavailableReason || 'Rest / Leave'} on ${selectedDate} and cannot be assigned to duty. Choose 'All Employees (Entire Roster)' if you want to assign them.`);
        }

        // If employee is already working another train/duty, confirm before shifting
        if (assignStatus.isAssigned) {
          setShiftConfirmDialog({
            staffName: assignedStaffObj.name,
            currentTrainDesc: assignStatus.trainDesc,
            targetDesc: linkNum ? `Link #${linkNum}` : 'Duty',
            onConfirm: () => doExecuteAssign(assignedStaffObj, linkNum, targetCatIdNum)
          });
          return;
        }

        await doExecuteAssign(assignedStaffObj, linkNum, targetCatIdNum);
        return;
      }
    } catch (err) {
      setErrorMsg(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
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
      <div className="modal-content" style={{
        maxWidth: '680px',
        width: '100%',
        maxHeight: '92vh',
        maxHeight: '92dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        overflow: 'hidden',
        border: '1px solid var(--border-gold)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(212, 161, 92, 0.15)',
        borderRadius: '16px',
        background: 'var(--bg-secondary)'
      }}>

        {/* Pinned Modal Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>🏷️</span>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                Duty Assignment & Status Control
              </h2>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', margin: '3px 0 0 0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span>
                Slot Staff: <strong 
                  style={{ 
                    color: 'var(--primary)', 
                    cursor: currentStaffId ? 'pointer' : 'default', 
                    textDecoration: currentStaffId ? 'underline dotted' : 'none' 
                  }}
                  onClick={() => currentStaffId && setShowSlotStaffDuties(prev => !prev)}
                  title={currentStaffId ? "Click to view last duties performed" : undefined}
                >
                  {dutyModal.name || 'Unassigned / Vacant'}
                </strong> ({dutyModal.designation || 'Staff'}) • <span style={{ opacity: 0.85 }}>{dutyModal.categoryName || 'Staff Roster'}</span>
              </span>
              {currentStaffId && (
                <button
                  type="button"
                  onClick={() => setShowSlotStaffDuties(prev => !prev)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: showSlotStaffDuties ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.1)',
                    color: '#fbbf24',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Toggle last duties performed"
                >
                  <span>🕒 Last Duties</span>
                  <span>{showSlotStaffDuties ? '▲' : '▼'}</span>
                </button>
              )}
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
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
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
            gap: '16px'
          }}>

            {/* Target Date & Fixed Link Badge */}
            <div style={{
              background: 'rgba(212, 161, 92, 0.05)',
              border: '1px solid rgba(212, 161, 92, 0.2)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
                  📅 Duty Assignment Date:
                </label>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  Day of week: <strong>{dayOfWeek}</strong>
                </div>
              </div>
              <input 
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: 'auto', minWidth: '160px', padding: '6px 12px', fontSize: '0.88rem', fontWeight: 600 }}
              />
            </div>

            {/* FIXED LINK BANNER */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1.5px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#60a5fa' }}>
                    Fixed Duty Link: Link #{targetLink || 'N/A'} {linkDetails?.train_numbers ? `— Train ${linkDetails.train_numbers}` : (dutyModal.train_numbers ? `— Train ${dutyModal.train_numbers}` : '')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {linkDetails ? `${linkDetails.from_station} ➔ ${linkDetails.to_station} [${linkDetails.coaches || 'Coaches'}]` : 'Duty link remains fixed. Only the employee assigned changes.'}
                  </div>
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid #3b82f6', fontWeight: 700, fontSize: '0.74rem' }}>
                🔒 Link Locked
              </span>
            </div>

            {/* Slot Staff Last Duties History Accordion */}
            {showSlotStaffDuties && currentStaffId && (
              <StaffRecentDutiesView 
                staffId={currentStaffId} 
                staffName={dutyModal.name} 
                targetDate={selectedDate} 
                authToken={authToken} 
              />
            )}

            {/* Administrative Alerts (Leave, Sick, Vacant Advance) */}
            {(dutyModal.status === 'LEAVE' || dutyModal.status === 'SICK' || dutyModal.leave_type || (dutyModal.overrideReason && /leave|sick|cl|lap|lhap|nh/i.test(dutyModal.overrideReason))) && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.45)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{dutyModal.status === 'SICK' || (dutyModal.overrideReason && /sick/i.test(dutyModal.overrideReason)) ? '🤒' : '🏖️'}</span>
                  <div>
                    <strong style={{ color: '#f87171', fontSize: '0.94rem' }}>
                      Currently On {dutyModal.status === 'SICK' || (dutyModal.overrideReason && /sick/i.test(dutyModal.overrideReason)) ? 'Sick Leave' : 'Leave'} ({dutyModal.leave_type || dutyModal.overrideReason || (dutyModal.status === 'SICK' ? 'Sick' : 'Leave')})
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Original Scheduled Duty: <strong>Link #{targetLink || 'Duty'}</strong>.
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(dutyModal.status === 'SICK' || (dutyModal.overrideReason && /sick/i.test(dutyModal.overrideReason))) && (
                      <button
                        type="button"
                        onClick={handleReportFit}
                        disabled={submitting}
                        className="btn"
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title="Mark employee as reported fit and available at HQ"
                      >
                        🟢 Reported Fit (Available at HQ)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCancelLeave}
                      disabled={submitting}
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Cancel Leave
                    </button>
                  </div>
                )}
              </div>
            )}

            {(dutyModal.isVacantAdvance || dutyModal.status === 'UTILISED_ADVANCE') && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid #ef4444',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚡</span>
                  <div>
                    <strong style={{ color: '#ef4444', fontSize: '0.94rem' }} className="blink-advance">
                      ⚡ UTILISED ADVANCE BY TRAIN NO {dutyModal.advanceTrainNo || '...'}
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Slot is vacant until original next link.
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleUndoAdvance}
                    disabled={submitting}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    ↩️ Undo Advance
                  </button>
                )}
              </div>
            )}

            {(dutyModal.isVacantShifted || dutyModal.status === 'SHIFTED') && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1.5px solid #f59e0b',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🔄</span>
                  <div>
                    <strong style={{ color: '#f59e0b', fontSize: '0.94rem' }}>
                      ⚠️ SHIFTED PLACE ({dutyModal.overrideReason || 'Shifted away from this link'})
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Slot is vacant or replaced. Original employee shifted to another location/link.
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleUndoShift}
                    disabled={submitting}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    ↩️ Undo Shift
                  </button>
                )}
              </div>
            )}

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

            {/* ============================================================ */}
            {/* EXACTLY TWO OPTIONS: DELETE OR ADD / ASSIGN DUTY */}
            {/* ============================================================ */}
            <div>
              <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px' }}>
                Select Action (Two Options Only):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveMode('DELETE')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: activeMode === 'DELETE' ? '2px solid #ef4444' : '1px solid var(--border-glass)',
                    background: activeMode === 'DELETE' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255,255,255,0.02)',
                    color: activeMode === 'DELETE' ? '#f87171' : 'var(--color-text-secondary)',
                    fontWeight: activeMode === 'DELETE' ? 800 : 600,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🗑️</span>
                    <span>Delete</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                    Leave, Sick, Advance Booked, Absent, Shifted Place
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('ASSIGN_DUTY')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: activeMode === 'ASSIGN_DUTY' ? '2px solid #3b82f6' : '1px solid var(--border-glass)',
                    background: activeMode === 'ASSIGN_DUTY' ? 'rgba(59, 130, 246, 0.16)' : 'rgba(255,255,255,0.02)',
                    color: activeMode === 'ASSIGN_DUTY' ? '#60a5fa' : 'var(--color-text-secondary)',
                    fontWeight: activeMode === 'ASSIGN_DUTY' ? 800 : 600,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>➕</span>
                    <span>Add or Assign Duty</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                    Allot employee to this fixed link
                  </span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* OPTION 1 CONTENT: DELETE */}
            {/* Sub-options: 1. Leave (cl, lap, lhap, scl, od, ccl, cr, nh), 2. Sick, 3. Advance Booked, 4. Absent, 5. Shifted Place */}
            {/* ============================================================ */}
            {activeMode === 'DELETE' && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🗑️ Select Reason for Delete:</span>
                  </div>
                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.74rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    Link #{targetLink || 'Duty'} Locked
                  </span>
                </div>

                {/* 6 Reasons for Delete Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'LEAVE', label: '1. Leave', icon: '🏖️', desc: 'CL, LAP, LHAP, etc.' },
                    { id: 'SICK', label: '2. Sick', icon: '🤒', desc: 'Medical sick leave' },
                    { id: 'ADVANCE_BOOKED', label: '3. Advance Booked', icon: '⚡', desc: 'Utilised on advance train' },
                    { id: 'ABSENT', label: '4. Absent', icon: '🚫', desc: 'Unauthorized [O]' },
                    { id: 'SHIFTED', label: '5. Shifted Place', icon: '🔄', desc: 'Shifted to place / link' },
                    { id: 'WRONG_ALLOTMENT', label: '6. Wrong Allotment', icon: '❌', desc: 'Remove mistaken allotment' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setDeleteReason(r.id);
                        if (r.id === 'WRONG_ALLOTMENT') {
                          if (dutyModal.isOverridden) {
                            setDeleteSlotAction('RESET');
                          } else {
                            setDeleteSlotAction('REPLACE');
                          }
                        } else if (deleteSlotAction === 'RESET') {
                          setDeleteSlotAction('REPLACE');
                        }
                      }}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '8px',
                        border: deleteReason === r.id ? '2px solid #ef4444' : '1px solid var(--border-glass)',
                        background: deleteReason === r.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.02)',
                        color: deleteReason === r.id ? '#ffffff' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', textAlign: 'center' }}>{r.label}</span>
                      <span style={{ fontSize: '0.64rem', opacity: 0.75, textAlign: 'center' }}>{r.desc}</span>
                    </button>
                  ))}
                </div>

                {/* SUB-OPTION 1: LEAVE (all 9 types: CL, LAP, LHAP, SCL, OD, CCL, CR, NH, REST) */}
                {deleteReason === 'LEAVE' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                      📋 {leaveDates.length > 1 ? 'Select Default Leave Type (Applies to all days):' : 'Select Leave / Rest Type (All 9 options available):'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))', gap: '6px' }}>
                      {LEAVE_TYPES.map(l => {
                        const isSelected = leaveType === l.code;
                        return (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => handleSelectPrimaryLeaveType(l.code)}
                            style={{
                              padding: '8px 6px',
                              borderRadius: '6px',
                              border: isSelected ? `2px solid ${l.color}` : '1px solid var(--border-glass)',
                              background: isSelected ? l.bg : 'rgba(255,255,255,0.02)',
                              color: isSelected ? l.color : 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{l.label}</span>
                            <span style={{ fontSize: '0.66rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.title}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Date Range Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>From Date:</label>
                        <input
                          type="date"
                          className="form-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>To Date (Optional multi-day):</label>
                        <input
                          type="date"
                          className="form-input"
                          value={leaveToDate}
                          min={selectedDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                    </div>

                    {/* Multi-Day Specific Day-Wise Breakdown */}
                    {leaveDates.length > 1 ? (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1.5px solid rgba(251, 191, 36, 0.45)',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🗓️</span>
                            <strong style={{ fontSize: '0.88rem', color: '#fbbf24' }}>
                              Day-Wise Specific Leave Options ({leaveDates.length} Days Applied):
                            </strong>
                          </div>
                          {/* Summary badges of chosen leaves */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {(() => {
                              const counts = {};
                              leaveDates.forEach(d => {
                                const t = dayWiseLeaves[d]?.leaveType || leaveType;
                                counts[t] = (counts[t] || 0) + 1;
                              });
                              return Object.entries(counts).map(([type, count]) => {
                                const lt = LEAVE_TYPES.find(x => x.code === type) || { color: '#fbbf24', bg: 'rgba(251,191,36,0.2)' };
                                return (
                                  <span key={type} style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    background: lt.bg,
                                    color: lt.color,
                                    border: `1px solid ${lt.color}66`
                                  }}>
                                    {count} × {type}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          Click a pill below to set each day's specific leave type (e.g. <strong>Day 1: CR</strong>, <strong>Day 2: CL</strong> or <strong>LAP</strong>):
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '2px' }}>
                          {leaveDates.map((dStr, idx) => {
                            const dObj = new Date(dStr + 'T12:00:00');
                            const dayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const dNameLong = dayNamesLong[dObj.getDay()];
                            const dParts = dStr.split('-');
                            const dDisplay = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

                            const curDayType = dayWiseLeaves[dStr]?.leaveType || leaveType;
                            const curCrDate = dayWiseLeaves[dStr]?.crEarnedDate || (curDayType === 'CR' ? (dueDates[0]?.date || null) : null);
                            const selectedDueDateObj = dueDates.find(dd => dd.date === curCrDate);

                            return (
                              <div
                                key={dStr}
                                style={{
                                  background: curDayType === 'CR' ? 'rgba(167, 139, 250, 0.09)' : 'rgba(255, 255, 255, 0.03)',
                                  border: curDayType === 'CR' ? '1.5px solid rgba(167, 139, 250, 0.45)' : '1px solid var(--border-glass)',
                                  borderRadius: '8px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(255, 255, 255, 0.1)',
                                      color: 'var(--color-text-primary)'
                                    }}>
                                      Day {idx + 1}
                                    </span>
                                    <strong style={{ fontSize: '0.86rem', color: '#f3f4f6' }}>
                                      {dDisplay}
                                    </strong>
                                    <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                      ({dNameLong})
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    background: (LEAVE_TYPES.find(x => x.code === curDayType) || {}).bg || 'rgba(255,255,255,0.1)',
                                    color: (LEAVE_TYPES.find(x => x.code === curDayType) || {}).color || '#fff',
                                    border: `1px solid ${(LEAVE_TYPES.find(x => x.code === curDayType) || {}).color || '#fff'}55`
                                  }}>
                                    Muster Code: [{curDayType === 'REST' ? 'R' : curDayType}]
                                  </span>
                                </div>

                                {/* 9 Leave / Rest Type Choice Pills for This Specific Day */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
                                  {LEAVE_TYPES.map(l => {
                                    const isDaySelected = curDayType === l.code;
                                    return (
                                      <button
                                        key={l.code}
                                        type="button"
                                        onClick={() => handleDayLeaveTypeChange(dStr, l.code)}
                                        style={{
                                          padding: '6px 2px',
                                          borderRadius: '5px',
                                          border: isDaySelected ? `2px solid ${l.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                                          background: isDaySelected ? l.bg : 'rgba(255, 255, 255, 0.02)',
                                          color: isDaySelected ? l.color : 'var(--color-text-secondary)',
                                          fontWeight: isDaySelected ? 800 : 500,
                                          fontSize: '0.74rem',
                                          cursor: 'pointer',
                                          textAlign: 'center',
                                          transition: 'all 0.12s ease'
                                        }}
                                        title={`${l.code} - ${l.title}`}
                                      >
                                        {l.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Special Inline Due Date Selector when Day is CR */}
                                {curDayType === 'CR' && (
                                  <div style={{
                                    background: 'rgba(167, 139, 250, 0.12)',
                                    border: '1px dashed rgba(167, 139, 250, 0.45)',
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    marginTop: '2px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#ddd6fe' }}>
                                      <span>💤 <strong>Avail CR Against Forgone Rest Date:</strong></span>
                                      <span style={{ fontSize: '0.7rem', color: crCount > 0 ? '#c4b5fd' : '#f87171' }}>
                                        {crCount > 0 ? `(${crCount} Available)` : '(0 Due)'}
                                      </span>
                                    </div>
                                    {dueDates.length > 0 ? (
                                      <select
                                        className="form-input"
                                        value={curCrDate || ''}
                                        onChange={(e) => {
                                          const matched = dueDates.find(dd => dd.date === e.target.value);
                                          if (matched) handleDayCrDateSelect(dStr, matched);
                                        }}
                                        style={{ fontSize: '0.78rem', padding: '4px 8px', background: 'rgba(20, 20, 26, 0.9)', color: '#fff', border: '1px solid rgba(167, 139, 250, 0.5)' }}
                                      >
                                        {dueDates.map(dd => (
                                          <option key={dd.date} value={dd.date}>
                                            🗓️ {dd.dateDisplay || dd.date} ({dd.dayOfWeek}) — {dd.duty} [{dd.restType}]
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>
                                        ⚠️ No unredeemed rest-worked dates on record for this staff member.
                                      </div>
                                    )}
                                    {selectedDueDateObj && (
                                      <div style={{ fontSize: '0.72rem', color: '#a78bfa' }}>
                                        ✓ Redeeming rest earned on <strong>{selectedDueDateObj.dateDisplay || selectedDueDateObj.date}</strong> ({selectedDueDateObj.duty})
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        ℹ️ Muster Roll attendance marked as <strong style={{ color: '#fbbf24' }}>[{leaveType}]</strong>.
                      </div>
                    )}

                    {/* Dedicated Compensatory Rest (CR) Due Dates & Eligibility Card */}
                    {hasCrInLeave && (
                      <div style={{
                        background: 'rgba(167, 139, 250, 0.08)',
                        border: '1.5px solid rgba(167, 139, 250, 0.35)',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>💤</span>
                            <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#c4b5fd' }}>
                              Compensatory Rest (CR) Balance & Due Dates:
                            </span>
                          </div>
                          <span className="badge" style={{
                            background: crCount > 0 ? 'rgba(167, 139, 250, 0.25)' : 'rgba(239, 68, 68, 0.18)',
                            color: crCount > 0 ? '#ddd6fe' : '#f87171',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            border: crCount > 0 ? '1px solid rgba(167, 139, 250, 0.5)' : '1px solid rgba(239, 68, 68, 0.35)'
                          }}>
                            {crCount > 0 ? `✨ ${crCount} CR Available` : '⚠️ 0 CR Due'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          Dates on which <strong>{dutyModal.name || 'this employee'}</strong> worked without availing scheduled rest:
                        </div>

                        {/* Due Dates List */}
                        {dueDates.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                            {dueDates.map((item, idx) => {
                              const isSelected = selectedCrEarnedDate === item.date;
                              return (
                                <div
                                  key={item.date || idx}
                                  style={{
                                    background: isSelected ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                    border: isSelected ? '1.5px solid #a78bfa' : '1px solid rgba(167, 139, 250, 0.2)',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#f3f4f6' }}>
                                        🗓️ {item.dateDisplay || item.date}
                                      </span>
                                      <span style={{ fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 600 }}>
                                        ({item.dayOfWeekLong || item.dayOfWeek})
                                      </span>
                                      <span style={{
                                        fontSize: '0.7rem',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#93c5fd',
                                        border: '1px solid rgba(59, 130, 246, 0.3)'
                                      }}>
                                        {item.restType}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: '#e5e7eb' }}>
                                      🚆 <strong>Duty Worked:</strong> {item.duty}
                                    </div>
                                    {item.reason && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                        📝 <em>{item.reason}</em>
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCrEarnedDate(item.date);
                                      setReason(`CR availed against rest day worked on ${item.dateDisplay || item.date} (${item.duty})`);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      background: isSelected ? '#a78bfa' : 'rgba(167, 139, 250, 0.15)',
                                      color: isSelected ? '#000000' : '#c4b5fd',
                                      border: isSelected ? 'none' : '1px solid rgba(167, 139, 250, 0.4)'
                                    }}
                                  >
                                    {isSelected ? '✓ Selected' : '👉 Avail Against This Date'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.78rem',
                            color: '#fca5a5',
                            lineHeight: 1.45
                          }}>
                            <div><strong>⚠️ No Compensatory Rest (CR) Due Recorded:</strong></div>
                            <div style={{ marginTop: '2px' }}>
                              No record found of <strong>{dutyModal.name || 'this employee'}</strong> working on any scheduled weekly rest or cyclic rest days without availing rest.
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                              ℹ️ If granting a special administrative sanction, please specify the approval reference in the Remarks field.
                            </div>
                          </div>
                        )}

                        {/* Redeemed CR History (Collapsible) */}
                        {redeemedDates.length > 0 && (
                          <div style={{ marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setShowRedeemedHistory(!showRedeemedHistory)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>{showRedeemedHistory ? '▼' : '▶'}</span>
                              <span>📜 View Previously Redeemed CRs ({redeemedDates.length} availed)</span>
                            </button>
                            {showRedeemedHistory && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                {redeemedDates.map((r, i) => (
                                  <div key={i} style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', padding: '2px 6px' }}>
                                    • Availed on <strong>{r.dateDisplay || r.date}</strong> — {r.reason || 'CR Availed'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Multi-day Link Set Note if 1-day leave on Day 1 */}
                    {(!leaveToDate || leaveToDate === selectedDate) && (() => {
                      const detectedLinkSet = getLinkSetDetails(dutyModal.categoryId, targetLink);
                      if (!detectedLinkSet || !detectedLinkSet.isFirstDayOfSet || detectedLinkSet.remainingLinks.length === 0) return null;
                      return (
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontSize: '0.76rem'
                        }}>
                          <span style={{ color: '#10b981', fontWeight: 700 }}>🚆 Multi-Day Link Set ({detectedLinkSet.setLength}-Day Link #{targetLink}):</span>
                          <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>
                            1-day leave on Day 1. For next {detectedLinkSet.remainingLinks.length} day(s), employee will be marked <strong>Available for Booking</strong> at HQ (Muster [P]), and link vacated for relief.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SUB-OPTION 2: SICK */}
                {deleteReason === 'SICK' && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
                      🤒 Medical / Sick Classification:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      {[
                        { code: 'LHAP', label: 'LHAP (Sick on MC)', desc: 'Leave on Half Avg Pay (Medical)', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.18)' },
                        { code: 'SICK', label: 'SICK (Hospital / IOD)', desc: 'Medical Sick / Hospitalized', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)' },
                        { code: 'CL', label: 'CL (Sick without MC)', desc: 'Casual Leave for minor illness', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)' }
                      ].map(s => {
                        const isSelected = sickType === s.code;
                        return (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => setSickType(s.code)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isSelected ? `2px solid ${s.color}` : '1px solid var(--border-glass)',
                              background: isSelected ? s.bg : 'rgba(255,255,255,0.02)',
                              color: isSelected ? s.color : 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.84rem' }}>{s.label}</div>
                            <div style={{ fontSize: '0.68rem', opacity: 0.75 }}>{s.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Date Range Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>From Date:</label>
                        <input
                          type="date"
                          className="form-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>To Date (Optional multi-day):</label>
                        <input
                          type="date"
                          className="form-input"
                          value={leaveToDate}
                          min={selectedDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      ℹ️ Muster Roll attendance marked as <strong style={{ color: '#f87171' }}>[{sickType}]</strong>.
                    </div>
                  </div>
                )}

                {/* SUB-OPTION 3: ADVANCE BOOKED */}
                {deleteReason === 'ADVANCE_BOOKED' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                      ⚡ Advance Booked Train Details:
                    </label>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>
                        Train Number Utilised in Advance:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 17252, 12796"
                        value={advanceTrainNo}
                        onChange={(e) => setAdvanceTrainNo(e.target.value)}
                        style={{ fontSize: '0.86rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <input
                        type="checkbox"
                        id="advanceVacateCheck"
                        checked={advanceVacateNext}
                        onChange={(e) => setAdvanceVacateNext(e.target.checked)}
                      />
                      <label htmlFor="advanceVacateCheck" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                        Vacate employee's scheduled slot on this link (Slot displays blinking vacant notice until next link)
                      </label>
                    </div>
                  </div>
                )}

                {/* SUB-OPTION 4: ABSENT */}
                {deleteReason === 'ABSENT' && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#ef4444' }}>
                      🚫 Unauthorized Absence Record:
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>From Date:</label>
                        <input
                          type="date"
                          className="form-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>To Date (Optional multi-day):</label>
                        <input
                          type="date"
                          className="form-input"
                          value={leaveToDate}
                          min={selectedDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      ℹ️ Indian Railways Muster Roll attendance recorded as <strong style={{ color: '#ef4444' }}>[O] (Absent)</strong>.
                    </div>
                  </div>
                )}

                {/* SUB-OPTION 5: SHIFTED PLACE */}
                {deleteReason === 'SHIFTED' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                        🔄 Shifted Place / Duty Details:
                      </label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setShiftedMode('CUSTOM')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: shiftedMode === 'CUSTOM' ? '1px solid #fbbf24' : '1px solid var(--border-glass)',
                            background: shiftedMode === 'CUSTOM' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            color: shiftedMode === 'CUSTOM' ? '#fbbf24' : 'var(--color-text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🏢 Custom Place / Duty
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftedMode('LINK')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: shiftedMode === 'LINK' ? '1px solid #fbbf24' : '1px solid var(--border-glass)',
                            background: shiftedMode === 'LINK' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            color: shiftedMode === 'LINK' ? '#fbbf24' : 'var(--color-text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🚆 Daily Train Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftedMode('NON_DAILY')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: shiftedMode === 'NON_DAILY' ? '1px solid #fbbf24' : '1px solid var(--border-glass)',
                            background: shiftedMode === 'NON_DAILY' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            color: shiftedMode === 'NON_DAILY' ? '#fbbf24' : 'var(--color-text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🗓️ Non-Daily Train Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftedMode('MUTUAL')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: shiftedMode === 'MUTUAL' ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
                            background: shiftedMode === 'MUTUAL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                            color: shiftedMode === 'MUTUAL' ? '#38bdf8' : 'var(--color-text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🤝 Mutual Shift of Places
                        </button>
                      </div>
                    </div>

                    {shiftedMode === 'MUTUAL' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Category & Search filter */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Filter Category:</label>
                            <select
                              className="form-input"
                              value={mutualCatFilter}
                              onChange={(e) => {
                                setMutualCatFilter(e.target.value);
                                setMutualStaffId('');
                              }}
                              style={{ fontSize: '0.84rem' }}
                            >
                              <option value="ENTIRE_ROSTER">🌐 All Employees (Entire Roster)</option>
                              {(categories || []).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                              <option value="NON_DAILY">🗓️ Non-Daily Link Crew (60, 61, 62)</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Search Employee:</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Type name or HRMS ID..."
                              value={mutualSearchQuery}
                              onChange={(e) => setMutualSearchQuery(e.target.value)}
                              style={{ fontSize: '0.84rem' }}
                            />
                          </div>
                        </div>

                        {/* Staff B Select dropdown */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>
                            Select Staff B to Mutually Shift Places With ({eligibleMutualStaff.length}):
                          </label>
                          <select
                            className="form-input"
                            value={mutualStaffId}
                            onChange={(e) => setMutualStaffId(e.target.value)}
                            style={{ fontSize: '0.84rem', fontWeight: 600, color: mutualStaffId ? '#38bdf8' : 'inherit' }}
                          >
                            <option value="">-- Choose Employee to Exchange Places ({eligibleMutualStaff.length}) --</option>
                            {eligibleMutualStaff.map(s => {
                              const dInfo = getStaffDutyInfo(s, selectedDate);
                              const catName = categories?.find(c => c.id === s.category_id)?.name?.split(' ')[0] || `Cat ${s.category_id}`;
                              return (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({catName}) ➔ {dInfo.label || 'Duty'}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Live Mutual Shift Preview Card */}
                        {selectedMutualStaffObj ? (
                          <div style={{
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(99, 102, 241, 0.08))',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>🤝 Live Mutual Shift Preview (Place ↔ Place):</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>📅 {selectedDate}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                              {/* Staff A */}
                              <div style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: '6px',
                                padding: '8px 10px',
                                fontSize: '0.75rem'
                              }}>
                                <div style={{ fontWeight: 700, color: '#fbbf24' }}>
                                  👤 {dutyModal.name || initialStaffObj?.name || 'Staff A'}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                  Current: <strong style={{ color: 'var(--color-text-primary)' }}>{staffADutyInfo.label}</strong>
                                </div>
                                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', color: '#38bdf8', fontWeight: 600 }}>
                                  ➔ Will take: <strong>{staffBDutyInfo?.label || 'Duty'}</strong>
                                </div>
                              </div>

                              <div style={{ fontSize: '1.2rem', color: '#38bdf8', fontWeight: 700, textAlign: 'center' }}>
                                ⇄
                              </div>

                              {/* Staff B */}
                              <div style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: '6px',
                                padding: '8px 10px',
                                fontSize: '0.75rem'
                              }}>
                                <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                                  👤 {selectedMutualStaffObj.name}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                  Current: <strong style={{ color: 'var(--color-text-primary)' }}>{staffBDutyInfo?.label || 'Duty'}</strong>
                                </div>
                                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', color: '#fbbf24', fontWeight: 600 }}>
                                  ➔ Will take: <strong>{staffADutyInfo.label}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed rgba(255,255,255,0.15)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '0.74rem',
                            color: 'var(--color-text-muted)',
                            textAlign: 'center'
                          }}>
                            💡 Select an employee above to see live mutual duty swap preview.
                          </div>
                        )}

                        {/* Optional Reason */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                            Mutual Shift Reason / Remarks (Optional):
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={selectedMutualStaffObj ? `Mutual shift between ${dutyModal.name || 'Staff A'} and ${selectedMutualStaffObj.name}` : "e.g. Mutual consent / Admin duty shift"}
                            value={mutualReason}
                            onChange={(e) => setMutualReason(e.target.value)}
                            style={{ fontSize: '0.84rem' }}
                          />
                        </div>

                        <div style={{
                          fontSize: '0.76rem',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.08)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>ℹ️</span>
                          <span><strong>Allow & Shift:</strong> Mutually swaps employee names in the daily roster against their respective trains/links only on the selected date(s).</span>
                        </div>
                      </div>
                    ) : shiftedMode === 'CUSTOM' ? (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Shifted Location / Station / Duty Name:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Station Duty BZA, Spl Train 07002, Control Office, Lobby Duty"
                          value={shiftedPlace}
                          onChange={(e) => setShiftedPlace(e.target.value)}
                          style={{ fontSize: '0.86rem' }}
                        />
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <span>Suggestions:</span>
                          {['Station Duty BZA', 'Spl Train', 'Lobby Duty', 'HQ Standby', 'Control Office'].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setShiftedPlace(s)}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: '4px',
                                color: 'var(--primary)',
                                padding: '1px 6px',
                                fontSize: '0.7rem',
                                cursor: 'pointer'
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : shiftedMode === 'LINK' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Category:</label>
                          <select
                            className="form-input"
                            value={shiftedCatId}
                            onChange={(e) => setShiftedCatId(e.target.value)}
                            style={{ fontSize: '0.84rem' }}
                          >
                            {(categories || []).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Shifted Link Number:</label>
                          <select
                            className="form-input"
                            value={shiftedLinkNum}
                            onChange={(e) => setShiftedLinkNum(e.target.value)}
                            style={{ fontSize: '0.84rem' }}
                          >
                            <option value="">-- Choose Link --</option>
                            {(allLinksList || [])
                              .filter(l => String(l.category_id) === String(shiftedCatId))
                              .map(l => (
                                <option key={l.id || l.link_number} value={l.link_number}>
                                  Link #{l.link_number} {l.train_numbers ? `(Tr ${l.train_numbers})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Day of Week:</label>
                            <select
                              className="form-input"
                              value={shiftedNonDailyDayFilter}
                              onChange={(e) => {
                                setShiftedNonDailyDayFilter(e.target.value);
                                setShiftedNonDailyId('');
                              }}
                              style={{ fontSize: '0.84rem' }}
                            >
                              <option value="AUTO">📅 Auto ({selectedDateDayOfWeek})</option>
                              <option value="ALL">📋 All Days ({nonDailyList?.length || 0})</option>
                              {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => (
                                <option key={day} value={day}>{day}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>
                              Select Non-Daily Train ({availableNonDailyTrains.length}):
                            </label>
                            <select
                              className="form-input"
                              value={shiftedNonDailyId}
                              onChange={(e) => {
                                setShiftedNonDailyId(e.target.value);
                                const found = (nonDailyList || []).find(t => String(t.id) === String(e.target.value));
                                if (found) {
                                  setShiftedNonDailyTrainNo(found.train_number);
                                }
                              }}
                              style={{ fontSize: '0.84rem', fontWeight: 600 }}
                            >
                              <option value="">-- Choose Non-Daily Service ({availableNonDailyTrains.length}) --</option>
                              {availableNonDailyTrains.map(t => (
                                <option key={t.id} value={t.id}>
                                  Tr {t.train_number}{t.last_day_train_number ? `/${t.last_day_train_number}` : ''} {t.departure_station ? `(${t.departure_station} ➔ ${t.arrival_station})` : ''} {t.departure_time ? `[${t.departure_time} - ${t.arrival_time || '---'}]` : ''} ({t.day_of_week})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Optional Custom Train Number Override / Quick Type */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                              Train Number / Pair (Auto-filled or Custom):
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. 12842 or 07002/07001"
                              value={shiftedNonDailyTrainNo}
                              onChange={(e) => {
                                setShiftedNonDailyTrainNo(e.target.value);
                                const match = (nonDailyList || []).find(t => String(t.train_number) === e.target.value.trim());
                                if (match) setShiftedNonDailyId(String(match.id));
                              }}
                              style={{ fontSize: '0.84rem' }}
                            />
                          </div>
                          {selectedNonDailyObj && (
                            <div style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.74rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: '2px'
                            }}>
                              <div style={{ fontWeight: 700, color: '#60a5fa' }}>
                                🚆 Train {selectedNonDailyObj.train_number}{selectedNonDailyObj.last_day_train_number ? ` / ${selectedNonDailyObj.last_day_train_number}` : ''} ({selectedNonDailyObj.day_of_week})
                              </div>
                              <div style={{ color: 'var(--color-text-secondary)' }}>
                                Route: <strong>{selectedNonDailyObj.departure_station || '---'} ({selectedNonDailyObj.departure_time || '--:--'})</strong> ➔ <strong>{selectedNonDailyObj.arrival_station || '---'} ({selectedNonDailyObj.arrival_time || '--:--'})</strong>
                              </div>
                              {selectedNonDailyObj.coaches && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                  Coaches: {selectedNonDailyObj.coaches} {selectedNonDailyObj.last_day_coaches ? `| Return: ${selectedNonDailyObj.last_day_coaches}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Date Range Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>From Date:</label>
                        <input
                          type="date"
                          className="form-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem' }}>To Date (Optional multi-day):</label>
                        <input
                          type="date"
                          className="form-input"
                          value={leaveToDate}
                          min={selectedDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      ℹ️ Employee is on duty — Muster Roll attendance recorded as <strong style={{ color: '#10b981' }}>[P] (Present)</strong>.
                    </div>
                  </div>
                )}

                {/* SUB-OPTION 6: WRONG ALLOTMENT */}
                {deleteReason === 'WRONG_ALLOTMENT' && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
                        ❌ Remove as Wrong Allotment:
                      </label>
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.72rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                        Correction
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.45 }}>
                      Remove <strong>{dutyModal.name || 'this employee'}</strong> from <strong>Link #{targetLink || 'Duty'}</strong> on <strong>{selectedDate}</strong> because they were wrongly allotted.
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>Correction Note / Remarks:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Allotted by mistake / Wrong employee selected"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{ fontSize: '0.84rem' }}
                      />
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                      ℹ️ The employee's mistaken allotment on this link will be removed and their duty assignment corrected.
                    </div>
                  </div>
                )}

                {/* Slot Action: Replace with Another Employee (name changes, link fixed) or Leave Vacant */}
                {!(deleteReason === 'SHIFTED' && shiftedMode === 'MUTUAL') && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>
                        What happens to this slot on Link #{targetLink || 'Duty'}?
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        (Link is fixed — only employee name changes)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {deleteReason === 'WRONG_ALLOTMENT' && dutyModal.isOverridden && (
                        <button
                          type="button"
                          onClick={() => setDeleteSlotAction('RESET')}
                          style={{
                            flex: 1,
                            minWidth: '160px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: deleteSlotAction === 'RESET' ? '2px solid #3b82f6' : '1px solid var(--border-glass)',
                            background: deleteSlotAction === 'RESET' ? 'rgba(59, 130, 246, 0.16)' : 'rgba(255,255,255,0.02)',
                            color: deleteSlotAction === 'RESET' ? '#60a5fa' : 'var(--color-text-secondary)',
                            fontWeight: deleteSlotAction === 'RESET' ? 700 : 500,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          ⏮️ Revert to Original Roster
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteSlotAction('REPLACE')}
                        style={{
                          flex: 1,
                          minWidth: '160px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: deleteSlotAction === 'REPLACE' ? '2px solid #10b981' : '1px solid var(--border-glass)',
                          background: deleteSlotAction === 'REPLACE' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255,255,255,0.02)',
                          color: deleteSlotAction === 'REPLACE' ? '#34d399' : 'var(--color-text-secondary)',
                          fontWeight: deleteSlotAction === 'REPLACE' ? 700 : 500,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {deleteReason === 'WRONG_ALLOTMENT' ? '🔄 Replace with Correct Employee' : '🔄 Replace with Another Employee'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSlotAction('VACANT')}
                        style={{
                          flex: 1,
                          minWidth: '140px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: deleteSlotAction === 'VACANT' ? '2px solid #ef4444' : '1px solid var(--border-glass)',
                          background: deleteSlotAction === 'VACANT' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255,255,255,0.02)',
                          color: deleteSlotAction === 'VACANT' ? '#f87171' : 'var(--color-text-secondary)',
                          fontWeight: deleteSlotAction === 'VACANT' ? 700 : 500,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        🚫 Leave Slot Vacant
                      </button>
                    </div>

                    {deleteSlotAction === 'RESET' && (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        fontSize: '0.8rem',
                        color: '#93c5fd'
                      }}>
                        ℹ️ This will undo the mistaken assignment on <strong>Link #{targetLink || 'Duty'}</strong> and restore the original cyclic roster baseline.
                      </div>
                    )}

                    {deleteSlotAction === 'VACANT' && deleteReason === 'WRONG_ALLOTMENT' && (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: '0.8rem',
                        color: '#fca5a5'
                      }}>
                        ℹ️ <strong>{dutyModal.name || 'This employee'}</strong> will be removed from Link #{targetLink || 'Duty'} on {selectedDate}. The slot will remain <strong>[UNMANNED / VACANT]</strong>.
                      </div>
                    )}

                    {deleteSlotAction === 'REPLACE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        {/* Filter by Category */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {[
                            { id: 'ENTIRE_ROSTER', label: '👥 All Employees (Entire Roster)' },
                            { id: 'ALL', label: '🟢 All Available' },
                            { id: '1', label: 'Conductors' },
                            { id: '2', label: 'Sleeper' },
                            { id: '3', label: 'Ladies' },
                            { id: '4', label: 'LR Pool' },
                            { id: 'NON_DAILY', label: '⚡ Non-Daily (60, 61, 62)' }
                          ].map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setReplacementCatId(c.id);
                                setReplacementStaffId('');
                                setReplacementName('');
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: replacementCatId === c.id ? '1px solid #10b981' : '1px solid var(--border-glass)',
                                background: replacementCatId === c.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                                color: replacementCatId === c.id ? '#34d399' : 'var(--color-text-secondary)',
                                fontSize: '0.74rem',
                                fontWeight: replacementCatId === c.id ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label" style={{ fontSize: '0.78rem', margin: 0 }}>
                            Choose Replacement Employee:
                          </label>
                          <label style={{ fontSize: '0.74rem', color: showAlreadyAssigned ? '#f59e0b' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={showAlreadyAssigned}
                              onChange={(e) => setShowAlreadyAssigned(e.target.checked)}
                            />
                            <span>⚠️ Show busy / assigned staff (to shift duty)</span>
                          </label>
                        </div>

                        {/* Dropdown */}
                        <select
                          className="form-input"
                          value={replacementStaffId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReplacementStaffId(val);
                            const found = allStaffList.find(s => String(s.id) === String(val));
                            if (found) setReplacementName(found.name);
                          }}
                          style={{ fontSize: '0.84rem' }}
                        >
                          <option value="">-- Choose Replacement Employee ({eligibleReplacementStaff.length} {replacementCatId === 'ENTIRE_ROSTER' ? 'total employees' : 'available'}) --</option>
                          {eligibleReplacementStaff.map(s => {
                            const dutyInfo = getStaffDutyInfo(s, selectedDate);
                            const assignStatus = getStaffAssignmentStatus(s, selectedDate);
                            const catName = categories.find(c => c.id === s.category_id)?.name || 'Staff';
                            let statusPrefix = '';
                            if (assignStatus.isAssigned) {
                              statusPrefix = `⚠️ [BUSY: ${assignStatus.trainDesc}] `;
                            } else if (assignStatus.isUnavailable) {
                              statusPrefix = `🏖️ [${assignStatus.unavailableReason || 'REST/LEAVE'}] `;
                            } else {
                              statusPrefix = '🟢 [AVAILABLE] ';
                            }
                            return (
                              <option key={s.id} value={s.id}>
                                {statusPrefix}{s.name} ({s.designation || 'Staff'}) • [{catName}] — {dutyInfo.label}
                              </option>
                            );
                          })}
                        </select>
                        {eligibleReplacementStaff.length === 0 && (
                          <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px' }}>
                            💡 No employees currently available for booking in this pool.
                            {!showAlreadyAssigned && ' Check "Show busy / assigned staff" above to shift a working staff member, or select "All Employees (Entire Roster)".'}
                          </div>
                        )}

                        {selectedReplacementStaffObj && (() => {
                          const repAssignStatus = getStaffAssignmentStatus(selectedReplacementStaffObj, selectedDate);
                          const dutyInfo = getStaffDutyInfo(selectedReplacementStaffObj, selectedDate);
                          const catName = categories.find(c => c.id === selectedReplacementStaffObj.category_id)?.name || 'Staff';

                          let badgeColor = '#34d399';
                          let badgeBg = 'rgba(16, 185, 129, 0.25)';
                          let cardBorder = 'rgba(16, 185, 129, 0.3)';
                          let cardBg = 'rgba(16, 185, 129, 0.1)';
                          let badgeText = dutyInfo.label;
                          let subText = <span><strong>{selectedReplacementStaffObj.name}</strong> will take over Link #{targetLink || 'Duty'} on {selectedDate} (Muster: <strong>[P]</strong>).</span>;

                          if (repAssignStatus.isAssigned) {
                            badgeColor = '#fbbf24';
                            badgeBg = 'rgba(245, 158, 11, 0.25)';
                            cardBorder = 'rgba(245, 158, 11, 0.35)';
                            cardBg = 'rgba(245, 158, 11, 0.12)';
                            badgeText = `Busy on ${repAssignStatus.trainDesc}`;
                            subText = <span><strong>{selectedReplacementStaffObj.name}</strong> is currently assigned to <strong>{repAssignStatus.trainDesc}</strong>. Submitting will show a confirmation prompt to shift them to Link #{targetLink || 'Duty'} and vacate their previous slot.</span>;
                          } else if (repAssignStatus.isUnavailable) {
                            badgeColor = '#c084fc';
                            badgeBg = 'rgba(192, 132, 252, 0.25)';
                            cardBorder = 'rgba(192, 132, 252, 0.4)';
                            cardBg = 'rgba(192, 132, 252, 0.1)';
                            badgeText = repAssignStatus.unavailableReason || 'Rest / Leave';
                            subText = <span><strong>{selectedReplacementStaffObj.name}</strong> is currently on <strong>{repAssignStatus.unavailableReason || 'Rest / Leave'}</strong>. Submitting will assign them to take over Link #{targetLink || 'Duty'} on {selectedDate} (Muster: <strong>[P]</strong>).</span>;
                          }

                          return (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              background: cardBg,
                              border: `1px solid ${cardBorder}`,
                              fontSize: '0.8rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: badgeColor }}>
                                  👤 {selectedReplacementStaffObj.name} ({selectedReplacementStaffObj.designation || 'Staff'}) • [{catName}]
                                </strong>
                                <span className="badge" style={{ background: badgeBg, color: badgeColor, fontSize: '0.72rem' }}>
                                  {badgeText}
                                </span>
                              </div>
                              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.74rem' }}>
                                {subText}
                              </div>
                              <StaffRecentDutiesView 
                                staffId={selectedReplacementStaffObj.id} 
                                staffName={selectedReplacementStaffObj.name} 
                                targetDate={selectedDate} 
                                authToken={authToken} 
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {deleteSlotAction === 'VACANT' && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                        Slot on Link #{targetLink || 'Duty'} will show as <strong>[VACANT]</strong> on {selectedDate}.
                      </div>
                    )}
                  </div>
                )}

                {/* Remarks */}
                {!(deleteReason === 'SHIFTED' && shiftedMode === 'MUTUAL') && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Remarks / Reason:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={`e.g. Relieved for ${deleteReason} / Operational adjustment`}
                      style={{ fontSize: '0.84rem' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* OPTION 2 CONTENT: ADD OR ASSIGN DUTY */}
            {/* "name of the employe should only change there is no any change in link" */}
            {/* ============================================================ */}
            {activeMode === 'ASSIGN_DUTY' && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1.5px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>➕ Add or Assign Duty to Link #{targetLink || 'Duty'}:</span>
                  </div>
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid #3b82f6', fontWeight: 700, fontSize: '0.74rem' }}>
                    Fixed Link Assignment
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                  Duty link is fixed to <strong>Link #{targetLink || 'N/A'}</strong>. Select which employee will be assigned to work this link on <strong>{selectedDate}</strong>.
                  {!isSlotVacant && dutyModal.name && (
                    <div style={{ marginTop: '4px', color: '#fbbf24' }}>
                      ℹ️ Current slot employee <strong>{dutyModal.name}</strong> will be relieved to HQ (Available for Booking / Standby).
                    </div>
                  )}
                </div>

                {/* Filter by Category */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                    Filter by Staff Category:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'ENTIRE_ROSTER', label: '👥 All Employees (Entire Roster)' },
                      { id: 'ALL', label: '🟢 All Available' },
                      { id: '1', label: 'Conductors (COR)' },
                      { id: '2', label: 'Sleeper / TTI' },
                      { id: '3', label: 'Ladies / TTE' },
                      { id: '4', label: 'LR Relief Pool' },
                      { id: 'NON_DAILY', label: '⚡ Non-Daily (60, 61, 62)' }
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setAssignCatId(c.id);
                          setAssignStaffId('');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: assignCatId === c.id ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                          background: assignCatId === c.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)',
                          color: assignCatId === c.id ? '#60a5fa' : 'var(--color-text-secondary)',
                          fontSize: '0.78rem',
                          fontWeight: assignCatId === c.id ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Employee Selector Dropdown */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>
                      Select Employee to Assign:
                    </label>
                    <label style={{ fontSize: '0.74rem', color: showAlreadyAssigned ? '#f59e0b' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={showAlreadyAssigned}
                        onChange={(e) => setShowAlreadyAssigned(e.target.checked)}
                      />
                      <span>⚠️ Show busy / assigned staff (to shift duty)</span>
                    </label>
                  </div>
                  <select
                    className="form-input"
                    value={assignStaffId}
                    onChange={(e) => setAssignStaffId(e.target.value)}
                    style={{ fontSize: '0.86rem', fontWeight: 600 }}
                  >
                    <option value="">-- Choose Employee to Assign ({eligibleAssignStaff.length} {assignCatId === 'ENTIRE_ROSTER' ? 'total employees' : 'candidates'}) --</option>
                    {eligibleAssignStaff.map(s => {
                      const dutyInfo = getStaffDutyInfo(s, selectedDate);
                      const assignStatus = getStaffAssignmentStatus(s, selectedDate);
                      const catName = categories.find(c => c.id === s.category_id)?.name || 'Staff';
                      let statusPrefix = '';
                      if (assignStatus.isAssigned) {
                        statusPrefix = `⚠️ [BUSY: ${assignStatus.trainDesc}] `;
                      } else if (assignStatus.isUnavailable) {
                        statusPrefix = `🏖️ [${assignStatus.unavailableReason || 'REST/LEAVE'}] `;
                      } else {
                        statusPrefix = '🟢 [AVAILABLE] ';
                      }
                      return (
                        <option key={s.id} value={s.id}>
                          {statusPrefix}{s.name} ({s.designation || 'Staff'}) • [{catName}] — {dutyInfo.label}
                        </option>
                      );
                    })}
                  </select>
                  {eligibleAssignStaff.length === 0 && (
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px' }}>
                      💡 No employees currently available for booking in this pool.
                      {!showAlreadyAssigned && ' Check "Show busy / assigned staff" above to shift a working staff member, or select "All Employees (Entire Roster)".'}
                    </div>
                  )}
                </div>

                {/* Selected Assignee Card */}
                {selectedAssignStaffObj && (() => {
                  const selAssignStatus = getStaffAssignmentStatus(selectedAssignStaffObj, selectedDate);
                  const dutyInfo = getStaffDutyInfo(selectedAssignStaffObj, selectedDate);
                  const catName = categories.find(c => c.id === selectedAssignStaffObj.category_id)?.name || 'Staff';

                  let badgeColor = '#60a5fa';
                  let badgeBg = 'rgba(59, 130, 246, 0.25)';
                  let cardBorder = 'rgba(59, 130, 246, 0.35)';
                  let cardBg = 'rgba(59, 130, 246, 0.08)';
                  let badgeText = dutyInfo.label;
                  let subText = <span>Will be assigned to <strong>Link #{targetLink || 'Duty'}</strong> on <strong>{selectedDate}</strong> (Muster: <strong>[P]</strong>).</span>;

                  if (selAssignStatus.isAssigned) {
                    badgeColor = '#fbbf24';
                    badgeBg = 'rgba(245, 158, 11, 0.25)';
                    cardBorder = 'rgba(245, 158, 11, 0.4)';
                    cardBg = 'rgba(245, 158, 11, 0.12)';
                    badgeText = `Busy on ${selAssignStatus.trainDesc}`;
                    subText = <span>⚠️ Currently busy on <strong>{selAssignStatus.trainDesc}</strong>. Submitting will show a confirmation prompt to shift them to <strong>Link #{targetLink || 'Duty'}</strong> and vacate their previous slot.</span>;
                  } else if (selAssignStatus.isUnavailable) {
                    badgeColor = '#c084fc';
                    badgeBg = 'rgba(192, 132, 252, 0.25)';
                    cardBorder = 'rgba(192, 132, 252, 0.4)';
                    cardBg = 'rgba(192, 132, 252, 0.1)';
                    badgeText = selAssignStatus.unavailableReason || 'Rest / Leave';
                    subText = <span>ℹ️ Currently on <strong>{selAssignStatus.unavailableReason || 'Rest / Leave'}</strong>. Submitting will assign them to <strong>Link #{targetLink || 'Duty'}</strong> on <strong>{selectedDate}</strong> (Muster: <strong>[P]</strong>).</span>;
                  }

                  return (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: badgeColor }}>
                          👤 {selectedAssignStaffObj.name} ({selectedAssignStaffObj.designation || 'Staff'}) • [{catName}]
                        </strong>
                        <span className="badge" style={{ background: badgeBg, color: badgeColor, fontSize: '0.72rem' }}>
                          {badgeText}
                        </span>
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.76rem' }}>
                        {subText}
                      </div>
                      <StaffRecentDutiesView 
                        staffId={selectedAssignStaffObj.id} 
                        staffName={selectedAssignStaffObj.name} 
                        targetDate={selectedDate} 
                        authToken={authToken} 
                      />
                    </div>
                  );
                })()}

                {/* Assign Reason */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Reason / Assignment Notes:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    placeholder={`e.g. Assigned to Link #${targetLink || 'Duty'} / Operational relief`}
                    style={{ fontSize: '0.84rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pinned Modal Footer */}
          <div style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderTop: '1px solid var(--border-glass)',
            background: 'rgba(12, 12, 16, 0.95)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {dutyModal.isOverridden && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={submitting}
                  className="btn btn-secondary"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.8rem',
                    padding: '8px 12px'
                  }}
                  title="Remove override and restore master cyclic rotation"
                >
                  🔄 Reset to Cyclic
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  background: activeMode === 'DELETE' 
                    ? ((deleteReason === 'SHIFTED' && shiftedMode === 'MUTUAL')
                        ? 'linear-gradient(135deg, #0284c7, #0369a1)' 
                        : 'linear-gradient(135deg, #ef4444, #dc2626)')
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  padding: '8px 20px',
                  minWidth: '160px',
                  boxShadow: (activeMode === 'DELETE' && deleteReason === 'SHIFTED' && shiftedMode === 'MUTUAL')
                    ? '0 0 16px rgba(2, 132, 199, 0.45)'
                    : 'none'
                }}
              >
                {submitting ? 'Shifting...' :
                 activeMode === 'DELETE' ? (
                   deleteReason === 'WRONG_ALLOTMENT'
                     ? (deleteSlotAction === 'REPLACE' ? '🔄 Replace Wrong Allotment' : (deleteSlotAction === 'RESET' ? '⏮️ Revert Wrong Allotment' : '❌ Remove Wrong Allotment'))
                     : (deleteReason === 'SHIFTED' 
                         ? (shiftedMode === 'MUTUAL' ? '🤝 Allow & Shift Employee Names' : '🔄 Shift & Save Duty') 
                         : `🗑️ Delete & Save Status`)
                 ) :
                 `➕ Assign to Link #${targetLink || 'Duty'}`}
              </button>
            </div>
          </div>
        </form>

        {/* Shift Confirmation Pop-up Modal */}
        {shiftConfirmDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '460px',
              width: '100%',
              background: '#18181b',
              border: '2px solid #f59e0b',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.25)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', margin: '0 0 10px 0' }}>
                Confirm Employee Shift
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5, marginBottom: '16px' }}>
                <strong>{shiftConfirmDialog.staffName}</strong> is already working{' '}
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>{shiftConfirmDialog.currentTrainDesc}</span> on {selectedDate}.
              </p>
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.84rem',
                color: '#fbbf24',
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                📌 <strong>What will happen:</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Staff will be shifted to <strong>{shiftConfirmDialog.targetDesc}</strong>.</li>
                  <li>Their slot on <strong>{shiftConfirmDialog.currentTrainDesc}</strong> will immediately show as <strong style={{ color: '#ef4444' }}>[VACANT]</strong>.</li>
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShiftConfirmDialog(null)}
                  style={{ padding: '8px 18px', fontSize: '0.86rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const cb = shiftConfirmDialog.onConfirm;
                    setShiftConfirmDialog(null);
                    if (cb) cb();
                  }}
                  style={{
                    padding: '8px 22px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    color: '#000'
                  }}
                >
                  Confirm & Shift Staff
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
