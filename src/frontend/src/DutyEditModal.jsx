import React, { useState, useMemo, useCallback } from 'react';

// Multi-day link sets for Indian Railways train roster
export const KNOWN_LINK_SETS = {
  1: [
    [1, 2, 3],
    [4, 5, 6],
    [8, 9, 10, 11],
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
    if (isSlotVacant) return 'ASSIGN_DUTY';
    return 'DELETE';
  });

  // SUB-OPTIONS UNDER DELETE: 'LEAVE', 'SICK', 'ADVANCE_BOOKED', 'ABSENT', 'SHIFTED'
  const [deleteReason, setDeleteReason] = useState(() => {
    if (dutyModal.isVacantShifted || dutyModal.status === 'SHIFTED') return 'SHIFTED';
    if (dutyModal.status === 'SICK') return 'SICK';
    if (dutyModal.status === 'ABSENT') return 'ABSENT';
    if (dutyModal.isVacantAdvance || dutyModal.status === 'UTILISED_ADVANCE') return 'ADVANCE_BOOKED';
    return 'LEAVE';
  });

  // All 8 Leave Types under Leave: CL, LAP, LHAP, SCL, OD, CCL, CR, NH
  const [leaveType, setLeaveType] = useState(() => {
    if (dutyModal.leave_type) return dutyModal.leave_type.toUpperCase();
    if (dutyModal.overrideReason) {
      const match = dutyModal.overrideReason.match(/\b(CL|LAP|LHAP|SCL|OD|CCL|CR|NH)\b/i);
      if (match) return match[1].toUpperCase();
    }
    return 'CL';
  });

  // Sick medical classification: LHAP (MC), SICK (Hospital), CL (Minor)
  const [sickType, setSickType] = useState(() => {
    if (dutyModal.leave_type) return dutyModal.leave_type.toUpperCase();
    return 'LHAP';
  });

  // Advance Booked inputs
  const [advanceTrainNo, setAdvanceTrainNo] = useState(dutyModal.advanceTrainNo || '');
  const [advanceVacateNext, setAdvanceVacateNext] = useState(true);

  // Shifted Place inputs
  const [shiftedMode, setShiftedMode] = useState('CUSTOM'); // 'CUSTOM' or 'LINK'
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

  // Multi-day date range for Leave / Sick / Absent / Shifted
  const [leaveToDate, setLeaveToDate] = useState(dutyModal.date || selectedDate);

  // Slot action under Delete: 'REPLACE' (name changes, link fixed) or 'VACANT'
  const [deleteSlotAction, setDeleteSlotAction] = useState('REPLACE');
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [replacementCatId, setReplacementCatId] = useState('ALL');
  // Assign Duty state (name changes, link fixed)
  const [assignStaffId, setAssignStaffId] = useState(
    isSlotVacant ? '' : (dutyModal.staffId ? String(dutyModal.staffId) : '')
  );
  const [assignCatId, setAssignCatId] = useState('ALL');
  const [assignReason, setAssignReason] = useState('');

  // Remarks & general reason
  const [reason, setReason] = useState(dutyModal.overrideReason || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fixed link & category calculation:
  // "In delete and assign duty option name of the employe should only change there is no any change in link"
  const targetCategoryId = useMemo(() => {
    if (dutyModal.categoryId && dutyModal.categoryId !== 4) return String(dutyModal.categoryId);
    return '1';
  }, [dutyModal.categoryId]);

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
        if (activeDuty.link_number !== null && activeDuty.link_number !== undefined) {
          const lNum = parseInt(activeDuty.link_number, 10);
          const trStr = activeDuty.train_numbers && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.train_numbers)
            ? `Tr ${activeDuty.train_numbers}`
            : '';
          return {
            label: `Link #${lNum}${trStr ? ` (${trStr})` : ''}`,
            isRest: false,
            isLr: staffMember.category_id === 4,
            linkNum: lNum
          };
        }
        if (activeDuty.isRest || activeDuty.status === 'REST') {
          return {
            label: 'Weekly REST',
            isRest: true,
            isLr: staffMember.category_id === 4,
            linkNum: null
          };
        }
        if (activeDuty.status === 'AVAILABLE_FOR_BOOKING') {
          return {
            label: '⚡ Available for Booking',
            isRest: false,
            isLr: false,
            linkNum: null
          };
        }
        if (['SICK', 'LEAVE', 'CR', 'ABSENT'].includes(activeDuty.status)) {
          return {
            label: `${activeDuty.status} [${activeDuty.leave_type || activeDuty.status}]`,
            isRest: true,
            isLr: false,
            linkNum: null
          };
        }
      }
    }

    if (staffMember.category_id === 4) {
      return {
        label: staffMember.rest_day && staffMember.rest_day !== '-' ? `LR Pool [Rest: ${staffMember.rest_day}]` : 'LR Relief Pool',
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
    return {
      label: `Link #${linkNum} (${linkDef.train_numbers ? `Tr ${linkDef.train_numbers}` : 'Duty'})`,
      isRest: false,
      isLr: false,
      linkNum
    };
  }, [categories, allLinksList, dailyDuties, allDailyStaffDuties]);

  // Eligible replacement staff for Delete mode (Strictly in Alphabetical Order A to Z)
  const eligibleReplacementStaff = useMemo(() => {
    if (!allStaffList) return [];
    return allStaffList
      .filter(s => {
        if (s.id === dutyModal.staffId) return false;
        if (!s.name || s.name.toUpperCase().includes('VACANT')) return false;
        if (replacementCatId && replacementCatId !== 'ALL') {
          if (String(s.category_id) !== String(replacementCatId)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [allStaffList, dutyModal.staffId, replacementCatId]);

  // Selected replacement staff object
  const selectedReplacementStaffObj = useMemo(() => {
    if (!replacementStaffId || !allStaffList) return null;
    return allStaffList.find(s => String(s.id) === String(replacementStaffId)) || null;
  }, [replacementStaffId, allStaffList]);

  // Eligible staff for Assign Duty mode (Strictly in Alphabetical Order A to Z)
  const eligibleAssignStaff = useMemo(() => {
    if (!allStaffList) return [];
    return allStaffList
      .filter(s => {
        if (!s.name || s.name.toUpperCase().includes('VACANT')) return false;
        if (assignCatId && assignCatId !== 'ALL') {
          if (String(s.category_id) !== String(assignCatId)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [allStaffList, assignCatId]);

  // Selected assign staff object
  const selectedAssignStaffObj = useMemo(() => {
    if (!assignStaffId || !allStaffList) return null;
    return allStaffList.find(s => String(s.id) === String(assignStaffId)) || null;
  }, [assignStaffId, allStaffList]);

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

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators can modify employee duties.');
      return;
    }
    setSubmitting(true);
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

        if (deleteReason === 'LEAVE') {
          actionCode = 'LEAVE';
          selectedLeaveType = leaveType;
          if (!finalReason) finalReason = `${leaveType} Leave`;
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
          actionCode = 'SHIFTED';
          const placeDesc = shiftedMode === 'CUSTOM' ? shiftedPlace.trim() : (shiftedLinkNum ? `Link #${shiftedLinkNum}` : '');
          if (!placeDesc) {
            throw new Error('Please enter a shifted place/duty or select a train link.');
          }
          if (!finalReason) finalReason = `Shifted to ${placeDesc}`;
        }

        const payload = {
          staff_id: staffId,
          date: selectedDate,
          to_date: effectiveToDate,
          action: actionCode,
          leave_type: selectedLeaveType,
          advance_train_no: advanceTrainNo,
          vacate_next_link: advanceVacateNext,
          shifted_place: shiftedMode === 'CUSTOM' ? shiftedPlace.trim() : null,
          shifted_link_number: shiftedMode === 'LINK' && shiftedLinkNum ? parseInt(shiftedLinkNum, 10) : null,
          shifted_category_id: shiftedMode === 'LINK' && shiftedCatId ? parseInt(shiftedCatId, 10) : null,
          reason: finalReason,
          new_link_number: null,
          replacement_type: deleteSlotAction === 'REPLACE' ? 'OTHER_COLUMN' : 'NONE',
          replacement_staff_id: repStaffIdNum,
          replacement_name: repStaffName
        };

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
        const linkNum = targetLink ? parseInt(targetLink, 10) : null;
        const targetCatIdNum = parseInt(targetCategoryId, 10);

        const assignPayload = {
          staff_id: parseInt(assignStaffId, 10),
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

        // If the current slot had an active employee who is not vacant and not the same person,
        // relieve them to HQ (Available for Booking / Standby)
        if (dutyModal.staffId && !isSlotVacant && dutyModal.staffId !== parseInt(assignStaffId, 10)) {
          const relievePayload = {
            staff_id: dutyModal.staffId,
            date: selectedDate,
            action: 'CHANGED_LINK',
            new_link_number: null,
            target_category_id: dutyModal.categoryId || targetCatIdNum,
            reason: `Relieved from Link #${linkNum} by ${assignedStaffObj?.name || 'replacement staff'}`
          };
          await fetch('/api/duty/change-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(relievePayload)
          });
        }

        onSuccess(`Assigned ${assignedStaffObj?.name} to Link #${linkNum || 'Duty'} on ${selectedDate}!`);
        onClose();
        return;
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
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
            <p style={{ color: 'var(--color-text-secondary)', margin: '3px 0 0 0', fontSize: '0.82rem' }}>
              Slot Staff: <strong style={{ color: 'var(--primary)' }}>{dutyModal.name || 'Unassigned / Vacant'}</strong> ({dutyModal.designation || 'Staff'}) • <span style={{ opacity: 0.85 }}>{dutyModal.categoryName || 'Staff Roster'}</span>
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
                  <span style={{ fontSize: '1.5rem' }}>🏖️</span>
                  <div>
                    <strong style={{ color: '#f87171', fontSize: '0.94rem' }}>
                      Currently On {dutyModal.status === 'SICK' ? 'Sick Leave' : 'Leave'} ({dutyModal.leave_type || dutyModal.overrideReason || 'Leave'})
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Original Scheduled Duty: <strong>Link #{targetLink || 'Duty'}</strong>.
                    </div>
                  </div>
                </div>
                {isAdmin && (
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

                {/* 5 Reasons for Delete Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'LEAVE', label: '1. Leave', icon: '🏖️', desc: 'CL, LAP, LHAP, etc.' },
                    { id: 'SICK', label: '2. Sick', icon: '🤒', desc: 'Medical sick leave' },
                    { id: 'ADVANCE_BOOKED', label: '3. Advance Booked', icon: '⚡', desc: 'Utilised on advance train' },
                    { id: 'ABSENT', label: '4. Absent', icon: '🚫', desc: 'Unauthorized [O]' },
                    { id: 'SHIFTED', label: '5. Shifted Place', icon: '🔄', desc: 'Shifted to place / link' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setDeleteReason(r.id)}
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

                {/* SUB-OPTION 1: LEAVE (all 8 types: CL, LAP, LHAP, SCL, OD, CCL, CR, NH) */}
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
                      📋 Select Leave Type (All 8 types available):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        { code: 'CL', label: 'CL', title: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)' },
                        { code: 'LAP', label: 'LAP', title: 'Leave Avg Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)' },
                        { code: 'LHAP', label: 'LHAP', title: 'Half Avg Pay', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.18)' },
                        { code: 'SCL', label: 'SCL', title: 'Special Casual', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.18)' },
                        { code: 'OD', label: 'OD', title: 'On Duty', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' },
                        { code: 'CCL', label: 'CCL', title: 'Child Care', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)' },
                        { code: 'CR', label: 'CR', title: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.18)' },
                        { code: 'NH', label: 'NH', title: 'National Holiday', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' }
                      ].map(l => {
                        const isSelected = leaveType === l.code;
                        return (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => setLeaveType(l.code)}
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

                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      ℹ️ Muster Roll attendance marked as <strong style={{ color: '#fbbf24' }}>[{leaveType}]</strong>.
                    </div>

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
                      <div style={{ display: 'flex', gap: '6px' }}>
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
                      </div>
                    </div>

                    {shiftedMode === 'CUSTOM' ? (
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
                    ) : (
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

                {/* Slot Action: Replace with Another Employee (name changes, link fixed) or Leave Vacant */}
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

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDeleteSlotAction('REPLACE')}
                      style={{
                        flex: 1,
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
                      🔄 Replace with Another Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteSlotAction('VACANT')}
                      style={{
                        flex: 1,
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

                  {deleteSlotAction === 'REPLACE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {/* Filter by Category */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {[
                          { id: 'ALL', label: 'All Staff' },
                          { id: '1', label: 'Conductors' },
                          { id: '2', label: 'Sleeper' },
                          { id: '3', label: 'Ladies' },
                          { id: '4', label: 'LR Pool' }
                        ].map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setReplacementCatId(c.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: replacementCatId === c.id ? '1px solid #10b981' : '1px solid var(--border-glass)',
                              background: replacementCatId === c.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                              color: replacementCatId === c.id ? '#34d399' : 'var(--color-text-secondary)',
                              fontSize: '0.74rem',
                              cursor: 'pointer'
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
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
                        <option value="">-- Choose Replacement Employee ({eligibleReplacementStaff.length} available) --</option>
                        {eligibleReplacementStaff.map(s => {
                          const dutyInfo = getStaffDutyInfo(s, selectedDate);
                          const catName = categories.find(c => c.id === s.category_id)?.name || 'Staff';
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.designation || 'Staff'}) • [{catName}] — {dutyInfo.label}
                            </option>
                          );
                        })}
                      </select>

                      {selectedReplacementStaffObj && (
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontSize: '0.78rem',
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>✅</span>
                          <span>
                            <strong>{selectedReplacementStaffObj.name}</strong> will take over Link #{targetLink || 'Duty'} on {selectedDate} (Muster: <strong>[P]</strong>).
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {deleteSlotAction === 'VACANT' && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                      Slot on Link #{targetLink || 'Duty'} will show as <strong>[VACANT]</strong> on {selectedDate}.
                    </div>
                  )}
                </div>

                {/* Remarks */}
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
                      { id: 'ALL', label: 'All Staff' },
                      { id: '1', label: 'Conductors (COR)' },
                      { id: '2', label: 'Sleeper / TTI' },
                      { id: '3', label: 'Ladies / TTE' },
                      { id: '4', label: 'LR Relief Pool' }
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAssignCatId(c.id)}
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
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Select Employee to Assign:
                  </label>
                  <select
                    className="form-input"
                    value={assignStaffId}
                    onChange={(e) => setAssignStaffId(e.target.value)}
                    style={{ fontSize: '0.86rem', fontWeight: 600 }}
                  >
                    <option value="">-- Choose Employee to Assign ({eligibleAssignStaff.length} candidates) --</option>
                    {eligibleAssignStaff.map(s => {
                      const dutyInfo = getStaffDutyInfo(s, selectedDate);
                      const catName = categories.find(c => c.id === s.category_id)?.name || 'Staff';
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.designation || 'Staff'}) • [{catName}] — {dutyInfo.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Assignee Card */}
                {selectedAssignStaffObj && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#93c5fd' }}>
                        👤 {selectedAssignStaffObj.name} ({selectedAssignStaffObj.designation || 'Staff'})
                      </strong>
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontSize: '0.72rem' }}>
                        {getStaffDutyInfo(selectedAssignStaffObj, selectedDate).label}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.76rem' }}>
                      Will be assigned to <strong>Link #{targetLink || 'Duty'}</strong> on <strong>{selectedDate}</strong>.
                    </div>
                  </div>
                )}

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
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  padding: '8px 20px',
                  minWidth: '160px'
                }}
              >
                {submitting ? 'Saving...' :
                 activeMode === 'DELETE' ? (deleteReason === 'SHIFTED' ? '🔄 Shift & Save Duty' : `🗑️ Delete & Save Status`) :
                 `➕ Assign to Link #${targetLink || 'Duty'}`}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
