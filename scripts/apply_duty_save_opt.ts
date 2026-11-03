import fs from 'fs';

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');
const isCrlf = code.includes('\r\n');
if (isCrlf) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. Optimize syncDocumentsAndEarningsForStaffDate (lines 7873-7893)
const oldSyncDocSnippet = `    // 1. Clear stale custom saved rows for this specific date in nda_entries and diary_entries so per-date merge regenerates them cleanly
    await run(
      \`DELETE FROM nda_entries 
       WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
      [staffId, monthYear, dateStr, altShort, altPadded, altFull]
    );

    await run(
      \`DELETE FROM diary_entries 
       WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
      [staffId, monthYear, dateStr, altShort, altPadded, altFull]
    );

    if (!preserveCustomTa && !isLeaveOrRest) {
      await run(
        \`DELETE FROM ta_entries 
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
        [staffId, dateStr, dateStr, altShort, altPadded, altFull]
      );
    }`;

const newSyncDocSnippet = `    // 1. Clear stale custom saved rows for this specific date concurrently in parallel
    const deleteQueries = [
      run(
        \`DELETE FROM nda_entries 
         WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
        [staffId, monthYear, dateStr, altShort, altPadded, altFull]
      ),
      run(
        \`DELETE FROM diary_entries 
         WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
        [staffId, monthYear, dateStr, altShort, altPadded, altFull]
      )
    ];

    if (!preserveCustomTa && !isLeaveOrRest) {
      deleteQueries.push(
        run(
          \`DELETE FROM ta_entries 
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)\`,
          [staffId, dateStr, dateStr, altShort, altPadded, altFull]
        )
      );
    }
    await Promise.all(deleteQueries);`;

if (!code.includes(oldSyncDocSnippet)) {
  console.error('oldSyncDocSnippet not found!');
  process.exit(1);
}
code = code.replace(oldSyncDocSnippet, newSyncDocSnippet);
console.log('✓ Optimized syncDocumentsAndEarningsForStaffDate with Promise.all');

// 2. Add pendingTaTasks queue in app.post('/api/duty/change-status'
const txStartTarget = `    return await withTransaction(async () => {
      // Determine dates array to update (supports single date or date range)`;

const txStartReplacement = `    const pendingTaTasks = new Map<string, { year: number; month: number; staffId: number }>();
    const queueTaRecalc = (y: number, m: number, sId: any) => {
      const numId = parseInt(sId, 10);
      if (y && m && !isNaN(numId)) {
        pendingTaTasks.set(\`\${y}_\${m}_\${numId}\`, { year: y, month: m, staffId: numId });
      }
    };

    const txResult = await withTransaction(async () => {
      // Determine dates array to update (supports single date or date range)`;

if (!code.includes(txStartTarget)) {
  console.error('txStartTarget not found!');
  process.exit(1);
}
code = code.replace(txStartTarget, txStartReplacement);
console.log('✓ Added pendingTaTasks queue to change-status');

// 3. Replace synchronous generatePendingTaClaimsForMonth calls with queueTaRecalc
// In RESET:
const oldResetTa = `          try {
            const { generatePendingTaClaimsForMonth } = require('./ta_generator');
            await generatePendingTaClaimsForMonth({ run, get, all }, parseInt(dateParts[0], 10), parseInt(dateParts[1], 10), staff_id);
          } catch (err) { }`;

const newResetTa = `          queueTaRecalc(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10), staff_id);`;
if (!code.includes(oldResetTa)) {
  console.error('oldResetTa not found!');
  process.exit(1);
}
code = code.replace(oldResetTa, newResetTa);
console.log('✓ Queued TA recalc in RESET action');

// In LEAVE / SICK substitute:
const oldLeaveSubTa = `              const subY = parseInt(dateParts[0], 10);
              const subM = parseInt(dateParts[1], 10);
              try {
                const { generatePendingTaClaimsForMonth } = require('./ta_generator');
                await generatePendingTaClaimsForMonth({ run, get, all }, subY, subM, subStaff.id);
              } catch (err) { }`;

const newLeaveSubTa = `              const subY = parseInt(dateParts[0], 10);
              const subM = parseInt(dateParts[1], 10);
              queueTaRecalc(subY, subM, subStaff.id);`;
if (!code.includes(oldLeaveSubTa)) {
  console.error('oldLeaveSubTa not found!');
  process.exit(1);
}
code = code.replace(oldLeaveSubTa, newLeaveSubTa);
console.log('✓ Queued TA recalc in LEAVE substitute action');

// 4. Batch snapshot lookups in LEAVE / SICK
const oldSnapshots = `          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let existingSubOverride = null;
          let existingSubMuster = null;
          if (replacement_staff_id) {
            existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }`;

const newSnapshots = `          const [existingOverride, existingMuster, existingSubOverride, existingSubMuster] = await Promise.all([
            get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]),
            get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]),
            replacement_staff_id ? get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]) : Promise.resolve(null),
            replacement_staff_id ? get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]) : Promise.resolve(null)
          ]);`;

if (!code.includes(oldSnapshots)) {
  console.error('oldSnapshots not found!');
  process.exit(1);
}
code = code.replace(oldSnapshots, newSnapshots);
console.log('✓ Batched snapshot lookups with Promise.all in LEAVE action');

// 5. Batch TA updates in LEAVE / SICK
const oldTaDisallow = `          await run(
            \`UPDATE ta_approvals 
           SET status = 'REJECTED', 
               claim_amount = 0, 
               ta_percentage = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)\`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );
          await run(
            \`UPDATE ta_entries 
           SET ta_b1 = '', 
               days_claiming_ta = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)\`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );`;

const newTaDisallow = `          await Promise.all([
            run(
              \`UPDATE ta_approvals 
             SET status = 'REJECTED', 
                 claim_amount = 0, 
                 ta_percentage = NULL, 
                 remarks = ?
             WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)\`,
              [disallowRemark, staff.id, dStr, dStr, altDateStr]
            ),
            run(
              \`UPDATE ta_entries 
             SET ta_b1 = '', 
                 days_claiming_ta = NULL, 
                 remarks = ?
             WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)\`,
              [disallowRemark, staff.id, dStr, dStr, altDateStr]
            )
          ]);`;

if (!code.includes(oldTaDisallow)) {
  console.error('oldTaDisallow not found!');
  process.exit(1);
}
code = code.replace(oldTaDisallow, newTaDisallow);
console.log('✓ Batched TA disallow queries in LEAVE action');

// 6. Deduplicate multi-day link set writes:
// Remove lines 6069-6117 and integrate LR sync into the subsequent multi-day block
const oldDuplicateBlock = `                // If original link is part of a multi-day link set, automatically book LR substitute for the entire link!
                if (datesToProcess.length === 1) {
                  const subLinkSet = getLinkSetDetails(staff.category_id, originalLink);
                  if (subLinkSet && subLinkSet.remainingLinks && subLinkSet.remainingLinks.length > 0) {
                    for (let k = 0; k < subLinkSet.remainingLinks.length; k++) {
                      const remLinkNum = subLinkSet.remainingLinks[k];
                      const nextDate = new Date(dStr + 'T12:00:00');
                      nextDate.setDate(nextDate.getDate() + k + 1);
                      const y = nextDate.getFullYear();
                      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                      const d = String(nextDate.getDate()).padStart(2, '0');
                      const nextDateStr = \`\${y}-\${m}-\${d}\`;

                      const subLegReason = \`Substitute for \${staff.name} on Link #\${remLinkNum} (Day \${subLinkSet.dayIndexInSet + k + 1} of \${subLinkSet.setLength}-day link set)\`;

                      await run(
                        \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                       VALUES (?, ?, NULL, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         overridden_link_number = excluded.overridden_link_number,
                         status = excluded.status,
                         substitute_staff_id = excluded.substitute_staff_id,
                         substitute_name = excluded.substitute_name,
                         reason = excluded.reason,
                         target_category_id = excluded.target_category_id\`,
                        [subStaff.id, nextDateStr, remLinkNum, staff.id, staff.name, subLegReason, target_category_id || staff.category_id]
                      );

                      await run(
                        \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         code = 'P',
                         remarks = excluded.remarks,
                         updated_by = excluded.updated_by,
                         updated_at = CURRENT_TIMESTAMP\`,
                        [subStaff.id, nextDateStr, \`Working as substitute for \${staff.name} on Link #\${remLinkNum}\`]
                      );

                      const nextDObj = new Date(nextDateStr + 'T12:00:00');
                      const nextDayOfWeek = dayNames[nextDObj.getDay()];
                      const resolvedNextDuty = await resolveDutyCodeForLRStaff(subStaff.id, nextDateStr, nextDayOfWeek, subStaff.rest_day);
                      if (resolvedNextDuty && resolvedNextDuty.code) {
                        await syncLRSheetRecord(subStaff.id, nextDateStr, resolvedNextDuty.code, subLegReason);
                      }
                      await syncDocumentsAndEarningsForStaffDate(subStaff.id, nextDateStr, { dutyText: \`L-\${remLinkNum}\`, isLeaveOrRest: false, remarks: subLegReason });
                    }
                  }
                }`;

const newDeduplicatedNotice = `                // Note: Multi-day return leg overrides & muster records are handled in the unified multi-day block below to avoid duplicate writes.`;

if (!code.includes(oldDuplicateBlock)) {
  console.error('oldDuplicateBlock not found!');
  process.exit(1);
}
code = code.replace(oldDuplicateBlock, newDeduplicatedNotice);
console.log('✓ Removed duplicate multi-day write block (lines 6069-6117)');

// 7. Add LR sheet sync inside the unified multi-day return leg block (lines 6212-6254)
const oldReturnLegSubBlock = `                    await syncDocumentsAndEarningsForStaffDate(subStaff.id, remDateStr, { dutyText: \`L-\${remLink}\`, isLeaveOrRest: false, remarks: subReason });
                  }
                }`;

const newReturnLegSubBlock = `                    // If substitute is in Category 4 (LR), sync LR sheet for return leg
                    if (subStaff.category_id === 4) {
                      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                      const nextDObj = new Date(remDateStr + 'T12:00:00');
                      const nextDayOfWeek = dayNames[nextDObj.getDay()];
                      const resolvedNextDuty = await resolveDutyCodeForLRStaff(subStaff.id, remDateStr, nextDayOfWeek, subStaff.rest_day);
                      if (resolvedNextDuty && resolvedNextDuty.code) {
                        await syncLRSheetRecord(subStaff.id, remDateStr, resolvedNextDuty.code, subReason);
                      }
                    }
                    await syncDocumentsAndEarningsForStaffDate(subStaff.id, remDateStr, { dutyText: \`L-\${remLink}\`, isLeaveOrRest: false, remarks: subReason });
                  }
                }`;

if (!code.includes(oldReturnLegSubBlock)) {
  console.error('oldReturnLegSubBlock not found!');
  process.exit(1);
}
code = code.replace(oldReturnLegSubBlock, newReturnLegSubBlock);
console.log('✓ Added LR sheet sync to unified multi-day return leg block');

// 8. In multi-day return leg snapshot lookups, batch with Promise.all
const oldSubDaySnapshots = `                // Record snapshot for undo
                const existingSubDayOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
                const existingSubDayMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
                let existingSubDaySubOv = null;
                let existingSubDaySubMuster = null;
                if (replacement_staff_id) {
                  existingSubDaySubOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
                  existingSubDaySubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
                }`;

const newSubDaySnapshots = `                // Record snapshot for undo (batched concurrently)
                const [existingSubDayOv, existingSubDayMuster, existingSubDaySubOv, existingSubDaySubMuster] = await Promise.all([
                  get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]),
                  get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]),
                  replacement_staff_id ? get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]) : Promise.resolve(null),
                  replacement_staff_id ? get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]) : Promise.resolve(null)
                ]);`;

if (!code.includes(oldSubDaySnapshots)) {
  console.error('oldSubDaySnapshots not found!');
  process.exit(1);
}
code = code.replace(oldSubDaySnapshots, newSubDaySnapshots);
console.log('✓ Batched multi-day snapshot lookups with Promise.all');

// 9. Dispatch background TA recalculation after transaction commit
const txEndTarget = `      return res.status(400).json({ error: 'Invalid action specified' });
    });
  } catch (err) {`;

const txEndReplacement = `      return res.status(400).json({ error: 'Invalid action specified' });
    });

    // Transaction committed successfully! Dispatch queued TA recalculation tasks in background
    if (pendingTaTasks.size > 0) {
      setImmediate(async () => {
        try {
          const { generatePendingTaClaimsForMonth } = require('./ta_generator');
          for (const task of pendingTaTasks.values()) {
            try {
              await generatePendingTaClaimsForMonth({ run, get, all }, task.year, task.month, task.staffId);
            } catch (err: any) {
              console.error(\`Background TA recalculation failed for staff \${task.staffId}:\`, err?.message || err);
            }
          }
        } catch (e: any) {
          console.error('Background TA task runner error:', e?.message || e);
        }
      });
    }

    return txResult;
  } catch (err) {`;

if (!code.includes(txEndTarget)) {
  console.error('txEndTarget not found!');
  process.exit(1);
}
code = code.replace(txEndTarget, txEndReplacement);
console.log('✓ Dispatched queued TA recalculation in background after transaction commit');

if (isCrlf) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('ALL DUTY SAVE OPTIMIZATIONS APPLIED SUCCESSFULLY!');
