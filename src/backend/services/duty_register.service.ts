import { get, all, run } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { ApiError } from '../utils/api_error';
import {
  parseTrainNumbers,
  isCoachCompatible,
  getActiveLinkDef,
  getCategoryParamsForDate
} from './helpers.service';
import {
  syncLRSheetRecord,
  syncDocumentsAndEarningsForStaffDate
} from './sync.service';
import { logAudit } from './audit.service';

export async function getDutyRegister(query: any) {
  const { date } = query;
  if (!date) throw new ApiError(400, 'Date is required' );

    const entries = await all('SELECT * FROM duty_register_entry WHERE date = ?', [date]);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    return (entries);
}

export async function saveDutyRegister(data: any, currentUser: string = 'Admin') {
  const { date, page_number, entries } = data;
  if (!date) throw new ApiError(400, 'Date is required' );
  if (!Array.isArray(entries)) throw new ApiError(400, 'Entries must be an array' );

    // Fetch and delete existing entries for this date
    const existing = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    for (const e of existing) {
      await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [e.id]);
    }
    await run('DELETE FROM duty_register_entry WHERE date = ?', [date]);

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (const item of entries) {
      try {
        const result = await run(
          `INSERT INTO duty_register_entry 
           (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            date,
            page_number ? parseInt(page_number, 10) : null,
            item.train_out || '',
            item.coach_out || '',
            item.train_return || '',
            item.coach_return || '',
            item.duty_label || '',
            item.notes || ''
          ]
        );
        const entryId = result.lastID;
        if (Array.isArray(item.staff_ids) && item.staff_ids.length > 0) {
          for (const staffId of item.staff_ids) {
            try {
              await run(
                'INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)',
                [entryId, staffId]
              );
              // Sync with LR sheet if staff is Category 4
              const staffObj = await get('SELECT id, name, category_id FROM staff WHERE id = ?', [staffId]);
              let regCode = '';
              if (item.train_out) {
                regCode = item.train_out + (item.train_return ? ` / ${item.train_return}` : '');
              } else if (item.duty_label) {
                regCode = item.duty_label;
              }
              if (staffObj && staffObj.category_id === 4 && regCode) {
                await syncLRSheetRecord(staffId, date, regCode, item.notes || item.duty_label || '');
              }
              if (regCode) {
                await syncDocumentsAndEarningsForStaffDate(staffId, date, {
                  dutyText: regCode,
                  isLeaveOrRest: regCode.toUpperCase() === 'REST' || regCode.toUpperCase() === 'R',
                  remarks: item.notes || item.duty_label || ''
                });
              }
              savedCount++;
              savedEmployeesSet.add(staffId);
            } catch (staffErr) {
              errorCount++;
              errorEmployeesSet.add(staffId);
              const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
              errors.push({
                staff_id: staffId,
                staff_name: staffRow?.name || `Employee #${staffId}`,
                error: staffErr.message
              });
            }
          }
        } else {
          savedCount++;
        }
      } catch (entryErr) {
        errorCount++;
        errors.push({
          staff_id: null,
          staff_name: item.train_out || item.duty_label || 'Register Row',
          error: entryErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      'Admin',
      'SAVE_DUTY_REGISTER',
      `Saved Duty Register for ${date}: ${savedEmployeesCount} employee(s) (${savedCount} assignment(s)) saved successfully, ${errorEmployeesCount} failed`,
      {
        date,
        savedCount,
        errorCount,
        savedEmployeesCount,
        errorEmployeesCount,
        errors
      }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Duty Register Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} assignment(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} error(s)) failed.${errorSummary}`
    });
}

export async function deleteDutyRegister(id: any, currentUser: string = 'Admin') {
    await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [id]);
    await run('DELETE FROM duty_register_entry WHERE id = ?', [id]);
    return ({ success: true });
}

export async function populateDutyRegisterFromRoster(data: any, currentUser: string = 'Admin') {
  const { date } = data;
  if (!date) throw new ApiError(400, 'Date is required' );
    const existingEntries = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    if (existingEntries.length > 0) {
      const ids = existingEntries.map(e => e.id).join(',');
      await run(`DELETE FROM duty_register_staff WHERE entry_id IN (${ids})`);
      await run(`DELETE FROM duty_register_entry WHERE id IN (${ids})`);
    }

    const categories = await all('SELECT * FROM categories');

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, date);
      const dayOffset = getDayOffset(catAnchorDate, date);

      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;

        if (override) {
          activeLink = override.overridden_link_number;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const isRest = activeLink === null || (dutyDetails && dutyDetails.is_rest === 1);

        let train_out = '';
        let coach_out = '';
        let train_return = '';
        let coach_return = '';
        let duty_label = isRest ? 'REST' : '';

        if (!isRest && dutyDetails) {
          const trains = parseTrainNumbers(dutyDetails.train_numbers);
          train_out = trains[0] || '';
          train_return = trains[1] || trains[0] || '';
          coach_out = dutyDetails.coaches || '';
          coach_return = dutyDetails.coaches || '';
          duty_label = `Link #${activeLink}`;
        }

        const result = await run(
          `INSERT INTO duty_register_entry 
           (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
          [date, train_out, coach_out, train_return, coach_return, duty_label, 'Auto-populated from roster']
        );

        const entryId = result.lastID;
        await run(
          `INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)`,
          [entryId, staff.id]
        );
      }
    }

    return ({ success: true });
}

export async function getDutyRegisterReconciliation(query: any) {
  const { date } = query;
  if (!date) throw new ApiError(400, 'Date is required' );

    const categories = await all('SELECT * FROM categories');
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, date);
      const dayOffset = getDayOffset(catAnchorDate, date);

      // Fetch all entries joined with staff for this category on this date
      const entries = await all(
        `SELECT e.*, s.id as staff_id 
         FROM duty_register_entry e
         JOIN duty_register_staff drs ON e.id = drs.entry_id
         JOIN staff s ON drs.staff_id = s.id
         WHERE e.date = ? AND s.category_id = ?`,
        [date, cat.id]
      );

      // Map entry crew members
      const entryCrewMap = {};
      for (const e of entries) {
        if (!entryCrewMap[e.id]) {
          const crew = await all(
            `SELECT s.name FROM staff s
             JOIN duty_register_staff drs ON s.id = drs.staff_id
             WHERE drs.entry_id = ?`,
            [e.id]
          );
          entryCrewMap[e.id] = crew.map(c => c.name);
        }
      }

      const list = [];
      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;
        let isOverridden = false;

        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const planned = {
          link_number: activeLink,
          isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
          isOverridden,
          train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
          from_station: dutyDetails ? dutyDetails.from_station : '',
          to_station: dutyDetails ? dutyDetails.to_station : '',
          coaches: dutyDetails ? dutyDetails.coaches : '',
          set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
        };

        const actualEntry = entries.find(e => e.staff_id === staff.id);
        const actual = actualEntry ? {
          entryId: actualEntry.id,
          train_out: actualEntry.train_out,
          coach_out: actualEntry.coach_out,
          train_return: actualEntry.train_return,
          coach_return: actualEntry.coach_return,
          duty_label: actualEntry.duty_label,
          notes: actualEntry.notes,
          crew: entryCrewMap[actualEntry.id] || []
        } : null;

        let isMismatch = false;
        let mismatchReason = '';

        if (planned.isRest) {
          if (actual) {
            isMismatch = true;
            mismatchReason = `Rostered for REST but worked: ${actual.duty_label || actual.train_out}`;
          }
        } else {
          if (!actual) {
            isMismatch = true;
            mismatchReason = `Rostered for duty (${planned.train_numbers}) but absent in register`;
          } else {
            const pTrains = parseTrainNumbers(planned.train_numbers);
            const actTrains = [];
            if (actual.train_out) actTrains.push(actual.train_out);
            if (actual.train_return) actTrains.push(actual.train_return);

            // Match train numbers
            const trainMismatch = pTrains.length > 0 && actTrains.length > 0 &&
              !pTrains.some(pt => actTrains.some(at => at.includes(pt) || pt.includes(at)));

            // Match coaches
            const coachMismatch = planned.coaches && actual.coach_out && !isCoachCompatible(planned.coaches, actual.coach_out);

            if (trainMismatch) {
              isMismatch = true;
              mismatchReason = `Train mismatch: Planned ${planned.train_numbers} vs Actual ${actTrains.join('/')}`;
            } else if (coachMismatch) {
              isMismatch = true;
              mismatchReason = `Coach mismatch: Planned ${planned.coaches} vs Actual ${actual.coach_out}`;
            }
          }
        }

        list.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          planned,
          actual,
          isMismatch,
          mismatchReason
        });
      }

      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        reconciliation: list
      });
    }

    return ({ date, categories: result });
}

export async function getDutyRegisterHistory(query: any) {
  const { q, startDate, endDate } = query;

    let sql = `
      SELECT DISTINCT e.*
      FROM duty_register_entry e
      LEFT JOIN duty_register_staff drs ON e.id = drs.entry_id
      LEFT JOIN staff s ON drs.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND e.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND e.date <= ?';
      params.push(endDate);
    }
    if (q) {
      sql += ' AND (s.name LIKE ? OR e.train_out LIKE ? OR e.train_return LIKE ? OR e.duty_label LIKE ?)';
      const queryParam = `%${q}%`;
      params.push(queryParam, queryParam, queryParam, queryParam);
    }
    sql += ' ORDER BY e.date DESC, e.id ASC';

    const entries = await all(sql, params);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    return (entries);
}
