const fs = require('fs');
const path = require('path');

// 1. Update ta_generator.ts
const taGenPath = path.join(__dirname, '../src/backend/ta_generator.ts');
let taGen = fs.readFileSync(taGenPath, 'utf8');

const oldMergeBlock = `  // Seamlessly merge savedEntries with approvedClaims for any dates not present in savedEntries
  const sourceRows = [];
  const savedDateSet = new Set();
  if (savedEntries && savedEntries.length > 0) {
    savedEntries.forEach(r => {
      const dIso = resolveDutyDateIso(r);
      if (dIso) {
        const ov = staffOverrideMap[dIso];
        const isStandby = ov && (ov.status === 'AVAILABLE_FOR_BOOKING' || (ov.reason && (ov.reason.toLowerCase().includes('available for booking') || ov.reason.toLowerCase().includes('available for other duty') || ov.reason.toLowerCase().includes('removed from link') || ov.reason.toLowerCase().includes('relieved to hq'))));
        let journalAnchor = category.anchor_date;
        let journalCycle = category.cycle_length;
        if (category.id === 1) {
          journalAnchor = dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01';
          journalCycle = 21;
        } else if (category.id === 2) {
          journalAnchor = dIso < '2026-10-01' ? '2026-08-01' : (dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01');
          journalCycle = dIso < '2026-10-01' ? 63 : 56;
        } else if (category.id === 3) {
          journalAnchor = dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01';
          journalCycle = 7;
        }
        const isMultiDayReturn = checkMultiDayLeaveReturnSync(staff.id, staff.category_id, staff.row_position, journalCycle, journalAnchor, dIso, musterMap, staffOverrideMap);
        const hasDutyOverride = ov && (ov.status === 'CHANGED_LINK' || ov.status === 'SUBSTITUTE' || ov.status === 'EXTRA_CREW' || ov.status === 'UTILISED_ADVANCE');

        // If staff is on leave or standby at HQ on this date, or if row has no train, discard
        if (leaveInfoMap[dIso] || (isStandby && !hasDutyOverride) || r.is_leave || !r.train_no || ['---', '-', 'REST', 'OFF', 'SPARE', 'SPARE (HQ)', 'STANDBY'].includes(r.train_no)) {
          return;
        }

        savedDateSet.add(dIso);
        sourceRows.push({ ...r, _isSaved: true });
      }
    });
  }
  if (approvedClaims && approvedClaims.length > 0) {
    approvedClaims.forEach(claim => {
      const dIso = claim.duty_date;
      if (!savedDateSet.has(dIso)) {
        sourceRows.push({ ...claim, _isSaved: false });
      }
    });
  }`;

const newMergeBlock = `  // Seamlessly merge savedEntries with approvedClaims for any dates not present in savedEntries
  const sourceRows = [];
  const savedDateSet = new Set();
  const seenDutyKeys = new Set();
  if (savedEntries && savedEntries.length > 0) {
    savedEntries.forEach(r => {
      const dIso = resolveDutyDateIso(r);
      if (dIso) {
        const ov = staffOverrideMap[dIso];
        const isStandby = ov && (ov.status === 'AVAILABLE_FOR_BOOKING' || (ov.reason && (ov.reason.toLowerCase().includes('available for booking') || ov.reason.toLowerCase().includes('available for other duty') || ov.reason.toLowerCase().includes('removed from link') || ov.reason.toLowerCase().includes('relieved to hq'))));
        let journalAnchor = category.anchor_date;
        let journalCycle = category.cycle_length;
        if (category.id === 1) {
          journalAnchor = dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01';
          journalCycle = 21;
        } else if (category.id === 2) {
          journalAnchor = dIso < '2026-10-01' ? '2026-08-01' : (dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01');
          journalCycle = dIso < '2026-10-01' ? 63 : 56;
        } else if (category.id === 3) {
          journalAnchor = dIso < '2026-11-01' ? '2026-10-01' : '2026-11-01';
          journalCycle = 7;
        }
        const isMultiDayReturn = checkMultiDayLeaveReturnSync(staff.id, staff.category_id, staff.row_position, journalCycle, journalAnchor, dIso, musterMap, staffOverrideMap);
        const hasDutyOverride = ov && (ov.status === 'CHANGED_LINK' || ov.status === 'SUBSTITUTE' || ov.status === 'EXTRA_CREW' || ov.status === 'UTILISED_ADVANCE');

        // If staff is on leave or standby at HQ on this date, or if row has no train, discard
        if (leaveInfoMap[dIso] || (isStandby && !hasDutyOverride) || r.is_leave || !r.train_no || ['---', '-', 'REST', 'OFF', 'SPARE', 'SPARE (HQ)', 'STANDBY'].includes(r.train_no)) {
          return;
        }

        const dutyKey = \`\${dIso}_\${String(r.train_no || '').trim()}_\${String(r.from_station || '').trim()}_\${String(r.to_station || '').trim()}\`;
        if (seenDutyKeys.has(dutyKey)) {
          return;
        }
        seenDutyKeys.add(dutyKey);

        savedDateSet.add(dIso);
        sourceRows.push({ ...r, _isSaved: true });
      }
    });
  }
  if (approvedClaims && approvedClaims.length > 0) {
    approvedClaims.forEach(claim => {
      const dIso = claim.duty_date;
      const dutyKey = \`\${dIso}_\${String(claim.train_no || '').trim()}_\${String(claim.from_station || '').trim()}_\${String(claim.to_station || '').trim()}\`;
      if (!savedDateSet.has(dIso) && !seenDutyKeys.has(dutyKey)) {
        seenDutyKeys.add(dutyKey);
        sourceRows.push({ ...claim, _isSaved: false });
      }
    });
  }`;

const isTaGenCRLF = taGen.includes('\r\n');
const oldTaGenTarget = isTaGenCRLF ? oldMergeBlock.replace(/\n/g, '\r\n') : oldMergeBlock;
const newTaGenTarget = isTaGenCRLF ? newMergeBlock.replace(/\n/g, '\r\n') : newMergeBlock;

if (taGen.includes(oldTaGenTarget)) {
  taGen = taGen.replace(oldTaGenTarget, newTaGenTarget);
  fs.writeFileSync(taGenPath, taGen, 'utf8');
  console.log('Updated ta_generator.ts deduplication successfully');
} else {
  console.error('Could not find oldMergeBlock in ta_generator.ts');
}

// 2. Update server.ts POST /api/documents/ta/:staffId
const serverPath = path.join(__dirname, '../src/backend/server.ts');
let serverContent = fs.readFileSync(serverPath, 'utf8');

const oldSaveLoop = `    // Save all current rows & propagate timings
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];`;

const newSaveLoop = `    // Save all current rows & propagate timings (deduplicating identical entries)
    const seenSaveKeys = new Set();
    let savedRowOrder = 0;
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const dutyDate = item.date_iso || item.duty_date || null;
      const dedupeKey = \`\${dutyDate}_\${String(item.train_no || '').trim()}_\${String(item.from_station || '').trim()}_\${String(item.to_station || '').trim()}\`;
      if (dutyDate && item.train_no && seenSaveKeys.has(dedupeKey)) {
        continue;
      }
      seenSaveKeys.add(dedupeKey);
      savedRowOrder++;`;

const isServerCRLF = serverContent.includes('\r\n');
const oldSaveTarget = isServerCRLF ? oldSaveLoop.replace(/\n/g, '\r\n') : oldSaveLoop;
const newSaveTarget = isServerCRLF ? newSaveLoop.replace(/\n/g, '\r\n') : newSaveLoop;

if (serverContent.includes(oldSaveTarget)) {
  serverContent = serverContent.replace(oldSaveTarget, newSaveTarget);
  // Also replace `i + 1` with `savedRowOrder`
  const oldRowOrder = `item.remarks || '',\n          i + 1`;
  const newRowOrder = `item.remarks || '',\n          savedRowOrder`;
  const oldRowOrderTarget = isServerCRLF ? oldRowOrder.replace(/\n/g, '\r\n') : oldRowOrder;
  const newRowOrderTarget = isServerCRLF ? newRowOrder.replace(/\n/g, '\r\n') : newRowOrder;
  serverContent = serverContent.replace(oldRowOrderTarget, newRowOrderTarget);

  fs.writeFileSync(serverPath, serverContent, 'utf8');
  console.log('Updated server.ts POST /api/documents/ta/:staffId deduplication successfully');
} else {
  console.error('Could not find oldSaveLoop in server.ts');
}
