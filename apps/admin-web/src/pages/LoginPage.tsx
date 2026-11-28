import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, TwoFactorStep } from '../context/AuthContext';
import { api } from '../api/client';
import { getErrorMessage } from '../api/client';

export function LoginPage() {
  const { login, verify2fa } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<TwoFactorStep | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (step) { await verify2fa(step.challenge, code); navigate('/'); return; }
      const next = await login(email, password);
      if (next) { setStep(next); return; }
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/icon.svg" alt="" width={56} height={56} style={{ display: "block", margin: "0 auto 8px", borderRadius: 14 }} />
        <h1>N-Health</h1>
        <p className="subtitle">Admin Panel</p>
        {error && <div className="error-text">{error}</div>}
        {step && (
          <div>
            <p className="subtitle">{step.method === 'email' ? `Enter the 6-digit code we emailed to ${step.sentTo}.` : 'Enter the 6-digit code from your authenticator app.'}</p>
            <input autoFocus inputMode="numeric" placeholder="Code (or a backup code)" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            <button type="submit" disabled={loading} style={{ width: '100%' }}>{loading ? 'Checking…' : 'Verify'}</button>
            {step.method === 'email' && <button type="button" className="outline" style={{ width: '100%', marginTop: 8 }} onClick={() => api.post('/auth/2fa/resend', { challenge: step.challenge }).then(() => setError('A new code was sent.')).catch(() => setError('Could not send a new code'))}>Send a new code</button>}
            <button type="button" className="outline" style={{ width: '100%', marginTop: 8 }} onClick={() => { setStep(null); setCode(''); }}>Back</button>
          </div>
        )}
        {!step && (<>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" style={{ width: '100%' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      
        </>)}
      </form>
    </div>
  );
}
