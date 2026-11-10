import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X, KeyRound, ShieldAlert, CheckCircle2, ArrowLeft, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const PinModal = ({ isOpen, onClose, onSuccess }) => {
  const { getAuthHeaders, user } = useAuth();
  
  // mode: 'enter' | 'reset' | 'forgot' | 'forgot_new_pin'
  const [mode, setMode] = useState('enter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Enter mode state
  const [enterPin, setEnterPin] = useState(['', '', '', '']);
  const enterRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Reset mode state
  const [currentPin, setCurrentPin] = useState(['', '', '', '']);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const currentRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const newRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const confirmRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Forgot mode state
  const [forgotInfo, setForgotInfo] = useState(null);
  const [otpPin, setOtpPin] = useState(['', '', '', '']);
  const [forgotNewPin, setForgotNewPin] = useState(['', '', '', '']);
  const [forgotConfirmPin, setForgotConfirmPin] = useState(['', '', '', '']);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const forgotNewRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const forgotConfirmRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('enter');
      setError('');
      setSuccessMsg('');
      setLoading(false);
      setEnterPin(['', '', '', '']);
      setCurrentPin(['', '', '', '']);
      setNewPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setOtpPin(['', '', '', '']);
      setForgotNewPin(['', '', '', '']);
      setForgotConfirmPin(['', '', '', '']);
      setTimeout(() => {
        if (enterRefs[0].current) enterRefs[0].current.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Generic 4-digit input change handler
  const handleDigitChange = (index, value, stateArray, setStateArray, refsArray, onComplete = null) => {
    if (value && !/^\d$/.test(value)) return;

    const updated = [...stateArray];
    updated[index] = value;
    setStateArray(updated);
    setError('');

    // Auto advance
    if (value && index < 3 && refsArray[index + 1]?.current) {
      refsArray[index + 1].current.focus();
    }

    const fullCode = updated.join('');
    if (fullCode.length === 4 && onComplete) {
      onComplete(fullCode);
    }
  };

  const handleDigitKeyDown = (index, e, stateArray, refsArray) => {
    if (e.key === 'Backspace' && !stateArray[index] && index > 0 && refsArray[index - 1]?.current) {
      refsArray[index - 1].current.focus();
    }
  };

  // 1. Verify PIN (Enter Mode - Auto executes on 4th digit)
  const handleVerifyEnteredPin = async (pinValue) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-pin`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: pinValue })
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Incorrect 4-digit PIN');
      }

      // Success
      setEnterPin(['', '', '', '']);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Incorrect 4-digit PIN. Please try again.');
      setEnterPin(['', '', '', '']);
      setTimeout(() => {
        if (enterRefs[0].current) enterRefs[0].current.focus();
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  // 2. Reset PIN (Requires Current PIN + New PIN + Confirm PIN)
  const handleResetSubmit = async (e) => {
    if (e) e.preventDefault();
    const currStr = currentPin.join('');
    const newStr = newPin.join('');
    const confirmStr = confirmPin.join('');

    if (currStr.length !== 4) {
      setError('Please enter your complete 4-digit current PIN.');
      return;
    }
    if (newStr.length !== 4) {
      setError('Please enter a 4-digit new PIN.');
      return;
    }
    if (newStr !== confirmStr) {
      setError('New PIN and confirmation PIN do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-pin`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPin: currStr,
          newPin: newStr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update PIN');
      }

      setSuccessMsg('Security PIN updated successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setMode('enter');
        setEnterPin(['', '', '', '']);
        setTimeout(() => {
          if (enterRefs[0].current) enterRefs[0].current.focus();
        }, 100);
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Forgot PIN Flow
  const handleTriggerForgotPin = async () => {
    try {
      setLoading(true);
      setError('');
      setMode('forgot');
      
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-pin`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process forgot PIN');
      }

      setForgotInfo(data);
      setTimeout(() => {
        if (otpRefs[0].current) otpRefs[0].current.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Code is checked by the server when the new PIN is saved
  const handleVerifyOtp = () => {
    setMode('forgot_new_pin');
    setError('');
    setTimeout(() => {
      if (forgotNewRefs[0].current) forgotNewRefs[0].current.focus();
    }, 100);
  };

  // Save new PIN after OTP verification
  const handleSaveForgotNewPin = async () => {
    const newStr = forgotNewPin.join('');
    const confirmStr = forgotConfirmPin.join('');

    if (newStr.length !== 4) {
      setError('Please enter a 4-digit new PIN.');
      return;
    }
    if (newStr !== confirmStr) {
      setError('New PIN and confirmation PIN do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-pin-with-code`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: otpPin.join(''),
          newPin: newStr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // Wrong or expired code: send the user back to re-enter it
          setMode('forgot');
          setOtpPin(['', '', '', '']);
        }
        throw new Error(data.error || 'Failed to set new PIN');
      }

      setSuccessMsg('PIN successfully updated & workspace unlocked!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      {/* Translucent Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9999998
        }}
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div 
        className="glass-card"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          maxWidth: '92vw',
          background: 'var(--bg-tertiary, rgba(15, 23, 42, 0.94))',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          borderRadius: '22px',
          padding: '1.75rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          zIndex: 9999999,
          color: 'var(--text-primary)',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: mode === 'forgot' || mode === 'forgot_new_pin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.12)',
              border: mode === 'forgot' || mode === 'forgot_new_pin' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
            }}>
              {mode === 'enter' && <Lock size={20} color="var(--accent-primary)" />}
              {mode === 'reset' && <KeyRound size={20} color="var(--accent-primary)" />}
              {(mode === 'forgot' || mode === 'forgot_new_pin') && <Mail size={20} color="#f43f5e" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                {mode === 'enter' && 'Unlock Personal Workspace'}
                {mode === 'reset' && 'Reset Security PIN'}
                {mode === 'forgot' && 'Forgot Workspace PIN'}
                {mode === 'forgot_new_pin' && 'Create New PIN'}
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {mode === 'enter' && 'Enter your 4-digit PIN to proceed'}
                {mode === 'reset' && 'Provide current PIN to authorize changes'}
                {mode === 'forgot' && 'Verification code dispatched to your email'}
                {mode === 'forgot_new_pin' && 'Set a new 4-digit workspace PIN'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'rgba(255, 255, 255, 0.03)', 
              border: '1px solid var(--border-light)', 
              color: 'var(--text-muted)', 
              cursor: 'pointer', 
              padding: '6px', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 45, 85, 0.15)';
              e.currentTarget.style.color = '#ff2d55';
              e.currentTarget.style.borderColor = 'rgba(255, 45, 85, 0.3)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ----------------- MODE 1: ENTER PIN (Auto-opens on 4th digit) ----------------- */}
        {mode === 'enter' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', margin: '1.75rem 0' }}>
              {enterPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={enterRefs[idx]}
                  type="password"
                  maxLength={1}
                  disabled={loading}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value, enterPin, setEnterPin, enterRefs, handleVerifyEnteredPin)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e, enterPin, enterRefs)}
                  style={{
                    width: '48px',
                    height: '54px',
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 600,
                    borderRadius: '12px',
                    background: digit ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: digit ? '1.5px solid var(--accent-primary)' : error ? '1.5px solid #ff2d55' : '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    boxShadow: digit ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onFocus={(e) => {
                    if (!digit) {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(99, 102, 241, 0.25)';
                    }
                  }}
                  onBlur={(e) => {
                    if (!digit) {
                      e.currentTarget.style.borderColor = error ? '#ff2d55' : 'var(--border-light)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: '#ff2d55', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', margin: '-0.75rem 0 1.25rem 0', animation: 'fadeIn 0.15s ease' }}>
                {error}
              </p>
            )}

            {/* Bottom Footer Action: Forgot PIN? (Reset PIN moved to Settings) */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={handleTriggerForgotPin}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#f43f5e';
                  e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Forgot PIN?
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 2: RESET PIN (Requires Current PIN + 2x New PIN) ----------------- */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', margin: '1rem 0' }}>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  1. Current PIN
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {currentPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={currentRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, currentPin, setCurrentPin, currentRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, currentPin, currentRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  2. New 4-Digit PIN
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {newPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={newRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, newPin, setNewPin, newRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, newPin, newRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  3. Confirm New PIN
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {confirmPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={confirmRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, confirmPin, setConfirmPin, confirmRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, confirmPin, confirmRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p style={{ color: '#ff2d55', fontSize: '0.72rem', fontWeight: 600, margin: '-0.25rem 0 0.75rem 0' }}>
                {error}
              </p>
            )}

            {successMsg && (
              <p style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600, margin: '-0.25rem 0 0.75rem 0' }}>
                {successMsg}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('enter');
                  setError('');
                  setTimeout(() => {
                    if (enterRefs[0].current) enterRefs[0].current.focus();
                  }, 100);
                }}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="mirror-btn-pill dsa-submit"
                style={{
                  flex: 1.5,
                  padding: '0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '10px'
                }}
              >
                Update PIN
              </button>
            </div>
          </form>
        )}

        {/* ----------------- MODE 3: FORGOT PIN SIMULATION (Sends OTP to email) ----------------- */}
        {mode === 'forgot' && (
          <div>
            <div style={{
              background: 'rgba(244, 63, 94, 0.06)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: '12px',
              padding: '0.85rem',
              margin: '1rem 0',
              fontSize: '0.75rem',
              lineHeight: '1.45',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f43f5e', fontWeight: 600, marginBottom: '0.25rem' }}>
                <Mail size={14} />
                <span>Security Reset Dispatched</span>
              </div>
              <p style={{ margin: 0 }}>
                We've sent a 4-digit verification code to your registered email <strong style={{ color: 'var(--text-primary)' }}>{forgotInfo?.maskedEmail || user?.email || 'your email'}</strong>. Please check your inbox and enter the code below.
              </p>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', textAlign: 'center' }}>
                Enter Dispatched 4-Digit OTP
              </label>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.55rem' }}>
                {otpPin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="password"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value, otpPin, setOtpPin, otpRefs, handleVerifyOtp)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e, otpPin, otpRefs)}
                    style={{
                      width: '44px',
                      height: '48px',
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      fontWeight: 600,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: digit ? '1.5px solid #f43f5e' : '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p style={{ color: '#ff2d55', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', margin: '0.25rem 0 0.5rem 0' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('enter');
                  setError('');
                  setTimeout(() => {
                    if (enterRefs[0].current) enterRefs[0].current.focus();
                  }, 100);
                }}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ← Back to Unlock
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 4: FORGOT PIN (Set brand new PIN after OTP verification) ----------------- */}
        {mode === 'forgot_new_pin' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', margin: '1rem 0' }}>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  1. Set New 4-Digit PIN
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {forgotNewPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={forgotNewRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, forgotNewPin, setForgotNewPin, forgotNewRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, forgotNewPin, forgotNewRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  2. Confirm New 4-Digit PIN
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {forgotConfirmPin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={forgotConfirmRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value, forgotConfirmPin, setForgotConfirmPin, forgotConfirmRefs)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, forgotConfirmPin, forgotConfirmRefs)}
                      style={{
                        width: '38px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: digit ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p style={{ color: '#ff2d55', fontSize: '0.72rem', fontWeight: 600, margin: '-0.25rem 0 0.75rem 0' }}>
                {error}
              </p>
            )}

            {successMsg && (
              <p style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600, margin: '-0.25rem 0 0.75rem 0' }}>
                {successMsg}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('enter');
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveForgotNewPin}
                disabled={loading}
                className="mirror-btn-pill dsa-submit"
                style={{
                  flex: 1.5,
                  padding: '0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '10px'
                }}
              >
                Save & Unlock
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default PinModal;
