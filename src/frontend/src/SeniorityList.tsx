import React, { useState, useEffect, useMemo } from 'react';

const TIER_MAP: Record<string, number> = {
  'CTI': 1,
  'TTI': 2,
  'SRTE': 3,
  'Sr.CCTC': 4,
  'SRCCTC': 4,
  'CCTC': 5
};

export interface SeniorityEmployee {
  id?: number;
  sl_no: number;
  name: string;
  designation: string;
  working_designation?: string;
  desg_rank?: number | null;
  hierarchy_tier?: number | null;
  cug_number?: string;
  contact_number?: string;
  pf_number?: string;
  email?: string;
  [key: string]: any;
}

export interface SeniorityListProps {
  API_BASE?: string;
  authToken?: string | null;
  isAdmin?: boolean;
}

export default function SeniorityList({ API_BASE = '/api', authToken, isAdmin }: SeniorityListProps) {
  const [seniorityList, setSeniorityList] = useState<SeniorityEmployee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [desgFilter, setDesgFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'hierarchy' | 'sl_no'>('hierarchy');

  // Add / Edit Modal State
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<SeniorityEmployee | null>(null);
  const [formSlNo, setFormSlNo] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDesignation, setFormDesignation] = useState<string>('CTI');
  const [formWorkingDesignation, setFormWorkingDesignation] = useState<string>('CTI');
  const [formCug, setFormCug] = useState<string>('');
  const [formContact, setFormContact] = useState<string>('');
  const [formPf, setFormPf] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<SeniorityEmployee | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast Banner State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Determine admin privileges
  const isActuallyAdmin = useMemo(() => {
    if (isAdmin !== undefined) return isAdmin;
    try {
      const u = localStorage.getItem('railway_user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed?.role === 'Admin';
      }
    } catch (e) {}
    return true;
  }, [isAdmin]);

  const getAuthHeaders = () => {
    const token = authToken || localStorage.getItem('railway_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const fetchSeniority = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/seniority-list`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`Failed to fetch seniority list: ${res.statusText}`);
      const data = await res.json();
      setSeniorityList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching seniority list:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeniority();
  }, []);

  // Compute within-designation rank map
  const desgCounters = useMemo(() => {
    const counts: Record<string, number> = {};
    const rankMap = new Map<number, number>();
    const sorted = [...seniorityList].sort((a, b) => a.sl_no - b.sl_no);
    sorted.forEach((item) => {
      const d = item.designation || 'OTHER';
      counts[d] = (counts[d] || 0) + 1;
      rankMap.set(item.sl_no, counts[d]);
    });
    return { counts, rankMap };
  }, [seniorityList]);

  // Filtered and Sorted list
  const filteredList = useMemo(() => {
    let list = seniorityList.filter((item) => {
      const isChandrika = item.name && item.name.includes('CHANDRIKA');
      if (desgFilter !== 'ALL') {
        if (desgFilter === 'TTI') {
          if (item.designation !== 'TTI' && !isChandrika) return false;
        } else if (desgFilter === 'COR') {
          if (item.designation !== 'COR' || isChandrika) return false;
        } else if (item.designation !== desgFilter) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const desgRank = item.desg_rank != null ? item.desg_rank : (desgCounters.rankMap.get(item.sl_no) || '');
      return (
        String(item.sl_no).includes(q) ||
        String(desgRank).includes(q) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.designation && item.designation.toLowerCase().includes(q)) ||
        (item.working_designation && item.working_designation.toLowerCase().includes(q)) ||
        (isChandrika && (q === 'tti' || q === 'cor')) ||
        (item.cug_number && item.cug_number.toLowerCase().includes(q)) ||
        (item.contact_number && item.contact_number.toLowerCase().includes(q)) ||
        (item.pf_number && item.pf_number.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'hierarchy') {
        const tierA = a.hierarchy_tier || TIER_MAP[a.designation] || 999;
        const tierB = b.hierarchy_tier || TIER_MAP[b.designation] || 999;
        if (tierA !== tierB) return tierA - tierB;
        const rankA = a.desg_rank != null ? a.desg_rank : (desgCounters.rankMap.get(a.sl_no) || a.sl_no);
        const rankB = b.desg_rank != null ? b.desg_rank : (desgCounters.rankMap.get(b.sl_no) || b.sl_no);
        return rankA - rankB;
      }
      return a.sl_no - b.sl_no;
    });

    return list;
  }, [seniorityList, desgFilter, searchQuery, sortBy, desgCounters]);

  // Designation counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: seniorityList.length };
    seniorityList.forEach((item) => {
      const d = item.designation || 'OTHER';
      c[d] = (c[d] || 0) + 1;
    });
    return c;
  }, [seniorityList]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    let csv = 'Official Seniority Rank,Name of Employee,Designation,Rank in Designation,Designation Hierarchy Priority,CUG Number,Contact Number,PF Number,Email ID\n';
    filteredList.forEach((item) => {
      const rankInDesg = item.desg_rank != null ? item.desg_rank : (desgCounters.rankMap.get(item.sl_no) || '');
      const tier = item.hierarchy_tier || TIER_MAP[item.designation] || '';
      csv += `"${item.sl_no}","${item.name || ''}","${item.designation || ''}","${item.designation} #${rankInDesg}","${tier}","${item.cug_number || ''}","${item.contact_number || ''}","${item.pf_number || ''}","${item.email || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Seniority_List_Guntur_Division_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDesgBadgeStyle = (desg: string): React.CSSProperties => {
    switch (desg) {
      case 'CTI':
        return { background: 'rgba(217, 119, 6, 0.18)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
      case 'TTI':
        return { background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)' };
      case 'SRTE':
        return { background: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.4)' };
      case 'Sr.CCTC':
      case 'SRCCTC':
        return { background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' };
      case 'CCTC':
        return { background: 'rgba(236, 72, 153, 0.18)', color: '#f472b6', border: '1px solid rgba(244, 114, 182, 0.4)' };
      default:
        return { background: 'rgba(156, 163, 175, 0.18)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.4)' };
    }
  };

  // Open Modal in ADD Mode
  const handleOpenAdd = () => {
    const maxSl = seniorityList.reduce((max, e) => (e.sl_no > max ? e.sl_no : max), 0);
    setFormSlNo(String(maxSl + 1));
    setFormName('');
    setFormDesignation('CTI');
    setFormWorkingDesignation('CTI');
    setFormCug('');
    setFormContact('');
    setFormPf('');
    setFormEmail('');
    setModalError(null);
    setSelectedEmp(null);
    setModalMode('ADD');
  };

  // Open Modal in EDIT Mode
  const handleOpenEdit = (emp: SeniorityEmployee) => {
    setFormSlNo(String(emp.sl_no));
    setFormName(emp.name || '');
    setFormDesignation(emp.designation || 'CTI');
    setFormWorkingDesignation(emp.working_designation || emp.designation || 'CTI');
    setFormCug(emp.cug_number && emp.cug_number !== '--' ? emp.cug_number : '');
    setFormContact(emp.contact_number && emp.contact_number !== '--' ? emp.contact_number : '');
    setFormPf(emp.pf_number && emp.pf_number !== '--' ? emp.pf_number : '');
    setFormEmail(emp.email && emp.email !== '--' && emp.email !== '=' ? emp.email : '');
    setModalError(null);
    setSelectedEmp(emp);
    setModalMode('EDIT');
  };

  // Submit Add or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError('Employee name is required');
      return;
    }
    if (!formDesignation.trim()) {
      setModalError('Designation is required');
      return;
    }

    const payload = {
      sl_no: formSlNo ? parseInt(formSlNo, 10) : undefined,
      name: formName.trim().toUpperCase(),
      designation: formDesignation.trim(),
      working_designation: formWorkingDesignation.trim() || formDesignation.trim(),
      cug_number: formCug.trim() || '--',
      contact_number: formContact.trim() || '--',
      pf_number: formPf.trim() || '',
      email: formEmail.trim() || '--'
    };

    try {
      setIsSubmitting(true);
      setModalError(null);

      const url =
        modalMode === 'ADD'
          ? `${API_BASE}/seniority-list`
          : `${API_BASE}/seniority-list/${selectedEmp?.id || selectedEmp?.sl_no}`;
      const method = modalMode === 'ADD' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${modalMode === 'ADD' ? 'add' : 'update'} employee`);
      }

      showToast(
        modalMode === 'ADD'
          ? `🎉 Successfully added ${payload.name} (SL #${payload.sl_no || 'Auto'}) to Seniority List!`
          : `✅ Successfully updated details for ${payload.name}!`,
        'success'
      );
      setModalMode(null);
      setSelectedEmp(null);
      await fetchSeniority();
    } catch (err: any) {
      console.error('Save seniority employee error:', err);
      setModalError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmEmp) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${API_BASE}/seniority-list/${deleteConfirmEmp.id || deleteConfirmEmp.sl_no}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete employee from seniority list');
      }

      showToast(`🗑️ Removed ${deleteConfirmEmp.name} (SL #${deleteConfirmEmp.sl_no}) from Seniority List`, 'success');
      setDeleteConfirmEmp(null);
      await fetchSeniority();
    } catch (err: any) {
      console.error('Delete seniority employee error:', err);
      showToast(err.message || 'Failed to delete employee', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="seniority-container" style={{ padding: '0 4px' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '14px 20px',
            borderRadius: '12px',
            background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.92rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            animation: 'slideInRight 0.3s ease'
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '1.1rem',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div
        className="card"
        style={{
          padding: '20px',
          marginBottom: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Seniority List
            </h2>
            <span
              className="badge"
              style={{
                background: 'var(--primary-glow)',
                color: 'var(--primary)',
                fontWeight: 800,
                fontSize: '0.82rem',
                padding: '4px 10px',
                borderRadius: '8px'
              }}
            >
              {seniorityList.length} Total Staff
            </span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 0 0', fontSize: '0.88rem' }}>
            Basic Data of Ticket Checking Staff - Guntur Division (South Coast Railway)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Add Employee Button */}
          {isActuallyAdmin && (
            <button
              type="button"
              className="btn btn-primary no-print"
              onClick={handleOpenAdd}
              title="Add a new employee to the official Seniority List"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                padding: '8px 16px',
                fontWeight: 800,
                borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '1rem' }}>➕</span> Add Employee
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchSeniority}
            title="Refresh list"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 14px' }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 14px' }}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              padding: '8px 14px'
            }}
          >
            Download / Print
          </button>
        </div>
      </div>

      {/* Designation Hierarchy Priority Banner */}
      <div
        style={{
          padding: '12px 18px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(168, 85, 247, 0.08))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#60a5fa', fontSize: '0.92rem' }}>Seniority Hierarchy:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.85rem', fontWeight: 700 }}>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(217, 119, 6, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
              1. CTI
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)' }}>
              2. TTI
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.4)' }}>
              3. SRTE
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
              4. Sr.CCTC (SRCCTC)
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(244, 114, 182, 0.4)' }}>
              5. CCTC
            </span>
          </div>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          <em>Seniority evaluated within same designation &amp; compared across designations by hierarchy priority</em>
        </div>
      </div>

      {/* Designation Filter Pills, Search & Sort Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['ALL', 'CTI', 'TTI', 'SRTE', 'Sr.CCTC', 'CCTC'].map((desg) => (
            <button
              key={desg}
              type="button"
              onClick={() => setDesgFilter(desg)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: desgFilter === desg ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                background: desgFilter === desg ? 'var(--primary)' : 'var(--bg-secondary)',
                color: desgFilter === desg ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: desgFilter === desg ? '0 2px 8px var(--primary-glow)' : 'none'
              }}
            >
              {desg} ({counts[desg] || 0})
            </button>
          ))}
        </div>

        {/* Search Bar & Sort Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end' }}>
          {/* Sort Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              onClick={() => setSortBy('hierarchy')}
              title="Sort by Designation Hierarchy (1. CTI > 2. TTI > 3. SRTE > 4. Sr.CCTC > 5. CCTC)"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: 'none',
                fontWeight: 700,
                background: sortBy === 'hierarchy' ? 'var(--primary)' : 'transparent',
                color: sortBy === 'hierarchy' ? '#fff' : 'var(--color-text-secondary)'
              }}
            >
              Hierarchy
            </button>
            <button
              type="button"
              onClick={() => setSortBy('sl_no')}
              title="Sort by Official List SL NO (1-139)"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: 'none',
                fontWeight: 700,
                background: sortBy === 'sl_no' ? 'var(--primary)' : 'transparent',
                color: sortBy === 'sl_no' ? '#fff' : 'var(--color-text-secondary)'
              }}
            >
              Sl No (1-139)
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name, rank, PF, CUG..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingRight: searchQuery ? '36px' : '14px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                fontSize: '0.86rem',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="spinner-container" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <span style={{ marginLeft: '12px', color: 'var(--color-text-secondary)' }}>Loading Seniority List...</span>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid #ef4444' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>{error}</p>
          <button type="button" className="btn btn-primary" onClick={fetchSeniority} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      ) : (
        /* Seniority Table */
        <div
          className="table-responsive seniority-table-container"
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            overflowX: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}
        >
          <table className="roster-table seniority-table" style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#18181b' }}>
                <th className="seniority-col-rank" style={{ width: '70px', textAlign: 'center', padding: '12px 6px' }}>
                  SL NO.
                </th>
                <th className="seniority-col-name" style={{ width: '230px', textAlign: 'left', padding: '12px 14px' }}>
                  NAME OF THE EMPLOYEE
                </th>
                <th style={{ width: '90px', textAlign: 'center', padding: '12px 8px' }}>DESG.</th>
                <th style={{ width: '110px', textAlign: 'center', padding: '12px 8px' }}>DESG. RANK</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CUG NUMBER</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CONTACT NUMBER</th>
                <th style={{ width: '140px', textAlign: 'center', padding: '12px 8px' }}>PF NUMBER</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>E-MAIL ID</th>
                <th className="no-print" style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    No employees match your search query: "<strong>{searchQuery}</strong>"
                  </td>
                </tr>
              ) : (
                filteredList.map((emp) => {
                  const desgStyle = getDesgBadgeStyle(emp.designation);
                  const rankInDesg = emp.desg_rank != null ? emp.desg_rank : (desgCounters.rankMap.get(emp.sl_no) || '-');
                  return (
                    <tr key={emp.id || emp.sl_no} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.15s ease' }}>
                      {/* Rank / SL NO */}
                      <td className="seniority-col-rank" style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 800 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '32px',
                            height: '32px',
                            lineHeight: '32px',
                            borderRadius: '8px',
                            background:
                              emp.sl_no <= 10
                                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))'
                                : 'rgba(255, 255, 255, 0.05)',
                            color: emp.sl_no <= 10 ? '#f59e0b' : 'var(--color-text-primary)',
                            border: emp.sl_no <= 10 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-glass)',
                            fontSize: '0.84rem'
                          }}
                        >
                          {emp.sl_no}
                        </span>
                      </td>

                      {/* Employee Name */}
                      <td className="seniority-col-name" style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)' }}>
                        <span
                          style={{ fontSize: '0.92rem', cursor: isActuallyAdmin ? 'pointer' : 'default' }}
                          onClick={() => isActuallyAdmin && handleOpenEdit(emp)}
                          title={isActuallyAdmin ? `Click to edit info for ${emp.name}` : undefined}
                        >
                          {emp.name}
                        </span>
                        {emp.name && emp.name.includes('CHANDRIKA') && (
                          <span
                            className="badge no-print"
                            title="Kept in TTI list (not in COR list) for working purpose only"
                            style={{
                              background: 'rgba(59, 130, 246, 0.18)',
                              color: '#60a5fa',
                              border: '1px solid rgba(96, 165, 250, 0.4)',
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              marginLeft: '8px',
                              fontWeight: 700
                            }}
                          >
                            Working in TTI (not in COR)
                          </span>
                        )}
                      </td>

                      {/* Designation */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            ...desgStyle
                          }}
                        >
                          {emp.designation}
                        </span>
                        {emp.working_designation && emp.working_designation !== emp.designation && (
                          <span style={{ fontSize: '0.7rem', color: '#60a5fa', display: 'block', marginTop: '3px', fontWeight: 700 }}>
                            Role: {emp.working_designation}
                          </span>
                        )}
                      </td>

                      {/* Rank in Designation */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--border-glass)'
                          }}
                        >
                          #{rankInDesg}
                        </span>
                      </td>

                      {/* CUG Number */}
                      <td
                        style={{
                          textAlign: 'center',
                          padding: '10px 8px',
                          fontSize: '0.86rem',
                          color: emp.cug_number && emp.cug_number !== '--' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
                        }}
                      >
                        {emp.cug_number && emp.cug_number !== '--' ? (
                          <a href={`tel:${emp.cug_number}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {emp.cug_number}
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* Contact Number */}
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.86rem' }}>
                        {emp.contact_number && emp.contact_number !== '--' ? (
                          <a href={`tel:${emp.contact_number}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                            {emp.contact_number}
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* PF Number */}
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'monospace', fontSize: '0.88rem', color: '#a78bfa' }}>
                        {emp.pf_number || '--'}
                      </td>

                      {/* Email */}
                      <td style={{ padding: '10px 14px', fontSize: '0.84rem' }}>
                        {emp.email && emp.email !== '--' && emp.email !== '=' ? (
                          <a href={`mailto:${emp.email}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                            {emp.email}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>--</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="no-print" style={{ textAlign: 'center', padding: '8px 6px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleOpenEdit(emp)}
                          title={`Edit info for ${emp.name}`}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            marginRight: '6px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        {isActuallyAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeleteConfirmEmp(emp)}
                            title={`Remove ${emp.name} from Seniority List`}
                            style={{
                              padding: '4px 9px',
                              fontSize: '0.78rem',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '6px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {modalMode && (
        <div
          className="modal-overlay no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setModalMode(null);
          }}
        >
          <div
            className="modal-content card"
            style={{
              background: '#18181b',
              border: '1px solid var(--border-glass)',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              padding: '24px 28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              animation: 'modalFadeIn 0.2s ease',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-glass)',
                paddingBottom: '16px',
                marginBottom: '20px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {modalMode === 'ADD' ? '➕ Add Employee to Seniority List' : `✏️ Edit Seniority Info: ${selectedEmp?.name || ''}`}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  {modalMode === 'ADD'
                    ? 'Enter official details to place employee in division seniority cadre'
                    : `Updating records for Seniority Rank #${selectedEmp?.sl_no} (${selectedEmp?.designation})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setModalMode(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.1rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {modalError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  marginBottom: '16px'
                }}
              >
                ⚠️ {modalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitForm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Seniority SL NO */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    Seniority Rank (SL NO.)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={formSlNo}
                    onChange={(e) => setFormSlNo(e.target.value)}
                    placeholder="e.g. 140"
                    min="1"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <small style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                    {modalMode === 'ADD' ? 'Auto-assigned if omitted' : 'Adjusting shifts colliding ranks'}
                  </small>
                </div>

                {/* Designation */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    Official Cadre Designation *
                  </label>
                  <select
                    className="form-input"
                    value={formDesignation}
                    onChange={(e) => {
                      setFormDesignation(e.target.value);
                      if (formWorkingDesignation === formDesignation) {
                        setFormWorkingDesignation(e.target.value);
                      }
                    }}
                    style={{
                      width: '100%',
                      background: '#27272a',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <option value="CTI">CTI - Chief Ticket Inspector (Tier 1)</option>
                    <option value="TTI">TTI - Travelling Ticket Examiner (Tier 2)</option>
                    <option value="SRTE">SRTE - Senior Ticket Examiner (Tier 3)</option>
                    <option value="Sr.CCTC">Sr.CCTC - Senior Commercial Clerk (Tier 4)</option>
                    <option value="CCTC">CCTC - Commercial Clerk (Tier 5)</option>
                  </select>
                  <small style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                    Determines hierarchy priority
                  </small>
                </div>
              </div>

              {/* Employee Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  Employee Full Name (Official Railway Records) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value.toUpperCase())}
                  placeholder="e.g. K RAMANAIAH"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '8px',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Working Designation */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    Working Designation (Duty Role)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formWorkingDesignation}
                    onChange={(e) => setFormWorkingDesignation(e.target.value)}
                    placeholder="e.g. TTI or CTI"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                  />
                  <small style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                    Set if working role differs from cadre
                  </small>
                </div>

                {/* PF Number / HRMS ID */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    PF Number / HRMS ID
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formPf}
                    onChange={(e) => setFormPf(e.target.value)}
                    placeholder="e.g. 24609276830"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <small style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                    Syncs with Staff Directory
                  </small>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* CUG Mobile Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    Official CUG Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formCug}
                    onChange={(e) => setFormCug(e.target.value)}
                    placeholder="e.g. 9701379965"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    Personal Contact Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="e.g. 9440123456"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. employee@scr.railnet.gov.in"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Footer Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '18px'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                  style={{ padding: '8px 18px', fontSize: '0.88rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 22px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    background:
                      modalMode === 'ADD'
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      Saving...
                    </>
                  ) : modalMode === 'ADD' ? (
                    '➕ Add Employee'
                  ) : (
                    '💾 Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmEmp && (
        <div
          className="modal-overlay no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteConfirmEmp(null);
          }}
        >
          <div
            className="modal-content card"
            style={{
              background: '#18181b',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>Confirm Removal</h3>
            </div>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Are you sure you want to remove <strong>{deleteConfirmEmp.name}</strong> (SL #{deleteConfirmEmp.sl_no},{' '}
              {deleteConfirmEmp.designation}) from the Seniority List?
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', margin: '0 0 20px 0' }}>
              Subsequent seniority serial numbers and designation ranks will automatically re-index.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmEmp(null)}
                disabled={isDeleting}
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                {isDeleting ? 'Deleting...' : '🗑️ Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
