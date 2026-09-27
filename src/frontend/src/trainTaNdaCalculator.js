/**
 * Railway Duty Roster Manager - Train Movement TA & NDA Calculator Utility
 * 
 * Provides official Railway baseline rates, timings, and cumulative link formulas:
 * - TA Calculator: 100% (Full Day), 70% (>6h Outstation), 30% (<=6h Short Run), 0% (Connecting / Local)
 * - NDA Calculator: Night Window 22:00 to 06:00 IST (1 hr = 1 NDA point)
 * - Cumulative Total for Entire Train Link: Aggregates all legs/movements for each Seniority Link
 */

export const DEFAULT_DA_RATE = 800; // Level 6-8 default (CTI / TTI)
export const DEFAULT_NDA_HOURLY_RATE = 168; // Standard Railway NDA hourly rate

/**
 * Standard Railway Baseline TA % and NDA hours for every train in each category & seniority link
 */
export function getDefaultTaNdaForTrain(categoryId, linkNumber, trainNumber) {
  const cId = parseInt(categoryId, 10);
  const lNum = parseInt(linkNumber, 10);
  const tNum = String(trainNumber || '').trim();

  // Category 1: Conductors (COR) - 21-Day Seniority Cycle
  if (cId === 1) {
    if (lNum === 1) {
      if (tNum === '17281') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '17225') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Outstation Night Run (70% TA)' };
    }
    if (lNum === 2) {
      if (tNum === '17225') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival GTL' };
      if (tNum === '17226') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 3) {
      if (tNum === '17226') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival BZA' };
      if (tNum === '57210') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Return Arrival to HQ (70% TA)' };
    }
    if (lNum === 4 && tNum === '17261') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-TPTY (70% TA)' };
    if (lNum === 5) {
      if (tNum === '17261') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 6 && tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
    if (lNum === 8 && tNum === '20629') return { ta_pct: 0.3, nda_hrs: 4.0, desc: 'Evening Dep <=6h to Midnight (30% TA)' };
    if (lNum === 9) {
      if (tNum === '20629') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 10) {
      if (tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
      if (tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep <=6h to Midnight (30% TA)' };
    }
    if (lNum === 11) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '20630') return { ta_pct: 1.0, nda_hrs: 7.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 12) {
      if (tNum === '20630') return { ta_pct: 0.3, nda_hrs: 0, desc: 'Morning Return to HQ (30% TA)' };
      if (tNum === '12604') return { ta_pct: 0.3, nda_hrs: 8.0, desc: 'Night Run GNT-MAS (30% TA)' };
    }
    if (lNum === 13) {
      if (tNum === '12604') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival MAS' };
      if (tNum === '12603') return { ta_pct: 1.0, nda_hrs: 2.0, desc: 'Outstation Return to HQ (100% TA)' };
    }
    if (lNum === 15) {
      if (tNum === '67230') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '18047') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run BZA-GTL (70% TA)' };
    }
    if (lNum === 16) {
      if (tNum === '18047') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival GTL' };
      if (tNum === '17226') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 17) {
      if (tNum === '17226') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival BZA' };
      if (tNum === '57201') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Return Arrival to HQ (70% TA)' };
    }
    if (lNum === 18 && tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep <=6h (30% TA)' };
    if (lNum === 19) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 20 && tNum === '17262') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Return Arrival to HQ (70% TA)' };
  }

  // Category 2: TTI / Sleeper Staff - 63-Day Seniority Cycle
  if (cId === 2) {
    if ([1, 15, 29].includes(lNum) && tNum === '17253') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Run GNT-DHNE (70% TA)' };
    if ([2, 16, 30].includes(lNum) && tNum === '17252') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Return Run DHNE-GNT (70% TA)' };
    if ([3].includes(lNum) && tNum === '12604') return { ta_pct: 0.3, nda_hrs: 8.0, desc: 'Night Dep GNT-MAS (30% TA)' };
    if ([4, 46].includes(lNum)) {
      if (tNum === '12604') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival MAS' };
      if (tNum === '12603') return { ta_pct: 1.0, nda_hrs: 2.0, desc: 'Outstation Return to HQ (100% TA)' };
    }
    if ([5, 47].includes(lNum) && tNum === '17251') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Night Run GNT-DHNE (70% TA)' };
    if ([6].includes(lNum)) {
      if (tNum === '17251') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival DHNE' };
      if (tNum === '17252') return { ta_pct: 1.0, nda_hrs: 1.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([8, 22].includes(lNum) && tNum === '17215') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep GNT-DMM (30% TA)' };
    if ([9, 23].includes(lNum)) {
      if (tNum === '17215') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival DMM' };
      if (tNum === '17216') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([10, 24].includes(lNum) && tNum === '17216') return { ta_pct: 0.3, nda_hrs: 0, desc: 'Morning Return to HQ (30% TA)' };
    if ([11, 25, 39, 53].includes(lNum)) {
      if (tNum === '12747') return { ta_pct: 0, nda_hrs: 0, desc: 'Day Run GNT-VKB (Outbound)' };
      if (tNum === '12748') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return VKB-GNT (70% TA)' };
    }
    if ([12, 26].includes(lNum)) {
      if (tNum === '17201') return { ta_pct: 0, nda_hrs: 0, desc: 'Day Run GNT-KZJ (Outbound)' };
      if (tNum === '17202') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return KZJ-GNT (70% TA)' };
    }
    if ([13, 27].includes(lNum) && tNum === '17255') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-KCG (70% TA)' };
    if ([17, 31].includes(lNum) && tNum === '17228') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Run GNT-DHNE (70% TA)' };
    if ([18, 32].includes(lNum) && tNum === '17227') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return DHNE-GNT (70% TA)' };
    if ([19, 33].includes(lNum) && tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep GNT-TPTY (30% TA)' };
    if ([20, 34].includes(lNum)) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([36, 50].includes(lNum)) {
      if (tNum === '17645') return { ta_pct: 0, nda_hrs: 0, desc: 'Short Run GNT-RAL' };
      if (tNum === '17626') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Run RAL-KCG (30% TA)' };
    }
    if ([37, 51].includes(lNum)) {
      if (tNum === '17626') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival KCG' };
      if (tNum === '17625') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([38, 52].includes(lNum)) {
      if (tNum === '17625') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival RAL' };
      if (tNum === '17646') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Morning Return RAL-GNT (100% TA)' };
    }
    if ([40, 54].includes(lNum) && tNum === '17243') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Run GNT-VSKP (30% TA)' };
    if ([41, 55].includes(lNum)) {
      if (tNum === '17243') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival VSKP' };
      if (tNum === '17244') return { ta_pct: 1.0, nda_hrs: 7.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([43].includes(lNum) && tNum === '20629') return { ta_pct: 0.3, nda_hrs: 4.0, desc: 'Night Dep GNT-TPTY (30% TA)' };
    if ([44].includes(lNum)) {
      if (tNum === '20629') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([45].includes(lNum)) {
      if (tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
      if (tNum === '17281') return { ta_pct: 0.3, nda_hrs: 6.0, desc: 'Night Run GNT-NS (30% TA)' };
    }
    if ([48].includes(lNum) && tNum === '17646') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Morning Return to GNT (100% TA)' };
    if ([57].includes(lNum)) {
      if (tNum === '67230') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '18047') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run BZA-GTL (70% TA)' };
    }
    if ([58].includes(lNum)) {
      if (tNum === '18047') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival GTL' };
      if (tNum === '18048') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([59].includes(lNum)) {
      if (tNum === '18048') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival BZA' };
      if (tNum === '12703') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Connecting Return to GNT (100% TA)' };
    }
  }

  // Category 3: Ladies Staff / TTE
  if (cId === 3) {
    if ([1, 4].includes(lNum) && tNum === '17261') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-TPTY (70% TA)' };
    if ([2, 5].includes(lNum) && tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    if ([3, 6].includes(lNum) && tNum === '17262') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Morning Return to GNT (70% TA)' };
  }

  // Category 4: Leave Reserve (LR) Staff
  if (cId === 4) {
    if (tNum === '17281') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA' };
    if (tNum === '17225') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Outstation Night Run (70% TA)' };
  }

  // Generic fallback default
  return { ta_pct: 0.7, nda_hrs: 0, desc: 'Standard Duty Leg (70% TA)' };
}

/**
 * Calculates cumulative TA and NDA totals for every Seniority Link (Pure TA units and NDA hours, no money/currency)
 */
export function calculateLinkCumulativeTotals(trainRosterItems, trainTaNdaRules = {}) {
  const linkTotals = {};
  let grandTotalTaUnits = 0;
  let grandTotalNda = 0;

  trainRosterItems.forEach(item => {
    const linkKey = `${item.categoryId}_${item.linkNumber}`;
    if (!linkTotals[linkKey]) {
      linkTotals[linkKey] = {
        categoryId: item.categoryId,
        linkNumber: item.linkNumber,
        categoryName: item.categoryName,
        totalTaUnits: 0,
        totalNdaHours: 0,
        trainCount: 0,
        trains: []
      };
    }

    const ruleKey = `${item.categoryId}_${item.linkNumber}_${item.trainNumber}`;
    const custom = trainTaNdaRules[ruleKey] || {};
    const defaultData = getDefaultTaNdaForTrain(item.categoryId, item.linkNumber, item.trainNumber);

    const effTaPct = custom.ta_percentage !== undefined ? parseFloat(custom.ta_percentage) : defaultData.ta_pct;
    const effNdaHrs = custom.nda_hours !== undefined ? parseFloat(custom.nda_hours) : defaultData.nda_hrs;

    linkTotals[linkKey].totalTaUnits = Math.round((linkTotals[linkKey].totalTaUnits + effTaPct) * 100) / 100;
    linkTotals[linkKey].totalNdaHours = Math.round((linkTotals[linkKey].totalNdaHours + effNdaHrs) * 10) / 10;
    linkTotals[linkKey].trainCount += 1;
    linkTotals[linkKey].trains.push(item.trainNumber);

    grandTotalTaUnits += effTaPct;
    grandTotalNda += effNdaHrs;
  });

  return {
    linkTotals,
    grandTotalTaUnits: Math.round(grandTotalTaUnits * 100) / 100,
    grandTotalNda: Math.round(grandTotalNda * 10) / 10
  };
}

/**
 * Export TA & NDA Master Rates to CSV file (TA Units & NDA Hours)
 */
export function exportTaNdaMasterCsv(trainRosterItems, trainTaNdaRules = {}) {
  const { linkTotals } = calculateLinkCumulativeTotals(trainRosterItems, trainTaNdaRules);

  const headers = [
    'Train Number',
    'Category',
    'Seniority Link',
    'Route',
    'Coaches',
    'TA Claim (1 / 0.7 / 0.3 / 0)',
    'Cumulative Link TA Total',
    'NDA Hours (22:00-06:00)',
    'Cumulative Link NDA Hours',
    'Remarks / Rule'
  ];

  const rows = trainRosterItems.map(item => {
    const linkKey = `${item.categoryId}_${item.linkNumber}`;
    const linkTotal = linkTotals[linkKey] || {};
    const ruleKey = `${item.categoryId}_${item.linkNumber}_${item.trainNumber}`;
    const custom = trainTaNdaRules[ruleKey] || {};
    const defaultData = getDefaultTaNdaForTrain(item.categoryId, item.linkNumber, item.trainNumber);

    const effTaPct = custom.ta_percentage !== undefined ? parseFloat(custom.ta_percentage) : defaultData.ta_pct;
    const effNdaHrs = custom.nda_hours !== undefined ? parseFloat(custom.nda_hours) : defaultData.nda_hrs;

    return [
      item.trainNumber,
      `"${item.categoryName}"`,
      `"Link #${item.linkNumber}"`,
      `"${item.from_station || ''} to ${item.to_station || ''}"`,
      `"${item.coaches || ''}"`,
      effTaPct,
      linkTotal.totalTaUnits || 0,
      effNdaHrs,
      linkTotal.totalNdaHours || 0,
      `"${custom.remarks || defaultData.desc || ''}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Daily_Trains_TA_NDA_Master_Chart_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
