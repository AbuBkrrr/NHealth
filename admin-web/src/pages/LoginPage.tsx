import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from '../components/StatusBar';
import '../styles/LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'role' | 'credentials'>('role');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'provider' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: 'patient' | 'provider') => {
    setSelectedRole(role);
    setStep('credentials');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate inputs
      if (!email.trim()) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }

      // BACKEND LOGIN (REQUIRED - No fallback)
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Phone Frame */}
      <div className="phone-frame">
        {/* Notch */}
        <div className="phone-notch"></div>

        {/* Real-Time Status Bar */}
        <StatusBar />

        {step === 'role' ? (
          // Role Selection Screen
          <div className="login-content">
            <div className="logo-section">
              <div className="logo">🏥</div>
              <h1>N-Health</h1>
              <p>Complete Health Ecosystem</p>
            </div>

            <div className="role-selection">
              <button
                className="role-btn patient-btn"
                onClick={() => handleRoleSelect('patient')}
              >
                <span className="icon">👤</span>
                <span className="label">Patient</span>
                <span className="desc">Access healthcare services</span>
              </button>

              <button
                className="role-btn provider-btn"
                onClick={() => handleRoleSelect('provider')}
              >
                <span className="icon">🏥</span>
                <span className="label">Provider</span>
                <span className="desc">Doctor, Pharmacy, Lab</span>
              </button>
            </div>
          </div>
        ) : (
          // Credentials Screen
          <div className="login-content">
            <button className="back-btn" onClick={() => setStep('role')}>
              ← Back
            </button>

            <div className="credentials-header">
              <h2>Welcome to N-Health</h2>
              <p>Sign in to continue</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="credentials-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="your.email@healthprovider.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <p className="signup-link">
              Don't have an account? <a href="/signup">Sign Up</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
