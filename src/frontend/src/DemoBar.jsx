import React, { useState } from 'react';

export default function DemoBar({
  currentUser,
  onSwitchPersona,
  onRunScenario,
  isMobileSimulated,
  onToggleMobileSimulated,
  activeTab,
  setActiveTab,
  categories,
  selectedCatId,
  setSelectedCatId,
  device,
  deviceMode,
  setDeviceMode,
  detectedPlatform
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);
  const [activeScenarioMsg, setActiveScenarioMsg] = useState('');

  const personas = [
    { key: 'admin', label: '👑 Master Admin', role: 'Admin', desc: 'Full edit rights, approvals & duty register' },
    { key: 'employee1_cor', label: '👷 Employee 1 (COR)', role: 'Staff', desc: 'Conductor, 21-day rotation, Read-only' },
    { key: 'employee5_sleeper', label: '🚆 Employee 5 (Sleeper)', role: 'Staff', desc: 'Sleeper crew, 63-day rotation, Read-only' },
    { key: 'employee1_ladies', label: '👩 Employee 1 (Ladies)', role: 'Staff', desc: 'Ladies squad, 7-day rotation, Read-only' },
    { key: 'pending_user', label: '🆕 Pending Applicant', role: 'Pending', desc: 'Unverified user workflow simulation' }
  ];

  const handleSelectPersona = async (personaKey) => {
    setIsLoadingPersona(true);
    setActiveScenarioMsg('');
    try {
      await onSwitchPersona(personaKey);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPersona(false);
    }
  };

  const executeScenario = async (scenarioType) => {
    setActiveScenarioMsg('Running scenario...');
    try {
      await onRunScenario(scenarioType);
      if (scenarioType === 'rotation') {
        setActiveScenarioMsg('✓ Displaying cyclic daily rotation and link-offsets');
      } else if (scenarioType === 'swap') {
        setActiveScenarioMsg('✓ Submitted swap from Employee 1. Switched to Admin for live approval.');
      } else if (scenarioType === 'reconciliation') {
        setActiveScenarioMsg('✓ Daily Register loaded and reconciled against planned duties.');
      }
    } catch (err) {
      setActiveScenarioMsg('Scenario error: ' + err.message);
    }
  };

  if (isCollapsed) {
    return (
      <div 
        onClick={() => setIsCollapsed(false)}
        style={{
          position: 'fixed',
          top: '12px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1A1A1D 0%, #25252B 100%)',
          border: '1px solid var(--primary)',
          borderRadius: '30px',
          padding: '8px 16px',
          color: 'var(--primary)',
          fontSize: '0.82rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span>⚡ Prototype Sandbox</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Expand)</span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(90deg, #111114 0%, #1A1A1E 50%, #111114 100%)',
      borderBottom: '1px solid rgba(212, 161, 92, 0.3)',
      padding: '8px 18px',
      fontSize: '0.82rem',
      position: 'sticky',
      top: 0,
      zIndex: 999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      WebkitBackdropFilter: 'blur(10px)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Left: Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.95rem' }}>🎭</span>
            <strong style={{ color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
              Persona:
            </strong>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {personas.map((p) => {
              const isSelected = currentUser && (
                (p.key === 'admin' && currentUser.role === 'Admin') ||
                (p.key === 'employee1_cor' && currentUser.username === 'employee1_cor') ||
                (p.key === 'employee5_sleeper' && currentUser.username === 'employee5_sleeper') ||
                (p.key === 'employee1_ladies' && currentUser.username === 'employee1_ladies')
              );

              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={isLoadingPersona}
                  onClick={() => handleSelectPersona(p.key)}
                  style={{
                    background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                    color: isSelected ? '#0D0D0F' : 'var(--color-text-primary)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={p.desc}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Quick Scenarios */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎬 Scenarios:
          </span>
          <button
            type="button"
            onClick={() => executeScenario('rotation')}
            style={{
              background: 'rgba(108, 100, 153, 0.2)',
              color: '#c4bbf5',
              border: '1px solid rgba(108, 100, 153, 0.4)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            🔄 Rotation
          </button>
          <button
            type="button"
            onClick={() => executeScenario('swap')}
            style={{
              background: 'rgba(212, 161, 92, 0.15)',
              color: 'var(--primary)',
              border: '1px solid rgba(212, 161, 92, 0.4)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            🔀 Swap
          </button>
          <button
            type="button"
            onClick={() => executeScenario('reconciliation')}
            style={{
              background: 'rgba(46, 204, 113, 0.15)',
              color: '#2ecc71',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            📝 Register
          </button>
        </div>

        {/* Right: Adaptive Layout Selector & Simulator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '2px',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              type="button"
              onClick={() => setDeviceMode && setDeviceMode('auto')}
              style={{
                background: deviceMode === 'auto' ? 'var(--primary)' : 'transparent',
                color: deviceMode === 'auto' ? '#0D0D0F' : 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '14px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: deviceMode === 'auto' ? 700 : 500,
                cursor: 'pointer'
              }}
              title={`Auto-detected: ${detectedPlatform || 'Desktop'}`}
            >
              ⚡ Auto ({device === 'ios' ? '🍎 iOS' : device === 'android' ? '🤖 Android' : '💻 PC'})
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode && setDeviceMode('ios')}
              style={{
                background: deviceMode === 'ios' ? 'var(--primary)' : 'transparent',
                color: deviceMode === 'ios' ? '#0D0D0F' : 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '14px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: deviceMode === 'ios' ? 700 : 500,
                cursor: 'pointer'
              }}
              title="Force iOS / iPhone Safari Layout"
            >
              🍎 iOS
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode && setDeviceMode('android')}
              style={{
                background: deviceMode === 'android' ? 'var(--primary)' : 'transparent',
                color: deviceMode === 'android' ? '#0D0D0F' : 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '14px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: deviceMode === 'android' ? 700 : 500,
                cursor: 'pointer'
              }}
              title="Force Android Material Layout"
            >
              🤖 Android
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode && setDeviceMode('desktop')}
              style={{
                background: deviceMode === 'desktop' ? 'var(--primary)' : 'transparent',
                color: deviceMode === 'desktop' ? '#0D0D0F' : 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '14px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: deviceMode === 'desktop' ? 700 : 500,
                cursor: 'pointer'
              }}
              title="Force Desktop Workspace Layout"
            >
              💻 Desktop
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0 4px'
            }}
            title="Collapse demo bar"
          >
            ✕
          </button>
        </div>
      </div>

      {activeScenarioMsg && (
        <div style={{
          marginTop: '4px',
          padding: '3px 10px',
          background: 'rgba(212, 161, 92, 0.1)',
          borderRadius: '4px',
          color: 'var(--primary)',
          fontSize: '0.75rem',
          textAlign: 'center'
        }}>
          {activeScenarioMsg}
        </div>
      )}
    </div>
  );
}
