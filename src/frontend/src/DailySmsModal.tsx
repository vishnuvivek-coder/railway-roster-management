import React, { useState, useEffect } from 'react';

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

export interface DailySmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  API_BASE?: string;
}

function formatToIsoDate(val?: string): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0');
    const m = ddmmyyyy[2].padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${d}`;
  }
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

export default function DailySmsModal({
  isOpen,
  onClose,
  targetDate: initialDate,
  API_BASE = '/api'
}: DailySmsModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(formatToIsoDate(initialDate));
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [previews, setPreviews] = useState<SmsRecipientPreview[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'CHANGES' | 'READY' | 'NO_PHONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'PREVIEW' | 'HISTORY'>('PREVIEW');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [forceResend, setForceResend] = useState<boolean>(false);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(formatToIsoDate(initialDate));
    }
  }, [initialDate]);

  // Load config & preview when modal opens or date changes
  useEffect(() => {
    if (isOpen) {
      loadGatewayConfig();
      fetchPreview(selectedDate);
      fetchHistory(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const loadGatewayConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/sms/config`);
      const data = await res.json();
      if (data.success) {
        setGatewayConfig(data);
      }
    } catch (e) {
      console.warn('Could not load SMS gateway config:', e);
    }
  };

  const fetchPreview = async (dateStr: string) => {
    const cleanDate = formatToIsoDate(dateStr);
    setLoading(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/sms/preview?date=${cleanDate}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.previews)) {
        setPreviews(data.previews);
        // By default select all staff with valid phone numbers
        const validIds = data.previews.filter((p: SmsRecipientPreview) => p.phoneValid).map((p: SmsRecipientPreview) => Number(p.staffId));
        setSelectedStaffIds(validIds);
      } else {
        setPreviews([]);
        setSelectedStaffIds([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch SMS previews:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (dateStr: string) => {
    const cleanDate = formatToIsoDate(dateStr);
    try {
      const res = await fetch(`${API_BASE}/sms/history?date=${cleanDate}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistoryLogs(data.history);
      }
    } catch (err) {
      console.error('Failed to fetch SMS history:', err);
    }
  };

  const handleSelectAll = () => {
    const validFilteredIds = filteredPreviews.filter(p => p.phoneValid).map(p => Number(p.staffId));
    setSelectedStaffIds(validFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedStaffIds([]);
  };

  const toggleSelectStaff = (staffId: number | string) => {
    const numId = Number(staffId);
    setSelectedStaffIds(prev =>
      prev.includes(numId) ? prev.filter(id => id !== numId) : [...prev, numId]
    );
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const handleSendDailySms = async () => {
    if (selectedStaffIds.length === 0) {
      alert('Please select at least one employee with a valid phone number.');
      return;
    }

    setSending(true);
    try {
      const cleanDate = formatToIsoDate(selectedDate);
      const res = await fetch(`${API_BASE}/sms/send-daily`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: cleanDate,
          staffIds: selectedStaffIds.map(Number),
          force: forceResend
        })
      });
      const data = await res.json();
      if (data.success) {
        setSendResult(data.result);
        await fetchPreview(cleanDate);
        await fetchHistory(cleanDate);
      } else {
        alert(`Error sending SMS: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendSingleSms = async (item: SmsRecipientPreview) => {
    if (!item.phoneNumber) {
      alert('Cannot send SMS: No valid mobile phone number for this employee.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/sms/send-single`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staffId: item.staffId,
          staffName: item.staffName,
          phoneNumber: item.phoneNumber,
          dutyDate: selectedDate,
          trainNo: item.trainNo,
          route: `${item.fromStation} -> ${item.toStation}`,
          depTime: item.depTime,
          timingSource: item.timingSource,
          hasChanges: item.hasChanges,
          changeDetails: item.changeDetails,
          messageBody: item.messageBody
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ SMS dispatched for ${item.staffName} (${data.status})!`);
        fetchPreview(selectedDate);
        fetchHistory(selectedDate);
      } else {
        alert(`❌ Failed to send SMS: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  // Filter previews based on filterType and search query
  const filteredPreviews = previews.filter(item => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.staffName.toLowerCase().includes(q);
      const matchTrain = item.trainNo.toLowerCase().includes(q);
      const matchPhone = (item.phoneNumber || item.rawPhone || '').includes(q);
      if (!matchName && !matchTrain && !matchPhone) return false;
    }

    // Filter type
    if (filterType === 'CHANGES') return item.hasChanges;
    if (filterType === 'READY') return item.phoneValid;
    if (filterType === 'NO_PHONE') return !item.phoneValid;
    return true;
  });

  const validPhoneCount = previews.filter(p => p.phoneValid).length;
  const changesCount = previews.filter(p => p.hasChanges).length;
  const alreadySentCount = previews.filter(p => p.alreadySent).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#121316] border border-[#2a2d35] text-slate-100 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#181a1f] border-b border-[#2a2d35] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
              📱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  Daily Duty SMS Notifications
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Android SIM Gateway
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct SMS from your personal phone SIM card with Live NTES Departure Times & Change Notices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Android SIM Gateway Status Badge */}
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                gatewayConfig?.connected
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : gatewayConfig?.configured
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700'
              }`}
              title={gatewayConfig?.description}
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                gatewayConfig?.connected
                  ? 'bg-emerald-400'
                  : gatewayConfig?.configured
                  ? 'bg-amber-400'
                  : 'bg-yellow-400'
              }`} />
              <span>
                {gatewayConfig?.connected
                  ? `SIM Online: ${gatewayConfig.activeDevice?.name || 'Phone Connected'}`
                  : gatewayConfig?.configured
                  ? 'Phone Disconnected / Offline'
                  : 'Simulation Mode (Logged to DB)'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
              title="Close Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Gateway Info Banner */}
        {!gatewayConfig?.connected && (
          <div className="px-6 py-2.5 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-b border-amber-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-base">📱</span>
              <span>
                {gatewayConfig?.configured ? (
                  <><strong>Phone not detected:</strong> Open the Android SMS Gateway app on your phone to connect.</>
                ) : (
                  <><strong>Personal SIM Gateway:</strong> Uses open-source <strong>Android SMS Gateway (capcom6)</strong> in Cloud Mode to send real SMS from your SIM. Add <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded">ANDROID_SMS_GATEWAY_LOGIN</code> and <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded">ANDROID_SMS_GATEWAY_PASSWORD</code> to Railway to go live.</>
                )}
              </span>
            </div>
            <a
              href="https://github.com/capcom6/android-sms-gateway/releases"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 underline font-medium text-[11px]"
            >
              Get Android APK ↗
            </a>
          </div>
        )}

        {/* Date Selector & Stats Toolbar */}
        <div className="px-6 py-3.5 bg-[#14161a] border-b border-[#242730] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Duty Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1c1f26] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => { fetchPreview(selectedDate); fetchHistory(selectedDate); }}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-800/80 rounded-md text-slate-300 border border-slate-700">
              👥 <strong>{previews.length}</strong> Working Staff
            </span>
            <span className="px-2.5 py-1 bg-emerald-950/40 text-emerald-300 rounded-md border border-emerald-800/40">
              📞 <strong>{validPhoneCount}</strong> Phone Verified
            </span>
            <span className="px-2.5 py-1 bg-amber-950/40 text-amber-300 rounded-md border border-amber-800/40">
              ⚠️ <strong>{changesCount}</strong> Duty Changes
            </span>
            {alreadySentCount > 0 && (
              <span className="px-2.5 py-1 bg-blue-950/40 text-blue-300 rounded-md border border-blue-800/40">
                📨 <strong>{alreadySentCount}</strong> Sent Today
              </span>
            )}
          </div>

          {/* Main View Tabs */}
          <div className="flex items-center bg-[#1c1f26] p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setActiveView('PREVIEW')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeView === 'PREVIEW'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Preview & Dispatch ({filteredPreviews.length})
            </button>
            <button
              onClick={() => setActiveView('HISTORY')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeView === 'HISTORY'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dispatch Logs ({historyLogs.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Send Result Banner */}
          {sendResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 flex items-start justify-between">
              <div>
                <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                  <span>✅</span> SMS Dispatch Processed Successfully
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Dispatched: <strong>{(sendResult.sentCount || 0) + (sendResult.simulatedCount || 0)}</strong> messages ({sendResult.isSimulatedMode ? 'Simulation Mode - Logged to Database' : 'Live Gateway'}).
                  Skipped: {sendResult.skippedCount || 0}. Failed: {sendResult.failedCount || 0}.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('HISTORY')}
                  className="mt-2 text-xs font-bold px-3 py-1 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition cursor-pointer"
                >
                  📜 View Dispatched SMS Logs in History Tab ({historyLogs.length}) →
                </button>
              </div>
              <button
                onClick={() => setSendResult(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Dismiss
              </button>
            </div>
          )}

          {activeView === 'PREVIEW' ? (
            <>
              {/* Filter & Selection Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#181a1f] p-3 rounded-xl border border-[#242730]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Filter:</span>
                  <button
                    onClick={() => setFilterType('ALL')}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${filterType === 'ALL' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    All ({previews.length})
                  </button>
                  <button
                    onClick={() => setFilterType('CHANGES')}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${filterType === 'CHANGES' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    ⚠️ Changes Only ({changesCount})
                  </button>
                  <button
                    onClick={() => setFilterType('READY')}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${filterType === 'READY' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    📞 Ready to Send ({validPhoneCount})
                  </button>
                  <button
                    onClick={() => setFilterType('NO_PHONE')}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${filterType === 'NO_PHONE' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    ❌ No Phone ({previews.length - validPhoneCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search staff, train, mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#121316] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-48"
                  />
                  <button
                    onClick={handleSelectAll}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                  >
                    Deselect
                  </button>
                </div>
              </div>

              {/* Recipient Cards Grid */}
              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="animate-spin text-3xl mb-2">⏳</div>
                  <p className="text-sm">Fetching daily roster duties & resolving live NTES timings...</p>
                </div>
              ) : filteredPreviews.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <p className="text-base">No staff found matching current criteria for {selectedDate}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPreviews.map((item) => {
                    const isSelected = selectedStaffIds.includes(Number(item.staffId));
                    return (
                      <div
                        key={String(item.staffId)}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-[#1a1d24] border-amber-500/50 shadow-md'
                            : 'bg-[#15171c] border-[#252830] opacity-80'
                        }`}
                      >
                        {/* Header: Checkbox + Staff info + Status tag */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!item.phoneValid}
                              onChange={() => toggleSelectStaff(item.staffId)}
                              className="mt-1 w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                            <div>
                              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                                <span>{item.staffName}</span>
                                <span className="text-[11px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                  {item.designation || 'TTE'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>📞 {item.phoneNumber || <span className="text-rose-400 italic">Missing Mobile</span>}</span>
                                {item.linkNumber && (
                                  <span className="text-slate-500">• Link #{item.linkNumber}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Duty Status Tag */}
                          <div className="text-right">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                item.hasChanges
                                  ? 'bg-amber-950/50 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {item.hasChanges ? '⚠️ Change' : '✅ Regular'}
                            </span>
                            {item.alreadySent && (
                              <div className="text-[10px] text-blue-400 mt-1 font-medium">
                                📨 Sent
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Train, Section & NTES Timing Details */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-[#101114] p-2.5 rounded-lg border border-[#202228]">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">🚆 Train No</span>
                            <span className="font-semibold text-slate-200">
                              {item.trainNo} {item.trainName ? `(${item.trainName})` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">📍 Beat / Section</span>
                            <span className="font-semibold text-slate-200">
                              {item.fromStation} ➔ {item.toStation}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">🕒 Departure Time</span>
                            <span className="font-bold text-amber-400">
                              {item.depTime} hrs
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">📡 Timing Source</span>
                            <span className="text-slate-300">
                              {item.timingSource}
                            </span>
                          </div>
                        </div>

                        {/* Change details explanation if any */}
                        {item.hasChanges && (
                          <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 p-2 rounded-lg">
                            {item.changeDetails}
                          </div>
                        )}

                        {/* SMS Preview Snippet */}
                        <div className="mt-2 text-[11px] text-slate-400 bg-black/40 p-2 rounded border border-slate-800/80 font-mono whitespace-pre-line leading-relaxed">
                          {item.messageBody}
                        </div>

                        {/* Individual Action */}
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="text-[11px] text-slate-500">
                            {item.coaches && item.coaches !== '-' ? `Coach: ${item.coaches}` : ''}
                          </span>
                          <button
                            onClick={() => handleSendSingleSms(item)}
                            disabled={!item.phoneValid || sending}
                            className="text-xs px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded transition disabled:opacity-40"
                          >
                            Send SMS to Employee
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Dispatch History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200">
                  SMS Notifications Sent for {selectedDate} ({historyLogs.length} records)
                </h3>
                <button
                  onClick={() => fetchHistory(selectedDate)}
                  className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                >
                  Refresh Logs
                </button>
              </div>

              {historyLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <p>No SMS dispatch records logged for {selectedDate}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#181a1f] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">Time</th>
                        <th className="px-3 py-2.5">Staff Name</th>
                        <th className="px-3 py-2.5">Mobile</th>
                        <th className="px-3 py-2.5">Train & Beat</th>
                        <th className="px-3 py-2.5">Dep. Time</th>
                        <th className="px-3 py-2.5">Change Note</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Gateway SID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-[#121316]">
                      {historyLogs.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">
                            {row.created_at ? row.created_at.substring(11, 16) : '-'}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-200">
                            {row.staff_name}
                          </td>
                          <td className="px-3 py-2 text-slate-300 font-mono">
                            {row.phone_number}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            <strong>{row.train_no}</strong> ({row.route})
                          </td>
                          <td className="px-3 py-2 text-amber-400 font-mono">
                            {row.dep_time}
                          </td>
                          <td className="px-3 py-2 text-slate-400 max-w-xs truncate" title={row.change_details}>
                            {row.has_changes ? `⚠️ ${row.change_details}` : '✅ Regular'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.status === 'SENT'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : row.status === 'SIMULATED'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono text-slate-500 max-w-[120px] truncate" title={row.gateway_sid || row.error_message}>
                            {row.gateway_sid || row.error_message || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#181a1f] border-t border-[#2a2d35] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={forceResend}
                onChange={(e) => setForceResend(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700"
              />
              <span>Force Resend to already notified staff</span>
            </label>
            <span className="text-xs text-slate-500">
              • Selected <strong>{selectedStaffIds.length}</strong> of {filteredPreviews.length} staff
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSendDailySms}
              disabled={selectedStaffIds.length === 0 || sending}
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{sending ? '⏳ Sending...' : '📱'}</span>
              <span>
                {sending
                  ? 'Dispatching SMS via Android SIM...'
                  : `Send Daily SMS via Android SIM (${selectedStaffIds.length} Staff)`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
