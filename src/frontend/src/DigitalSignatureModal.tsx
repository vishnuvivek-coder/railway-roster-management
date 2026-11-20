import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | number;
  staffName: string;
  designation?: string;
  pfNo?: string;
  currentSignature?: string | null;
  authToken?: string;
  onSaveSignature: (signatureDataUrl: string | null) => void;
}

export default function DigitalSignatureModal({
  isOpen,
  onClose,
  staffId,
  staffName,
  designation = '',
  pfNo = '',
  currentSignature = null,
  authToken = '',
  onSaveSignature
}: DigitalSignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'DRAW' | 'TYPE' | 'UPLOAD'>('DRAW');
  const [penColor, setPenColor] = useState('#002b66'); // Official Indian Railways deep blue
  const [penWidth, setPenWidth] = useState(3);
  const [typedName, setTypedName] = useState(staffName || '');
  const [selectedFontPreset, setSelectedFontPreset] = useState<number>(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize typed name whenever staffName changes
  useEffect(() => {
    if (staffName) {
      setTypedName(staffName);
    }
  }, [staffName]);

  // Set up canvas when modal opens or DRAW tab is selected
  useEffect(() => {
    if (!isOpen || activeTab !== 'DRAW') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 520;
    const displayHeight = 180;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    // Fill with transparent background
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw subtle guideline
    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, displayHeight - 40);
    ctx.lineTo(displayWidth - 30, displayHeight - 40);
    ctx.stroke();
    ctx.restore();

    setHasDrawn(false);
  }, [isOpen, activeTab]);

  // Canvas drawing helpers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCoordinates(e);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const coords = getCoordinates(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 520;
    const displayHeight = 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, displayHeight - 40);
    ctx.lineTo(displayWidth - 30, displayHeight - 40);
    ctx.stroke();
    ctx.restore();

    setHasDrawn(false);
  };

  // Convert typed cursive signature to image data URL
  const generateTypedSignatureDataUrl = useCallback((): string => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 500;
    tempCanvas.height = 160;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 500, 160);

    // Font styles
    const fonts = [
      'italic 44px "Brush Script MT", "Caveat", "Segoe Script", cursive',
      'italic 40px "Lucida Handwriting", "Dancing Script", cursive',
      'italic bold 36px "Times New Roman", "Georgia", serif'
    ];
    ctx.font = fonts[selectedFontPreset - 1] || fonts[0];
    ctx.fillStyle = penColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Signature main text
    ctx.fillText(typedName || staffName || 'Employee', 250, 70);

    // Underline flourish
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 105);
    ctx.quadraticCurveTo(250, 120, 400, 105);
    ctx.stroke();

    // Subtle Digital Seal Text
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`✓ DIGITALLY SIGNED • ${pfNo ? `PF: ${pfNo}` : staffName}`, 250, 135);

    return tempCanvas.toDataURL('image/png');
  }, [typedName, staffName, penColor, selectedFontPreset, pfNo]);

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Save Signature handler
  const handleSave = async () => {
    setErrorMsg('');
    let finalSignatureDataUrl: string | null = null;

    if (activeTab === 'DRAW') {
      if (!hasDrawn) {
        setErrorMsg('Please draw your signature on the pad above before saving.');
        return;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        finalSignatureDataUrl = canvas.toDataURL('image/png');
      }
    } else if (activeTab === 'TYPE') {
      if (!typedName.trim()) {
        setErrorMsg('Please enter a name for the digital signature.');
        return;
      }
      finalSignatureDataUrl = generateTypedSignatureDataUrl();
    } else if (activeTab === 'UPLOAD') {
      if (!uploadedImage) {
        setErrorMsg('Please upload a signature image file.');
        return;
      }
      finalSignatureDataUrl = uploadedImage;
    }

    if (!finalSignatureDataUrl) {
      setErrorMsg('Unable to capture signature.');
      return;
    }

    setSaving(true);
    try {
      const effectiveToken = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      const res = await fetch(`/api/staff/${staffId}/signature`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ signature_data: finalSignatureDataUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save digital signature to server.');
      }

      onSaveSignature(finalSignatureDataUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving digital signature.');
    } finally {
      setSaving(false);
    }
  };

  // Remove Signature handler
  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove the digital signature for ${staffName}?`)) {
      return;
    }

    setSaving(true);
    try {
      const effectiveToken = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      const res = await fetch(`/api/staff/${staffId}/signature`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ signature_data: null })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove digital signature.');
      }

      onSaveSignature(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error removing digital signature.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-secondary, #1a1a1d)',
          border: '1.5px solid var(--border-gold, #d4a15c)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          color: 'var(--color-text-primary, #f2f0eb)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(212, 161, 92, 0.08)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>✍️</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary, #d4a15c)', fontWeight: 700 }}>
                Digital Signature for TA Document
              </h3>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary, #9e9b95)' }}>
              Official claimant signature for <strong>{staffName}</strong> {designation ? `(${designation})` : ''} {pfNo ? `• PF: ${pfNo}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted, #9e9b95)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '0 16px'
          }}
        >
          {[
            { id: 'DRAW', label: '✏️ Draw Signature', desc: 'Sign with mouse / touch' },
            { id: 'TYPE', label: '🔤 Type / Cursive Style', desc: 'Auto-generate calligraphic' },
            { id: 'UPLOAD', label: '📁 Upload Image', desc: 'Scanned signature image' }
          ].map((tab) => {
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '12px 10px',
                  background: isSel ? 'rgba(212, 161, 92, 0.14)' : 'transparent',
                  border: 'none',
                  borderBottom: isSel ? '2.5px solid var(--primary, #d4a15c)' : '2.5px solid transparent',
                  color: isSel ? 'var(--primary, #d4a15c)' : 'var(--color-text-secondary, #9e9b95)',
                  fontWeight: isSel ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
              >
                <div>{tab.label}</div>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMsg && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DRAW SIGNATURE */}
          {activeTab === 'DRAW' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #9e9b95)' }}>Ink Color:</span>
                  {[
                    { color: '#002b66', label: 'Railway Blue' },
                    { color: '#111827', label: 'Black' },
                    { color: '#1e3a8a', label: 'Navy' }
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setPenColor(c.color)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: c.color,
                        border: penColor === c.color ? '2.5px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        boxShadow: penColor === c.color ? '0 0 8px rgba(255,255,255,0.5)' : 'none'
                      }}
                      title={c.label}
                    />
                  ))}

                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #9e9b95)', marginLeft: '10px' }}>Stroke:</span>
                  {[
                    { width: 2, label: 'Fine' },
                    { width: 3, label: 'Normal' },
                    { width: 4.5, label: 'Bold' }
                  ].map((w) => (
                    <button
                      key={w.width}
                      type="button"
                      onClick={() => setPenWidth(w.width)}
                      className={`btn btn-xs ${penWidth === w.width ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: penWidth === w.width ? 700 : 400 }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={clearCanvas}
                  className="btn btn-secondary btn-xs"
                  style={{ fontSize: '0.75rem', padding: '3px 10px', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' }}
                >
                  🧹 Clear Canvas
                </button>
              </div>

              {/* HTML5 Signature Canvas */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '2px dashed var(--border-gold, #d4a15c)',
                  overflow: 'hidden',
                  position: 'relative',
                  touchAction: 'none',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '180px',
                    cursor: 'crosshair'
                  }}
                />
                {!hasDrawn && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      color: '#94a3b8',
                      fontSize: '0.85rem',
                      fontStyle: 'italic',
                      textAlign: 'center'
                    }}
                  >
                    ✍️ Sign here using mouse, stylus, or touch
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TYPE / CURSIVE STYLE */}
          {activeTab === 'TYPE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                  Signatory Name:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Enter employee full name"
                  style={{ padding: '8px 12px', fontSize: '0.9rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                  Choose Calligraphic Signature Style:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 1, label: 'Style 1: Calligraphic Flourish', font: 'italic 20px "Brush Script MT", "Caveat", cursive' },
                    { id: 2, label: 'Style 2: Formal Script', font: 'italic 18px "Lucida Handwriting", "Dancing Script", cursive' },
                    { id: 3, label: 'Style 3: Executive Serif', font: 'italic bold 17px "Times New Roman", Georgia, serif' }
                  ].map((preset) => {
                    const isSel = selectedFontPreset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setSelectedFontPreset(preset.id)}
                        style={{
                          padding: '14px 10px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: isSel ? '2.5px solid var(--primary, #d4a15c)' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          textAlign: 'center',
                          boxShadow: isSel ? '0 0 10px rgba(212, 161, 92, 0.4)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ font: preset.font, color: penColor, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {typedName || staffName || 'Employee'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isSel ? 'var(--primary, #d4a15c)' : '#64748b', fontWeight: 600 }}>
                          {preset.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ink color selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #9e9b95)' }}>Ink Color:</span>
                {[
                  { color: '#002b66', label: 'Railway Blue' },
                  { color: '#111827', label: 'Black' },
                  { color: '#1e3a8a', label: 'Navy' }
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setPenColor(c.color)}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: c.color,
                      border: penColor === c.color ? '2.5px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                      cursor: 'pointer'
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: UPLOAD IMAGE */}
          {activeTab === 'UPLOAD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  border: '2px dashed var(--border-gold, #d4a15c)',
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('signature-file-input')?.click()}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📤</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary, #d4a15c)' }}>
                  Click to select signature image file
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #9e9b95)', marginTop: '4px' }}>
                  Supports PNG, JPG, JPEG, WEBP (Max 5MB)
                </div>
                <input
                  id="signature-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {uploadedImage && (
                <div
                  style={{
                    background: '#ffffff',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>Uploaded Signature Preview:</div>
                  <img
                    src={uploadedImage}
                    alt="Uploaded Signature"
                    style={{ maxHeight: '80px', maxWidth: '280px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* TA Document Preview Box */}
          <div
            style={{
              marginTop: '4px',
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              color: '#000000',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              Preview on Official TA Statement:
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '220px', borderTop: '1px solid #94a3b8', paddingTop: '6px' }}>
                <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
                  {activeTab === 'DRAW' && hasDrawn && canvasRef.current ? (
                    <img
                      src={canvasRef.current.toDataURL()}
                      alt="Signature Preview"
                      style={{ maxHeight: '38px', maxWidth: '160px', objectFit: 'contain' }}
                    />
                  ) : activeTab === 'TYPE' ? (
                    <div style={{
                      font: selectedFontPreset === 1
                        ? 'italic 22px "Brush Script MT", "Caveat", cursive'
                        : (selectedFontPreset === 2 ? 'italic 20px "Lucida Handwriting", cursive' : 'italic bold 18px "Times New Roman", serif'),
                      color: penColor
                    }}>
                      {typedName || staffName}
                    </div>
                  ) : activeTab === 'UPLOAD' && uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt="Signature Preview"
                      style={{ maxHeight: '38px', maxWidth: '160px', objectFit: 'contain' }}
                    />
                  ) : currentSignature ? (
                    <img
                      src={currentSignature}
                      alt="Current Signature"
                      style={{ maxHeight: '38px', maxWidth: '160px', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      [Signature will appear here]
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '8px', color: '#059669', fontWeight: 'bold', marginBottom: '2px' }}>
                  ✓ DIGITALLY SIGNED
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#000000' }}>
                  {typedName || staffName}
                </div>
                <div style={{ fontSize: '9.5px', color: '#334155' }}>
                  {designation ? `(${designation}/GNT)` : '(CTI/SL/GNT)'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.25)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            {currentSignature && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="btn btn-secondary btn-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  padding: '6px 12px'
                }}
              >
                🗑️ Remove Signature
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.84rem', padding: '6px 16px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: '0.84rem',
                padding: '7px 20px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
              }}
            >
              {saving ? 'Saving...' : '💾 Save & Apply to TA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
