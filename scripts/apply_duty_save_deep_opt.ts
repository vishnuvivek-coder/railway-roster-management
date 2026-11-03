import fs from 'fs';

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');
const isCrlf = code.includes('\r\n');
if (isCrlf) code = code.replace(/\r\n/g, '\n');

// 1. Optimize resolveDutyCodeForLRStaff (lines 16065-16090)
const oldLRDataPool = `  } else {
    const dMinus2Obj = new Date(dateStr + 'T12:00:00');
    dMinus2Obj.setDate(dMinus2Obj.getDate() - 2);
    const dMinus2Start = dMinus2Obj.toISOString().split('T')[0];
    overrides = await all(\`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    \`, [dMinus2Start, dateStr]);
    links = await all(\`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    \`);
    nonDaily = await all('SELECT * FROM non_daily_trains');
    dutyRegister = await all(\`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date = ?
    \`, [dateStr]);
    muster = await all('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    dailyEarnings = await all('SELECT * FROM daily_earnings_entries WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
  }`;

const newLRDataPool = `  } else {
    const dMinus2Obj = new Date(dateStr + 'T12:00:00');
    dMinus2Obj.setDate(dMinus2Obj.getDate() - 2);
    const dMinus2Start = dMinus2Obj.toISOString().split('T')[0];
    const [ovList, ndList, dreList, mrList, deList, pubLinks] = await Promise.all([
      all(\`
        SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
        FROM overrides o
        JOIN staff s1 ON o.staff_id = s1.id
        WHERE o.date >= ? AND o.date <= ?
      \`, [dMinus2Start, dateStr]),
      all('SELECT * FROM non_daily_trains'),
      all(\`
        SELECT dre.*, drs.staff_id
        FROM duty_register_entry dre
        JOIN duty_register_staff drs ON dre.id = drs.entry_id
        WHERE dre.date = ?
      \`, [dateStr]),
      all('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]),
      all('SELECT * FROM daily_earnings_entries WHERE staff_id = ? AND date = ?', [staffId, dateStr]),
      getCachedPublishedLinks()
    ]);
    overrides = ovList;
    links = pubLinks;
    nonDaily = ndList;
    dutyRegister = dreList;
    muster = mrList;
    dailyEarnings = deList;
  }`;

if (!code.includes(oldLRDataPool)) {
  console.error('oldLRDataPool not found!');
  process.exit(1);
}
code = code.replace(oldLRDataPool, newLRDataPool);
console.log('✓ Optimized resolveDutyCodeForLRStaff with Promise.all and in-memory link cache');

// 2. Cache subStaff and subCat at start of LEAVE action
const oldSubStaffLookup = `      if (action === 'SICK' || action === 'LEAVE' || action === 'CR' || action === 'ABSENT' || action === 'REST') {
        let finalSubstituteName = replacement_name;
        if (!finalSubstituteName && replacement_staff_id) {
          const subStaffObj = await get('SELECT name FROM staff WHERE id = ?', [replacement_staff_id]);
          finalSubstituteName = subStaffObj ? subStaffObj.name : null;
        }`;

const newSubStaffLookup = `      if (action === 'SICK' || action === 'LEAVE' || action === 'CR' || action === 'ABSENT' || action === 'REST') {
        let finalSubstituteName = replacement_name;
        let cachedSubStaff: any = null;
        let cachedSubCat: any = null;
        if (replacement_staff_id) {
          cachedSubStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
          if (cachedSubStaff) {
            finalSubstituteName = finalSubstituteName || cachedSubStaff.name;
            cachedSubCat = await get('SELECT * FROM categories WHERE id = ?', [cachedSubStaff.category_id]);
          }
        }`;

if (!code.includes(oldSubStaffLookup)) {
  console.error('oldSubStaffLookup not found!');
  process.exit(1);
}
code = code.replace(oldSubStaffLookup, newSubStaffLookup);
console.log('✓ Cached subStaff and subCat upfront in LEAVE action');

// 3. Reuse cachedSubStaff and cachedSubCat in Day 1 substitute allotment
const oldSubStaffInLoop = `          // If replacement is an existing staff member in another column or LR pool
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);`;

const newSubStaffInLoop = `          // If replacement is an existing staff member in another column or LR pool
          if (replacement_staff_id && cachedSubStaff) {
            const subStaff = cachedSubStaff;
            const subCat = cachedSubCat || category;`;

if (!code.includes(oldSubStaffInLoop)) {
  console.error('oldSubStaffInLoop not found!');
  process.exit(1);
}
code = code.replace(oldSubStaffInLoop, newSubStaffInLoop);
console.log('✓ Reused cachedSubStaff and cachedSubCat in Day 1 loop');

// 4. Batch substitute override, muster, and ta delete into Promise.all
const oldSubWrites = `              await run(
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
              );`;

const newSubWrites = `              await Promise.all([
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
                )
              ]);`;

if (!code.includes(oldSubWrites)) {
  console.error('oldSubWrites not found!');
  process.exit(1);
}
code = code.replace(oldSubWrites, newSubWrites);
console.log('✓ Batched substitute writes with Promise.all in Day 1');

// 5. Reuse cachedSubStaff and cachedSubCat in Multi-Day return leg
const oldReturnLegSubStaff = `                // 3. If substitute assigned on Day 1, they work return leg as well
                if (replacement_staff_id) {
                  const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                  if (subStaff) {
                    const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);`;

const newReturnLegSubStaff = `                // 3. If substitute assigned on Day 1, they work return leg as well
                if (replacement_staff_id && cachedSubStaff) {
                  const subStaff = cachedSubStaff;
                  const subCat = cachedSubCat || category;`;

if (!code.includes(oldReturnLegSubStaff)) {
  console.error('oldReturnLegSubStaff not found!');
  process.exit(1);
}
code = code.replace(oldReturnLegSubStaff, newReturnLegSubStaff);
console.log('✓ Reused cachedSubStaff and cachedSubCat in return leg loop');

// 6. Batch return leg overrides and muster writes into Promise.all
const oldReturnLegWrites = `                // 1. Mark main staff as AVAILABLE_FOR_BOOKING at HQ
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
                );`;

const newReturnLegWrites = `                // 1 & 2. Mark main staff as AVAILABLE_FOR_BOOKING at HQ and muster 'P' concurrently
                await Promise.all([
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
                  )
                ]);`;

if (!code.includes(oldReturnLegWrites)) {
  console.error('oldReturnLegWrites not found!');
  process.exit(1);
}
code = code.replace(oldReturnLegWrites, newReturnLegWrites);
console.log('✓ Batched return leg main staff writes with Promise.all');

if (isCrlf) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, code, 'utf8');
console.log('✓ ALL DEEP OPTIMIZATIONS APPLIED TO SERVER.TS!');
