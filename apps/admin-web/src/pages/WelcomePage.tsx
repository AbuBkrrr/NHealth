import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/WelcomePage.css';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="welcome-page">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-logo">
            <span className="logo-icon">🏥</span>
            <span className="logo-text">N-Health</span>
          </div>
          <div className="navbar-buttons">
            <button className="btn btn-outline" onClick={() => navigate('/login')}>
              Sign In
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/signup')}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Complete Healthcare Ecosystem</h1>
            <p className="hero-subtitle">
              Connect with doctors, nurses, pharmacies, labs, and ambulances in one unified platform
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
                Get Started Free
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
                Already a member? Sign In
              </button>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-graphic">🏥</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="features-container">
          <h2 className="section-title">Why Choose N-Health?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">👨‍⚕️</div>
              <h3>For Patients</h3>
              <p>Easy access to healthcare providers, appointment booking, and medical records management</p>
              <ul className="feature-list">
                <li>✓ Find trusted doctors</li>
                <li>✓ Book appointments instantly</li>
                <li>✓ Access prescriptions</li>
                <li>✓ Lab test results online</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚕️</div>
              <h3>For Doctors</h3>
              <p>Grow your practice with more patients and streamlined appointment management</p>
              <ul className="feature-list">
                <li>✓ Manage appointments</li>
                <li>✓ Build patient relationships</li>
                <li>✓ Track earnings</li>
                <li>✓ Secure patient data</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">👩‍⚕️</div>
              <h3>For Nurses</h3>
              <p>Find flexible opportunities and connect with patients who need care</p>
              <ul className="feature-list">
                <li>✓ Set availability</li>
                <li>✓ Receive requests</li>
                <li>✓ Manage earnings</li>
                <li>✓ Build reputation</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💊</div>
              <h3>For Pharmacies</h3>
              <p>Reach more customers and simplify medication delivery</p>
              <ul className="feature-list">
                <li>✓ Online orders</li>
                <li>✓ Delivery management</li>
                <li>✓ Inventory tracking</li>
                <li>✓ Sales analytics</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔬</div>
              <h3>For Labs</h3>
              <p>Streamline test management and deliver results instantly</p>
              <ul className="feature-list">
                <li>✓ Manage test requests</li>
                <li>✓ Digital reports</li>
                <li>✓ Automated results</li>
                <li>✓ Revenue tracking</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🚑</div>
              <h3>For Ambulances</h3>
              <p>Get emergency calls and manage emergency response efficiently</p>
              <ul className="feature-list">
                <li>✓ Emergency alerts</li>
                <li>✓ Route optimization</li>
                <li>✓ Trip history</li>
                <li>✓ Performance tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-number">50K+</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">10K+</div>
            <div className="stat-label">Healthcare Providers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">100K+</div>
            <div className="stat-label">Appointments Booked</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">₦50M+</div>
            <div className="stat-label">Transactions</div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="how-it-works-container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Create Account</h3>
              <p>Sign up as patient or healthcare provider</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Complete Profile</h3>
              <p>Add your information and preferences</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Start Using</h3>
              <p>Access services and manage your healthcare</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Get Support</h3>
              <p>24/7 customer support is always available</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-container">
          <h2>Ready to Transform Your Healthcare?</h2>
          <p>Join thousands of users already using N-Health</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
            Start Free Trial Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-column">
            <h4>N-Health</h4>
            <p>Complete healthcare ecosystem</p>
          </div>
          <div className="footer-column">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#about">About</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <ul>
              <li><a href="/terms">Terms & Conditions</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Follow Us</h4>
            <div className="social-links">
              <a href="#">Twitter</a>
              <a href="#">Facebook</a>
              <a href="#">LinkedIn</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 N-Health. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
