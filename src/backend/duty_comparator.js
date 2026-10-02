/**
 * duty_comparator.js
 * 
 * Centralized Duty & Train Comparator for Railway Roster & Documents.
 * Implements the 4 user-specified conditions comparing the original assigned train
 * (Train Numbers column) and the train the employee went to (Remarks column):
 * 
 * condition 1: if both have the same train numbers then display that train number in the TA,NDA,DIARY document
 * condition 2: if both have different train numbers then display the train number in the remarks column(cause that is the final decision) in the TA,NDA,DIARY document
 * condition 3: if it is that employee's rest day, if both columns has declared as rest then that day should be skipped in the TA,NDA,DIARY documents
 * condition 4: if he goes on a train on rest day(i.e, if train number column shows rest and remarks column shows a train number) then that train number should be displayed in the TA,NDA,DIARY document
 */

const { getDutyRowsForLinkNumber, resolveDutyCodeToRows } = require('./ta_generator');

/**
 * Checks if a string or code represents a REST day
 */
function isRestString(val) {
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  if (s === 'REST' || s === 'R' || s === 'WEEKLY REST' || s === 'WEEKLY REST DAY' || s === 'OFF' || s === '-' || s === '---') {
    return true;
  }
  if (/^(weekly\s+rest|rest\b|r\b|muster:\s*r\b|weekly\s+rest\s+day)/i.test(String(val).trim())) {
    return true;
  }
  return false;
}

/**
 * Extracts 4 to 5 digit train numbers from text
 */
function extractTrainNumbers(val) {
  if (!val) return [];
  const s = String(val).trim();
  if (isRestString(s)) return [];
  const matches = s.match(/\b\d{4,5}\b/g);
  if (matches && matches.length > 0) {
    return [...new Set(matches)];
  }
  return [];
}

/**
 * Compares the original assigned train (Train Numbers column) and the train
 * the employee went to (Remarks column) based on the 4 conditions.
 */
function compareDutyAndResolve({
  origTrain,           // original assigned train string (e.g. '17253', 'REST', '12704/12703')
  origIsRest,          // boolean flag if original cyclic schedule was rest
  remarks,             // text from remarks column / override reason
  overrideDuty,        // object with extra_train_no, overridden_link_number, etc.
  muster,              // muster record { code, remarks }
  allLinks = []        // list of all links for fast link lookup
}) {
  // 1. Check for Muster Leave / Sick / Absent
  const musterCode = muster ? String(muster.code || '').trim().toUpperCase() : null;
  if (musterCode && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'O', 'NH'].includes(musterCode)) {
    return {
      action: 'LEAVE',
      leaveCode: musterCode,
      isRest: musterCode === 'CR',
      remarks: muster.remarks || `${musterCode} Leave`,
      train_no: null,
      duty_rows: []
    };
  }

  // 2. Check for Override Leave / Sick / Absent / Standby
  if (overrideDuty) {
    const ovStatus = String(overrideDuty.status || '').trim().toUpperCase();
    if (['LEAVE', 'SICK', 'CR', 'ABSENT'].includes(ovStatus) || overrideDuty.leave_type) {
      const code = overrideDuty.leave_type || ovStatus;
      return {
        action: 'LEAVE',
        leaveCode: code,
        isRest: code === 'CR',
        remarks: overrideDuty.reason || `${code} Leave`,
        train_no: null,
        duty_rows: []
      };
    }
    if (ovStatus === 'AVAILABLE_FOR_BOOKING') {
      return {
        action: 'STANDBY',
        isRest: false,
        remarks: overrideDuty.reason || 'Available at HQ (Standby)',
        train_no: null,
        duty_rows: []
      };
    }
  }

  // 3. Determine if original assigned duty is REST
  const origStr = String(origTrain || '').trim();
  const isOrigRest = Boolean(origIsRest) || isRestString(origStr);

  // 4. Determine remarks column train and rest status
  const remarksStr = String(remarks || (overrideDuty?.reason || '')).trim();
  let isRemarksRest = isRestString(remarksStr) || (overrideDuty?.status === 'REST') || (musterCode === 'R');

  let remarksTrain = null;
  if (overrideDuty) {
    if (overrideDuty.extra_train_no) {
      remarksTrain = String(overrideDuty.extra_train_no).trim();
      isRemarksRest = false;
    } else if (overrideDuty.advance_train_no) {
      remarksTrain = String(overrideDuty.advance_train_no).trim();
      isRemarksRest = false;
    } else if (overrideDuty.overridden_link_number) {
      const ln = parseInt(overrideDuty.overridden_link_number, 10);
      const tCat = overrideDuty.target_category_id || (ln > 21 ? 2 : 1);
      const linkMatch = allLinks.find(l => (l.category_id === tCat || !l.category_id) && l.link_number === ln);
      if (linkMatch && (linkMatch.is_rest || isRestString(linkMatch.train_numbers))) {
        isRemarksRest = true;
        remarksTrain = null;
      } else if (linkMatch && linkMatch.train_numbers) {
        remarksTrain = linkMatch.train_numbers;
        isRemarksRest = false;
      } else if (ln > 100) {
        remarksTrain = String(ln);
        isRemarksRest = false;
      }
    }
  }

  if (!remarksTrain && remarksStr) {
    const extracted = extractTrainNumbers(remarksStr);
    if (extracted.length > 0) {
      remarksTrain = extracted.join('/');
      isRemarksRest = false;
    } else {
      const linkMatchRegex = remarksStr.match(/(?:Link|link)\s*#?\s*(\d{1,2})\b/);
      if (linkMatchRegex) {
        const linkNumFound = parseInt(linkMatchRegex[1], 10);
        const lMatch = allLinks.find(l => l.link_number === linkNumFound);
        if (lMatch) {
          if (lMatch.is_rest || isRestString(lMatch.train_numbers)) {
            isRemarksRest = true;
            remarksTrain = null;
          } else if (lMatch.train_numbers) {
            remarksTrain = lMatch.train_numbers;
            isRemarksRest = false;
          }
        }
      }
    }
  }

  // 5. Apply the 4 conditions:

  // CONDITION 3:
  // if it is that employee's rest day, if both columns has declared as rest
  // then that day should be skipped in the TA,NDA,DIARY documents
  if (isOrigRest && (isRemarksRest || !remarksTrain)) {
    return {
      action: 'SKIP',
      condition: 3,
      isRest: true,
      train_no: null,
      duty_rows: [],
      remarks: remarksStr || 'Weekly Rest Day'
    };
  }

  // CONDITION 4:
  // if he goes on a train on rest day (i.e, if train number column shows rest and remarks column shows a train number)
  // then that train number should be displayed in the TA,NDA,DIARY document
  if (isOrigRest && remarksTrain) {
    const dutyRows = getDutyRowsForTrain(remarksTrain, allLinks);
    return {
      action: 'DISPLAY',
      condition: 4,
      isRest: false,
      train_no: remarksTrain,
      duty_rows: dutyRows,
      remarks: remarksStr || `Working Train ${remarksTrain}`
    };
  }

  // If original was a working train duty (!isOrigRest):
  // Check if remarks declared rest (final decision: employee rested on working day)
  if (isRemarksRest) {
    return {
      action: 'SKIP',
      condition: 3,
      isRest: true,
      train_no: null,
      duty_rows: [],
      remarks: remarksStr || 'Weekly Rest'
    };
  }

  const origCleanTrains = extractTrainNumbers(origStr);
  const remarksCleanTrains = extractTrainNumbers(remarksTrain || '');

  // CONDITION 1:
  // if both have the same train numbers then display that train number in the TA,NDA,DIARY document
  const isSameTrain = !remarksTrain || 
    (origCleanTrains.length > 0 && remarksCleanTrains.length > 0 && origCleanTrains.some(t => remarksCleanTrains.includes(t))) ||
    origStr === remarksTrain;

  if (isSameTrain) {
    const finalTrain = origStr;
    const dutyRows = getDutyRowsForTrain(finalTrain, allLinks);
    return {
      action: 'DISPLAY',
      condition: 1,
      isRest: false,
      train_no: finalTrain,
      duty_rows: dutyRows,
      remarks: remarksStr || 'Regular Cyclic Duty'
    };
  }

  // CONDITION 2:
  // if both have different train numbers then display the train number in the remarks column
  // (cause that is the final decision) in the TA,NDA,DIARY document
  const finalTrain = remarksTrain;
  const dutyRows = getDutyRowsForTrain(finalTrain, allLinks);
  return {
    action: 'DISPLAY',
    condition: 2,
    isRest: false,
    train_no: finalTrain,
    duty_rows: dutyRows,
    remarks: remarksStr || `Working Train ${finalTrain}`
  };
}

/**
 * Resolves duty rows (train_no, from, to, dep, arr, ta) for a given train number string.
 */
function getDutyRowsForTrain(trainStr, allLinks = []) {
  if (!trainStr || isRestString(trainStr)) return [];
  const clean = String(trainStr).trim();

  // 1. Check if any link matches this train number
  const matchedLink = allLinks.find(l => 
    l.train_numbers && (
      l.train_numbers === clean ||
      l.train_numbers.split(/[/, ]+/).includes(clean) ||
      clean.split(/[/, ]+/).includes(l.train_numbers)
    )
  );
  if (matchedLink) {
    const rows = getDutyRowsForLinkNumber(matchedLink.category_id || 1, matchedLink.link_number, matchedLink);
    if (rows && rows.length > 0) return rows;
  }

  // 2. Try resolveDutyCodeToRows
  const resolved = resolveDutyCodeToRows(clean);
  if (resolved && resolved.length > 0) return resolved;

  // 2b. If compound train like 12704/12703, try resolving each sub-train
  if (clean.includes('/')) {
    const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
    const combined = [];
    for (const p of parts) {
      const pRows = resolveDutyCodeToRows(p);
      if (pRows && pRows.length > 0) {
        combined.push(...pRows);
      }
    }
    if (combined.length > 0) return combined;
  }

  // 3. Fallback generic duty row
  const nums = extractTrainNumbers(clean);
  if (nums.length > 0) {
    return nums.map(tNo => ({
      train_no: tNo,
      from: 'GNT',
      to: '---',
      dep: '17:45',
      arr: '---',
      ta: 0.7
    }));
  }

  return [{
    train_no: clean,
    from: 'GNT',
    to: '---',
    dep: '17:45',
    arr: '---',
    ta: 0.7
  }];
}

module.exports = {
  isRestString,
  extractTrainNumbers,
  compareDutyAndResolve,
  getDutyRowsForTrain
};
