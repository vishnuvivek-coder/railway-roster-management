import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SearchableStaffSelect from './SearchableStaffSelect';
import DigitalSignatureModal from './DigitalSignatureModal';
import { getDefaultDigitalSignature } from './signatureUtils';
import { printElement, downloadPdfFromElement } from './printUtils';

const API_BASE = '/api';

interface CashRemittanceRow {
  slNo: string;
  mrNumber: string;
  date: string;
  rmtdStn: string;
  totalAmount: string;
}

interface FoilRow {
  from: string;
  to: string;
  total: string;
}

interface OtherZoneRow {
  date: string;
  trNo: string;
  from: string;
  to: string;
  noOfEfts: string;
  amount: string;
  mrNoRStn: string;
}

interface Enclosures {
  comT12: string;
  noOfMrs: string;
  comR19: string;
  otherEnclosures: string;
}

interface Amounts {
  eftCash: string;
  otherCash: string;
  total: string;
}

interface EmployeeMeta {
  name: string;
  designation: string;
  hqStation: string;
  pfNo: string;
  billUnit: string;
  designationSign: string;
  signatureData?: string | null;
}

interface RemittanceDocumentProps {
  authToken?: string | null;
  isEmployee?: boolean;
  lockedStaffId?: string | number | null;
  categories?: any[];
  selectedCatId?: string;
  setSelectedCatId?: (id: string) => void;
  selectedStaffId?: string | number;
  setSelectedStaffId?: (id: string) => void;
  year?: string | number;
  setYear?: (y: string) => void;
  month?: string | number;
  setMonth?: (m: string) => void;
}

// Initial 26 rows for Left Table (matching rows 9 to 34 in user's Excel)
const createInitialCashRows = (): CashRemittanceRow[] => {
  const rows: CashRemittanceRow[] = [];
  for (let i = 1; i <= 26; i++) {
    rows.push({
      slNo: i <= 14 ? String(i) : '',
      mrNumber: '',
      date: '',
      rmtdStn: '',
      totalAmount: ''
    });
  }
  return rows;
};

// Initial 6 rows for Foils table
const createInitialFoilRows = (isCancelled = false): FoilRow[] => [
  { from: '', to: '', total: '' },
  { from: '', to: isCancelled ? 'NIL' : '', total: '' },
  { from: '', to: '', total: '' },
  { from: '', to: '', total: '' },
  { from: '', to: '', total: '' },
  { from: '', to: '', total: '' }
];

// Initial 11 rows for Other Zone Remittance
const createInitialOtherZoneRows = (): OtherZoneRow[] => {
  const rows: OtherZoneRow[] = [];
  for (let i = 0; i < 11; i++) {
    rows.push({
      date: '',
      trNo: '',
      from: '',
      to: '',
      noOfEfts: '',
      amount: '',
      mrNoRStn: ''
    });
  }
  return rows;
};

export default function RemittanceDocument({
  authToken,
  isEmployee = false,
  lockedStaffId = null,
  categories = [],
  selectedCatId = '1',
  setSelectedCatId,
  selectedStaffId,
  setSelectedStaffId,
  year = '2026',
  setYear,
  month = '11',
  setMonth
}: RemittanceDocumentProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);

  // Header Title States (Both fully editable)
  const [headerTitleOf, setHeaderTitleOf] = useState('');
  const [headerMonthText, setHeaderMonthText] = useState('');

  // Tables States
  const [cashRows, setCashRows] = useState<CashRemittanceRow[]>(createInitialCashRows);
  const [eftFoilsRows, setEftFoilsRows] = useState<FoilRow[]>(() => createInitialFoilRows(false));
  const [cancelledFoilsRows, setCancelledFoilsRows] = useState<FoilRow[]>(() => createInitialFoilRows(true));
  const [cancelledFoilsTotalNo, setCancelledFoilsTotalNo] = useState('');
  const [otherZoneRows, setOtherZoneRows] = useState<OtherZoneRow[]>(createInitialOtherZoneRows);

  const [enclosures, setEnclosures] = useState<Enclosures>({
    comT12: '',
    noOfMrs: '',
    comR19: '',
    otherEnclosures: '--'
  });

  const [amounts, setAmounts] = useState<Amounts>({
    eftCash: '',
    otherCash: '',
    total: ''
  });

  const [employeeMeta, setEmployeeMeta] = useState<EmployeeMeta>({
    name: 'K V RAMANA RAO',
    designation: 'CTI',
    hqStation: 'GNT',
    pfNo: '',
    billUnit: '',
    designationSign: 'CTI/SL/GNT',
    signatureData: null
  });

  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Auto Calculations
  const calculatedCashTotal = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    cashRows.forEach(r => {
      const v = parseFloat(r.totalAmount);
      if (!isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    });
    return hasAny ? sum : 0;
  }, [cashRows]);

  const calculatedEftFoilsTotal = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    eftFoilsRows.forEach(r => {
      const v = parseInt(r.total, 10);
      if (!isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    });
    return hasAny ? sum : 0;
  }, [eftFoilsRows]);

  const calculatedOtherZoneEftsTotal = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    otherZoneRows.forEach(r => {
      const v = parseInt(r.noOfEfts, 10);
      if (!isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    });
    return hasAny ? sum : 0;
  }, [otherZoneRows]);

  const calculatedOtherZoneAmountTotal = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    otherZoneRows.forEach(r => {
      const v = parseFloat(r.amount);
      if (!isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    });
    return hasAny ? sum : 0;
  }, [otherZoneRows]);

  // Load Staff List
  useEffect(() => {
    async function loadStaff() {
      try {
        const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `${API_BASE}/staff${selectedCatId && selectedCatId !== 'all' ? `?category_id=${selectedCatId}` : ''}`;
        const res = await fetch(url, { credentials: 'include', headers });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.staff || []);
          setStaffList(list);

          if (!selectedStaffId && list.length > 0) {
            const firstId = list[0].id.toString();
            if (setSelectedStaffId) setSelectedStaffId(firstId);
          }
        }
      } catch (e) {
        console.error('Failed to load staff list:', e);
      }
    }
    loadStaff();
  }, [authToken, selectedCatId, selectedStaffId, setSelectedStaffId]);

  // Fetch document data
  const fetchDocument = useCallback(async () => {
    if (!selectedStaffId) return;
    setLoading(true);
    setStatusMsg('');
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${API_BASE}/documents/remittance/${selectedStaffId}?year=${year}&month=${month}`,
        { credentials: 'include', headers }
      );

      if (res.ok) {
        const data = await res.json();
        
        setHeaderTitleOf(data.headerTitleOf || data.employeeMeta?.name || 'K V RAMANA RAO');
        setHeaderMonthText(data.headerMonthText || data.monthName || '');

        if (data.employeeMeta) {
          setEmployeeMeta({
            name: data.employeeMeta.name || 'K V RAMANA RAO',
            designation: data.employeeMeta.designation || 'CTI',
            hqStation: data.employeeMeta.hqStation || 'GNT',
            pfNo: data.employeeMeta.pfNo || '',
            billUnit: data.employeeMeta.billUnit || '',
            designationSign: data.employeeMeta.designationSign || 'CTI/SL/GNT',
            signatureData: data.employeeMeta.signatureData || null
          });
        }

        if (Array.isArray(data.cashRemittanceRows) && data.cashRemittanceRows.length > 0) {
          // Ensure at least 26 rows to match exact format
          const loaded = [...data.cashRemittanceRows];
          while (loaded.length < 26) {
            loaded.push({ slNo: '', mrNumber: '', date: '', rmtdStn: '', totalAmount: '' });
          }
          setCashRows(loaded);
        } else {
          setCashRows(createInitialCashRows());
        }

        if (Array.isArray(data.eftFoilsRows) && data.eftFoilsRows.length > 0) {
          setEftFoilsRows(data.eftFoilsRows);
        } else {
          setEftFoilsRows(createInitialFoilRows(false));
        }

        if (Array.isArray(data.cancelledFoilsRows) && data.cancelledFoilsRows.length > 0) {
          setCancelledFoilsRows(data.cancelledFoilsRows);
        } else {
          setCancelledFoilsRows(createInitialFoilRows(true));
        }

        if (data.cancelledFoilsTotalNo !== undefined) {
          setCancelledFoilsTotalNo(data.cancelledFoilsTotalNo);
        }

        if (Array.isArray(data.otherZoneRows) && data.otherZoneRows.length > 0) {
          const ozLoaded = [...data.otherZoneRows];
          while (ozLoaded.length < 11) {
            ozLoaded.push({ date: '', trNo: '', from: '', to: '', noOfEfts: '', amount: '', mrNoRStn: '' });
          }
          setOtherZoneRows(ozLoaded);
        } else {
          setOtherZoneRows(createInitialOtherZoneRows());
        }

        if (data.enclosures) setEnclosures(data.enclosures);
        if (data.amounts) setAmounts(data.amounts);

        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Error fetching remittance document:', err);
      setStatusMsg('Network error loading document.');
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId, year, month, authToken]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Save handler
  const handleSave = async (showToast = true) => {
    if (!selectedStaffId) return;
    setSaving(true);
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;
      const payload = {
        month_year: monthYearStr,
        employee_meta: {
          name: employeeMeta.name,
          designation: employeeMeta.designation,
          signature_data: employeeMeta.signatureData
        },
        data: {
          staffId: selectedStaffId,
          year,
          month,
          headerTitleOf,
          headerMonthText,
          monthYear: monthYearStr,
          employeeMeta,
          cashRemittanceRows: cashRows,
          eftFoilsRows,
          cancelledFoilsRows,
          cancelledFoilsTotalNo,
          otherZoneRows,
          enclosures,
          amounts
        }
      };

      const res = await fetch(`${API_BASE}/documents/remittance/${selectedStaffId}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        if (showToast) {
          setStatusMsg('✓ All changes saved permanently to database.');
          setTimeout(() => setStatusMsg(''), 4000);
        }
      } else {
        setStatusMsg('❌ Failed to save document.');
      }
    } catch (e: any) {
      console.error('Error saving document:', e);
      setStatusMsg('Network error saving document.');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Reset handler
  const handleReset = async () => {
    if (!window.confirm('Reset this document to blank master format? Any unsaved edits will be discarded.')) {
      return;
    }
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${API_BASE}/documents/remittance/${selectedStaffId}?year=${year}&month=${month}`,
        { method: 'DELETE', credentials: 'include', headers }
      );
      if (res.ok) {
        await fetchDocument();
        setStatusMsg('✓ Document reset to default format.');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (e) {
      console.error('Reset error:', e);
    }
  };

  // Row update handlers
  const updateCashRow = (idx: number, field: keyof CashRemittanceRow, val: string) => {
    setCashRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const updateEftFoilRow = (idx: number, field: keyof FoilRow, val: string) => {
    setEftFoilsRows(prev => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: val };
      if (field === 'from' || field === 'to') {
        const f = parseInt(field === 'from' ? val : updated.from, 10);
        const t = parseInt(field === 'to' ? val : updated.to, 10);
        if (!isNaN(f) && !isNaN(t) && t >= f) {
          updated.total = String(t - f + 1);
        }
      }
      copy[idx] = updated;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const updateCancelledFoilRow = (idx: number, field: keyof FoilRow, val: string) => {
    setCancelledFoilsRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const updateOtherZoneRow = (idx: number, field: keyof OtherZoneRow, val: string) => {
    setOtherZoneRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const selectedStaffObj = staffList.find(s => String(s.id) === String(selectedStaffId));
  const effectiveSignature = employeeMeta.signatureData || getDefaultDigitalSignature(
    employeeMeta.name || selectedStaffObj?.name,
    employeeMeta.designationSign || employeeMeta.designation || selectedStaffObj?.designation,
    employeeMeta.pfNo || selectedStaffObj?.pf_no
  );

  // Common transparent full-cell input style matching Excel exact grid lines
  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0 4px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: '#000000',
    textAlign: 'center'
  };

  const borderBlack = '1px solid #000000';
  const borderThickBlack = '2px solid #000000';

  return (
    <div className="remittance-doc-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '12px' }}>
      
      {/* Top Toolbar (Hidden when Printing) */}
      <div className="no-print" style={{
        background: 'var(--bg-card, #1A1A1D)',
        border: '1px solid var(--border-gold, #D4A15C)',
        borderRadius: '10px',
        padding: '12px 18px',
        marginBottom: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
      }}>
        {/* Left: Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!isEmployee && (
            <div style={{ minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#D4A15C', marginBottom: '2px' }}>
                SELECT EMPLOYEE:
              </label>
              <SearchableStaffSelect
                staffList={staffList}
                selectedStaffId={selectedStaffId}
                onSelect={(id) => {
                  if (setSelectedStaffId) setSelectedStaffId(id);
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#D4A15C', marginBottom: '2px' }}>
              MONTH:
            </label>
            <select
              value={month}
              onChange={(e) => {
                if (setMonth) setMonth(e.target.value);
              }}
              style={{
                background: '#0D0D0F',
                border: '1px solid #444',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {[
                { v: '1', l: 'January' }, { v: '2', l: 'February' }, { v: '3', l: 'March' },
                { v: '4', l: 'April' }, { v: '5', l: 'May' }, { v: '6', l: 'June' },
                { v: '7', l: 'July' }, { v: '8', l: 'August' }, { v: '9', l: 'September' },
                { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' }
              ].map(m => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#D4A15C', marginBottom: '2px' }}>
              YEAR:
            </label>
            <select
              value={year}
              onChange={(e) => {
                if (setYear) setYear(e.target.value);
              }}
              style={{
                background: '#0D0D0F',
                border: '1px solid #444',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {['2024', '2025', '2026', '2027', '2028'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {statusMsg && (
            <span style={{ fontSize: '0.82rem', color: statusMsg.includes('✓') ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {statusMsg}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '7px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: hasUnsavedChanges ? 'linear-gradient(135deg, #e5a93c 0%, #d48b1e 100%)' : 'var(--primary, #D4A15C)',
              color: '#000',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {saving ? 'Saving...' : hasUnsavedChanges ? '💾 Save Changes *' : '💾 Save Changes'}
          </button>

          <button
            type="button"
            onClick={() => printElement('.exact-excel-sheet', {
              title: `General_Summary_Remittance_${year}_${month}`,
              orientation: 'landscape',
              pageFormat: 'legal'
            })}
            className="btn btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            🖨️ Print Sheet
          </button>

          <button
            type="button"
            onClick={() => downloadPdfFromElement('.exact-excel-sheet', `General_Summary_Remittance_${year}_${month}.pdf`, {
              orientation: 'landscape',
              unit: 'mm',
              format: 'legal'
            })}
            className="btn btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            📥 Download PDF
          </button>

          <button
            type="button"
            onClick={() => setShowSignatureModal(true)}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            ✍️ Signature
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-outline"
            style={{ padding: '7px 10px', fontSize: '0.8rem', color: '#94a3b8' }}
            title="Reset to blank template"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXACT EXCEL SPREADSHEET REPLICA (White Background, Solid Black Gridlines) */}
      {/* ========================================================================= */}
      <div 
        className="exact-excel-sheet"
        style={{
          background: '#ffffff',
          color: '#000000',
          padding: '24px 30px',
          boxShadow: '0 6px 30px rgba(0,0,0,0.5)',
          fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.2',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* ROW 2: GENERAL SUMMARY CUM REMITTENCE OF [Editable Name] */}
        <div style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '11pt',
          letterSpacing: '0.5px',
          marginBottom: '2px'
        }}>
          GENERAL SUMMARY CUM REMITTENCE OF{' '}
          <input
            type="text"
            value={headerTitleOf}
            onChange={(e) => {
              setHeaderTitleOf(e.target.value.toUpperCase());
              setHasUnsavedChanges(true);
            }}
            placeholder="                                            "
            style={{
              border: 'none',
              borderBottom: '1px solid #000',
              outline: 'none',
              background: 'transparent',
              fontSize: '11pt',
              fontWeight: 700,
              fontFamily: 'inherit',
              textAlign: 'center',
              minWidth: '220px',
              padding: '0 6px'
            }}
            title="Click to edit employee name"
          />
        </div>

        {/* ROW 3: FOR THE MONTH OF [Editable Month] -2026 */}
        <div style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '11pt',
          letterSpacing: '0.5px',
          marginBottom: '10px'
        }}>
          FOR THE MONTH OF{' '}
          <input
            type="text"
            value={headerMonthText}
            onChange={(e) => {
              setHeaderMonthText(e.target.value.toUpperCase());
              setHasUnsavedChanges(true);
            }}
            placeholder="                    "
            style={{
              border: 'none',
              borderBottom: '1px solid #000',
              outline: 'none',
              background: 'transparent',
              fontSize: '11pt',
              fontWeight: 700,
              fontFamily: 'inherit',
              textAlign: 'center',
              width: '160px',
              padding: '0 4px'
            }}
            title="Click to edit month text"
          />
          {' '}-{year}
        </div>

        {/* TWO-COLUMN GRID: Left Cash Table (Cols B-F), Right Tables (Cols H-P) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '400px 1fr',
          columnGap: '60px',
          alignItems: 'start'
        }}>
          
          {/* ======================================================== */}
          {/* LEFT TABLE: CASH REMITTENCE PARTICULARS (Cols B to F)    */}
          {/* ======================================================== */}
          <div style={{ width: '100%' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: borderBlack,
              fontSize: '9.5pt',
              tableLayout: 'fixed'
            }}>
              <thead>
                {/* Header row: CASH REMITTENCE PARTICULARS */}
                <tr style={{ height: '24px' }}>
                  <th
                    colSpan={5}
                    style={{
                      border: borderBlack,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '10pt',
                      padding: '2px',
                      textDecoration: 'underline'
                    }}
                  >
                    CASH REMITTENCE PARTICULARS
                  </th>
                </tr>

                {/* Subheaders: SL. No. | MONEY RECEIPT NUMBER | DATE | RMTD. STN | TOTAL AMOUNT */}
                <tr style={{ height: '36px', textAlign: 'center', fontWeight: 700 }}>
                  <th style={{ border: borderBlack, width: '44px', padding: '1px' }}>
                    SL. No.
                  </th>
                  <th style={{ border: borderBlack, width: '125px', padding: '1px', lineHeight: '1.1' }}>
                    MONEY RECEIPT<br />NUMBER
                  </th>
                  <th style={{ border: borderBlack, width: '65px', padding: '1px' }}>
                    DATE
                  </th>
                  <th style={{ border: borderBlack, width: '60px', padding: '1px', lineHeight: '1.1' }}>
                    RMTD.<br />STN
                  </th>
                  <th style={{ border: borderBlack, width: '85px', padding: '1px', lineHeight: '1.1' }}>
                    TOTAL<br />AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {cashRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '21px' }}>
                    {/* SL. No. */}
                    <td style={{ border: borderBlack, padding: 0, textAlign: 'center', fontWeight: 600 }}>
                      <input
                        type="text"
                        value={row.slNo}
                        onChange={(e) => updateCashRow(idx, 'slNo', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    {/* MONEY RECEIPT NUMBER */}
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.mrNumber}
                        onChange={(e) => updateCashRow(idx, 'mrNumber', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    {/* DATE */}
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateCashRow(idx, 'date', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    {/* RMTD. STN */}
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.rmtdStn}
                        onChange={(e) => updateCashRow(idx, 'rmtdStn', e.target.value.toUpperCase())}
                        style={cellInputStyle}
                      />
                    </td>
                    {/* TOTAL AMOUNT */}
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.totalAmount}
                        onChange={(e) => updateCashRow(idx, 'totalAmount', e.target.value)}
                        style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '4px' }}
                      />
                    </td>
                  </tr>
                ))}

                {/* TOTAL: Row */}
                <tr style={{ height: '24px', fontWeight: 700 }}>
                  <td colSpan={4} style={{ border: borderBlack, textAlign: 'center', letterSpacing: '0.5px' }}>
                    TOTAL:
                  </td>
                  <td style={{ border: borderBlack, textAlign: 'right', paddingRight: '6px' }}>
                    {calculatedCashTotal > 0 ? calculatedCashTotal.toLocaleString('en-IN') : '0'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: FOILS, OTHER ZONE, ENCLOSURES, SIGNATURE   */}
          {/* ======================================================== */}
          <div style={{ width: '100%' }}>
            
            {/* ---------------------------------------------------- */}
            {/* TABLE 1: EFT FOILS USED & CANCELLED FOILES           */}
            {/* ---------------------------------------------------- */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: borderBlack,
              fontSize: '9.5pt',
              tableLayout: 'fixed',
              marginBottom: '18px'
            }}>
              <thead>
                {/* Main Header */}
                <tr style={{ height: '22px', textAlign: 'center', fontWeight: 700 }}>
                  <th colSpan={3} style={{ border: borderBlack, padding: '2px', textDecoration: 'underline' }}>
                    EFT FOILS USED
                  </th>
                  <th colSpan={3} style={{ border: borderBlack, padding: '2px', textDecoration: 'underline' }}>
                    CANCELLED FOILES
                  </th>
                </tr>
                {/* Subheaders: FROM | TO | TOTAL | FROM | TO | TOTAL */}
                <tr style={{ height: '22px', textAlign: 'center', fontWeight: 700, fontSize: '9pt' }}>
                  <th style={{ border: borderBlack, width: '17%' }}>FROM</th>
                  <th style={{ border: borderBlack, width: '17%' }}>TO</th>
                  <th style={{ border: borderBlack, width: '16%' }}>TOTAL</th>
                  <th style={{ border: borderBlack, width: '17%' }}>FROM</th>
                  <th style={{ border: borderBlack, width: '17%' }}>TO</th>
                  <th style={{ border: borderBlack, width: '16%' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, idx) => {
                  const used = eftFoilsRows[idx] || { from: '', to: '', total: '' };
                  const canc = cancelledFoilsRows[idx] || { from: '', to: '', total: '' };
                  return (
                    <tr key={idx} style={{ height: '21px' }}>
                      {/* EFT FOILS USED: FROM */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={used.from}
                          onChange={(e) => updateEftFoilRow(idx, 'from', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                      {/* EFT FOILS USED: TO */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={used.to}
                          onChange={(e) => updateEftFoilRow(idx, 'to', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                      {/* EFT FOILS USED: TOTAL */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={used.total}
                          onChange={(e) => updateEftFoilRow(idx, 'total', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* CANCELLED FOILES: FROM */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={canc.from}
                          onChange={(e) => updateCancelledFoilRow(idx, 'from', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                      {/* CANCELLED FOILES: TO */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={canc.to}
                          onChange={(e) => updateCancelledFoilRow(idx, 'to', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                      {/* CANCELLED FOILES: TOTAL */}
                      <td style={{ border: borderBlack, padding: 0 }}>
                        <input
                          type="text"
                          value={canc.total}
                          onChange={(e) => updateCancelledFoilRow(idx, 'total', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr style={{ height: '22px', fontWeight: 700 }}>
                  <td colSpan={2} style={{ border: borderBlack, textAlign: 'center', fontSize: '9pt' }}>
                    TOTAL No. Of. EFT FOILS.
                  </td>
                  <td style={{ border: borderBlack, textAlign: 'center' }}>
                    {calculatedEftFoilsTotal > 0 ? calculatedEftFoilsTotal : '0'}
                  </td>
                  <td colSpan={2} style={{ border: borderBlack, textAlign: 'center', fontSize: '9pt' }}>
                    TOTAL No.
                  </td>
                  <td style={{ border: borderBlack, padding: 0 }}>
                    <input
                      type="text"
                      value={cancelledFoilsTotalNo}
                      onChange={(e) => {
                        setCancelledFoilsTotalNo(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      style={cellInputStyle}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ---------------------------------------------------- */}
            {/* TABLE 2: OTHER ZONE REMITTENCE (Exact 11 data rows)  */}
            {/* ---------------------------------------------------- */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: borderBlack,
              fontSize: '9.5pt',
              tableLayout: 'fixed',
              marginBottom: '18px'
            }}>
              <thead>
                <tr style={{ height: '22px' }}>
                  <th
                    colSpan={7}
                    style={{
                      border: borderBlack,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '2px',
                      textDecoration: 'underline'
                    }}
                  >
                    OTHER ZONE REMITTENCE
                  </th>
                </tr>
                <tr style={{ height: '34px', textAlign: 'center', fontWeight: 700, fontSize: '9pt' }}>
                  <th style={{ border: borderBlack, width: '60px' }}>DATE</th>
                  <th style={{ border: borderBlack, width: '55px' }}>TRNO</th>
                  <th style={{ border: borderBlack, width: '90px' }}>FROM</th>
                  <th style={{ border: borderBlack, width: '90px' }}>TO</th>
                  <th style={{ border: borderBlack, width: '70px', lineHeight: '1.1' }}>
                    NO.OF<br />.EFTS
                  </th>
                  <th style={{ border: borderBlack, width: '75px' }}>AMOUNT</th>
                  <th style={{ border: borderBlack, width: '105px' }}>MR No. / R.STN</th>
                </tr>
              </thead>
              <tbody>
                {otherZoneRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '21px' }}>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateOtherZoneRow(idx, 'date', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.trNo}
                        onChange={(e) => updateOtherZoneRow(idx, 'trNo', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.from}
                        onChange={(e) => updateOtherZoneRow(idx, 'from', e.target.value.toUpperCase())}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.to}
                        onChange={(e) => updateOtherZoneRow(idx, 'to', e.target.value.toUpperCase())}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.noOfEfts}
                        onChange={(e) => updateOtherZoneRow(idx, 'noOfEfts', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.amount}
                        onChange={(e) => updateOtherZoneRow(idx, 'amount', e.target.value)}
                        style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '4px' }}
                      />
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={row.mrNoRStn}
                        onChange={(e) => updateOtherZoneRow(idx, 'mrNoRStn', e.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ height: '22px', fontWeight: 700 }}>
                  <td colSpan={4} style={{ border: borderBlack, textAlign: 'center' }}>
                    TOTAL
                  </td>
                  <td style={{ border: borderBlack, textAlign: 'center' }}>
                    {calculatedOtherZoneEftsTotal > 0 ? calculatedOtherZoneEftsTotal : '0'}
                  </td>
                  <td style={{ border: borderBlack, textAlign: 'right', paddingRight: '6px' }}>
                    {calculatedOtherZoneAmountTotal > 0 ? calculatedOtherZoneAmountTotal.toLocaleString('en-IN') : '0'}
                  </td>
                  <td style={{ border: borderBlack }}></td>
                </tr>
              </tbody>
            </table>

            {/* ---------------------------------------------------- */}
            {/* BOTTOM SECTION: ENCLOSURES (Left) & AMOUNT (Right)   */}
            {/* ---------------------------------------------------- */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.45fr 1fr',
              columnGap: '14px',
              alignItems: 'start'
            }}>
              
              {/* ENCLOSURES BOX */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: borderBlack,
                fontSize: '9pt',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr style={{ height: '20px' }}>
                    <th
                      colSpan={2}
                      style={{
                        border: borderBlack,
                        textAlign: 'left',
                        padding: '2px 4px',
                        fontWeight: 700,
                        textDecoration: 'underline'
                      }}
                    >
                      ENCLOSURES :
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 4px', fontWeight: 700 }}>
                      COM / T-12 EFT ACCOUNT FOILS
                    </td>
                    <td style={{ border: borderBlack, width: '60px', padding: 0 }}>
                      <input
                        type="text"
                        value={enclosures.comT12}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, comT12: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                  </tr>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 4px', fontWeight: 700 }}>
                      No.OF MRs ENCLOSED
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={enclosures.noOfMrs}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, noOfMrs: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                  </tr>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 4px', fontWeight: 700 }}>
                      COM / R-19 EFT RETURNS FORMS
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={enclosures.comR19}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, comR19: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                  </tr>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 4px', fontWeight: 700 }}>
                      OTHER ENCLOSURES IF ANY
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={enclosures.otherEnclosures}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, otherEnclosures: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={cellInputStyle}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* AMOUNT (IN Rs.) BOX */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: borderBlack,
                fontSize: '9pt',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr style={{ height: '20px' }}>
                    <th
                      colSpan={2}
                      style={{
                        border: borderBlack,
                        textAlign: 'center',
                        padding: '2px 4px',
                        fontWeight: 700
                      }}
                    >
                      AMOUNT (IN Rs.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 6px', fontWeight: 700 }}>
                      EFT CASH
                    </td>
                    <td style={{ border: borderBlack, width: '100px', padding: 0 }}>
                      <input
                        type="text"
                        value={amounts.eftCash}
                        onChange={(e) => {
                          setAmounts(prev => ({ ...prev, eftCash: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '6px' }}
                      />
                    </td>
                  </tr>
                  <tr style={{ height: '20px' }}>
                    <td style={{ border: borderBlack, padding: '2px 6px', fontWeight: 700 }}>
                      OTHER CASH
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={amounts.otherCash}
                        onChange={(e) => {
                          setAmounts(prev => ({ ...prev, otherCash: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '6px' }}
                      />
                    </td>
                  </tr>
                  <tr style={{ height: '20px', fontWeight: 700 }}>
                    <td style={{ border: borderBlack, padding: '2px 6px' }}>
                      TOTAL
                    </td>
                    <td style={{ border: borderBlack, padding: 0 }}>
                      <input
                        type="text"
                        value={amounts.total}
                        onChange={(e) => {
                          setAmounts(prev => ({ ...prev, total: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '6px', fontWeight: 700 }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>

            {/* ---------------------------------------------------- */}
            {/* SIGNATURE (BOTTOM RIGHT CORNER)                      */}
            {/* ---------------------------------------------------- */}
            <div style={{
              marginTop: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              textAlign: 'center',
              paddingRight: '10px'
            }}>
              <div style={{ minWidth: '180px' }}>
                {/* Digital Signature image if present */}
                {effectiveSignature && (
                  <div 
                    onClick={() => setShowSignatureModal(true)}
                    style={{ cursor: 'pointer', marginBottom: '2px' }}
                    title="Click to change signature"
                  >
                    <img 
                      src={effectiveSignature} 
                      alt="Signature" 
                      style={{ maxHeight: '55px', maxWidth: '170px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                {/* Name */}
                <input
                  type="text"
                  value={employeeMeta.name}
                  onChange={(e) => {
                    setEmployeeMeta(prev => ({ ...prev, name: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '9.5pt',
                    fontWeight: 700,
                    textAlign: 'center',
                    width: '100%',
                    fontFamily: 'inherit',
                    color: '#000000'
                  }}
                />

                {/* Designation / Depot */}
                <input
                  type="text"
                  value={employeeMeta.designationSign}
                  onChange={(e) => {
                    setEmployeeMeta(prev => ({ ...prev, designationSign: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '9.5pt',
                    fontWeight: 700,
                    textAlign: 'center',
                    width: '100%',
                    fontFamily: 'inherit',
                    color: '#000000'
                  }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Signature Modal */}
      {showSignatureModal && selectedStaffId && (
        <DigitalSignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          staffId={selectedStaffId}
          staffName={employeeMeta.name}
          designation={employeeMeta.designationSign || employeeMeta.designation}
          pfNo={employeeMeta.pfNo}
          currentSignature={employeeMeta.signatureData}
          authToken={authToken}
          onSaveSignature={(newSig) => {
            setEmployeeMeta(prev => ({ ...prev, signatureData: newSig }));
            setHasUnsavedChanges(true);
          }}
        />
      )}

      {/* Print Stylesheet for 1-Page Legal Landscape */}
      <style>{`
        @page {
          size: legal landscape;
          margin: 6mm 8mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, nav, header, footer, .sidebar {
            display: none !important;
          }
          .remittance-doc-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .exact-excel-sheet {
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
          input {
            border: none !important;
            outline: none !important;
          }
        }
      `}</style>

    </div>
  );
}
