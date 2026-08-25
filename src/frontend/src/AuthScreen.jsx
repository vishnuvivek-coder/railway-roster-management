import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function AuthScreen({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  
  // Login form state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Register form state
  const [regForm, setRegForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Staff',
    staff_id: ''
  });
  
  // Staff list for linking profile
  const [staffList, setStaffList] = useState([]);
  
  // Status & Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [statusNotice, setStatusNotice] = useState(null);

  useEffect(() => {
    // Fetch staff list for linking registration to seniority record if desired
    fetch(`${API_BASE}/staff`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setStaffList(data);
      })
      .catch(() => {});
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusNotice(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === 'PENDING') {
          setStatusNotice({
            type: 'pending',
            title: 'Account Verification Pending',
            message: 'Your registration has been received and is currently waiting for Master Admin approval. You will be able to log in as soon as the administrator verifies your account.'
          });
        } else if (data.status === 'REJECTED') {
          setStatusNotice({
            type: 'rejected',
            title: 'Registration Not Approved',
            message: 'Your account registration was not approved or has been suspended. Please contact the Master Administrator.'
          });
        } else {
          setErrorMessage(data.error || 'Login failed. Please check your credentials.');
        }
        setLoading(false);
        return;
      }

      // Successful login
      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setErrorMessage('Network error connecting to backend authentication server.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusNotice(null);

    if (regForm.password !== regForm.confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regForm.name,
          username: regForm.username,
          email: regForm.email,
          password: regForm.password,
          role: regForm.role,
          staff_id: regForm.staff_id ? parseInt(regForm.staff_id, 10) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      // Registration successful -> pending approval
      setSuccessMessage('Registration submitted successfully!');
      setStatusNotice({
        type: 'pending',
        title: 'Registration Under Review',
        message: 'Your account has been created with status PENDING. The Master Admin will review and verify your account. Once approved, you can sign in directly.'
      });
      setIsRegister(false);
      setLoginForm({ username: regForm.username, password: '' });
      setLoading(false);
    } catch (err) {
      setErrorMessage('Network error submitting registration.');
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setLoginForm({ username: '12345', password: 'CLICKME' });
    setErrorMessage('');
    setStatusNotice(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      background: '#0D0D0F',
      overflow: 'hidden'
    }}>
      {/* Ambient background glow elements */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212, 161, 92, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '20%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(108, 100, 153, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Main Luxury Auth Card */}
      <div className="card" style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(26, 26, 29, 0.88)',
        border: '1px solid rgba(212, 161, 92, 0.25)',
        borderRadius: '20px',
        padding: '38px 34px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(212, 161, 92, 0.08)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #D4A15C 0%, #6C6499 100%)',
            color: '#0D0D0F',
            fontSize: '1.6rem',
            fontWeight: 800,
            marginBottom: '14px',
            boxShadow: '0 0 28px rgba(212, 161, 92, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            🚆
          </div>
          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '6px',
            background: 'linear-gradient(135deg, #F2F0EB 40%, #D4A15C 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Railway Crew Portal
          </h1>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.88rem',
            letterSpacing: '0.02em'
          }}>
            Secure Link-Rotation & Seniority Roster Management
          </p>
        </div>

        {/* Auth Mode Tabs (Sign In vs Register) */}
        <div style={{
          display: 'flex',
          background: '#151518',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '26px'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMessage(''); setStatusNotice(null); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              background: !isRegister ? 'linear-gradient(135deg, #D4A15C 0%, #C4914A 100%)' : 'transparent',
              color: !isRegister ? '#0D0D0F' : 'var(--color-text-secondary)',
              boxShadow: !isRegister ? '0 2px 10px rgba(212, 161, 92, 0.25)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMessage(''); setStatusNotice(null); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              background: isRegister ? 'linear-gradient(135deg, #D4A15C 0%, #C4914A 100%)' : 'transparent',
              color: isRegister ? '#0D0D0F' : 'var(--color-text-secondary)',
              boxShadow: isRegister ? '0 2px 10px rgba(212, 161, 92, 0.25)' : 'none'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Verification Status Notice */}
        {statusNotice && (
          <div style={{
            background: statusNotice.type === 'pending' ? 'rgba(212, 161, 92, 0.12)' : 'rgba(189, 90, 90, 0.14)',
            border: `1px solid ${statusNotice.type === 'pending' ? 'rgba(212, 161, 92, 0.35)' : 'rgba(189, 90, 90, 0.35)'}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '22px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              color: statusNotice.type === 'pending' ? 'var(--primary)' : 'var(--danger)',
              fontSize: '0.92rem',
              marginBottom: '6px'
            }}>
              <span>{statusNotice.type === 'pending' ? '⏳' : '⚠️'}</span>
              <span>{statusNotice.title}</span>
            </div>
            <p style={{
              fontSize: '0.84rem',
              color: 'var(--color-text-primary)',
              lineHeight: 1.5,
              margin: 0
            }}>
              {statusNotice.message}
            </p>
          </div>
        )}

        {/* Error / Success Alerts */}
        {errorMessage && (
          <div style={{
            background: 'rgba(189, 90, 90, 0.15)',
            border: '1px solid rgba(189, 90, 90, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#f87171',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {successMessage && !statusNotice && (
          <div style={{
            background: 'rgba(104, 166, 125, 0.15)',
            border: '1px solid rgba(104, 166, 125, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: 'var(--success)',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* ----------------------------------------------------
           SIGN IN FORM
           ---------------------------------------------------- */}
        {!isRegister ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Railway Officer ID / Username</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. 12345"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? 'Hide 👁️' : 'Show 👁️'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="form-input"
                placeholder="Enter password (e.g. CLICKME)"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.96rem',
                marginTop: '10px',
                boxShadow: '0 4px 18px rgba(212, 161, 92, 0.35)'
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal →'}
            </button>

            {/* Quick Fill Registered Credentials */}
            <div style={{
              marginTop: '24px',
              paddingTop: '18px',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                Quick Login Access:
              </p>
              <button
                type="button"
                onClick={fillAdminCredentials}
                style={{
                  background: 'rgba(212, 161, 92, 0.08)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                🔑 Fill Registered ID (12345 / CLICKME)
              </button>
            </div>
          </form>
        ) : (
          /* ----------------------------------------------------
             CREATE ACCOUNT / REGISTER FORM
             ---------------------------------------------------- */
          <form onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. K RAMANAIAH or Employee 1"
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Desired Username *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. kramanaiah or employee1"
                value={regForm.username}
                onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Email (Optional)</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. name@railway.gov.in"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Link Seniority Profile (Optional)</label>
              <select
                className="form-input"
                value={regForm.staff_id}
                onChange={(e) => setRegForm({ ...regForm, staff_id: e.target.value })}
              >
                <option value="">-- Associate with Employee record --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.designation || 'Staff'} - Row #{s.row_position})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Password * (Min 5 chars)</label>
              <input
                type="password"
                required
                minLength={5}
                className="form-input"
                placeholder="Create secure password"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="Re-enter password"
                value={regForm.confirmPassword}
                onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
              />
            </div>

            <div style={{
              background: 'rgba(212, 161, 92, 0.06)',
              border: '1px solid rgba(212, 161, 92, 0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '0.78rem',
              color: 'var(--color-text-secondary)'
            }}>
              🛡️ <strong>Admin Verification Policy:</strong> After registration, your account will be placed in review. The Master Administrator must approve your account before you can log in.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.96rem'
              }}
            >
              {loading ? 'Submitting Registration...' : 'Submit for Admin Verification →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
