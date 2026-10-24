import React, { useState } from 'react';

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

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  // Tabs: 'employee' (default for 99% of users) or 'admin'
  const [loginMode, setLoginMode] = useState<'employee' | 'admin'>('employee');
  const [staffPf, setStaffPf] = useState('');
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Handle Employee Single-PF Login
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPf = staffPf.trim();
    if (!cleanPf) {
      setErrorMessage('Please enter your Railway PF Number or HRMS ID.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanPf, password: cleanPf })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid Railway PF Number. Please verify your 11-digit PF ID.');
        setLoading(false);
        return;
      }

      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      if (rememberMe) {
        localStorage.setItem('railway_remember_login', 'true');
      }
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage('Unable to connect to the authentication server. Please check your network connection.');
      setLoading(false);
    }
  };

  // Handle Administrator Login
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

      {/* Main Luxury Auth Card */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(20, 20, 24, 0.95)',
        border: '1px solid rgba(212, 161, 92, 0.28)',
        borderRadius: '18px',
        padding: '36px 32px 30px 32px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(212, 161, 92, 0.06)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Official Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(212, 161, 92, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid rgba(212, 161, 92, 0.4)',
            color: '#D4A15C',
            fontSize: '1.9rem',
            marginBottom: '14px',
            boxShadow: '0 8px 24px rgba(212, 161, 92, 0.2)'
          }}>
            🚆
          </div>

          <div style={{
            fontSize: '0.74rem',
            letterSpacing: '1.4px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#D4A15C',
            marginBottom: '4px'
          }}>
            Indian Railways • South Central Railway
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            lineHeight: 1.25,
            margin: '0 0 4px 0',
            color: '#FFFFFF'
          }}>
            Ticket Checking Crew Portal
          </h1>

          <div style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
            Guntur Division • Duty Roster & Electronic Claims
          </div>
        </div>

        {/* Segmented Mode Selector Tab */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(11, 11, 14, 0.8)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '22px'
        }}>
          <button
            type="button"
            onClick={() => { setLoginMode('employee'); setErrorMessage(''); }}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
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
            <span>👤</span> Staff Sign In
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('admin'); setErrorMessage(''); }}
            style={{
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
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

        {/* Error Notification Banner */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            color: '#FCA5A5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: 1.4
          }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* MODE 1: PROFESSIONAL SINGLE-PF EMPLOYEE LOGIN */}
        {loginMode === 'employee' && (
          <form onSubmit={handleEmployeeSubmit}>
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

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your 11-digit PF ID (e.g. 2461J110088)"
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
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#D4A15C';
                    e.target.style.boxShadow = '0 0 0 3px rgba(212, 161, 92, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(212, 161, 92, 0.4)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{
                fontSize: '0.76rem',
                color: '#9CA3AF',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>ℹ️</span> Valid for Conductors (COR), Sleeper Staff (TTI), Ladies Staff, & LR.
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '22px'
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
                Remember me on this device (30 Days)
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
                letterSpacing: '0.4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(212, 161, 92, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Verifying Credentials...' : 'Access Duty Schedule & Documents →'}
            </button>
          </form>
        )}

        {/* MODE 2: ADMINISTRATIVE LOGIN */}
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
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showPassword ? 'Hide 👁️' : 'Show 👁️'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
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
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Verifying Administrator...' : 'Sign In to Roster Administration →'}
            </button>
          </form>
        )}

        {/* Professional Footer Info */}
        <div style={{
          marginTop: '28px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          fontSize: '0.74rem',
          color: '#6B7280',
          lineHeight: 1.5
        }}>
          <div>🔒 Official South Central Railway Crew Portal • 256-Bit SSL Encrypted</div>
          <div style={{ marginTop: '4px' }}>
            For duty allotment adjustments, contact the CTI / COR In-Charge Office, GNT.
          </div>
        </div>
      </div>
    </div>
  );
}
