import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { StatusBar } from '../components/StatusBar';
import '../styles/LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<'PATIENT' | 'DOCTOR' | 'NURSE' | 'PHARMACY' | 'LAB' | 'AMBULANCE' | 'ADMIN' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdminCard, setShowAdminCard] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMsg = getErrorMessage(err, 'Login failed. Please try again.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>
        <StatusBar />

        <div className="login-content">
          {/* Header */}
          <div className="login-header">
            <div className="logo">🏥</div>
            <h1>Welcome to N-Health</h1>
            <p>Sign in to continue</p>
          </div>

          {/* Role Selection Dropdown */}
          <div className="role-selection-section">
            <div className="role-buttons-grid">
              {/* Patient Button */}
              <button
                className={`role-option patient-option ${selectedRole === 'PATIENT' ? 'selected' : ''}`}
                onClick={() => setSelectedRole('PATIENT')}
              >
                <span className="icon">👤</span>
                <span className="label">Patient</span>
                <span className="desc">Access healthcare services</span>
              </button>

              {/* Provider Button */}
              <button
                className={`role-option provider-option ${selectedRole ? selectedRole !== 'PATIENT' ? 'selected' : '' : ''}`}
                onClick={() => setSelectedRole('DOCTOR')}
              >
                <span className="icon">🏥</span>
                <span className="label">Provider</span>
                <span className="desc">Doctor, Pharmacy, Lab, etc.</span>
              </button>
            </div>

            {/* Provider Submenu */}
            {selectedRole && selectedRole !== 'PATIENT' && (
              <div className="provider-submenu">
                <button
                  className={`provider-btn ${selectedRole === 'DOCTOR' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('DOCTOR')}
                >
                  👨‍⚕️ Doctor
                </button>
                <button
                  className={`provider-btn ${selectedRole === 'NURSE' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('NURSE')}
                >
                  👩‍⚕️ Nurse
                </button>
                <button
                  className={`provider-btn ${selectedRole === 'PHARMACY' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('PHARMACY')}
                >
                  💊 Pharmacy
                </button>
                <button
                  className={`provider-btn ${selectedRole === 'LAB' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('LAB')}
                >
                  🔬 Lab
                </button>
                <button
                  className={`provider-btn ${selectedRole === 'AMBULANCE' ? 'active' : ''}`}
                  onClick={() => setSelectedRole('AMBULANCE')}
                >
                  🚑 Ambulance
                </button>
              </div>
            )}
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !selectedRole}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="signup-link">
            Don't have an account? <a href="/signup">Sign Up</a>
          </p>

          {/* Institution/Admin Section - Hidden at bottom */}
          <div className="admin-section">
            <button
              className="admin-toggle"
              onClick={() => setShowAdminCard(!showAdminCard)}
              title="Click for institutional/admin access"
            >
              ⚙️
            </button>

            {showAdminCard && (
              <div className="admin-card">
                <div className="admin-content">
                  <h3>🏛️ Institutional Access</h3>
                  <p>Clinics, Hospitals & Health Centers</p>
                  <button
                    className="btn btn-admin"
                    onClick={() => {
                      setSelectedRole('ADMIN');
                      // Focus on email field
                      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
                      if (emailInput) emailInput.focus();
                    }}
                  >
                    Admin Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
