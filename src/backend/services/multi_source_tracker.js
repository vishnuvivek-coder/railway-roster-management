const https = require('https');
const http = require('http');
const { fetchTrainRunningFromNtes, parseTimeToMinutes, formatMinutesToTime } = require('./ntes_service');

/**
 * Generic HTTP GET helper with custom headers and timeout
 */
function fetchHttp(url, timeoutMs = 3500) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8'
        },
        timeout: timeoutMs
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 408, data: '', error: 'Timeout' });
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: '', error: err.message });
      });
    } catch (e) {
      resolve({ status: 500, data: '', error: e.message });
    }
  });
}

/**
 * Helper to convert 12-hour "hh:mm AM/PM" to 24-hour "HH:MM"
 */
function convert12to24(timeStr) {
  if (!timeStr) return '---';
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    const m24 = timeStr.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return m24 ? `${m24[1].padStart(2, '0')}:${m24[2]}` : '---';
  }
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else if (period === 'PM') {
    if (h !== 12) h += 12;
  }
  return `${h.toString().padStart(2, '0')}:${m}`;
}

/**
 * Resolve ISO date string (YYYY-MM-DD) from various journey leg attributes
 */
function resolveDateIso(leg) {
  if (leg.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(leg.date_iso)) {
    return leg.date_iso;
  }
  if (leg.duty_date && /^\d{4}-\d{2}-\d{2}$/.test(leg.duty_date)) {
    return leg.duty_date;
  }
  if (leg.date_str) {
    const parts = leg.date_str.trim().split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  if (leg.month_year && /^\d{4}-\d{2}$/.test(leg.month_year)) {
    return `${leg.month_year}-01`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Source 1: Where Is My Train (https://whereismytrain.org.in/?trainNo=...)
 */
async function fetchWhereIsMyTrain(trainNo) {
  const result = {};
  if (!trainNo) return result;

  try {
    const res = await fetchHttp(`https://whereismytrain.org.in/?trainNo=${trainNo}`, 4000);
    if (res.status !== 200 || !res.data) return result;

    const html = res.data;

    // Match station blocks e.g. <h3 class="...">Station Name (CODE)</h3>
    const stationBlockRegex = /<h3[^>]*>[\s\S]*?\(([A-Z0-9]{2,6})\)[\s\S]*?<\/h3>([\s\S]*?)(?=<h3[^>]*>[\s\S]*?\([A-Z0-9]{2,6}\)|$)/gi;
    let match;

    while ((match = stationBlockRegex.exec(html)) !== null) {
      const stnCode = match[1].trim().toUpperCase();
      const content = match[2];

      // Extract delay if present (e.g. "30min Late", "On Time", "Right Time", "5 min late")
      let delayMins = 0;
      const delayMatch = content.match(/(\d+)\s*min\s*Late/i);
      if (delayMatch) {
        delayMins = parseInt(delayMatch[1], 10) || 0;
      }

      // Split into Arrival and Departure sections
      let arrPart = '';
      let depPart = '';
      const arrIdx = content.indexOf('ARRIVAL');
      const depIdx = content.indexOf('DEPARTURE');

      if (arrIdx !== -1 && depIdx !== -1) {
        arrPart = content.slice(arrIdx, depIdx);
        depPart = content.slice(depIdx);
      } else if (arrIdx !== -1) {
        arrPart = content.slice(arrIdx);
      } else if (depIdx !== -1) {
        depPart = content.slice(depIdx);
      } else {
        arrPart = content;
      }

      const time12Regex = /\b([01]?\d:[0-5]\d\s*(?:AM|PM))\b/gi;
      const arrTimes = (arrPart.match(time12Regex) || []).map(t => convert12to24(t));
      const depTimes = (depPart.match(time12Regex) || []).map(t => convert12to24(t));

      // In WhereIsMyTrain:
      // When delayed: first time is actual, second time is scheduled
      // When on time: only one time is present (actual = scheduled)
      let actArr = arrTimes[0] || '---';
      let schedArr = arrTimes[1] || arrTimes[0] || '---';

      let actDep = depTimes[0] || '---';
      let schedDep = depTimes[1] || depTimes[0] || '---';

      // Don't overwrite previously found valid station timings with empty duplicate cards
      if (result[stnCode] && (result[stnCode].act_arr !== '---' || result[stnCode].act_dep !== '---') && (actArr === '---' && actDep === '---')) {
        continue;
      }

      result[stnCode] = {
        station_code: stnCode,
        sched_arr: schedArr,
        sched_dep: schedDep,
        act_arr: actArr,
        act_dep: actDep,
        delay_arr_mins: delayMins,
        delay_dep_mins: delayMins,
        source: 'WhereIsMyTrain'
      };
    }
  } catch (err) {
    // Graceful fallback
  }

  return result;
}

/**
 * Source 2: RailYatri Live Train Status (https://www.railyatri.in/live-train-status/...)
 */
async function fetchRailYatri(trainNo) {
  const result = {};
  if (!trainNo) return result;

  try {
    const res = await fetchHttp(`https://www.railyatri.in/live-train-status/${trainNo}`, 4000);
    if (res.status !== 200 || !res.data) return result;

    const match = res.data.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return result;

    const json = JSON.parse(match[1]);
    const pageProps = json.props?.pageProps;
    if (!pageProps) return result;

    const route = pageProps.timeTableData?.[0]?.route || pageProps.timeTableData || [];
    const lts = pageProps.ltsData || {};

    let currentDelayMins = 0;
    if (lts.delay_mins) currentDelayMins = parseInt(lts.delay_mins, 10) || 0;

    for (const item of route) {
      const stnCode = (item.station_code || '').trim().toUpperCase();
      if (!stnCode) continue;

      const sta = item.sta_min !== undefined && item.sta_min !== null ? item.sta_min : item.sta;
      const std = item.std_min !== undefined && item.std_min !== null ? item.std_min : item.std;

      // sta === 0 means origin station, std === 0 means destination station
      const isOrigin = !sta || sta === 0;
      const isDest = !std || std === 0;

      let schedArr = isOrigin ? '---' : formatMinutesToTime(sta);
      let schedDep = isDest ? '---' : formatMinutesToTime(std);

      let delayMins = item.delay !== undefined && item.delay !== null ? parseInt(item.delay, 10) : currentDelayMins;
      if (isNaN(delayMins)) delayMins = 0;

      let actArr = schedArr;
      let actDep = schedDep;

      if (delayMins > 0) {
        if (!isOrigin && sta !== undefined && sta !== null) {
          actArr = formatMinutesToTime(sta + delayMins);
        }
        if (!isDest && std !== undefined && std !== null) {
          actDep = formatMinutesToTime(std + delayMins);
        }
      }

      result[stnCode] = {
        station_code: stnCode,
        sched_arr: schedArr,
        sched_dep: schedDep,
        act_arr: actArr,
        act_dep: actDep,
        delay_arr_mins: delayMins,
        delay_dep_mins: delayMins,
        source: 'RailYatri'
      };
    }
  } catch (err) {
    // Graceful fallback
  }

  return result;
}

/**
 * Multi-Source Consensus & Fallback Engine
 * Queries WhereIsMyTrain, RailYatri, and NTES in parallel
 */
async function fetchMultiSourceTrainTimings(trainNo, dateIso, dbHelper, forceRefresh = false) {
  const timingMap = {};

  // 1. Check local SQLite cache first (Instant < 5ms) ONLY IF not forcing refresh
  if (!forceRefresh && dbHelper && dbHelper.all) {
    try {
      const cached = await dbHelper.all(
        'SELECT * FROM actual_train_runs WHERE train_no = ? AND run_date = ?',
        [trainNo, dateIso]
      );
      // Only accept cache if at least one station has real non-placeholder timing data
      const hasValidData = Array.isArray(cached) && cached.some(row =>
        (row.sched_arr && row.sched_arr !== '---') ||
        (row.sched_dep && row.sched_dep !== '---') ||
        (row.act_arr && row.act_arr !== '---') ||
        (row.act_dep && row.act_dep !== '---')
      );

      if (hasValidData) {
        cached.forEach(row => {
          timingMap[row.station_code] = {
            station_code: row.station_code,
            sched_arr: row.sched_arr || '---',
            sched_dep: row.sched_dep || '---',
            act_arr: row.act_arr || '---',
            act_dep: row.act_dep || '---',
            delay_arr_mins: row.delay_arr_mins || 0,
            delay_dep_mins: row.delay_dep_mins || 0,
            source: row.source || 'CACHE'
          };
        });
        return timingMap;
      }
    } catch (e) {}
  }

  // 2. Fetch all 3 sources in parallel with Promise.allSettled
  const [wimtRes, ryRes, ntesRes] = await Promise.allSettled([
    fetchWhereIsMyTrain(trainNo),
    fetchRailYatri(trainNo),
    fetchTrainRunningFromNtes(trainNo, dateIso, dbHelper)
  ]);

  const wimtData = wimtRes.status === 'fulfilled' ? (wimtRes.value || {}) : {};
  const ryData = ryRes.status === 'fulfilled' ? (ryRes.value || {}) : {};
  const ntesData = ntesRes.status === 'fulfilled' ? (ntesRes.value || {}) : {};

  // 3. Reconcile with consensus priority:
  // - Schedule: RailYatri (Official TimeTable) -> WhereIsMyTrain -> NTES
  // - Actual/Live: WhereIsMyTrain (Live GPS / Delay) -> RailYatri -> NTES
  const allStnCodes = new Set([
    ...Object.keys(wimtData),
    ...Object.keys(ryData),
    ...Object.keys(ntesData)
  ]);

  for (const stn of allStnCodes) {
    const wimt = wimtData[stn];
    const ry = ryData[stn];
    const ntes = ntesData[stn];

    // Priority for schedule: RailYatri -> WhereIsMyTrain -> NTES
    let schedArr = '---';
    if (ry?.sched_arr && ry.sched_arr !== '---') schedArr = ry.sched_arr;
    else if (wimt?.sched_arr && wimt.sched_arr !== '---') schedArr = wimt.sched_arr;
    else if (ntes?.sched_arr && ntes.sched_arr !== '---') schedArr = ntes.sched_arr;

    let schedDep = '---';
    if (ry?.sched_dep && ry.sched_dep !== '---') schedDep = ry.sched_dep;
    else if (wimt?.sched_dep && wimt.sched_dep !== '---') schedDep = wimt.sched_dep;
    else if (ntes?.sched_dep && ntes.sched_dep !== '---') schedDep = ntes.sched_dep;

    // Priority for actual: WhereIsMyTrain -> RailYatri -> NTES
    let actArr = schedArr;
    let actDep = schedDep;
    let delayArr = 0;
    let delayDep = 0;
    let source = 'NTES';

    if (wimt?.act_arr && wimt.act_arr !== '---') {
      actArr = wimt.act_arr;
      delayArr = wimt.delay_arr_mins || 0;
      source = 'WhereIsMyTrain';
    } else if (ry?.act_arr && ry.act_arr !== '---') {
      actArr = ry.act_arr;
      delayArr = ry.delay_arr_mins || 0;
      source = 'RailYatri';
    } else if (ntes?.act_arr && ntes.act_arr !== '---') {
      actArr = ntes.act_arr;
      delayArr = ntes.delay_arr_mins || 0;
      source = 'NTES (Official)';
    }

    if (wimt?.act_dep && wimt.act_dep !== '---') {
      actDep = wimt.act_dep;
      delayDep = wimt.delay_dep_mins || 0;
      source = 'WhereIsMyTrain';
    } else if (ry?.act_dep && ry.act_dep !== '---') {
      actDep = ry.act_dep;
      delayDep = ry.delay_dep_mins || 0;
      if (source !== 'WhereIsMyTrain') source = 'RailYatri';
    } else if (ntes?.act_dep && ntes.act_dep !== '---') {
      actDep = ntes.act_dep;
      delayDep = ntes.delay_dep_mins || 0;
      if (source !== 'WhereIsMyTrain' && source !== 'RailYatri') source = 'NTES (Official)';
    }

    timingMap[stn] = {
      station_code: stn,
      sched_arr: schedArr,
      sched_dep: schedDep,
      act_arr: actArr,
      act_dep: actDep,
      delay_arr_mins: delayArr,
      delay_dep_mins: delayDep,
      source
    };

    // Save to SQLite actual_train_runs for caching ONLY IF non-placeholder timings exist
    if (dbHelper && dbHelper.run && (actArr !== '---' || actDep !== '---' || schedArr !== '---' || schedDep !== '---')) {
      try {
        dbHelper.run(
          `INSERT OR REPLACE INTO actual_train_runs 
           (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [trainNo, dateIso, stn, schedArr, schedDep, actArr, actDep, delayArr, delayDep, source]
        ).catch(() => {});
      } catch (e) {}
    }
  }

  return timingMap;
}

/**
 * Helper to wrap any promise with a hard timeout guarantee
 */
function withTimeout(promise, ms = 3500, fallback = {}) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

/**
 * Synchronize Journey Legs across WhereIsMyTrain, RailYatri, and NTES
 */
async function syncJourneyLegsMultiSource(journeyLegs, dbHelper, forceRefresh = true) {
  if (!Array.isArray(journeyLegs) || journeyLegs.length === 0) {
    return [];
  }

  // 1. Extract distinct train numbers (typically 4-8 unique trains for an entire month)
  const distinctTrainNos = [...new Set(
    journeyLegs.map(l => l.train_no).filter(t => t && t !== 'REST' && t !== 'OFF')
  )];

  // 2. Fetch live data for each distinct train number in parallel with strict timeout
  const trainLiveMap = new Map();
  await Promise.all(
    distinctTrainNos.map(async (trainNo) => {
      try {
        const [wimt, ry] = await Promise.all([
          withTimeout(fetchWhereIsMyTrain(trainNo), 3500, {}),
          withTimeout(fetchRailYatri(trainNo), 3500, {})
        ]);
        trainLiveMap.set(trainNo, { wimt: wimt || {}, ry: ry || {} });
      } catch (err) {
        trainLiveMap.set(trainNo, { wimt: {}, ry: {} });
      }
    })
  );

  // 3. Map actual timings back to journey legs and persist cache
  const updatedLegs = journeyLegs.map(leg => {
    const { train_no, from_station, to_station } = leg;
    const dateIso = resolveDateIso(leg);

    if (!train_no || train_no === 'REST' || train_no === 'OFF') {
      return leg;
    }

    const schedDep = leg.sched_dep || leg.dep_time || '---';
    const schedArr = leg.sched_arr || leg.arr_time || '---';

    const liveData = trainLiveMap.get(train_no) || { wimt: {}, ry: {} };
    const wimt = liveData.wimt || {};
    const ry = liveData.ry || {};

    const fromWimt = (from_station && from_station !== '---') ? wimt[from_station] : null;
    const fromRy = (from_station && from_station !== '---') ? ry[from_station] : null;
    const toWimt = (to_station && to_station !== '---') ? wimt[to_station] : null;
    const toRy = (to_station && to_station !== '---') ? ry[to_station] : null;

    let actualDep = leg.act_dep || schedDep;
    let actualArr = leg.act_arr || schedArr;
    let delayMins = 0;
    let sourceUsed = '3-Source Engine';

    // Adjust departure timing
    if (fromWimt && fromWimt.act_dep && fromWimt.act_dep !== '---') {
      actualDep = fromWimt.act_dep;
      sourceUsed = 'WhereIsMyTrain';
      if (fromWimt.delay_dep_mins) delayMins = Math.max(delayMins, fromWimt.delay_dep_mins);
    } else if (fromRy && fromRy.act_dep && fromRy.act_dep !== '---') {
      actualDep = fromRy.act_dep;
      sourceUsed = 'RailYatri';
      if (fromRy.delay_dep_mins) delayMins = Math.max(delayMins, fromRy.delay_dep_mins);
    } else if (fromWimt && fromWimt.delay_dep_mins && schedDep && schedDep !== '---') {
      const schedMins = parseTimeToMinutes(schedDep);
      if (schedMins !== null) {
        actualDep = formatMinutesToTime(schedMins + fromWimt.delay_dep_mins);
        delayMins = Math.max(delayMins, fromWimt.delay_dep_mins);
        sourceUsed = 'WhereIsMyTrain';
      }
    }

    // Adjust arrival timing
    if (toWimt && toWimt.act_arr && toWimt.act_arr !== '---') {
      actualArr = toWimt.act_arr;
      sourceUsed = toWimt.source || 'WhereIsMyTrain';
      if (toWimt.delay_arr_mins) delayMins = Math.max(delayMins, toWimt.delay_arr_mins);
    } else if (toRy && toRy.act_arr && toRy.act_arr !== '---') {
      actualArr = toRy.act_arr;
      if (sourceUsed === '3-Source Engine') sourceUsed = 'RailYatri';
      if (toRy.delay_arr_mins) delayMins = Math.max(delayMins, toRy.delay_arr_mins);
    } else if (toWimt && toWimt.delay_arr_mins && schedArr && schedArr !== '---') {
      const schedMins = parseTimeToMinutes(schedArr);
      if (schedMins !== null) {
        actualArr = formatMinutesToTime(schedMins + toWimt.delay_arr_mins);
        delayMins = Math.max(delayMins, toWimt.delay_arr_mins);
      }
    }

    // Save actual timings to DB cache if DB helper available
    if (dbHelper && dbHelper.run && dateIso) {
      if (from_station && from_station !== '---' && (actualDep !== '---' || schedDep !== '---')) {
        dbHelper.run(
          `INSERT OR REPLACE INTO actual_train_runs 
           (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [train_no, dateIso, from_station, '---', schedDep, '---', actualDep, 0, delayMins, sourceUsed]
        ).catch(() => {});
      }
      if (to_station && to_station !== '---' && (actualArr !== '---' || schedArr !== '---')) {
        dbHelper.run(
          `INSERT OR REPLACE INTO actual_train_runs 
           (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [train_no, dateIso, to_station, schedArr, '---', actualArr, '---', delayMins, 0, sourceUsed]
        ).catch(() => {});
      }
    }

    return {
      ...leg,
      sched_dep: schedDep,
      sched_arr: schedArr,
      act_dep: actualDep,
      act_arr: actualArr,
      dep_time: actualDep,
      arr_time: actualArr,
      delay_mins: delayMins,
      is_synced: true,
      live_source: sourceUsed
    };
  });

  return updatedLegs;
}

module.exports = {
  fetchWhereIsMyTrain,
  fetchRailYatri,
  fetchMultiSourceTrainTimings,
  syncJourneyLegsMultiSource,
  resolveDateIso
};
