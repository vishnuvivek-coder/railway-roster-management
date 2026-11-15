/**
 * ============================================================================
 * ANDROID SIM-BASED SMS GATEWAY CLIENT (capcom6/android-sms-gateway)
 * ============================================================================
 *
 * Communicates with the user's personal Android phone through the open-source
 * Android SMS Gateway in Cloud Server mode (api.sms-gate.app).
 *
 * Messages are sent directly from the administrator's physical Android SIM card.
 * No commercial / paid SMS aggregators (Twilio, Fast2SMS, MSG91) are used.
 *
 * Documentation: https://docs.sms-gate.app/
 * GitHub: https://github.com/capcom6/android-sms-gateway
 * ============================================================================
 */

export interface AndroidSmsGatewayDevice {
  id: string;
  name: string;
  lastSeen?: string;
  isOnline?: boolean;
}

export interface AndroidSmsGatewayConfig {
  configured: boolean;
  connected: boolean;
  mode: 'ANDROID_SIM_GATEWAY_CLOUD' | 'SIMULATION_MODE';
  provider: string;
  serverUrl: string;
  loginMasked: string | null;
  devices: AndroidSmsGatewayDevice[];
  activeDevice: AndroidSmsGatewayDevice | null;
  error?: string | null;
  description: string;
}

export interface AndroidSmsSendResult {
  success: boolean;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  sid: string;
  error?: string;
  gatewayResponse?: any;
}

/**
 * Resolves gateway connection parameters from environment variables.
 * Compatible with Railway environment variables and local .env files.
 */
function getGatewayCredentials() {
  const login = (
    process.env.ANDROID_SMS_GATEWAY_LOGIN ||
    process.env.SMS_GATEWAY_LOGIN ||
    process.env.SMS_GATEWAY_USER ||
    ''
  ).trim();

  const password = (
    process.env.ANDROID_SMS_GATEWAY_PASSWORD ||
    process.env.SMS_GATEWAY_PASSWORD ||
    process.env.SMS_GATEWAY_PASS ||
    ''
  ).trim();

  const serverUrl = (
    process.env.ANDROID_SMS_GATEWAY_URL ||
    process.env.SMS_GATEWAY_URL ||
    'https://api.sms-gate.app'
  ).trim().replace(/\/+$/, '');

  const deviceId = (
    process.env.ANDROID_SMS_GATEWAY_DEVICE_ID ||
    process.env.SMS_GATEWAY_DEVICE_ID ||
    ''
  ).trim();

  return {
    login,
    password,
    serverUrl,
    deviceId: deviceId || undefined,
    isConfigured: Boolean(login && password)
  };
}

/**
 * Checks whether Android SMS Gateway credentials are set in environment.
 */
export function isAndroidGatewayConfigured(): boolean {
  const { isConfigured } = getGatewayCredentials();
  return isConfigured;
}

/**
 * Generates HTTP Basic Auth header value.
 */
function getAuthHeader(login: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${login}:${pass}`).toString('base64');
}

/**
 * Queries connected Android devices from the Cloud Server to verify phone connection.
 */
export async function getAndroidGatewayDevices(): Promise<{ success: boolean; devices: AndroidSmsGatewayDevice[]; error?: string }> {
  const { login, password, serverUrl, isConfigured } = getGatewayCredentials();

  if (!isConfigured) {
    return { success: false, devices: [], error: 'Android SMS Gateway credentials not configured.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(`${serverUrl}/3rdparty/v1/devices`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(login, password),
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return { success: false, devices: [], error: 'Invalid Android SMS Gateway login or password.' };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, devices: [], error: `Gateway returned HTTP ${res.status}: ${errText}` };
    }

    const data: any = await res.json();
    const rawList = Array.isArray(data) ? data : (data.devices || []);

    const now = Date.now();
    const devices: AndroidSmsGatewayDevice[] = rawList.map((d: any) => {
      let isOnline = false;
      if (d.lastSeen) {
        const lastSeenTime = new Date(d.lastSeen).getTime();
        // Online if device pinged within the last 30 minutes
        isOnline = (now - lastSeenTime) < 30 * 60 * 1000;
      }
      return {
        id: String(d.id || ''),
        name: String(d.name || d.model || 'Android Phone'),
        lastSeen: d.lastSeen || undefined,
        isOnline
      };
    });

    return { success: true, devices };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Connection timed out contacting Android Gateway Cloud' : err.message;
    return { success: false, devices: [], error: msg };
  }
}

/**
 * Retrieves full gateway status (masking password) for admin dashboard UI.
 */
export async function getAndroidGatewayConfigStatus(): Promise<AndroidSmsGatewayConfig> {
  const { login, serverUrl, isConfigured } = getGatewayCredentials();

  if (!isConfigured) {
    return {
      configured: false,
      connected: false,
      mode: 'SIMULATION_MODE',
      provider: 'Android SIM SMS Gateway (capcom6)',
      serverUrl,
      loginMasked: null,
      devices: [],
      activeDevice: null,
      error: 'Gateway credentials missing from Railway / .env environment variables (ANDROID_SMS_GATEWAY_LOGIN and ANDROID_SMS_GATEWAY_PASSWORD).',
      description: 'Simulation mode active. Formatted messages are logged to MySQL database. Set credentials to transmit through your personal Android SIM card.'
    };
  }

  const { success, devices, error } = await getAndroidGatewayDevices();
  const activeDevice = devices.find(d => d.isOnline) || devices[0] || null;
  const connected = success && devices.length > 0;

  const loginMasked = login.length > 4
    ? `${login.substring(0, 2)}***${login.substring(login.length - 2)}`
    : '***';

  return {
    configured: true,
    connected,
    mode: 'ANDROID_SIM_GATEWAY_CLOUD',
    provider: 'Android SIM SMS Gateway (capcom6 Cloud Mode)',
    serverUrl,
    loginMasked,
    devices,
    activeDevice,
    error: error || (connected ? null : 'No Android phone connected. Open the Android SMS Gateway app on your phone and ensure it is registered to Cloud Mode.'),
    description: connected
      ? `Connected to Android phone (${activeDevice?.name || 'Device'}). SMS messages will be sent from your phone's SIM card.`
      : (error || 'No Android phones are currently reporting online to your gateway account.')
  };
}

/**
 * Dispatches an SMS message through the personal Android phone SIM card.
 * If credentials are not configured, falls back to SIMULATION_MODE with database logging.
 */
export async function dispatchAndroidSimSms(params: {
  phoneNumber: string;
  messageText: string;
  staffId?: number;
  staffName?: string;
}): Promise<AndroidSmsSendResult> {
  const { phoneNumber, messageText, staffId, staffName } = params;
  const { login, password, serverUrl, deviceId, isConfigured } = getGatewayCredentials();

  // Validate phone number
  const cleanPhone = (phoneNumber || '').trim();
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
    return {
      success: false,
      status: 'FAILED',
      sid: '',
      error: `Invalid phone number format: "${phoneNumber}". Must be at least 10 digits.`
    };
  }

  // Fallback to Simulation Mode if not configured
  if (!isConfigured) {
    const simulatedSid = `SIM_${Date.now()}_${staffId || '0'}`;
    return {
      success: true,
      status: 'SIMULATED',
      sid: simulatedSid,
      gatewayResponse: { mode: 'SIMULATION_MODE', note: 'Saved to MySQL database' }
    };
  }

  try {
    const payload: any = {
      phoneNumbers: [cleanPhone],
      textMessage: {
        text: messageText
      },
      withDeliveryReport: true
    };

    if (deviceId) {
      payload.deviceId = deviceId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${serverUrl}/3rdparty/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(login, password),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        status: 'FAILED',
        sid: '',
        error: 'Authentication failed with Android SMS Gateway. Please verify ANDROID_SMS_GATEWAY_LOGIN and ANDROID_SMS_GATEWAY_PASSWORD.'
      };
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      let parsedMsg = errBody;
      try {
        const jsonErr = JSON.parse(errBody);
        parsedMsg = jsonErr.message || jsonErr.error || errBody;
      } catch (_) {}
      return {
        success: false,
        status: 'FAILED',
        sid: '',
        error: `Android SMS Gateway error (${res.status}): ${parsedMsg}`
      };
    }

    const data: any = await res.json().catch(() => ({}));
    const messageId = String(data.id || data.messageId || `MSG_${Date.now()}`);

    return {
      success: true,
      status: 'SENT',
      sid: messageId,
      gatewayResponse: data
    };
  } catch (err: any) {
    const errMsg = err.name === 'AbortError'
      ? 'Timeout contacting Android SMS Gateway Cloud server.'
      : err.message;

    return {
      success: false,
      status: 'FAILED',
      sid: '',
      error: errMsg
    };
  }
}
