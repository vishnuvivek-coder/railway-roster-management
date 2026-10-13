import React, { useState, useEffect } from 'react';

const FEEDBACK_CATEGORIES = [
  { value: 'Duty Grievance', label: '🚆 Duty & Link Allocation Grievance', color: '#f59e0b' },
  { value: 'Bug Report', label: '🐛 System / Calculation Bug Report', color: '#ef4444' },
  { value: 'Feature Suggestion', label: '💡 Feature Request & Improvement', color: '#38bdf8' },
  { value: 'Data Correction', label: '👤 Staff Profile / Data Correction', color: '#a855f7' },
  { value: 'General Feedback', label: '💬 General Inquiry & Feedback', color: '#10b981' }
];

export default function FeedbackModal({ isOpen, onClose, currentUser, authToken, API_BASE = '/api' }) {
  const [activeTab, setActiveTab] = useState('SUBMIT'); // 'SUBMIT' | 'LIST'
  const [category, setCategory] = useState('Duty Grievance');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [userName, setUserName] = useState(currentUser?.name || currentUser?.username || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Feedbacks list state (for viewing/admin review)
  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);

  const isAdmin = currentUser?.role === 'Admin';

  useEffect(() => {
    if (isOpen) {
      setSubmitSuccess(false);
      setSubmitError(null);
      if (currentUser?.name || currentUser?.username) {
        setUserName(currentUser.name || currentUser.username);
      }
      if (activeTab === 'LIST' || isAdmin) {
        fetchFeedbacks();
      }
    }
  }, [isOpen, activeTab, currentUser]);

  const fetchFeedbacks = async () => {
    try {
      setLoadingFeedbacks(true);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/feedback`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.feedbacks)) {
        setFeedbacks(data.feedbacks);
      }
    } catch (err) {
      console.error('Failed to fetch feedbacks:', err);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setSubmitError('Please enter both a subject and detailed message.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          rating,
          contact_info: contactInfo.trim(),
          user_name: userName.trim() || 'Anonymous Staff'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSubmitSuccess(true);
      setSubject('');
      setMessage('');
      setContactInfo('');
      // Refresh list if active
      fetchFeedbacks();
    } catch (err) {
      setSubmitError(err.message || 'Error submitting feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, responseText = '') => {
    try {
      setUpdatingId(id);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/feedback/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          status: newStatus,
          admin_response: responseText
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus, admin_response: responseText || f.admin_response } : f));
      } else {
        alert(data.error || 'Failed to update feedback status');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (!confirm('Are you sure you want to delete this feedback entry?')) return;
    try {
      setUpdatingId(id);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/feedback/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbacks(prev => prev.filter(f => f.id !== id));
      } else {
        alert(data.error || 'Failed to delete feedback');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredFeedbacks = feedbacks.filter(f => {
    if (feedbackFilter === 'ALL') return true;
    return f.status === feedbackFilter;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="card" style={{
        background: '#18181b',
        border: '1.5px solid var(--border-gold, #d4a15c)',
        borderRadius: '16px',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary, #d4a15c)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💬</span> Staff Feedback & Grievance Portal
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.80rem', color: 'var(--color-text-secondary, #a1a1aa)' }}>
              Direct line to administration for duty grievances, system bugs, and suggestions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.25)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('SUBMIT')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: activeTab === 'SUBMIT' ? 'rgba(212, 161, 92, 0.15)' : 'transparent',
              color: activeTab === 'SUBMIT' ? 'var(--primary, #d4a15c)' : '#a1a1aa',
              borderBottom: activeTab === 'SUBMIT' ? '2px solid var(--primary, #d4a15c)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            ✍️ Submit Feedback / Grievance
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('LIST'); fetchFeedbacks(); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: activeTab === 'LIST' ? 'rgba(212, 161, 92, 0.15)' : 'transparent',
              color: activeTab === 'LIST' ? 'var(--primary, #d4a15c)' : '#a1a1aa',
              borderBottom: activeTab === 'LIST' ? '2px solid var(--primary, #d4a15c)' : 'none',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>📋 View Submissions</span>
            {feedbacks.length > 0 && (
              <span style={{
                background: 'rgba(212, 161, 92, 0.25)',
                color: 'var(--primary, #d4a15c)',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.72rem'
              }}>
                {feedbacks.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: SUBMIT FEEDBACK FORM */}
          {activeTab === 'SUBMIT' && (
            <div>
              {submitSuccess ? (
                <div style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  margin: '10px 0'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#34d399', fontWeight: 800 }}>
                    Feedback Submitted Successfully!
                  </h4>
                  <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                    Your feedback has been permanently recorded in the database. The railway roster administration will review and address your inquiry promptly.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setSubmitSuccess(false)}
                      style={{ padding: '8px 18px', fontSize: '0.84rem', fontWeight: 700 }}
                    >
                      ✍️ Submit Another Feedback
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setActiveTab('LIST'); fetchFeedbacks(); }}
                      style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                    >
                      📋 View Submissions
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {submitError && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '8px',
                      color: '#f87171',
                      fontSize: '0.82rem'
                    }}>
                      ⚠️ {submitError}
                    </div>
                  )}

                  {/* Category Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Category / Topic:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {FEEDBACK_CATEGORIES.map(cat => {
                        const isSelected = category === cat.value;
                        return (
                          <div
                            key={cat.value}
                            onClick={() => setCategory(cat.value)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 600,
                              background: isSelected ? `${cat.color}22` : 'rgba(255, 255, 255, 0.03)',
                              border: `1.5px solid ${isSelected ? cat.color : 'rgba(255, 255, 255, 0.08)'}`,
                              color: isSelected ? cat.color : 'var(--color-text-secondary)',
                              transition: 'all 0.15s'
                            }}
                          >
                            {cat.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Overall Experience Rating:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          style={{
                            fontSize: '1.4rem',
                            cursor: 'pointer',
                            color: star <= (hoverRating || rating) ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)',
                            transition: 'color 0.12s'
                          }}
                        >
                          ★
                        </span>
                      ))}
                      <span style={{ fontSize: '0.78rem', color: '#fbbf24', marginLeft: '6px', fontWeight: 700 }}>
                        {rating} of 5 Stars
                      </span>
                    </div>
                  </div>

                  {/* Name & Contact Info Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        Your Name / Designation:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. MV PRASAD (CTI)"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        style={{ width: '100%', borderRadius: '8px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        PF / HRMS / Contact No. (Optional):
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 24609272641 / 9876543210"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        style={{ width: '100%', borderRadius: '8px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Subject / Brief Summary: <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Need rest adjustment after 12805 arrival / Link 19 change inquiry"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      style={{ width: '100%', borderRadius: '8px', fontSize: '0.88rem' }}
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Detailed Feedback / Grievance Description: <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      className="form-input"
                      rows="4"
                      placeholder="Please provide full details of your feedback, grievance, train number, date, or suggestion..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      style={{ width: '100%', borderRadius: '8px', fontSize: '0.86rem', resize: 'vertical', lineHeight: 1.45 }}
                    />
                  </div>

                  {/* Submit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                      style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || !subject.trim() || !message.trim()}
                      style={{
                        padding: '8px 22px',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, var(--primary, #d4a15c), #b5833f)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'Submitting...' : '🚀 Submit Feedback to Administration'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: LIST FEEDBACKS */}
          {activeTab === 'LIST' && (
            <div>
              {/* Filter Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['ALL', 'OPEN', 'RESOLVED'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFeedbackFilter(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: feedbackFilter === st ? 'var(--primary, #d4a15c)' : 'rgba(255,255,255,0.06)',
                        color: feedbackFilter === st ? '#000' : 'var(--color-text-secondary)',
                        border: 'none'
                      }}
                    >
                      {st === 'ALL' ? 'All Submissions' : st}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={fetchFeedbacks}
                  disabled={loadingFeedbacks}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#a1a1aa',
                    cursor: 'pointer'
                  }}
                >
                  🔄 {loadingFeedbacks ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {/* Feedbacks List */}
              {loadingFeedbacks ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                  Loading submissions from database...
                </div>
              ) : filteredFeedbacks.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#a1a1aa', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  No feedback submissions recorded yet. Use the "Submit Feedback" tab to submit your first feedback!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredFeedbacks.map(f => {
                    const catObj = FEEDBACK_CATEGORIES.find(c => c.value === f.category);
                    const isResolved = f.status === 'RESOLVED';

                    return (
                      <div
                        key={f.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: `${catObj?.color || '#a855f7'}22`,
                              color: catObj?.color || '#a855f7',
                              border: `1px solid ${catObj?.color || '#a855f7'}44`
                            }}>
                              {f.category}
                            </span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
                              {f.subject}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>
                              {'★'.repeat(f.rating || 5)}{'☆'.repeat(5 - (f.rating || 5))}
                            </span>
                            <span style={{
                              fontSize: '0.70rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: isResolved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: isResolved ? '#34d399' : '#fbbf24',
                              border: `1px solid ${isResolved ? '#10b981' : '#f59e0b'}`
                            }}>
                              ● {f.status}
                            </span>
                          </div>
                        </div>

                        {/* Message body */}
                        <div style={{ fontSize: '0.82rem', color: '#d4d4d8', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {f.message}
                        </div>

                        {/* Admin Response banner if available */}
                        {f.admin_response && (
                          <div style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            fontSize: '0.78rem',
                            color: '#a7f3d0'
                          }}>
                            <strong>Officer / Admin Response:</strong> {f.admin_response}
                          </div>
                        )}

                        {/* Footer author & timestamp */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.72rem',
                          color: '#71717a',
                          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          paddingTop: '6px'
                        }}>
                          <span>
                            By <strong>{f.user_name || 'Staff'}</strong> {f.contact_info ? `(${f.contact_info})` : ''} • {new Date(f.created_at).toLocaleString()}
                          </span>

                          {isAdmin && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {!isResolved ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(f.id, 'RESOLVED', 'Reviewed and noted by Roster Administration.')}
                                  disabled={updatingId === f.id}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.70rem',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Mark Resolved
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(f.id, 'OPEN')}
                                  disabled={updatingId === f.id}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.70rem',
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Reopen
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteFeedback(f.id)}
                                disabled={updatingId === f.id}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.70rem',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
