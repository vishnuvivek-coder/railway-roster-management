const fs = require('fs');

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Parallelize main staff updates (lines ~5920-5986)
const oldMainStaff = `          // 1. Mark main staff member
          await run(
            \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = NULL,
             status = excluded.status,
             substitute_staff_id = excluded.substitute_staff_id,
             substitute_name = excluded.substitute_name,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             leave_type = excluded.leave_type\`,
            [
              staff_id,
              dStr,
              originalLink,
              dayAction,
              replacement_staff_id || null,
              finalSubstituteName || null,
              dayReason || \`\${dayAction} - \${dayLeaveType}\`,
              staff.category_id,
              dayLeaveType
            ]
          );

          // 2. Automatically sync with muster_records table
          const musterRemarks = \`\${dayAction} [\${dayLeaveType}]\${finalSubstituteName ? \` - Sub: \${finalSubstituteName}\` : ''}\${dayReason ? \` (\${dayReason})\` : ''}\`;
          await run(
            \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = excluded.code,
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP\`,
            [staff_id, dStr, dayMusterCode, musterRemarks]
          );

          // Sync main staff with LR sheet if staff is in Category 4
          if (staff.category_id === 4) {
            const lrMusterCode = dayMusterCode === 'SICK' ? 'S' : dayMusterCode;
            await syncLRSheetRecord(staff.id, dStr, lrMusterCode, dayReason || \`\${dayAction} - \${dayLeaveType}\`);
          }

          // Synchronize TA approvals for main staff on leave/sick/rest
          const dateParts = dStr.split('-');
          const altDateStr = dateParts.length === 3 ? \`\${parseInt(dateParts[2], 10)}/\${parseInt(dateParts[1], 10)}/\${dateParts[0].slice(-2)}\` : dStr;
          const disallowRemark = \`Disallowed: On Leave/Absent as per Daily Duty (\${dayMusterCode})\`;
          await run(
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
          );
          await syncDocumentsAndEarningsForStaffDate(staff.id, dStr, { dutyText: dayMusterCode, isLeaveOrRest: true, remarks: musterRemarks });`;

const newMainStaff = `          // 1. Mark main staff member & sync records concurrently in parallel
          const musterRemarks = \`\${dayAction} [\${dayLeaveType}]\${finalSubstituteName ? \` - Sub: \${finalSubstituteName}\` : ''}\${dayReason ? \` (\${dayReason})\` : ''}\`;
          const dateParts = dStr.split('-');
          const altDateStr = dateParts.length === 3 ? \`\${parseInt(dateParts[2], 10)}/\${parseInt(dateParts[1], 10)}/\${dateParts[0].slice(-2)}\` : dStr;
          const disallowRemark = \`Disallowed: On Leave/Absent as per Daily Duty (\${dayMusterCode})\`;

          const mainStaffUpdates = [
            run(
              \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = excluded.status,
               substitute_staff_id = excluded.substitute_staff_id,
               substitute_name = excluded.substitute_name,
               reason = excluded.reason,
               target_category_id = excluded.target_category_id,
               leave_type = excluded.leave_type\`,
              [
                staff_id,
                dStr,
                originalLink,
                dayAction,
                replacement_staff_id || null,
                finalSubstituteName || null,
                dayReason || \`\${dayAction} - \${dayLeaveType}\`,
                staff.category_id,
                dayLeaveType
              ]
            ),
            run(
              \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = excluded.code,
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP\`,
              [staff_id, dStr, dayMusterCode, musterRemarks]
            ),
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
            ),
            syncDocumentsAndEarningsForStaffDate(staff.id, dStr, { dutyText: dayMusterCode, isLeaveOrRest: true, remarks: musterRemarks })
          ];

          if (staff.category_id === 4) {
            const lrMusterCode = dayMusterCode === 'SICK' ? 'S' : dayMusterCode;
            mainStaffUpdates.push(syncLRSheetRecord(staff.id, dStr, lrMusterCode, dayReason || \`\${dayAction} - \${dayLeaveType}\`));
          }

          await Promise.all(mainStaffUpdates);`;

// 2. Parallelize substitute updates & queue TA recalculation asynchronously (lines ~6003-6072)
const oldSubStaff = `              // Clear any previous substitute assignment for this staff on another slot on the same date
              await run(
                \`UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND staff_id != ? AND date = ?\`,
                [subStaff.id, staff.id, dStr]
              );

              await run(
                \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type, is_extra, extra_train_no, is_advance_duty, advance_train_no)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?, NULL, 0, NULL, 0, NULL)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id,
                 leave_type = NULL,
                 is_extra = 0,
                 extra_train_no = NULL,
                 is_advance_duty = 0,
                 advance_train_no = NULL\`,
                [
                  subStaff.id,
                  dStr,
                  subOrigLink,
                  effectiveSlotLink,
                  staff.id,
                  staff.name,
                  subReason,
                  isUpgrade ? 1 : (target_category_id || staff.category_id)
                ]
              );

              // Substitute is working duty on this date: record 'P' in muster roll
              await run(
                \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP\`,
                [subStaff.id, dStr, isUpgrade ? \`Upgraded to COR Link #\${effectiveSlotLink} (Sub for \${staff.name})\` : \`Working as substitute for \${staff.name}\`]
              );

              // Regenerate TA claims for substitute
              await run(
                \`DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')\`,
                [subStaff.id, dStr, dStr, altDateStr]
              );
              const subY = parseInt(dateParts[0], 10);
              const subM = parseInt(dateParts[1], 10);
              try {
                const { generatePendingTaClaimsForMonth } = require('./ta_generator');
                await generatePendingTaClaimsForMonth({ run, get, all }, subY, subM, subStaff.id);
              } catch (err) { }
              await syncDocumentsAndEarningsForStaffDate(subStaff.id, dStr, { dutyText: \`L-\${effectiveSlotLink}\`, isLeaveOrRest: false, remarks: subReason });

              // Sync substitute with LR sheet if substitute is in Category 4
              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, subReason);
                }

                // Note: Multi-day return leg overrides & muster records are handled in the unified multi-day block below to avoid duplicate writes.
              }`;

const newSubStaff = `              // Clear any previous substitute assignment for this staff on another slot on the same date
              await run(
                \`UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND staff_id != ? AND date = ?\`,
                [subStaff.id, staff.id, dStr]
              );

              // Concurrently run substitute override, muster, and document sync
              const subStaffUpdates = [
                run(
                  \`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type, is_extra, extra_train_no, is_advance_duty, advance_train_no)
                 VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?, NULL, 0, NULL, 0, NULL)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   overridden_link_number = excluded.overridden_link_number,
                   status = excluded.status,
                   substitute_staff_id = excluded.substitute_staff_id,
                   substitute_name = excluded.substitute_name,
                   reason = excluded.reason,
                   target_category_id = excluded.target_category_id,
                   leave_type = NULL,
                   is_extra = 0,
                   extra_train_no = NULL,
                   is_advance_duty = 0,
                   advance_train_no = NULL\`,
                  [
                    subStaff.id,
                    dStr,
                    subOrigLink,
                    effectiveSlotLink,
                    staff.id,
                    staff.name,
                    subReason,
                    isUpgrade ? 1 : (target_category_id || staff.category_id)
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
                  [subStaff.id, dStr, isUpgrade ? \`Upgraded to COR Link #\${effectiveSlotLink} (Sub for \${staff.name})\` : \`Working as substitute for \${staff.name}\`]
                ),
                run(
                  \`DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')\`,
                  [subStaff.id, dStr, dStr, altDateStr]
                ),
                syncDocumentsAndEarningsForStaffDate(subStaff.id, dStr, { dutyText: \`L-\${effectiveSlotLink}\`, isLeaveOrRest: false, remarks: subReason })
              ];

              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  subStaffUpdates.push(syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, subReason));
                }
              }

              await Promise.all(subStaffUpdates);

              // Queue asynchronous background TA recalculation for substitute instead of blocking HTTP response
              queueTaRecalc(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10), subStaff.id);`;

// 3. Parallelize remainingSetLinks multi-day loop (lines ~6100-6216)
const oldRemainingLoop = `              for (let k = 0; k < remainingSetLinks.length; k++) {
                const remLink = remainingSetLinks[k];
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

                // 1. Mark main staff as AVAILABLE_FOR_BOOKING at HQ
                await run(
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
                );

                // 2. Mark main staff muster as 'P' (Present at HQ)
                await run(
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
                );
                await syncDocumentsAndEarningsForStaffDate(staff_id, remDateStr, { dutyText: 'AVL', isLeaveOrRest: false });

                // 3. If substitute assigned on Day 1, they work return leg as well
                if (replacement_staff_id) {
                  const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                  if (subStaff) {
                    const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
                    const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, remDateStr), subCat.cycle_length);
                    const subReason = \`Substitute for \${staff.name} on return Link #\${remLink}\`;

                    await run(
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
                        subStaff.id,
                        remDateStr,
                        subOrigLink,
                        remLink,
                        staff.id,
                        staff.name,
                        subReason,
                        staff.category_id
                      ]
                    );

                    await run(
                      \`INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                     VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       code = 'P',
                       remarks = excluded.remarks,
                       updated_by = excluded.updated_by,
                       updated_at = CURRENT_TIMESTAMP\`,
                      [subStaff.id, remDateStr, \`Working as substitute for \${staff.name} on Link #\${remLink}\`]
                    );
                    // If substitute is in Category 4 (LR), sync LR sheet for return leg
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
                }
              }`;

const newRemainingLoop = `              // Fetch subStaff and subCat once upfront outside the remainingSetLinks loop
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

const normalizedCode = code.replace(/\r\n/g, '\n');
const normOldMain = oldMainStaff.replace(/\r\n/g, '\n');
const normNewMain = newMainStaff.replace(/\r\n/g, '\n');
const normOldSub = oldSubStaff.replace(/\r\n/g, '\n');
const normNewSub = newSubStaff.replace(/\r\n/g, '\n');
const normOldRem = oldRemainingLoop.replace(/\r\n/g, '\n');
const normNewRem = newRemainingLoop.replace(/\r\n/g, '\n');

if (!normalizedCode.includes(normOldMain)) {
  console.error('Error: normOldMain not found in code');
  process.exit(1);
}
if (!normalizedCode.includes(normOldSub)) {
  console.error('Error: normOldSub not found in code');
  process.exit(1);
}
if (!normalizedCode.includes(normOldRem)) {
  console.error('Error: normOldRem not found in code');
  process.exit(1);
}

let updated = normalizedCode.replace(normOldMain, normNewMain);
updated = updated.replace(normOldSub, normNewSub);
updated = updated.replace(normOldRem, normNewRem);

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Successfully optimized server.ts for P1 concurrent query execution!');
