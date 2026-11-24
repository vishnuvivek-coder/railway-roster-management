import React, { useState, useEffect, useRef, useCallback } from 'react';
import SearchableStaffSelect from './SearchableStaffSelect';
import DigitalSignatureModal from './DigitalSignatureModal';
import { getDefaultDigitalSignature } from './signatureUtils';
import { printElement, downloadPdfFromElement } from './printUtils';

const API_BASE = '/api';

interface CashRemittanceRow {
  slNo: number | string;
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

  // Document Fields
  const [monthName, setMonthName] = useState('NOVEMBER');
  const [employeeMeta, setEmployeeMeta] = useState<EmployeeMeta>({
    name: 'K V RAMANA RAO',
    designation: 'CTI',
    hqStation: 'GNT',
    pfNo: '',
    billUnit: '',
    designationSign: 'CTI/SL/GNT',
    signatureData: null
  });

  const [cashRows, setCashRows] = useState<CashRemittanceRow[]>([]);
  const [eftFoilsRows, setEftFoilsRows] = useState<FoilRow[]>([]);
  const [cancelledFoilsRows, setCancelledFoilsRows] = useState<FoilRow[]>([]);
  const [otherZoneRows, setOtherZoneRows] = useState<OtherZoneRow[]>([]);
  const [enclosures, setEnclosures] = useState<Enclosures>({
    comT12: '',
    noOfMrs: '',
    comR19: '',
    otherEnclosures: '--'
  });
  const [amounts, setAmounts] = useState<Amounts>({
    eftCash: '0',
    otherCash: '0',
    total: '0'
  });

  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Auto-sum calculations
  const calculateCashTotal = useCallback(() => {
    return cashRows.reduce((sum, r) => {
      const val = parseFloat(r.totalAmount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [cashRows]);

  const calculateEftFoilsTotal = useCallback(() => {
    return eftFoilsRows.reduce((sum, r) => {
      const val = parseInt(r.total, 10);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [eftFoilsRows]);

  const calculateCancelledFoilsTotal = useCallback(() => {
    return cancelledFoilsRows.reduce((sum, r) => {
      const val = parseInt(r.total, 10);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [cancelledFoilsRows]);

  const calculateOtherZoneEftsTotal = useCallback(() => {
    return otherZoneRows.reduce((sum, r) => {
      const val = parseInt(r.noOfEfts, 10);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [otherZoneRows]);

  const calculateOtherZoneAmountTotal = useCallback(() => {
    return otherZoneRows.reduce((sum, r) => {
      const val = parseFloat(r.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [otherZoneRows]);

  // Sync cash totals into Amounts box automatically unless manually overridden
  useEffect(() => {
    const eftCashSum = calculateCashTotal();
    const otherCashSum = calculateOtherZoneAmountTotal();
    setAmounts(prev => ({
      ...prev,
      eftCash: prev.eftCash && prev.eftCash !== '0' && prev.eftCash !== String(eftCashSum) ? prev.eftCash : (eftCashSum > 0 ? String(eftCashSum) : ''),
      otherCash: prev.otherCash && prev.otherCash !== '0' && prev.otherCash !== String(otherCashSum) ? prev.otherCash : (otherCashSum > 0 ? String(otherCashSum) : ''),
      total: String((parseFloat(prev.eftCash) || eftCashSum) + (parseFloat(prev.otherCash) || otherCashSum))
    }));
  }, [cashRows, otherZoneRows, calculateCashTotal, calculateOtherZoneAmountTotal]);

  // Fetch staff list for category
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
        setMonthName(data.monthName || 'NOVEMBER');
        if (data.employeeMeta) setEmployeeMeta(data.employeeMeta);
        if (Array.isArray(data.cashRemittanceRows)) setCashRows(data.cashRemittanceRows);
        if (Array.isArray(data.eftFoilsRows)) setEftFoilsRows(data.eftFoilsRows);
        if (Array.isArray(data.cancelledFoilsRows)) setCancelledFoilsRows(data.cancelledFoilsRows);
        if (Array.isArray(data.otherZoneRows)) setOtherZoneRows(data.otherZoneRows);
        if (data.enclosures) setEnclosures(data.enclosures);
        if (data.amounts) setAmounts(data.amounts);
        setHasUnsavedChanges(false);
      } else {
        setStatusMsg('Failed to load General Summary Cum Remittance.');
      }
    } catch (err: any) {
      console.error('Error fetching remittance document:', err);
      setStatusMsg('Network error loading document.');
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId, year, month, authToken]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Save document
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
          monthName,
          monthYear: monthYearStr,
          employeeMeta,
          cashRemittanceRows: cashRows,
          eftFoilsRows,
          cancelledFoilsRows,
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
          setStatusMsg('✓ Document saved successfully to database.');
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

  // Keyboard shortcut Ctrl+S
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

  // Reset to defaults
  const handleReset = async () => {
    if (!window.confirm('Reset this General Summary Cum Remittance to auto-generated master data? Any unsaved edits will be discarded.')) {
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
        setStatusMsg('✓ Document reset to defaults.');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (e) {
      console.error('Reset error:', e);
    }
  };

  // Row update helpers for Cash Remittance Table
  const updateCashRow = (idx: number, field: keyof CashRemittanceRow, val: any) => {
    setCashRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const addCashRow = () => {
    setCashRows(prev => [
      ...prev,
      { slNo: prev.length + 1, mrNumber: '', date: '', rmtdStn: employeeMeta.hqStation || 'GNT', totalAmount: '' }
    ]);
    setHasUnsavedChanges(true);
  };

  const removeCashRow = (idx: number) => {
    setCashRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, slNo: i + 1 })));
    setHasUnsavedChanges(true);
  };

  // Row update helpers for Foils
  const updateEftFoilRow = (idx: number, field: keyof FoilRow, val: string) => {
    setEftFoilsRows(prev => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: val };
      // Auto compute total if from & to are integers
      if (field === 'from' || field === 'to') {
        const fromNum = parseInt(field === 'from' ? val : updated.from, 10);
        const toNum = parseInt(field === 'to' ? val : updated.to, 10);
        if (!isNaN(fromNum) && !isNaN(toNum) && toNum >= fromNum) {
          updated.total = String(toNum - fromNum + 1);
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

  // Row update helpers for Other Zone Remittance
  const updateOtherZoneRow = (idx: number, field: keyof OtherZoneRow, val: string) => {
    setOtherZoneRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const addOtherZoneRow = () => {
    setOtherZoneRows(prev => [
      ...prev,
      { date: '', trNo: '', from: '', to: '', noOfEfts: '', amount: '', mrNoRStn: '' }
    ]);
    setHasUnsavedChanges(true);
  };

  const removeOtherZoneRow = (idx: number) => {
    setOtherZoneRows(prev => prev.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const selectedStaffObj = staffList.find(s => String(s.id) === String(selectedStaffId));
  const effectiveSignature = employeeMeta.signatureData || getDefaultDigitalSignature(
    employeeMeta.name || selectedStaffObj?.name,
    employeeMeta.designationSign || employeeMeta.designation || selectedStaffObj?.designation,
    employeeMeta.pfNo || selectedStaffObj?.pf_no
  );

  return (
    <div className="remittance-doc-container" style={{ maxWidth: '1380px', margin: '0 auto', padding: '16px' }}>
      
      {/* Top Toolbar (Hidden when Printing) */}
      <div className="no-print" style={{
        background: 'var(--bg-card, #1A1A1D)',
        border: '1px solid var(--border-gold, #D4A15C)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Left: Staff & Month Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!isEmployee && (
            <div style={{ minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#D4A15C', marginBottom: '4px' }}>
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
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#D4A15C', marginBottom: '4px' }}>
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
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '0.88rem',
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
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#D4A15C', marginBottom: '4px' }}>
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
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '0.88rem',
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
            <span style={{ fontSize: '0.85rem', color: statusMsg.includes('✓') ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {statusMsg}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: 700,
              background: hasUnsavedChanges ? 'linear-gradient(135deg, #e5a93c 0%, #d48b1e 100%)' : 'var(--primary, #D4A15C)',
              boxShadow: hasUnsavedChanges ? '0 0 14px rgba(245, 158, 11, 0.6)' : 'none',
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
            onClick={() => printElement('.remittance-sheet-paper', {
              title: `General_Summary_Remittance_${monthName}_${year}`,
              orientation: 'landscape',
              pageFormat: 'legal'
            })}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🖨️ Print Sheet
          </button>

          <button
            type="button"
            onClick={() => downloadPdfFromElement('.remittance-sheet-paper', `General_Summary_Remittance_${monthName}_${year}.pdf`, {
              orientation: 'landscape',
              unit: 'mm',
              format: 'legal'
            })}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Download PDF
          </button>

          <button
            type="button"
            onClick={() => setShowSignatureModal(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.88rem', fontWeight: 600 }}
          >
            ✍️ Signature
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-outline"
            style={{ padding: '8px 12px', fontSize: '0.82rem', color: '#94a3b8' }}
            title="Reset this sheet back to default synchronized data"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Main Official Document Sheet (Paper replica styling) */}
      <div 
        className="remittance-sheet-paper" 
        style={{
          background: '#ffffff',
          color: '#000000',
          padding: '24px 28px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          borderRadius: '4px',
          fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
          minHeight: '1000px',
          border: '1px solid #ccc'
        }}
      >
        {/* Document Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{
            margin: '0 0 6px 0',
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#000000'
          }}>
            GENERAL SUMMARY CUM REMITTENCE OF{' '}
            <input
              type="text"
              value={employeeMeta.name}
              onChange={(e) => {
                setEmployeeMeta(prev => ({ ...prev, name: e.target.value }));
                setHasUnsavedChanges(true);
              }}
              style={{
                border: 'none',
                borderBottom: '1px solid #000',
                outline: 'none',
                fontSize: '1.25rem',
                fontWeight: 800,
                textAlign: 'center',
                minWidth: '220px',
                padding: '0 6px',
                background: 'transparent'
              }}
              title="Click to edit employee name"
            />
          </h2>

          <div style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.3px',
            textTransform: 'uppercase'
          }}>
            FOR THE MONTH OF{' '}
            <input
              type="text"
              value={monthName}
              onChange={(e) => {
                setMonthName(e.target.value.toUpperCase());
                setHasUnsavedChanges(true);
              }}
              style={{
                border: 'none',
                borderBottom: '1px solid #000',
                outline: 'none',
                fontSize: '1rem',
                fontWeight: 700,
                textAlign: 'center',
                width: '140px',
                padding: '0 4px',
                background: 'transparent'
              }}
              title="Click to edit month name"
            />
            {' '}-{year}
          </div>
        </div>

        {/* Two-Column Document Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.35fr',
          gap: '16px',
          alignItems: 'start'
        }}>
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: CASH REMITTENCE PARTICULARS                 */}
          {/* ======================================================== */}
          <div>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '2px solid #000',
              fontSize: '0.82rem',
              textAlign: 'center'
            }}>
              <thead>
                <tr style={{ background: '#f1f1f1' }}>
                  <th
                    colSpan={5}
                    style={{
                      border: '1.5px solid #000',
                      padding: '6px 4px',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}
                  >
                    CASH REMITTENCE PARTICULARS
                  </th>
                </tr>
                <tr style={{ background: '#fafafa', fontWeight: 700, fontSize: '0.78rem' }}>
                  <th style={{ border: '1px solid #000', padding: '6px 2px', width: '45px' }}>SL. No.</th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '130px' }}>MONEY RECEIPT NUMBER</th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '85px' }}>DATE</th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '75px' }}>RMTD. STN</th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '90px' }}>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {cashRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '26px' }}>
                    <td style={{ border: '1px solid #000', padding: '2px', fontWeight: 600 }}>
                      <input
                        type="text"
                        value={row.slNo}
                        onChange={(e) => updateCashRow(idx, 'slNo', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.mrNumber}
                        onChange={(e) => updateCashRow(idx, 'mrNumber', e.target.value)}
                        placeholder="MR / EFT No."
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.8rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateCashRow(idx, 'date', e.target.value)}
                        placeholder="DD-MM-YYYY"
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.8rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.rmtdStn}
                        onChange={(e) => updateCashRow(idx, 'rmtdStn', e.target.value.toUpperCase())}
                        placeholder="STN"
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right' }}>
                      <input
                        type="text"
                        value={row.totalAmount}
                        onChange={(e) => updateCashRow(idx, 'totalAmount', e.target.value)}
                        placeholder="0.00"
                        style={{ width: '100%', border: 'none', textAlign: 'right', paddingRight: '6px', background: 'transparent', outline: 'none', fontSize: '0.82rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ background: '#f8f8f8', fontWeight: 800, height: '32px' }}>
                  <td colSpan={4} style={{ border: '1.5px solid #000', textAlign: 'center', padding: '6px', letterSpacing: '1px' }}>
                    TOTAL:
                  </td>
                  <td style={{ border: '1.5px solid #000', textAlign: 'right', padding: '6px 8px', fontSize: '0.92rem' }}>
                    {calculateCashTotal().toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Quick Row Controls (Hidden in Print) */}
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={addCashRow}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #aaa',
                  background: '#f8fafc',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Add Cash Row
              </button>
              {cashRows.length > 5 && (
                <button
                  type="button"
                  onClick={() => removeCashRow(cashRows.length - 1)}
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ef4444',
                    background: '#fef2f2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  - Remove Last Row
                </button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: EFT FOILS, OTHER ZONE, ENCLOSURES, TOTALS  */}
          {/* ======================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Top Right Table: EFT FOILS USED & CANCELLED FOILES */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '2px solid #000',
              fontSize: '0.8rem',
              textAlign: 'center'
            }}>
              <thead>
                <tr style={{ background: '#f1f1f1' }}>
                  <th colSpan={3} style={{ border: '1.5px solid #000', padding: '5px', fontWeight: 800 }}>
                    EFT FOILS USED
                  </th>
                  <th colSpan={3} style={{ border: '1.5px solid #000', padding: '5px', fontWeight: 800 }}>
                    CANCELLED FOILES
                  </th>
                </tr>
                <tr style={{ background: '#fafafa', fontWeight: 700, fontSize: '0.76rem' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '18%' }}>FROM</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '18%' }}>TO</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '14%' }}>TOTAL</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '18%' }}>FROM</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '18%' }}>TO</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '14%' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(eftFoilsRows.length, cancelledFoilsRows.length) }).map((_, idx) => {
                  const used = eftFoilsRows[idx] || { from: '', to: '', total: '' };
                  const canc = cancelledFoilsRows[idx] || { from: '', to: '', total: '' };
                  return (
                    <tr key={idx} style={{ height: '24px' }}>
                      {/* EFT Foils Used */}
                      <td style={{ border: '1px solid #000', padding: '2px' }}>
                        <input
                          type="text"
                          value={used.from}
                          onChange={(e) => updateEftFoilRow(idx, 'from', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px' }}>
                        <input
                          type="text"
                          value={used.to}
                          onChange={(e) => updateEftFoilRow(idx, 'to', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px', fontWeight: 600 }}>
                        <input
                          type="text"
                          value={used.total}
                          onChange={(e) => updateEftFoilRow(idx, 'total', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem', fontWeight: 600 }}
                        />
                      </td>

                      {/* Cancelled Foils */}
                      <td style={{ border: '1px solid #000', padding: '2px' }}>
                        <input
                          type="text"
                          value={canc.from}
                          onChange={(e) => updateCancelledFoilRow(idx, 'from', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px' }}>
                        <input
                          type="text"
                          value={canc.to}
                          onChange={(e) => updateCancelledFoilRow(idx, 'to', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px', fontWeight: 600 }}>
                        <input
                          type="text"
                          value={canc.total}
                          onChange={(e) => updateCancelledFoilRow(idx, 'total', e.target.value)}
                          style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.78rem', fontWeight: 600 }}
                        />
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr style={{ background: '#f8f8f8', fontWeight: 800, height: '28px' }}>
                  <td colSpan={2} style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.76rem' }}>
                    TOTAL No. Of. EFT FOILS.
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}>
                    {calculateEftFoilsTotal()}
                  </td>
                  <td colSpan={2} style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.76rem' }}>
                    TOTAL No.
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}>
                    {calculateCancelledFoilsTotal()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Middle Right Table: OTHER ZONE REMITTENCE */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '2px solid #000',
              fontSize: '0.78rem',
              textAlign: 'center'
            }}>
              <thead>
                <tr style={{ background: '#f1f1f1' }}>
                  <th colSpan={7} style={{ border: '1.5px solid #000', padding: '5px', fontWeight: 800 }}>
                    OTHER ZONE REMITTENCE
                  </th>
                </tr>
                <tr style={{ background: '#fafafa', fontWeight: 700, fontSize: '0.74rem' }}>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '14%' }}>DATE</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '14%' }}>TRNO</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '12%' }}>FROM</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '12%' }}>TO</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '14%' }}>NO.OF .EFTS</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '16%' }}>AMOUNT</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '18%' }}>MR No. / R.STN</th>
                </tr>
              </thead>
              <tbody>
                {otherZoneRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '24px' }}>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateOtherZoneRow(idx, 'date', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.trNo}
                        onChange={(e) => updateOtherZoneRow(idx, 'trNo', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.from}
                        onChange={(e) => updateOtherZoneRow(idx, 'from', e.target.value.toUpperCase())}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.to}
                        onChange={(e) => updateOtherZoneRow(idx, 'to', e.target.value.toUpperCase())}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.noOfEfts}
                        onChange={(e) => updateOtherZoneRow(idx, 'noOfEfts', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.amount}
                        onChange={(e) => updateOtherZoneRow(idx, 'amount', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'right', paddingRight: '4px', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={row.mrNoRStn}
                        onChange={(e) => updateOtherZoneRow(idx, 'mrNoRStn', e.target.value)}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem' }}
                      />
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ background: '#f8f8f8', fontWeight: 800, height: '28px' }}>
                  <td colSpan={4} style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.76rem' }}>
                    TOTAL
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}>
                    {calculateOtherZoneEftsTotal()}
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '4px', textAlign: 'right', paddingRight: '6px', fontSize: '0.85rem' }}>
                    {calculateOtherZoneAmountTotal().toLocaleString('en-IN')}
                  </td>
                  <td style={{ border: '1.5px solid #000' }}></td>
                </tr>
              </tbody>
            </table>

            {/* Quick Row Controls for Other Zone (Hidden in Print) */}
            <div className="no-print" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginTop: '-4px' }}>
              <button
                type="button"
                onClick={addOtherZoneRow}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #aaa',
                  background: '#f8fafc',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Add Other Zone Row
              </button>
              {otherZoneRows.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOtherZoneRow(otherZoneRows.length - 1)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ef4444',
                    background: '#fef2f2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  - Remove Row
                </button>
              )}
            </div>

            {/* Bottom Right Split: ENCLOSURES & AMOUNT (IN Rs.) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '12px', marginTop: '4px' }}>
              
              {/* Enclosures Table */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                fontSize: '0.75rem'
              }}>
                <thead>
                  <tr style={{ background: '#f1f1f1' }}>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '5px', textAlign: 'left', fontWeight: 800 }}>
                      ENCLOSURES :
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 600 }}>COM / T-12 EFT ACCOUNT FOILS</td>
                    <td style={{ border: '1px solid #000', padding: '2px', width: '60px' }}>
                      <input
                        type="text"
                        value={enclosures.comT12}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, comT12: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 600 }}>No.OF MRs ENCLOSED</td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={enclosures.noOfMrs}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, noOfMrs: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 600 }}>COM / R-19 EFT RETURNS FORMS</td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={enclosures.comR19}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, comR19: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 600 }}>OTHER ENCLOSURES IF ANY</td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}>
                      <input
                        type="text"
                        value={enclosures.otherEnclosures}
                        onChange={(e) => {
                          setEnclosures(prev => ({ ...prev, otherEnclosures: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none', fontSize: '0.76rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount (In Rs.) Table */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                fontSize: '0.76rem'
              }}>
                <thead>
                  <tr style={{ background: '#f1f1f1' }}>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 800 }}>
                      AMOUNT (IN Rs.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 700 }}>EFT CASH</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right' }}>
                      <input
                        type="text"
                        value={amounts.eftCash}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAmounts(prev => ({
                            ...prev,
                            eftCash: val,
                            total: String((parseFloat(val) || 0) + (parseFloat(prev.otherCash) || 0))
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'right', paddingRight: '6px', background: 'transparent', outline: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 700 }}>OTHER CASH</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right' }}>
                      <input
                        type="text"
                        value={amounts.otherCash}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAmounts(prev => ({
                            ...prev,
                            otherCash: val,
                            total: String((parseFloat(prev.eftCash) || 0) + (parseFloat(val) || 0))
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%', border: 'none', textAlign: 'right', paddingRight: '6px', background: 'transparent', outline: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                  <tr style={{ background: '#f8f8f8', fontWeight: 800 }}>
                    <td style={{ border: '1.5px solid #000', padding: '6px 8px' }}>TOTAL</td>
                    <td style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'right', fontSize: '0.88rem' }}>
                      {parseFloat(amounts.total || '0').toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Right Signature Block */}
            <div style={{
              marginTop: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              paddingRight: '20px'
            }}>
              <div style={{ minWidth: '220px', textAlign: 'center' }}>
                
                {/* Signature Graphic / Digital Stamp */}
                <div 
                  onClick={() => setShowSignatureModal(true)}
                  style={{
                    cursor: 'pointer',
                    minHeight: '65px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px'
                  }}
                  title="Click to sign or update digital signature"
                >
                  {effectiveSignature ? (
                    <img 
                      src={effectiveSignature} 
                      alt="Digital Signature" 
                      style={{ maxHeight: '65px', maxWidth: '200px', objectFit: 'contain' }} 
                    />
                  ) : (
                    <div style={{ border: '1px dashed #999', padding: '8px 16px', fontSize: '0.78rem', color: '#666', borderRadius: '4px' }}>
                      ✍️ Click to Sign
                    </div>
                  )}
                </div>

                {/* Staff Name & Designation */}
                <div style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.5px' }}>
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
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      width: '100%',
                      background: 'transparent'
                    }}
                  />
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#222' }}>
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
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      width: '100%',
                      background: 'transparent',
                      color: '#222'
                    }}
                  />
                </div>
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

      {/* Print Stylesheet for LEGAL LANDSCAPE / A4 LANDSCAPE */}
      <style>{`
        @page {
          size: legal landscape;
          margin: 8mm 10mm;
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
          .remittance-sheet-paper {
            box-shadow: none !important;
            border: none !important;
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
