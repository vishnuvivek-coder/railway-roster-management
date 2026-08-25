import React, { useState } from 'react';

const API_BASE = '/api';

export default function AuthScreen({ onLoginSuccess }) {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid credentials. Please enter a valid ID and password.');
        setLoading(false);
        return;
      }

      localStorage.setItem('railway_auth_token', data.token);
      localStorage.setItem('railway_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setErrorMessage('Network error connecting to backend authentication server.');
      setLoading(false);
    }
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
        maxWidth: '440px',
        background: 'rgba(26, 26, 29, 0.92)',
        border: '1px solid rgba(212, 161, 92, 0.25)',
        borderRadius: '20px',
        padding: '40px 36px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(212, 161, 92, 0.08)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #D4A15C 0%, #6C6499 100%)',
            color: '#0D0D0F',
            fontSize: '1.8rem',
            fontWeight: 800,
            marginBottom: '16px',
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
            Staff Link-Rotation & Seniority System
          </p>
        </div>

        {/* Error Alert */}
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

        {/* Pure Manual Sign In Form */}
        <form onSubmit={handleLoginSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.88rem' }}>
              Railway ID / Username
            </label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              className="form-input"
              placeholder="Enter your ID"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              style={{
                fontSize: '0.95rem',
                padding: '12px 14px'
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 0 }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                {showPassword ? 'Hide 👁️' : 'Show 👁️'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className="form-input"
              placeholder="Enter your password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              style={{
                fontSize: '0.95rem',
                padding: '12px 14px'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '13px',
              fontSize: '1rem',
              fontWeight: 700,
              boxShadow: '0 4px 18px rgba(212, 161, 92, 0.35)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Verifying...' : 'Sign In to Portal →'}
          </button>
        </form>
      </div>
    </div>
  );
}