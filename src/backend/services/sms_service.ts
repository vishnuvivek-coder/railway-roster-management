import { all, get, run } from '../db';
const twilio = require('twilio');
const { fetchMultiSourceTrainTimings } = require('./multi_source_tracker');
import {
  isAndroidGatewayConfigured,
  getAndroidGatewayConfigStatus,
  dispatchAndroidSimSms,
  getAndroidGatewayDevices
} from './android_sms_gateway.service';

/**
 * Check whether live Twilio credentials are configured in environment variables.
 * Supports standard Account SID + Auth Token OR Account SID + API Key (SK...) + Secret.
 */
export function isTwilioConfigured(): boolean {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const apiKey = (process.env.TWILIO_API_KEY || '').trim();
  const apiSecret = (process.env.TWILIO_API_SECRET || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const phone = (process.env.TWILIO_PHONE_NUMBER || '').trim();

  const hasValidAuth = (apiKey.startsWith('SK') && apiSecret.length >= 10 && accountSid.startsWith('AC')) ||
                       (accountSid.startsWith('AC') && authToken.length >= 10);

  return Boolean(hasValidAuth && phone && phone.length >= 10);
}

/**
 * Creates an authorized Twilio SDK client using either standard Auth Token or API Key.
 */
export function getTwilioClient(): any {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const apiKey = (process.env.TWILIO_API_KEY || '').trim();
  const apiSecret = (process.env.TWILIO_API_SECRET || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (apiKey.startsWith('SK') && apiSecret && accountSid.startsWith('AC')) {
    return twilio(apiKey, apiSecret, { accountSid });
  }
  if (accountSid.startsWith('AC') && authToken) {
    return twilio(accountSid, authToken);
  }
  return null;
}

/**
 * Retrieve current Twilio configuration status for UI display.
 */
export function getTwilioConfigStatus() {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const phone = (process.env.TWILIO_PHONE_NUMBER || '').trim();
  const configured = isTwilioConfigured();

  return {
    success: true,
    configured,
    connected: configured,
    mode: configured ? 'LIVE_TWILIO' : 'SIMULATION_MODE',
    provider: 'Twilio Cloud SMS API',
    accountSidMasked: sid.length > 8 ? `${sid.substring(0, 4)}...${sid.substring(sid.length - 4)}` : null,
    twilioPhoneNumber: phone || null,
    description: configured
      ? `Twilio Cloud SMS is active and connected. Real SMS alerts will be sent to staff from ${phone}.`
      : 'Simulation mode active. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to Railway environment variables to send live SMS.'
  };
}

export {
  isAndroidGatewayConfigured,
  getAndroidGatewayConfigStatus,
  dispatchAndroidSimSms,
  getAndroidGatewayDevices
};

// Standard GNT Division Train Timetables & Schedules (fallback when NTES live status is off-peak)
const STANDARD_TRAIN_SCHEDULES: Record<string, { name: string; route: string; schedDep: string; from: string; to: string }> = {
  '12604': { name: 'Chennai Express', route: 'GNT -> MAS', schedDep: '21:10', from: 'GNT', to: 'MAS' },
  '12603': { name: 'Hyderabad Express', route: 'MAS -> GNT', schedDep: '16:45', from: 'MAS', to: 'GNT' },
  '12734': { name: 'Narayanadri Express', route: 'LPI -> TPTY', schedDep: '23:05', from: 'GNT', to: 'TPTY' },
  '12733': { name: 'Narayanadri Express', route: 'TPTY -> LPI', schedDep: '18:25', from: 'TPTY', to: 'GNT' },
  '17281': { name: 'Narsapur Express', route: 'GNT -> NS', schedDep: '07:15', from: 'GNT', to: 'NS' },
  '17282': { name: 'Guntur Express', route: 'NS -> GNT', schedDep: '06:05', from: 'NS', to: 'GNT' },
  '17261': { name: 'Tirupati Express', route: 'GNT -> TPTY', schedDep: '16:30', from: 'GNT', to: 'TPTY' },
  '17262': { name: 'Guntur Express', route: 'TPTY -> GNT', schedDep: '19:35', from: 'TPTY', to: 'GNT' },
  '17253': { name: 'Guntur - Secunderabad', route: 'GNT -> SC', schedDep: '06:15', from: 'GNT', to: 'SC' },
  '17254': { name: 'Secunderabad - Guntur', route: 'SC -> GNT', schedDep: '15:10', from: 'SC', to: 'GNT' },
  '17646': { name: 'Nanded Express', route: 'GNT -> NED', schedDep: '07:00', from: 'GNT', to: 'NED' },
  '17645': { name: 'Guntur Express', route: 'NED -> GNT', schedDep: '15:40', from: 'NED', to: 'GNT' },
  '12805': { name: 'Janmabhoomi Express', route: 'GNT -> VSKP', schedDep: '06:30', from: 'GNT', to: 'VSKP' },
  '12806': { name: 'Janmabhoomi Express', route: 'VSKP -> GNT', schedDep: '06:20', from: 'VSKP', to: 'GNT' },
  '12705': { name: 'Guntur - Secunderabad Intercity', route: 'GNT -> SC', schedDep: '15:30', from: 'GNT', to: 'SC' },
  '12706': { name: 'Secunderabad - Guntur Intercity', route: 'SC -> GNT', schedDep: '07:45', from: 'SC', to: 'GNT' },
  '17201': { name: 'Golconda Express', route: 'GNT -> KZJ', schedDep: '06:00', from: 'GNT', to: 'KZJ' },
  '17202': { name: 'Golconda Express', route: 'KZJ -> GNT', schedDep: '12:45', from: 'KZJ', to: 'GNT' },
  '17243': { name: 'Rayagada Express', route: 'GNT -> RGDA', schedDep: '23:20', from: 'GNT', to: 'RGDA' },
  '17244': { name: 'Rayagada Express (Return)', route: 'RGDA -> GNT', schedDep: '15:30', from: 'RGDA', to: 'GNT' },
  '07193': { name: 'HYB-QLN Special', route: 'GNT -> PER', schedDep: '01:50', from: 'GNT', to: 'PER' },
  '07194': { name: 'QLN-HYB Special', route: 'PER -> GNT', schedDep: '22:15', from: 'PER', to: 'GNT' },
  '07180': { name: 'CHZ-QLN Special', route: 'GNT -> PER', schedDep: '01:50', from: 'GNT', to: 'PER' },
  '07181': { name: 'QLN-CHZ Special', route: 'PER -> GNT', schedDep: '22:15', from: 'PER', to: 'GNT' },
  '07195': { name: 'CHZ-QLN Special', route: 'GNT -> PER', schedDep: '01:50', from: 'GNT', to: 'PER' },
  '07196': { name: 'QLN-CHZ Special', route: 'PER -> GNT', schedDep: '22:15', from: 'PER', to: 'GNT' },
  '07197': { name: 'CHZ-QLN Special', route: 'GNT -> PER', schedDep: '01:50', from: 'GNT', to: 'PER' },
  '07198': { name: 'QLN-CHZ Special', route: 'PER -> GNT', schedDep: '22:15', from: 'PER', to: 'GNT' },
  '07189': { name: 'NED-QLN Special', route: 'GNT -> PER', schedDep: '01:50', from: 'GNT', to: 'PER' },
  '07190': { name: 'QLN-CHZ Special', route: 'PER -> GNT', schedDep: '22:15', from: 'PER', to: 'GNT' }
};

export interface SmsRecipientPreview {
  staffId: number;
  staffName: string;
  designation: string;
  phoneNumber: string | null;
  rawPhone: string | null;
  phoneValid: boolean;
  trainNo: string;
  trainName?: string;
  fromStation: string;
  toStation: string;
  depTime: string;
  timingSource: string;
  coaches: string;
  linkNumber: number | null;
  hasChanges: boolean;
  changeTag: string;
  changeDetails: string;
  messageBody: string;
  alreadySent?: boolean;
}

export interface SmsSendResult {
  totalEligible: number;
  sentCount: number;
  simulatedCount: number;
  failedCount: number;
  skippedCount: number;
  isSimulatedMode: boolean;
  records: any[];
}

/**
 * Gateway configuration aliases
 */
export const isSmsConfigured = isAndroidGatewayConfigured;
export const getSmsConfigStatus = getAndroidGatewayConfigStatus;

/**
 * Formats Indian phone numbers to E.164 international standard (+91XXXXXXXXXX)
 */
export function formatPhoneNumber(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  let digits = String(rawPhone).trim().replace(/\D/g, '');

  if (!digits) return null;

  // If 10 digits (Standard Indian Mobile / CUG) -> prepend +91
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // If 12 digits starting with 91 -> prepend +
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // If starts with 0 and followed by 10 digits -> strip 0 and prepend +91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.substring(1)}`;
  }

  // Generic valid E.164 (+ followed by 10-15 digits)
  if (String(rawPhone).trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Clean and extract primary train number for NTES queries.
 */
function extractPrimaryTrainNo(trainStr: string | null | undefined): string {
  if (!trainStr) return '';
  const match = String(trainStr).match(/\b(\d{4,5})\b/);
  return match ? match[1] : String(trainStr).trim();
}

const timingCache = new Map<string, { data: { depTime: string; timingSource: string; trainName: string; from: string; to: string }; timestamp: number }>();

/**
 * Resolves train departure timing from NTES (with fallback to official timetables)
 */
export async function resolveTrainDepartureTiming(
  trainNo: string,
  dateIso: string,
  originStation = 'GNT'
): Promise<{ depTime: string; timingSource: string; trainName: string; from: string; to: string }> {
  const cleanTrain = extractPrimaryTrainNo(trainNo);
  const cacheKey = `${cleanTrain}_${dateIso}_${originStation}`;
  const cached = timingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.data;
  }

  const standard = STANDARD_TRAIN_SCHEDULES[cleanTrain];

  let trainName = standard?.name || `Train ${cleanTrain}`;
  let fromStation = standard?.from || originStation;
  let toStation = standard?.to || 'OUTSTATION';
  let depTime = standard?.schedDep || '---';
  let timingSource = 'Official Timetable';

  // Attempt NTES Live Query with fast timeout (1500ms)
  try {
    const ntesPromise = fetchMultiSourceTrainTimings(cleanTrain, dateIso, { get, all, run }, false);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('NTES query timeout')), 1500));
    const stationTimings = await Promise.race([ntesPromise, timeoutPromise]) as Record<string, any>;

    if (stationTimings && typeof stationTimings === 'object') {
      // Find matching station (GNT or origin)
      const stnData = stationTimings[originStation] || stationTimings[fromStation] || Object.values(stationTimings)[0];
      if (stnData) {
        if (stnData.act_dep && stnData.act_dep !== '---') {
          depTime = stnData.act_dep;
          timingSource = stnData.source ? `${stnData.source} Live` : 'NTES Live';
        } else if (stnData.sched_dep && stnData.sched_dep !== '---') {
          depTime = stnData.sched_dep;
          timingSource = 'NTES Schedule';
        }
      }
    }
  } catch (err: any) {
    // Graceful fallback to standard timetable
  }

  if (depTime === '---' && standard?.schedDep) {
    depTime = standard.schedDep;
    timingSource = 'Official Timetable';
  }

  if (depTime === '---') {
    depTime = 'As per Lobby Board';
    timingSource = 'Depot Schedule';
  }

  const res = { depTime, timingSource, trainName, from: fromStation, to: toStation };
  timingCache.set(cacheKey, { data: res, timestamp: Date.now() });
  return res;
}

/**
 * Analyzes duty assignment to detect any changes, substitutions, or link modifications.
 */
export function analyzeDutyChanges(duty: any): { hasChanges: boolean; changeTag: string; changeDetails: string } {
  const status = (duty.status || '').toUpperCase();
  const isOverridden = Boolean(duty.isOverridden || duty.overrideReason);
  const origLink = duty.original_link_number;
  const currentLink = duty.link_number;
  const reason = (duty.overrideReason || '').trim();
  const subName = duty.substituteName || '';

  // 1. Substitute duty
  if (status === 'SUBSTITUTE' || subName) {
    return {
      hasChanges: true,
      changeTag: '⚠️ SUBSTITUTE DUTY',
      changeDetails: `Substituted for ${subName || 'Staff'} (Link #${origLink || currentLink || '-'}). ${reason ? 'Reason: ' + reason : ''}`
    };
  }

  // 2. Changed link
  if (status === 'CHANGED_LINK' || (origLink && currentLink && origLink !== currentLink)) {
    return {
      hasChanges: true,
      changeTag: '⚠️ LINK CHANGED',
      changeDetails: `Link altered from #${origLink} to #${currentLink}. ${reason ? 'Reason: ' + reason : ''}`
    };
  }

  // 3. Shifted duty (e.g. into non-daily or other link)
  if (status === 'SHIFTED' || duty.shifted_place) {
    return {
      hasChanges: true,
      changeTag: '⚠️ SHIFTED DUTY',
      changeDetails: `Shifted from Link #${origLink || '-'} to ${duty.shifted_place || duty.train_numbers}. ${reason ? 'Reason: ' + reason : ''}`
    };
  }

  // 4. Utilised in Advance
  if (status === 'UTILISED_ADVANCE' || duty.is_advance_duty) {
    return {
      hasChanges: true,
      changeTag: '⚠️ UTILISED ADVANCE',
      changeDetails: `Utilised in advance on Train ${duty.advance_train_no || duty.train_numbers || '-'}. ${reason ? 'Reason: ' + reason : ''}`
    };
  }

  // 5. Extra crew
  if (status === 'EXTRA_CREW' || duty.is_extra) {
    return {
      hasChanges: true,
      changeTag: '⚠️ EXTRA CREW',
      changeDetails: `Assigned as Extra Crew for Train ${duty.extra_train_no || duty.train_numbers || '-'}. ${reason ? 'Reason: ' + reason : ''}`
    };
  }

  // 6. Generic override
  if (isOverridden && reason) {
    return {
      hasChanges: true,
      changeTag: '⚠️ DUTY MODIFIED',
      changeDetails: `Change: ${reason}`
    };
  }

  // 7. Regular scheduled duty
  return {
    hasChanges: false,
    changeTag: '✅ REGULAR ROSTER',
    changeDetails: `Regular scheduled duty on Link #${currentLink || '-'}`
  };
}

/**
 * Calculates lobby reporting time (30 minutes prior to train departure time).
 */
export function calculateReportingTime(depTime: string): string {
  if (!depTime || depTime === '-' || depTime.toLowerCase().includes('lobby') || depTime.toLowerCase().includes('tbd')) {
    return '30 mins before departure';
  }
  const match = depTime.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    minutes -= 30;
    if (minutes < 0) {
      minutes += 60;
      hours = (hours - 1 + 24) % 24;
    }
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm} hrs`;
  }
  return `${depTime} (Report 30 mins prior)`;
}

/**
 * Builds the official SMS message text satisfying all requirements:
 * 1. Exact required format:
 *    RAILWAY DUTY ALERT
 *
 *    Hello [Employee Name],
 *
 *    Your duty has been assigned for [Date].
 *
 *    Train: [Train Number]
 *    Link: [Employee Link]
 *    Reporting Time: [Time]
 *
 *    Please check your roster.
 * 2. Includes Section (From -> To), Train Name, NTES Departure Timing & Changes if any
 */
export function buildDutySmsMessage(params: {
  employeeName: string;
  dateStr: string;
  trainNo: string;
  trainName?: string;
  fromStation: string;
  toStation: string;
  depTime: string;
  timingSource: string;
  coaches?: string;
  linkNumber?: number | string | null;
  hasChanges: boolean;
  changeTag: string;
  changeDetails: string;
}): string {
  const {
    employeeName,
    dateStr,
    trainNo,
    trainName,
    fromStation,
    toStation,
    depTime,
    timingSource,
    linkNumber,
    hasChanges,
    changeDetails
  } = params;

  let trainDisplay = trainNo;
  if (trainName && !trainName.includes(trainNo)) {
    trainDisplay = `${trainNo} (${trainName})`;
  }
  if (fromStation && toStation && fromStation !== '-' && toStation !== '-') {
    trainDisplay += ` [${fromStation} -> ${toStation}]`;
  }

  const linkDisplay = linkNumber ? `Link #${linkNumber}` : 'Ad-hoc / Special Duty';
  const reportingTime = calculateReportingTime(depTime);
  const depTimeDisplay = depTime && depTime !== '-' ? `${depTime} hrs (${timingSource || 'NTES'})` : 'Refer NTES';

  let msg =
    `RAILWAY DUTY ALERT\n\n` +
    `Hello ${employeeName.toUpperCase()},\n\n` +
    `Your duty has been assigned for ${dateStr}.\n\n` +
    `Train: ${trainDisplay}\n` +
    `Link: ${linkDisplay}\n` +
    `Reporting Time: ${reportingTime} (Dep: ${depTimeDisplay})\n`;

  if (hasChanges && changeDetails) {
    msg += `Notice: ${changeDetails}\n`;
  }

  msg += `\nPlease check your roster.`;

  return msg;
}

/**
 * Dispatches a single SMS notification.
 * Supports Twilio Cloud SMS and Android SIM Gateway.
 * If credentials are not set, falls back to SIMULATION_MODE with database logging.
 * Persists the record to the `sms_notifications` database table.
 */
export async function sendSmsNotification(params: {
  staffId: number;
  staffName: string;
  phoneNumber: string;
  dutyDate: string;
  trainNo: string;
  route: string;
  depTime: string;
  timingSource: string;
  hasChanges: boolean;
  changeDetails: string;
  messageBody: string;
}): Promise<{ success: boolean; status: 'SENT' | 'SIMULATED' | 'FAILED'; sid: string; error?: string }> {
  const {
    staffId,
    staffName,
    phoneNumber,
    dutyDate,
    trainNo,
    route,
    depTime,
    timingSource,
    hasChanges,
    changeDetails,
    messageBody
  } = params;

  // 1. Prioritize Twilio Cloud SMS if credentials are set
  if (isTwilioConfigured()) {
    try {
      const client = getTwilioClient();
      if (!client) {
        throw new Error('Twilio client initialization failed. Please check credentials.');
      }
      const message = await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      await run(
        `INSERT INTO sms_notifications 
         (staff_id, staff_name, phone_number, duty_date, train_no, route, dep_time, timing_source, has_changes, change_details, message_body, status, gateway_sid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?)`,
        [staffId, staffName, phoneNumber, dutyDate, trainNo, route, depTime, timingSource, hasChanges ? 1 : 0, changeDetails, messageBody, message.sid]
      );

      return { success: true, status: 'SENT', sid: message.sid };
    } catch (err: any) {
      console.error(`[Twilio Error] Failed to send SMS to ${phoneNumber}:`, err.message);

      await run(
        `INSERT INTO sms_notifications 
         (staff_id, staff_name, phone_number, duty_date, train_no, route, dep_time, timing_source, has_changes, change_details, message_body, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?)`,
        [staffId, staffName, phoneNumber, dutyDate, trainNo, route, depTime, timingSource, hasChanges ? 1 : 0, changeDetails, messageBody, err.message]
      );

      return { success: false, status: 'FAILED', sid: '', error: err.message };
    }
  }

  // 2. Next, check Android SIM Gateway if configured
  if (isAndroidGatewayConfigured()) {
    const result = await dispatchAndroidSimSms({
      phoneNumber,
      messageText: messageBody,
      staffId,
      staffName
    });

    if (result.success) {
      await run(
        `INSERT INTO sms_notifications 
         (staff_id, staff_name, phone_number, duty_date, train_no, route, dep_time, timing_source, has_changes, change_details, message_body, status, gateway_sid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [staffId, staffName, phoneNumber, dutyDate, trainNo, route, depTime, timingSource, hasChanges ? 1 : 0, changeDetails, messageBody, result.status, result.sid]
      );

      return { success: true, status: result.status, sid: result.sid };
    } else {
      console.error(`[Android SIM Gateway Error] Failed to send SMS to ${phoneNumber}:`, result.error);

      await run(
        `INSERT INTO sms_notifications 
         (staff_id, staff_name, phone_number, duty_date, train_no, route, dep_time, timing_source, has_changes, change_details, message_body, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?)`,
        [staffId, staffName, phoneNumber, dutyDate, trainNo, route, depTime, timingSource, hasChanges ? 1 : 0, changeDetails, messageBody, result.error || 'Failed to dispatch via Android Gateway']
      );

      return { success: false, status: 'FAILED', sid: '', error: result.error };
    }
  }

  // 3. Fallback to SIMULATION MODE
  const simulatedSid = `SM_SIMULATED_${Date.now()}_${staffId || '0'}`;
  await run(
    `INSERT INTO sms_notifications 
     (staff_id, staff_name, phone_number, duty_date, train_no, route, dep_time, timing_source, has_changes, change_details, message_body, status, gateway_sid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SIMULATED', ?)`,
    [staffId, staffName, phoneNumber, dutyDate, trainNo, route, depTime, timingSource, hasChanges ? 1 : 0, changeDetails, messageBody, simulatedSid]
  );

  return { success: true, status: 'SIMULATED', sid: simulatedSid };
}

/**
 * Generates previews of all daily duty SMS notifications for a target date.
 */
export async function generateDailySmsPreview(
  targetDateStr: string,
  staffDutiesList: any[]
): Promise<SmsRecipientPreview[]> {
  const previews: SmsRecipientPreview[] = [];

  // Filter only working staff assigned to trains (exclude REST, LEAVE, SICK, AVAILABLE_FOR_BOOKING)
  const workingDuties = staffDutiesList.filter(d => {
    if (d.isRest) return false;
    const st = (d.status || '').toUpperCase();
    if (['REST', 'LEAVE', 'SICK', 'CR', 'ABSENT', 'AVAILABLE_FOR_BOOKING'].includes(st)) return false;
    if (!d.train_numbers && !d.train_out && !d.extra_train_no && !d.advance_train_no) return false;
    return true;
  });

  // Query already sent SMS for this date to avoid duplicate confusion
  const alreadySentRows = await all(
    'SELECT staff_id, status FROM sms_notifications WHERE duty_date = ? AND status IN (\'SENT\', \'SIMULATED\')',
    [targetDateStr]
  );
  const sentMap = new Set(alreadySentRows.map((r: any) => Number(r.staff_id)));

  for (const duty of workingDuties) {
    const rawPhone = duty.cug_number || duty.contact_number || null;
    const formattedPhone = formatPhoneNumber(rawPhone);
    const primaryTrain = extractPrimaryTrainNo(duty.train_out || duty.train_numbers || duty.extra_train_no || duty.advance_train_no);

    const timing = await resolveTrainDepartureTiming(
      primaryTrain,
      targetDateStr,
      duty.from_station || 'GNT'
    );

    const changeAnalysis = analyzeDutyChanges(duty);

    const messageBody = buildDutySmsMessage({
      employeeName: duty.name,
      dateStr: targetDateStr,
      trainNo: primaryTrain || duty.train_numbers || 'Special Link',
      trainName: timing.trainName,
      fromStation: duty.from_station || timing.from,
      toStation: duty.to_station || timing.to,
      depTime: timing.depTime,
      timingSource: timing.timingSource,
      coaches: duty.coaches || 'SL / AC',
      linkNumber: duty.link_number,
      hasChanges: changeAnalysis.hasChanges,
      changeTag: changeAnalysis.changeTag,
      changeDetails: changeAnalysis.changeDetails
    });

    previews.push({
      staffId: Number(duty.staffId),
      staffName: duty.name,
      designation: duty.designation,
      phoneNumber: formattedPhone,
      rawPhone,
      phoneValid: Boolean(formattedPhone),
      trainNo: primaryTrain || duty.train_numbers || 'Special Link',
      trainName: timing.trainName,
      fromStation: duty.from_station || timing.from,
      toStation: duty.to_station || timing.to,
      depTime: timing.depTime,
      timingSource: timing.timingSource,
      coaches: duty.coaches || 'SL / AC',
      linkNumber: duty.link_number,
      hasChanges: changeAnalysis.hasChanges,
      changeTag: changeAnalysis.changeTag,
      changeDetails: changeAnalysis.changeDetails,
      messageBody,
      alreadySent: sentMap.has(Number(duty.staffId))
    });
  }

  return previews;
}

/**
 * Sends daily SMS messages to working staff for a specific date.
 */
export async function sendDailySmsBatch(
  targetDateStr: string,
  staffDutiesList: any[],
  filterStaffIds?: (number | string)[],
  forceResend = false
): Promise<SmsSendResult> {
  const previews = await generateDailySmsPreview(targetDateStr, staffDutiesList);

  const filterSet = (filterStaffIds && filterStaffIds.length > 0)
    ? new Set(filterStaffIds.map(id => String(id).trim()))
    : null;

  const targets = filterSet
    ? previews.filter(p => filterSet.has(String(p.staffId).trim()))
    : previews;

  let sentCount = 0;
  let simulatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const records = [];

  for (const item of targets) {
    if (!item.phoneValid || !item.phoneNumber) {
      skippedCount++;
      records.push({
        staffId: item.staffId,
        staffName: item.staffName,
        status: 'SKIPPED_NO_PHONE',
        message: 'No valid mobile phone number found in staff profile'
      });
      continue;
    }

    if (item.alreadySent && !forceResend) {
      skippedCount++;
      records.push({
        staffId: item.staffId,
        staffName: item.staffName,
        status: 'SKIPPED_ALREADY_SENT',
        message: 'SMS already dispatched for this date (use force to resend)'
      });
      continue;
    }

    const res = await sendSmsNotification({
      staffId: item.staffId,
      staffName: item.staffName,
      phoneNumber: item.phoneNumber,
      dutyDate: targetDateStr,
      trainNo: item.trainNo,
      route: `${item.fromStation} -> ${item.toStation}`,
      depTime: item.depTime,
      timingSource: item.timingSource,
      hasChanges: item.hasChanges,
      changeDetails: item.changeDetails,
      messageBody: item.messageBody
    });

    if (res.status === 'SENT') {
      sentCount++;
    } else if (res.status === 'SIMULATED') {
      simulatedCount++;
    } else {
      failedCount++;
    }

    records.push({
      staffId: item.staffId,
      staffName: item.staffName,
      phoneNumber: item.phoneNumber,
      trainNo: item.trainNo,
      status: res.status,
      sid: res.sid,
      error: res.error || null
    });
  }

  return {
    totalEligible: targets.length,
    sentCount,
    simulatedCount,
    failedCount,
    skippedCount,
    isSimulatedMode: !isAndroidGatewayConfigured(),
    records
  };
}

/**
 * Everyday automated SMS scheduler.
 * Checks every 30 minutes. If the current time is around the scheduled dispatch window (default 06:00 AM IST)
 * and SMS hasn't been sent yet for today, automatically executes daily SMS dispatch.
 */
let dailyCronInterval: NodeJS.Timeout | null = null;
let lastAutoDispatchedDate = '';

export function startDailySmsScheduler(
  fetchDailyDutiesFn: (date: string) => Promise<any[]>,
  targetHour = 6, // 06:00 AM
  targetMinute = 0
) {
  if (dailyCronInterval) {
    clearInterval(dailyCronInterval);
  }

  console.log(`[SMS Scheduler] Initialized daily automated SMS cron (Target Time: ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} IST).`);

  const checkAndRun = async () => {
    try {
      const now = new Date();
      // IST is UTC + 5:30
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5));

      const hour = istDate.getHours();
      const minute = istDate.getMinutes();
      const dateStr = istDate.toISOString().split('T')[0];

      // If at or past scheduled time and not yet dispatched today
      if (hour === targetHour && minute >= targetMinute && minute <= targetMinute + 30 && lastAutoDispatchedDate !== dateStr) {
        // Double check database to ensure not already dispatched today
        const existingCount = await get(
          'SELECT COUNT(*) as count FROM sms_notifications WHERE duty_date = ?',
          [dateStr]
        );

        if (!existingCount || existingCount.count === 0) {
          console.log(`[SMS Scheduler] ⏰ Triggering scheduled daily duty SMS for ${dateStr}...`);
          lastAutoDispatchedDate = dateStr;

          const duties = await fetchDailyDutiesFn(dateStr);
          if (duties && duties.length > 0) {
            const result = await sendDailySmsBatch(dateStr, duties, undefined, false);
            console.log(`[SMS Scheduler] ✅ Daily SMS completed: ${result.sentCount} sent, ${result.simulatedCount} simulated, ${result.skippedCount} skipped.`);
          }
        } else {
          lastAutoDispatchedDate = dateStr;
        }
      }
    } catch (err: any) {
      console.error('[SMS Scheduler] Error in automated SMS run:', err.message);
    }
  };

  // Run initial check and set periodic timer every 5 minutes
  checkAndRun();
  dailyCronInterval = setInterval(checkAndRun, 5 * 60 * 1000);
}
