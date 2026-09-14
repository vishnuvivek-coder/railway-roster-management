const https = require('https');
const querystring = require('querystring');

/**
 * NTES (National Train Enquiry System) Official Service
 * Connects directly and exclusively to https://enquiry.indianrail.gov.in/mntes/
 * Extracts official arrival and departure timings directly from the NTES website.
 */

function requestPromise(options, postData = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`NTES request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

class NtesOfficialClient {
  constructor() {
    this.cookies = {};
    this.lastSessionTime = 0;
  }

  async ensureSession() {
    const now = Date.now();
    if (Object.keys(this.cookies).length > 0 && now - this.lastSessionTime < 10 * 60 * 1000) {
      return;
    }

    try {
      const resHome = await requestPromise({
        hostname: 'enquiry.indianrail.gov.in',
        path: '/mntes/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      (resHome.headers['set-cookie'] || []).forEach(c => {
        const [kv] = c.split(';');
        const [k, v] = kv.split('=');
        this.cookies[k.trim()] = v ? v.trim() : '';
      });
      this.lastSessionTime = now;
    } catch (err) {
      console.warn('[NTES Client] Error establishing session:', err.message);
    }
  }

  async getFreshCsrf() {
    await this.ensureSession();
    try {
      const resCsrf = await requestPromise({
        hostname: 'enquiry.indianrail.gov.in',
        path: `/mntes/GetCSRFToken?t=${Date.now()}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': this.getCookieHeader(),
          'Referer': 'https://enquiry.indianrail.gov.in/mntes/'
        }
      });

      (resCsrf.headers['set-cookie'] || []).forEach(c => {
        const [kv] = c.split(';');
        const [k, v] = kv.split('=');
        this.cookies[k.trim()] = v ? v.trim() : '';
      });

      const nameMatch = resCsrf.data.match(/name=['"]([^'"]+)['"]/);
      const valMatch = resCsrf.data.match(/value=['"]([^'"]+)['"]/);
      if (nameMatch && valMatch) {
        return { name: nameMatch[1], value: valMatch[1] };
      }
    } catch (err) {
      console.warn('[NTES Client] Error getting CSRF token:', err.message);
    }
    return null;
  }

  getCookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // Official NTES Train Service Schedule (Scheduled Arr & Dep for all stations)
  async fetchSchedule(trainNo) {
    const cleanTrain = String(trainNo).trim();
    const csrf = await this.getFreshCsrf();
    const postParams = { lan: 'en', trainNo: cleanTrain };
    if (csrf) postParams[csrf.name] = csrf.value;

    const postBody = querystring.stringify(postParams);

    const res = await requestPromise({
      hostname: 'enquiry.indianrail.gov.in',
      path: `/mntes/q?opt=TrainServiceSchedule&subOpt=main&trainNo=${encodeURIComponent(cleanTrain)}`,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody),
        'Cookie': this.getCookieHeader(),
        'Referer': 'https://enquiry.indianrail.gov.in/mntes/',
        'Origin': 'https://enquiry.indianrail.gov.in'
      }
    }, postBody);

    const scheduleMap = {};
    if (res.status === 200 && res.data) {
      const rows = res.data.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      rows.forEach(rowHtml => {
        const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => 
          c[1].replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        );
        if (cells.length >= 6) {
          const words = cells[1].split(' ');
          let stnCode = null;
          for (const w of words) {
            if (/^[A-Z]{2,5}$/.test(w) && !['JN', 'RD', 'TOWN', 'CANT', 'CITY', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'MAIN', 'PASS'].includes(w)) {
              stnCode = w;
            }
          }

          const timeStr = cells[3];
          const timeMatches = timeStr.match(/(\d{1,2}:\d{2})/g) || [];
          let schedArr = '---';
          let schedDep = '---';

          if (timeStr.includes('SRC') && timeMatches.length >= 1) {
            schedArr = timeMatches[0];
            schedDep = timeMatches[0];
          } else if (timeStr.includes('DSTN') && timeMatches.length >= 1) {
            schedArr = timeMatches[0];
            schedDep = timeMatches[0];
          } else if (timeMatches.length >= 2) {
            schedArr = timeMatches[0];
            schedDep = timeMatches[1];
          } else if (timeMatches.length === 1) {
            schedArr = timeMatches[0];
            schedDep = timeMatches[0];
          }

          if (stnCode) {
            scheduleMap[stnCode] = {
              stn_name: cells[1],
              day: parseInt(cells[2], 10) || 1,
              sched_arr: schedArr,
              sched_dep: schedDep
            };
          }
        }
      });
    }
    return scheduleMap;
  }

  // Official NTES Live Train Running Status (Actual Arr & Dep + Delays from NTES)
  async fetchRunningStatus(trainNo, dateIso) {
    const cleanTrain = String(trainNo).trim();
    const csrf = await this.getFreshCsrf();

    const [yyyy, mm, dd] = dateIso.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(mm, 10) - 1];
    const jDate = `${dd}-${monthName}-${yyyy}`;

    const postParams = {
      lan: 'en',
      jDate: jDate,
      trainNo: cleanTrain
    };
    if (csrf) postParams[csrf.name] = csrf.value;

    const postBody = querystring.stringify(postParams);

    const res = await requestPromise({
      hostname: 'enquiry.indianrail.gov.in',
      path: '/mntes/tr?opt=TrainRunning&subOpt=FindRunningInstance',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody),
        'Cookie': this.getCookieHeader(),
        'Referer': 'https://enquiry.indianrail.gov.in/mntes/',
        'Origin': 'https://enquiry.indianrail.gov.in'
      }
    }, postBody);

    const statusMap = {};
    if (res.status === 200 && res.data) {
      const data = res.data;
      const regex = /<b>([A-Z]{2,6})\s+<span[^>]*>.*?PF\s*([^<]*)<\/span><\/b>/gi;
      let match;
      while ((match = regex.exec(data)) !== null) {
        const stnCode = match[1];
        const postSnippet = data.slice(match.index, match.index + 1200);

        const timeMatches = [...postSnippet.matchAll(/(\d{1,2}:\d{2})\s+([0-9]{2}-[A-Za-z]{3})/g)];
        const isOntime = postSnippet.includes('On Time');
        const delayMatch = postSnippet.match(/(\d+)\s*(?:min|mins|hr|hrs|hour|hours)\s*late/i);

        let schedTime = '---';
        let actTime = '---';
        if (timeMatches.length >= 2) {
          schedTime = timeMatches[0][1];
          actTime = timeMatches[1][1];
        } else if (timeMatches.length === 1) {
          schedTime = timeMatches[0][1];
          actTime = schedTime;
        }

        let delayMins = 0;
        if (delayMatch) {
          delayMins = parseInt(delayMatch[1], 10);
          if (delayMatch[0].toLowerCase().includes('hr')) delayMins *= 60;
        }

        if (!statusMap[stnCode]) {
          statusMap[stnCode] = {
            stn_code: stnCode,
            sched_time: schedTime,
            act_time: actTime,
            delay_mins: delayMins,
            status: isOntime ? 'On Time' : (delayMatch ? delayMatch[0] : 'Normal')
          };
        }
      }
    }
    return statusMap;
  }

  // Combined NTES query: merges NTES timetable schedule with NTES live actual running timings
  async getOfficialNtesData(trainNo, dateIso) {
    const cleanTrain = String(trainNo).trim();
    const [sched, live] = await Promise.all([
      this.fetchSchedule(cleanTrain).catch(() => ({})),
      this.fetchRunningStatus(cleanTrain, dateIso).catch(() => ({}))
    ]);

    const merged = {};
    const allStations = new Set([...Object.keys(sched), ...Object.keys(live)]);

    allStations.forEach(stn => {
      const s = sched[stn] || {};
      const l = live[stn] || {};

      const schedDep = s.sched_dep || l.sched_time || '---';
      const schedArr = s.sched_arr || l.sched_time || '---';

      const delayMins = l.delay_mins || 0;

      let actDep = l.act_time || schedDep;
      let actArr = l.act_time || schedArr;

      if (delayMins > 0) {
        if (schedDep !== '---') {
          const m = parseTimeToMinutes(schedDep);
          if (m !== null) actDep = formatMinutesToTime(m + delayMins);
        }
        if (schedArr !== '---') {
          const m = parseTimeToMinutes(schedArr);
          if (m !== null) actArr = formatMinutesToTime(m + delayMins);
        }
      }

      merged[stn] = {
        stn_code: stn,
        stn_name: s.stn_name || stn,
        sched_arr: schedArr,
        sched_dep: schedDep,
        act_arr: actArr,
        act_dep: actDep,
        delay_arr_mins: delayMins,
        delay_dep_mins: delayMins,
        delay_mins: delayMins,
        status: l.status || (delayMins === 0 ? 'On Time' : `${delayMins} min late`),
        source: 'NTES (Official)'
      };
    });

    return merged;
  }
}

const ntesClient = new NtesOfficialClient();


/**
 * Format minutes to HH:MM string
 */
function formatMinutesToTime(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '---';
  let mins = Math.floor(totalMinutes) % 1440;
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parse time string like '17:45', '5:10' to minutes from midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === '---' || timeStr === '--' || timeStr === '') return null;
  const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Fetch official arrival and departure timings for a specific train and date from NTES website.
 * Checks SQLite cache if forceRefresh is false.
 */
async function fetchTrainRunningFromNtes(trainNo, dateIso, dbHelper, forceRefresh = false) {
  if (!trainNo || trainNo === 'REST' || trainNo === 'OFF' || !dateIso) {
    return {};
  }

  const cleanTrain = String(trainNo).trim();

  // 1. Check SQLite cache first unless forceRefresh is true
  if (!forceRefresh && dbHelper && dbHelper.all) {
    try {
      const cached = await dbHelper.all(
        'SELECT * FROM actual_train_runs WHERE train_no = ? AND run_date = ?',
        [cleanTrain, dateIso]
      );
      const hasValid = cached && cached.length > 0 && cached.some(row =>
        (row.sched_arr && row.sched_arr !== '---') ||
        (row.sched_dep && row.sched_dep !== '---') ||
        (row.act_arr && row.act_arr !== '---') ||
        (row.act_dep && row.act_dep !== '---')
      );

      if (hasValid) {
        const resultMap = {};
        cached.forEach((row) => {
          resultMap[row.station_code] = {
            stn_code: row.station_code,
            sched_arr: row.sched_arr,
            sched_dep: row.sched_dep,
            act_arr: row.act_arr,
            act_dep: row.act_dep,
            delay_arr_mins: row.delay_arr_mins || 0,
            delay_dep_mins: row.delay_dep_mins || 0,
            delay_mins: Math.max(row.delay_arr_mins || 0, row.delay_dep_mins || 0),
            source: 'NTES (Official)'
          };
        });
        return resultMap;
      }
    } catch (err) {
      console.warn('Cache lookup warning:', err.message);
    }
  }

  // 2. Fetch directly from official NTES website (enquiry.indianrail.gov.in/mntes/)
  let stationTimings = {};
  try {
    stationTimings = await ntesClient.getOfficialNtesData(cleanTrain, dateIso);
  } catch (err) {
    console.error(`[NTES Official] Failed to query train ${cleanTrain} on ${dateIso}:`, err.message);
  }

  // 3. Cache valid timings in SQLite database
  if (dbHelper && dbHelper.run && Object.keys(stationTimings).length > 0) {
    try {
      for (const [stnCode, data] of Object.entries(stationTimings)) {
        if ((data.act_arr && data.act_arr !== '---') || (data.act_dep && data.act_dep !== '---') || (data.sched_arr && data.sched_arr !== '---') || (data.sched_dep && data.sched_dep !== '---')) {
          await dbHelper.run(
            `INSERT OR REPLACE INTO actual_train_runs 
             (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cleanTrain,
              dateIso,
              stnCode,
              data.sched_arr || '---',
              data.sched_dep || '---',
              data.act_arr || '---',
              data.act_dep || '---',
              data.delay_arr_mins || 0,
              data.delay_dep_mins || 0,
              'NTES (Official)'
            ]
          );
        }
      }
    } catch (err) {
      console.warn('[NTES Cache] Failed to write cache:', err.message);
    }
  }

  return stationTimings;
}

/**
 * Batch resolve actual arrival and departure timings for a list of journey legs
 * Strictly and exclusively relies on official NTES website data (enquiry.indianrail.gov.in).
 */
async function syncJourneyLegsWithNtes(journeyLegs, dbHelper, forceRefresh = true) {
  if (!Array.isArray(journeyLegs) || journeyLegs.length === 0) {
    return [];
  }

  // 1. Collect distinct (train_no, date_iso) runs
  const uniqueRuns = new Map();
  journeyLegs.forEach(leg => {
    if (leg.train_no && leg.train_no !== 'REST' && leg.train_no !== 'OFF' && leg.date_iso) {
      const train = String(leg.train_no).trim();
      const key = `${train}_${leg.date_iso}`;
      if (!uniqueRuns.has(key)) {
        uniqueRuns.set(key, { train_no: train, date_iso: leg.date_iso });
      }
    }
  });

  // 2. Fetch official NTES timings for each unique run
  const timingCache = new Map();
  await Promise.all(
    Array.from(uniqueRuns.values()).map(async ({ train_no, date_iso }) => {
      try {
        const stnTimings = await fetchTrainRunningFromNtes(train_no, date_iso, dbHelper, forceRefresh);
        timingCache.set(`${train_no}_${date_iso}`, stnTimings);
      } catch (err) {
        console.error(`[NTES Batch] Error fetching ${train_no} on ${date_iso}:`, err.message);
        timingCache.set(`${train_no}_${date_iso}`, {});
      }
    })
  );

  // 3. Map official NTES timings back to each journey leg
  const updatedLegs = journeyLegs.map(leg => {
    const { train_no, date_iso, from_station, to_station } = leg;

    if (!train_no || train_no === 'REST' || train_no === 'OFF' || !date_iso) {
      return leg;
    }

    const train = String(train_no).trim();
    const stnTimings = timingCache.get(`${train}_${date_iso}`) || {};
    const fromData = stnTimings[from_station] || {};
    const toData = stnTimings[to_station] || {};

    let schedDep = fromData.sched_dep && fromData.sched_dep !== '---' 
      ? fromData.sched_dep 
      : (leg.sched_dep || leg.dep_time || '---');
      
    let schedArr = toData.sched_arr && toData.sched_arr !== '---' 
      ? toData.sched_arr 
      : (leg.sched_arr || leg.arr_time || '---');

    let actualDep = fromData.act_dep && fromData.act_dep !== '---' 
      ? fromData.act_dep 
      : (leg.act_dep || schedDep);

    let actualArr = toData.act_arr && toData.act_arr !== '---' 
      ? toData.act_arr 
      : (leg.act_arr || schedArr);

    let delayMins = Math.max(fromData.delay_dep_mins || 0, toData.delay_arr_mins || 0);

    const hasNtesMatch = (fromData && Object.keys(fromData).length > 0) || (toData && Object.keys(toData).length > 0);

    return {
      ...leg,
      sched_dep: schedDep,
      sched_arr: schedArr,
      act_dep: actualDep,
      act_arr: actualArr,
      dep_time: actualDep,
      arr_time: actualArr,
      delay_mins: delayMins,
      is_ntes_synced: hasNtesMatch,
      ntes_source: 'NTES (Official)'
    };
  });

  return updatedLegs;
}

module.exports = {
  fetchTrainRunningFromNtes,
  syncJourneyLegsWithNtes,
  parseTimeToMinutes,
  formatMinutesToTime
};
