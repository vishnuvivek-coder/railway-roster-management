const fs = require('fs');

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Combine staff and category lookup in /api/duty/change-status
const oldStaffCat = `    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);`;

const newStaffCat = `    const staffWithCat = await get(
      \`SELECT s.*, c.anchor_date as cat_anchor_date, c.cycle_length as cat_cycle_length, c.name as cat_name
       FROM staff s 
       LEFT JOIN categories c ON s.category_id = c.id 
       WHERE s.id = ?\`,
      [staff_id]
    );
    if (!staffWithCat) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    const staff = staffWithCat;
    const category = {
      id: staff.category_id,
      anchor_date: staff.cat_anchor_date,
      cycle_length: staff.cat_cycle_length,
      name: staff.cat_name
    };`;

// 2. Batch remainingSetLinks snapshots and writes
const oldRemainingBlock = `              // Fetch subStaff and subCat once upfront outside the remainingSetLinks loop
              let cachedSubStaff = null;
              let cachedSubCat = null;
              if (replacement_staff_id) {
                cachedSubStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                if (cachedSubStaff) {
                  cachedSubCat = await get('SELECT * FROM categories WHERE id = ?', [cachedSubStaff.category_id]);
                }
              }

              await Promise.all(remainingSetLinks.map(async (remLink, k) => {
                const nextDate = new Date(lastDate + 'T12:00:00');
                nextDate.setDate(nextDate.getDate() + k + 1);
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const remDateStr = \`\${y}-\${m}-\${d}\`;

                // Record snapshot for undo (batched concurrently)
                const [existingSubDayOv, existingSubDayMuster, existingSubDaySubOv, existingSubDaySubMuster] = await Promise.all([
                  get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]),
                  get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]),
                  replacement_staff_id ? get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]) : Promise.resolve(null),
                  replacement_staff_id ? get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]) : Promise.resolve(null)
                ]);
                undoSnapshots.push({
                  date: remDateStr,
                  override: existingSubDayOv || null,
                  muster: existingSubDayMuster || null,
                  subOverride: existingSubDaySubOv || null,
                  subMuster: existingSubDaySubMuster || null
                });

                // Concurrently write overrides, muster, and sync documents for main staff
                const mainStaffUpdates = [
                  run(
                    \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                   VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?, ?, ?)
                   ON CONFLICT(staff_id, date) DO UPDATE SET
                     overridden_link_number = NULL,
                     status = 'AVAILABLE_FOR_BOOKING',
                     substitute_staff_id = excluded.substitute_staff_id,
                     substitute_name = excluded.substitute_name,
                     reason = excluded.reason,
                     target_category_id = excluded.target_category_id\`,
                    [
                      staff_id,
                      remDateStr,
                      remLink,
                      replacement_staff_id || null,
                      finalSubstituteName || null,
                      \`Available for Booking Duty at HQ (Came out of \${action} on Link #\${firstOriginalLink})\`,
                      staff.category_id
                    ]
                  ),
                  run(
                    \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                   VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                   ON CONFLICT(staff_id, date) DO UPDATE SET
                     code = 'P',
                     remarks = excluded.remarks,
                     updated_by = excluded.updated_by,
                     updated_at = CURRENT_TIMESTAMP\`,
                    [
                      staff_id,
                      remDateStr,
                      \`Present at HQ (Available for booking - Came out of \${action} on Link #\${firstOriginalLink})\`
                    ]
                  ),
                  syncDocumentsAndEarningsForStaffDate(staff_id, remDateStr, { dutyText: 'AVL', isLeaveOrRest: false })
                ];

                await Promise.all(mainStaffUpdates);

                // 3. If substitute assigned on Day 1, they work return leg as well
                if (cachedSubStaff && cachedSubCat) {
                  const subOrigLink = getBaseLinkNumber(cachedSubStaff.row_position, getDayOffset(cachedSubCat.anchor_date, remDateStr), cachedSubCat.cycle_length);
                  const subReason = \`Substitute for \${staff.name} on return Link #\${remLink}\`;

                  const subPromises = [
                    run(
                      \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                     VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       overridden_link_number = excluded.overridden_link_number,
                       status = excluded.status,
                       substitute_staff_id = excluded.substitute_staff_id,
                       substitute_name = excluded.substitute_name,
                       reason = excluded.reason,
                       target_category_id = excluded.target_category_id\`,
                      [
                        cachedSubStaff.id,
                        remDateStr,
                        subOrigLink,
                        remLink,
                        staff.id,
                        staff.name,
                        subReason,
                        staff.category_id
                      ]
                    ),
                    run(
                      \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                     VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       code = 'P',
                       remarks = excluded.remarks,
                       updated_by = excluded.updated_by,
                       updated_at = CURRENT_TIMESTAMP\`,
                      [cachedSubStaff.id, remDateStr, \`Working as substitute for \${staff.name} on Link #\${remLink}\`]
                    ),
                    syncDocumentsAndEarningsForStaffDate(cachedSubStaff.id, remDateStr, { dutyText: \`L-\${remLink}\`, isLeaveOrRest: false, remarks: subReason })
                  ];

                  if (cachedSubStaff.category_id === 4) {
                    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                    const nextDObj = new Date(remDateStr + 'T12:00:00');
                    const nextDayOfWeek = dayNames[nextDObj.getDay()];
                    const resolvedNextDuty = await resolveDutyCodeForLRStaff(cachedSubStaff.id, remDateStr, nextDayOfWeek, cachedSubStaff.rest_day);
                    if (resolvedNextDuty && resolvedNextDuty.code) {
                      subPromises.push(syncLRSheetRecord(cachedSubStaff.id, remDateStr, resolvedNextDuty.code, subReason));
                    }
                  }

                  await Promise.all(subPromises);
                }
              }));`;

const newRemainingBlock = `              // Fetch subStaff and subCat once upfront outside the remainingSetLinks loop
              let cachedSubStaff = null;
              let cachedSubCat = null;
              if (replacement_staff_id) {
                cachedSubStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                if (cachedSubStaff) {
                  cachedSubCat = await get('SELECT * FROM categories WHERE id = ?', [cachedSubStaff.category_id]);
                }
              }

              // Compute all remaining date strings
              const remDates = remainingSetLinks.map((remLink, k) => {
                const nextDate = new Date(lastDate + 'T12:00:00');
                nextDate.setDate(nextDate.getDate() + k + 1);
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                return { remLink, remDateStr: \`\${y}-\${m}-\${d}\` };
              });
              const dateList = remDates.map(r => r.remDateStr);
              const placeholders = dateList.map(() => '?').join(',');

              // Batch query snapshots in parallel
              const [existingOvList, existingMusList, existingSubOvList, existingSubMusList] = await Promise.all([
                all(\`SELECT * FROM overrides WHERE staff_id = ? AND date IN (\${placeholders})\`, [staff_id, ...dateList]),
                all(\`SELECT * FROM muster_records WHERE staff_id = ? AND date IN (\${placeholders})\`, [staff_id, ...dateList]),
                replacement_staff_id ? all(\`SELECT * FROM overrides WHERE staff_id = ? AND date IN (\${placeholders})\`, [replacement_staff_id, ...dateList]) : Promise.resolve([]),
                replacement_staff_id ? all(\`SELECT * FROM muster_records WHERE staff_id = ? AND date IN (\${placeholders})\`, [replacement_staff_id, ...dateList]) : Promise.resolve([])
              ]);

              for (const { remDateStr } of remDates) {
                undoSnapshots.push({
                  date: remDateStr,
                  override: existingOvList.find(o => o.date === remDateStr) || null,
                  muster: existingMusList.find(m => m.date === remDateStr) || null,
                  subOverride: existingSubOvList.find(o => o.date === remDateStr) || null,
                  subMuster: existingSubMusList.find(m => m.date === remDateStr) || null
                });
              }

              // Batch execute multi-statement SQL writes for all remaining days in a single network round trip
              const batchStatements = [];
              const batchParams = [];

              for (const { remLink, remDateStr } of remDates) {
                batchStatements.push(
                  \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                   VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?, ?, ?)
                   ON CONFLICT(staff_id, date) DO UPDATE SET
                     overridden_link_number = NULL,
                     status = 'AVAILABLE_FOR_BOOKING',
                     substitute_staff_id = excluded.substitute_staff_id,
                     substitute_name = excluded.substitute_name,
                     reason = excluded.reason,
                     target_category_id = excluded.target_category_id\`
                );
                batchParams.push(
                  staff_id,
                  remDateStr,
                  remLink,
                  replacement_staff_id || null,
                  finalSubstituteName || null,
                  \`Available for Booking Duty at HQ (Came out of \${action} on Link #\${firstOriginalLink})\`,
                  staff.category_id
                );

                batchStatements.push(
                  \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                   VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                   ON CONFLICT(staff_id, date) DO UPDATE SET
                     code = 'P',
                     remarks = excluded.remarks,
                     updated_by = excluded.updated_by,
                     updated_at = CURRENT_TIMESTAMP\`
                );
                batchParams.push(
                  staff_id,
                  remDateStr,
                  \`Present at HQ (Available for booking - Came out of \${action} on Link #\${firstOriginalLink})\`
                );

                if (cachedSubStaff && cachedSubCat) {
                  const subOrigLink = getBaseLinkNumber(cachedSubStaff.row_position, getDayOffset(cachedSubCat.anchor_date, remDateStr), cachedSubCat.cycle_length);
                  const subReason = \`Substitute for \${staff.name} on return Link #\${remLink}\`;
                  batchStatements.push(
                    \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                     VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       overridden_link_number = excluded.overridden_link_number,
                       status = excluded.status,
                       substitute_staff_id = excluded.substitute_staff_id,
                       substitute_name = excluded.substitute_name,
                       reason = excluded.reason,
                       target_category_id = excluded.target_category_id\`
                  );
                  batchParams.push(
                    cachedSubStaff.id,
                    remDateStr,
                    subOrigLink,
                    remLink,
                    staff.id,
                    staff.name,
                    subReason,
                    staff.category_id
                  );

                  batchStatements.push(
                    \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                     VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       code = 'P',
                       remarks = excluded.remarks,
                       updated_by = excluded.updated_by,
                       updated_at = CURRENT_TIMESTAMP\`
                  );
                  batchParams.push(
                    cachedSubStaff.id,
                    remDateStr,
                    \`Working as substitute for \${staff.name} on Link #\${remLink}\`
                  );
                }
              }

              if (batchStatements.length > 0) {
                await run(batchStatements.join(';\\n'), batchParams);
              }`;

// 3. Dispatch logAudit asynchronously after commit
const oldAuditCall = `        await logAudit(
          'Admin',
          \`STAFF_\${action}\`,
          \`Marked \${staff.name} as \${action}\${dayWiseSummary || \` (\${effectiveLeaveType})\`} on \${dateRangeStr}. Replacement: \${finalSubstituteName || 'None'}. Reason: \${reason || action}.\${multiDaySetNotice ? ' ' + multiDaySetNotice : ''} Updated Muster Sheet.\`,
          undoData
        );`;

const newAuditCall = `        setImmediate(() => {
          logAudit(
            'Admin',
            \`STAFF_\${action}\`,
            \`Marked \${staff.name} as \${action}\${dayWiseSummary || \` (\${effectiveLeaveType})\`} on \${dateRangeStr}. Replacement: \${finalSubstituteName || 'None'}. Reason: \${reason || action}.\${multiDaySetNotice ? ' ' + multiDaySetNotice : ''} Updated Muster Sheet.\`,
            undoData
          ).catch(() => {});
        });`;

const normalizedCode = code.replace(/\r\n/g, '\n');
const normOldStaff = oldStaffCat.replace(/\r\n/g, '\n');
const normNewStaff = newStaffCat.replace(/\r\n/g, '\n');
const normOldRem = oldRemainingBlock.replace(/\r\n/g, '\n');
const normNewRem = newRemainingBlock.replace(/\r\n/g, '\n');
const normOldAudit = oldAuditCall.replace(/\r\n/g, '\n');
const normNewAudit = newAuditCall.replace(/\r\n/g, '\n');

if (!normalizedCode.includes(normOldStaff)) {
  console.error('Error: normOldStaff not found in code');
  process.exit(1);
}
if (!normalizedCode.includes(normOldRem)) {
  console.error('Error: normOldRem not found in code');
  process.exit(1);
}
if (!normalizedCode.includes(normOldAudit)) {
  console.error('Error: normOldAudit not found in code');
  process.exit(1);
}

let updated = normalizedCode.replace(normOldStaff, normNewStaff);
updated = updated.replace(normOldRem, normNewRem);
updated = updated.replace(normOldAudit, normNewAudit);

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Successfully applied Ultra P1 batching optimizations to server.ts!');
