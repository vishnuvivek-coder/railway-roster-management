const fs = require('fs');
const path = require('path');

// 1. Update DutyEditModal.tsx
const modalPath = path.join(__dirname, '../src/frontend/src/DutyEditModal.tsx');
let modalContent = fs.readFileSync(modalPath, 'utf8');

const oldSlotIdBlock = `  // Resolve slot staff ID robustly from staffId, id, or staff name
  const slotStaffId = useMemo(() => {
    let idVal = dutyModal.staffId || dutyModal.id;
    if (typeof idVal === 'string' && /^\\d+$/.test(idVal.trim())) {
      idVal = parseInt(idVal.trim(), 10);
    }
    if ((!idVal || isNaN(idVal as number)) && !isSlotVacant && dutyModal.name && allStaffList && allStaffList.length > 0) {
      const targetName = (dutyModal.name || '').trim().toUpperCase();
      const found = allStaffList.find(s => s.name?.trim().toUpperCase() === targetName);
      if (found) idVal = found.id;
    }
    return (typeof idVal === 'number' && !isNaN(idVal)) ? idVal : null;
  }, [dutyModal.staffId, dutyModal.id, dutyModal.name, isSlotVacant, allStaffList]);`;

const newSlotIdBlock = `  // Resolve slot staff ID robustly from staffId, id, or staff name
  const slotStaffId = useMemo(() => {
    let idVal = dutyModal.staffId || dutyModal.id || dutyModal.staff_id || dutyModal.originalStaffId || dutyModal.shiftedStaffId || dutyModal.advanceStaffId;
    if (typeof idVal === 'string') {
      const match = idVal.match(/(\\d+)$/);
      if (match) idVal = parseInt(match[1], 10);
      else if (/^\\d+$/.test(idVal.trim())) idVal = parseInt(idVal.trim(), 10);
    }
    if ((!idVal || isNaN(idVal as number)) && allStaffList && allStaffList.length > 0) {
      const candidateNames = [dutyModal.name, dutyModal.staffName, dutyModal.originalStaffName].filter(Boolean);
      for (const rawName of candidateNames) {
        const clean = String(rawName).replace(/\\s*\\([^)]*\\)/g, '').trim().toUpperCase();
        if (clean && !clean.includes('VACANT') && clean !== 'V') {
          const found = allStaffList.find(s => s.name?.replace(/\\s*\\([^)]*\\)/g, '').trim().toUpperCase() === clean);
          if (found) {
            idVal = found.id;
            break;
          }
        }
      }
    }
    return (typeof idVal === 'number' && !isNaN(idVal)) ? idVal : null;
  }, [dutyModal.staffId, dutyModal.id, dutyModal.staff_id, dutyModal.originalStaffId, dutyModal.shiftedStaffId, dutyModal.advanceStaffId, dutyModal.name, dutyModal.staffName, dutyModal.originalStaffName, allStaffList]);`;

const isModalCRLF = modalContent.includes('\r\n');
const oldModalTarget = isModalCRLF ? oldSlotIdBlock.replace(/\n/g, '\r\n') : oldSlotIdBlock;
const newModalTarget = isModalCRLF ? newSlotIdBlock.replace(/\n/g, '\r\n') : newSlotIdBlock;

if (modalContent.includes(oldModalTarget)) {
  modalContent = modalContent.replace(oldModalTarget, newModalTarget);
  console.log('Updated slotStaffId in DutyEditModal.tsx');
} else {
  console.error('Could not find oldSlotIdBlock in DutyEditModal.tsx');
}

const oldSubmitBlock = `      if (activeMode === 'DELETE') {
        const staffId = slotStaffId || dutyModal.staffId;
        if (!staffId && !isSlotVacant) {
          throw new Error('Employee ID missing for this slot.');
        }

        const effectiveToDate = leaveToDate && leaveToDate >= selectedDate ? leaveToDate : selectedDate;
        const hasReplacementAction = deleteSlotAction === 'REPLACE' || deleteSlotAction === 'UPGRADE_SLEEPER';
        const repStaffIdNum = (hasReplacementAction && replacementStaffId) ? parseInt(replacementStaffId, 10) : null;`;

const newSubmitBlock = `      if (activeMode === 'DELETE') {
        const effectiveToDate = leaveToDate && leaveToDate >= selectedDate ? leaveToDate : selectedDate;
        const hasReplacementAction = deleteSlotAction === 'REPLACE' || deleteSlotAction === 'UPGRADE_SLEEPER' || deleteReason === 'REASSIGN_STAFF';
        const repStaffIdNum = (hasReplacementAction && (replacementStaffId || reassignStaffId)) ? parseInt(replacementStaffId || reassignStaffId, 10) : null;

        let staffId = slotStaffId || dutyModal.staffId || dutyModal.id || dutyModal.staff_id || dutyModal.originalStaffId;
        if (typeof staffId === 'string') {
          const match = staffId.match(/(\\d+)$/);
          if (match) staffId = parseInt(match[1], 10);
          else if (/^\\d+$/.test(staffId.trim())) staffId = parseInt(staffId.trim(), 10);
        }
        if (!staffId && allStaffList && allStaffList.length > 0) {
          const candidateNames = [dutyModal.name, dutyModal.staffName, dutyModal.originalStaffName].filter(Boolean);
          for (const rawName of candidateNames) {
            const clean = String(rawName).replace(/\\s*\\([^)]*\\)/g, '').trim().toUpperCase();
            if (clean && !clean.includes('VACANT') && clean !== 'V') {
              const found = allStaffList.find(s => s.name?.replace(/\\s*\\([^)]*\\)/g, '').trim().toUpperCase() === clean);
              if (found) {
                staffId = found.id;
                break;
              }
            }
          }
        }
        if (!staffId && !isSlotVacant && !repStaffIdNum) {
          throw new Error('Employee ID missing for this slot.');
        }`;

const oldSubmitTarget = isModalCRLF ? oldSubmitBlock.replace(/\n/g, '\r\n') : oldSubmitBlock;
const newSubmitTarget = isModalCRLF ? newSubmitBlock.replace(/\n/g, '\r\n') : newSubmitBlock;

if (modalContent.includes(oldSubmitTarget)) {
  modalContent = modalContent.replace(oldSubmitTarget, newSubmitTarget);
  console.log('Updated handleSubmit in DutyEditModal.tsx');
} else {
  console.error('Could not find oldSubmitBlock in DutyEditModal.tsx');
}

fs.writeFileSync(modalPath, modalContent, 'utf8');

// 2. Update App.tsx to fetchAllStaff on activeTab === 'daily-summary'
const appPath = path.join(__dirname, '../src/frontend/src/App.tsx');
let appContent = fs.readFileSync(appPath, 'utf8');

const oldTabEffect = `    if (activeTab === 'daily' || activeTab === 'daily-summary') {
      fetch(\`\${API_BASE}/links\`).then(r => r.json()).then(setAllLinksList).catch(() => {});
      fetchDailyDuties();
      fetchNonDailyTrains('ALL');
      if (activeTab === 'daily') fetchRoster();
    }`;

const newTabEffect = `    if (activeTab === 'daily' || activeTab === 'daily-summary') {
      fetch(\`\${API_BASE}/links\`).then(r => r.json()).then(setAllLinksList).catch(() => {});
      fetchAllStaff();
      fetchDailyDuties();
      fetchNonDailyTrains('ALL');
      if (activeTab === 'daily') fetchRoster();
    }`;

const isAppCRLF = appContent.includes('\r\n');
const oldAppTarget = isAppCRLF ? oldTabEffect.replace(/\n/g, '\r\n') : oldTabEffect;
const newAppTarget = isAppCRLF ? newTabEffect.replace(/\n/g, '\r\n') : newTabEffect;

if (appContent.includes(oldAppTarget)) {
  appContent = appContent.replace(oldAppTarget, newAppTarget);
  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('Updated App.tsx fetchAllStaff for daily-summary');
} else {
  console.error('Could not find oldTabEffect in App.tsx');
}
