import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import '../styles/SignupPage.css';

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [provider, setProvider] = useState('');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // CLEAR ERROR WHEN STEP CHANGES
  useEffect(() => {
    setError('');
  }, [step]);

  const validateEmail = (e: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  };

  const validatePasswordStrength = (pwd: string) => {
    const hasLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    return hasLength && hasUpper && hasLower && hasNumber;
  };

  const selectRole = (selectedRole: string) => {
    setRole(selectedRole);
    if (selectedRole === 'patient') {
      setStep(3);
    } else {
      setStep(2);
    }
  };

  const selectProvider = (selectedProvider: string) => {
    setProvider(selectedProvider);
    setStep(3);
  };

  const continueToPassword = () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email (example@domain.com)');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }
    setStep(4);
  };

  const createAccount = async () => {
    // PASSWORD VALIDATION
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must include at least one uppercase letter (A-Z)');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must include at least one lowercase letter (a-z)');
      return;
    }

    if (!/\d/.test(password)) {
      setError('Password must include at least one number (0-9)');
      return;
    }

    if (!confirmPassword.trim()) {
      setError('Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!terms) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    // ALL VALIDATIONS PASSED - SUBMIT
    setLoading(true);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          phone: phone.trim(),
          password,
          role: role === 'patient' ? 'PATIENT' : provider.toUpperCase(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Registration failed (${response.status})`);
      }

      const data = await response.json();
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      setStep(5);
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      clearTimeout(timeout);
      console.error('Registration error:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>
        <StatusBar />

        {/* STEP 1: ROLE SELECTION */}
        {step === 1 && (
          <div className="signup-content">
            <div className="signup-header">
              <h1>Welcome to N-Health</h1>
              <p>Create your account</p>
            </div>

            <div className="role-options">
              <button className="role-btn patient-btn" onClick={() => selectRole('patient')}>
                <span className="icon">👤</span>
                <span className="label">Patient</span>
                <span className="desc">Access healthcare services</span>
              </button>
              <button className="role-btn provider-btn" onClick={() => selectRole('provider')}>
                <span className="icon">🏥</span>
                <span className="label">Provider</span>
                <span className="desc">Doctor, Pharmacy, Lab, etc.</span>
              </button>
            </div>

            <p className="already-account">
              Already have an account? <a href="/login">Sign In</a>
            </p>
          </div>
        )}

        {/* STEP 2: PROVIDER TYPE */}
        {step === 2 && (
          <div className="signup-content">
            <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
            <div className="signup-header">
              <h2>Select Your Role</h2>
              <p>What type of provider are you?</p>
            </div>

            <div className="provider-options">
              <button className="provider-btn" onClick={() => selectProvider('doctor')}>
                <span className="icon">👨‍⚕️</span>
                <span className="label">Doctor</span>
              </button>
              <button className="provider-btn" onClick={() => selectProvider('nurse')}>
                <span className="icon">👩‍⚕️</span>
                <span className="label">Nurse</span>
              </button>
              <button className="provider-btn" onClick={() => selectProvider('pharmacy')}>
                <span className="icon">💊</span>
                <span className="label">Pharmacy</span>
              </button>
              <button className="provider-btn" onClick={() => selectProvider('lab')}>
                <span className="icon">🔬</span>
                <span className="label">Lab</span>
              </button>
              <button className="provider-btn" onClick={() => selectProvider('ambulance')}>
                <span className="icon">🚑</span>
                <span className="label">Ambulance</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS */}
        {step === 3 && (
          <div className="signup-content">
            <button className="back-btn" onClick={() => setStep(role === 'provider' ? 2 : 1)}>← Back</button>
            <div className="signup-header">
              <h2>Your Information</h2>
              <p>{role === 'patient' ? 'Patient Details' : provider ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Details` : 'Details'}</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="signup-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input 
                    type="text" 
                    placeholder="John" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input 
                    type="text" 
                    placeholder="Doe" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  placeholder="john@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="+234 901 234 5678" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                />
              </div>

              <button className="btn btn-primary" onClick={continueToPassword}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PASSWORD */}
        {step === 4 && (
          <div className="signup-content">
            <button className="back-btn" onClick={() => setStep(3)}>← Back</button>
            <div className="signup-header">
              <h2>Set Your Password</h2>
              <p>Create a strong password</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="signup-form">
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  autoComplete="new-password"
                />
                <small>Requirements:</small>
                <small style={{ color: password.length >= 8 ? '#34A853' : '#EA4335' }}>
                  {password.length >= 8 ? '✓' : '✗'} At least 8 characters
                </small>
                <small style={{ color: /[A-Z]/.test(password) ? '#34A853' : '#EA4335' }}>
                  {/[A-Z]/.test(password) ? '✓' : '✗'} One uppercase letter (A-Z)
                </small>
                <small style={{ color: /[a-z]/.test(password) ? '#34A853' : '#EA4335' }}>
                  {/[a-z]/.test(password) ? '✓' : '✗'} One lowercase letter (a-z)
                </small>
                <small style={{ color: /\d/.test(password) ? '#34A853' : '#EA4335' }}>
                  {/\d/.test(password) ? '✓' : '✗'} One number (0-9)
                </small>
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group checkbox">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={terms} 
                  onChange={(e) => setTerms(e.target.checked)} 
                />
                <label htmlFor="terms">
                  I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
                </label>
              </div>

              <button 
                className="btn btn-primary" 
                disabled={loading} 
                onClick={createAccount}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <p className="signin-link">
                Already have an account? <a href="/login">Sign In</a>
              </p>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS */}
        {step === 5 && (
          <div className="signup-content success-content">
            <div className="success-icon">✅</div>
            <h2>Account Created!</h2>
            <p>Welcome to N-Health</p>
            <p className="small">Redirecting to dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
