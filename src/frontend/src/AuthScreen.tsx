import React, { useState, useEffect, useRef } from 'react';

const API_BASE = '/api';

export interface UserInfo {
  id: number | string;
  username: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

export interface AuthScreenProps {
  onLoginSuccess: (user: UserInfo, token: string) => void;
}

interface StaffVerificationResult {
  exists: boolean;
  name: string;
  designation: string;
  pf_no: string;
  category_id?: number | string;
  has_pin: boolean;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  // Tabs: 'employee' (default for 99% of users) or 'admin'
  const [loginMode, setLoginMode] = useState<'employee' | 'admin'>('employee');

  // Employee Flow Steps: 'enter_pf' | 'enter_pin' | 'setup_pin'
  const [staffStep, setStaffStep] = useState<'enter_pf' | 'enter_pin' | 'setup_pin'>('enter_pf');
  const [staffPf, setStaffPf] = useState(() => {
    try {
      return localStorage.getItem('railway_saved_pf') || '';
    } catch (e) {
      return '';
    }
  });
  const [verifiedStaff, setVerifiedStaff] = useState<StaffVerificationResult | null>(null);

  // PIN inputs
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Admin form
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);

  // Device settings
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');

  const pinInputRef = useRef<HTMLInputElement>(null);
  const newPinInputRef = useRef<HTMLInputElement>(null);

  // Focus PIN input automatically when moving to PIN step
  useEffect(() => {
    if (staffStep === 'enter_pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    } else if (staffStep === 'setup_pin' && newPinInputRef.current) {
      newPinInputRef.current.focus();
    }
  }, [staffStep]);

  // STEP 1: Verify PF Number
  const handleCheckPf = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPf = staffPf.trim();
    if (!cleanPf) {
      setErrorMessage('Please enter your Railway PF Number or HRMS ID.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessNotice('');

    try {
      const res = await fetch(`${API_BASE}/auth/check-pf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pf_no: cleanPf })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Railway PF Number not found in division seniority register.');
        setLoading(false);
        return;
      }

      setVerifiedStaff(data);
      if (rememberMe) {
        try { localStorage.setItem('railway_saved_pf', cleanPf.toUpperCase()); } catch (err) {}
      }

      // Route to PIN entry if PIN exists, or PIN setup if new
      if (data.has_pin) {
        setStaffStep('enter_pin');
      } else {
        setStaffStep('setup_pin');
      }
      setLoading(false);
    } catch (err: any) {
      setErrorMessage('Network error checking PF Number. Please verify connection.');
      setLoading(false);
    }
  };

  // STEP 2A: Verify 4-Digit PIN & Log In
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStaff) return;

    if (!/^\d{4}$/.test(pin.trim())) {
      setErrorMessage('Please enter your 4-digit PIN (digits 0-9).');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: verifiedStaff.pf_no,
          pin: pin.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Incorrect 4-digit PIN. Please try again.');
        setLoading(false);
        return;
      }

      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage('Network error logging in. Please try again.');
      setLoading(false);
    }
  };

  // STEP 2B: Set New 4-Digit PIN (First-time or Reset)
  const handleSetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStaff) return;

    const p1 = newPin.trim();
    const p2 = confirmPin.trim();

    if (!/^\d{4}$/.test(p1)) {
      setErrorMessage('PIN must be exactly 4 numeric digits (e.g. 1234).');
      return;
    }

    if (p1 !== p2) {
      setErrorMessage('PINs do not match. Please re-enter both identical 4-digit PINs.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pf_no: verifiedStaff.pf_no,
          pin: p1
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to save 4-digit PIN.');
        setLoading(false);
        return;
      }

      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage('Network error while setting up PIN.');
      setLoading(false);
    }
  };

  // Reset/Switch Staff Member
  const handleSwitchStaff = () => {
    setStaffStep('enter_pf');
    setVerifiedStaff(null);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setErrorMessage('');
    setSuccessNotice('');
  };

  // Administrator Login Handler
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.username.trim() || !adminForm.password.trim()) {
      setErrorMessage('Both username and password are required for administrative access.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid administrator credentials. Access denied.');
        setLoading(false);
        return;
      }

      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage('Network error connecting to administrative authentication service.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      background: '#0B0B0E',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      color: '#F2F0EB',
      overflow: 'hidden'
    }}>
      {/* Ambient background glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '18%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212, 161, 92, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '18%',
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(20, 20, 24, 0.95)',
        border: '1px solid rgba(212, 161, 92, 0.28)',
        borderRadius: '18px',
        padding: '34px 30px 28px 30px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(212, 161, 92, 0.06)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Official Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '58px',
            height: '58px',
            borderRadius: '15px',
            background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid rgba(212, 161, 92, 0.4)',
            color: '#D4A15C',
            fontSize: '1.85rem',
            marginBottom: '12px',
            boxShadow: '0 8px 24px rgba(212, 161, 92, 0.2)'
          }}>
            🚆
          </div>

          <div style={{
            fontSize: '0.72rem',
            letterSpacing: '1.4px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#D4A15C',
            marginBottom: '4px'
          }}>
            Indian Railways • South Central Railway
          </div>

          <h1 style={{
            fontSize: '1.48rem',
            fontWeight: 800,
            lineHeight: 1.25,
            margin: '0 0 4px 0',
            color: '#FFFFFF'
          }}>
            Ticket Checking Crew Portal
          </h1>

          <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
            Guntur Division • Duty Roster & Claims
          </div>
        </div>

        {/* Mode Selector Tab */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(11, 11, 14, 0.8)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => { setLoginMode('employee'); setErrorMessage(''); }}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: loginMode === 'employee' 
                ? 'linear-gradient(135deg, #D4A15C, #C28E46)' 
                : 'transparent',
              color: loginMode === 'employee' ? '#0B0B0E' : '#9CA3AF',
              boxShadow: loginMode === 'employee' ? '0 2px 10px rgba(212, 161, 92, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>👤</span> Staff PIN Login
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('admin'); setErrorMessage(''); }}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: loginMode === 'admin' 
                ? 'linear-gradient(135deg, #6366F1, #4F46E5)' 
                : 'transparent',
              color: loginMode === 'admin' ? '#FFFFFF' : '#9CA3AF',
              boxShadow: loginMode === 'admin' ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🛡️</span> Supervisor / Admin
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            color: '#FCA5A5',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: 1.4
          }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successNotice && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            color: '#6EE7B7',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: 1.4
          }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>✅</span>
            <div>{successNotice}</div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* EMPLOYEE FLOW: 3 STAGES (Enter PF -> Enter PIN -> Set PIN) */}
        {/* ---------------------------------------------------- */}
        {loginMode === 'employee' && (
          <div>
            {/* STAGE 1: ENTER PF NUMBER */}
            {staffStep === 'enter_pf' && (
              <form onSubmit={handleCheckPf}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: '#E5E7EB',
                    marginBottom: '8px'
                  }}>
                    Railway PF Number / HRMS ID
                  </label>

                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter 11-digit PF ID (e.g. 2461J110088)"
                    value={staffPf}
                    onChange={(e) => setStaffPf(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(212, 161, 92, 0.4)',
                      background: '#101014',
                      color: '#F9FAFB',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />

                  <div style={{
                    fontSize: '0.76rem',
                    color: '#9CA3AF',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span>ℹ️</span> Valid for Conductors (COR), Sleeper Staff, Ladies Staff, & LR.
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    color: '#D1D5DB',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ accentColor: '#D4A15C', cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    Remember my PF Number on this device
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #D4A15C 0%, #B8863A 100%)',
                    color: '#0B0B0E',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(212, 161, 92, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? 'Verifying PF Number...' : 'Continue to PIN Verification →'}
                </button>
              </form>
            )}

            {/* STAGE 2: ENTER 4-DIGIT PIN */}
            {staffStep === 'enter_pin' && verifiedStaff && (
              <form onSubmit={handlePinSubmit}>
                {/* Employee Info Header Card */}
                <div style={{
                  background: 'rgba(212, 161, 92, 0.08)',
                  border: '1px solid rgba(212, 161, 92, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>👤</span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#D4A15C', fontSize: '0.92rem' }}>
                        {verifiedStaff.name} ({verifiedStaff.designation || 'Staff'})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        PF: {verifiedStaff.pf_no}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwitchStaff}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '0.76rem',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    Change
                  </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.88rem', color: '#E5E7EB', margin: 0 }}>
                      Enter 4-Digit Security PIN
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9CA3AF',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {showPin ? 'Hide 👁️' : 'Show 👁️'}
                    </button>
                  </div>

                  <input
                    ref={pinInputRef}
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="• • • •"
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPin(val);
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(212, 161, 92, 0.4)',
                      background: '#101014',
                      color: '#F9FAFB',
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      letterSpacing: '12px',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>
                      Enter your personal 4-digit PIN
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffStep('setup_pin');
                        setErrorMessage('');
                        setSuccessNotice('You can reset your 4-digit PIN below.');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#D4A15C',
                        fontSize: '0.76rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Reset / Change PIN?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || pin.length < 4}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: pin.length === 4
                      ? 'linear-gradient(135deg, #D4A15C 0%, #B8863A 100%)'
                      : 'rgba(212, 161, 92, 0.3)',
                    color: pin.length === 4 ? '#0B0B0E' : '#6B7280',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    cursor: (loading || pin.length < 4) ? 'not-allowed' : 'pointer',
                    boxShadow: pin.length === 4 ? '0 6px 20px rgba(212, 161, 92, 0.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? 'Verifying PIN...' : 'Verify PIN & Open Portal →'}
                </button>
              </form>
            )}

            {/* STAGE 3: SETUP NEW 4-DIGIT PIN */}
            {staffStep === 'setup_pin' && verifiedStaff && (
              <form onSubmit={handleSetPinSubmit}>
                {/* Employee Welcome Card */}
                <div style={{
                  background: 'rgba(212, 161, 92, 0.1)',
                  border: '1px solid rgba(212, 161, 92, 0.4)',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🔐</span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#D4A15C', fontSize: '0.96rem' }}>
                        Welcome, {verifiedStaff.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        {verifiedStaff.designation || 'Staff'} • PF: {verifiedStaff.pf_no}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#D1D5DB', lineHeight: 1.4 }}>
                    Please set a personal <strong>4-digit PIN</strong> to protect your duty roster, TA approvals, and journal records.
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', color: '#E5E7EB', marginBottom: '6px' }}>
                    Create 4-Digit PIN
                  </label>
                  <input
                    ref={newPinInputRef}
                    type="password"
                    required
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Enter 4 digits"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid rgba(212, 161, 92, 0.4)',
                      background: '#101014',
                      color: '#F9FAFB',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      letterSpacing: '10px',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', color: '#E5E7EB', marginBottom: '6px' }}>
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Re-enter 4 digits"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid rgba(212, 161, 92, 0.4)',
                      background: '#101014',
                      color: '#F9FAFB',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      letterSpacing: '10px',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || newPin.length < 4 || confirmPin.length < 4}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: (newPin.length === 4 && confirmPin.length === 4)
                      ? 'linear-gradient(135deg, #D4A15C 0%, #B8863A 100%)'
                      : 'rgba(212, 161, 92, 0.3)',
                    color: (newPin.length === 4 && confirmPin.length === 4) ? '#0B0B0E' : '#6B7280',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    cursor: (loading || newPin.length < 4 || confirmPin.length < 4) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(212, 161, 92, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? 'Saving Security PIN...' : 'Save PIN & Sign In →'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handleSwitchStaff}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      fontSize: '0.78rem',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel & Return
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ADMINISTRATOR ACCESS FORM */}
        {/* ---------------------------------------------------- */}
        {loginMode === 'admin' && (
          <form onSubmit={handleAdminSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: '#E5E7EB',
                marginBottom: '8px'
              }}>
                Supervisor / Admin Username or Email
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter officer username or email"
                value={adminForm.username}
                onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                style={{
                  width: '100%',
                  padding: '13px 15px',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(99, 102, 241, 0.4)',
                  background: '#101014',
                  color: '#F9FAFB',
                  fontSize: '0.96rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.88rem', color: '#E5E7EB', margin: 0 }}>
                  Master Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showAdminPassword ? 'Hide 👁️' : 'Show 👁️'}
                </button>
              </div>
              <input
                type={showAdminPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                style={{
                  width: '100%',
                  padding: '13px 15px',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(99, 102, 241, 0.4)',
                  background: '#101014',
                  color: '#F9FAFB',
                  fontSize: '0.96rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#FFFFFF',
                fontSize: '0.98rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Verifying Administrator...' : 'Sign In to Roster Administration →'}
            </button>
          </form>
        )}

        {/* Security & Support Footer */}
        <div style={{
          marginTop: '26px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          fontSize: '0.74rem',
          color: '#6B7280',
          lineHeight: 1.5
        }}>
          <div>🔒 Official South Central Railway Crew Portal • 256-Bit SSL Encrypted</div>
          <div style={{ marginTop: '3px' }}>
            For duty allotment adjustments, contact the CTI / COR In-Charge Office, GNT.
          </div>
        </div>
      </div>
    </div>
  );
}
