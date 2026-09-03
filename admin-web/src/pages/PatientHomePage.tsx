import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/PatientHome.css';

export function PatientHomePage() {
  const [activeTab, setActiveTab] = useState<'home' | 'emergency' | 'bookings' | 'pharmacy' | 'providers' | 'profile'>('home');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <div className="patient-container">
      {/* PHONE FRAME */}
      <div className="phone-frame">
        {/* NOTCH */}
        <div className="phone-notch"></div>

        {/* STATUS BAR */}
        <StatusBar />

        {/* APP BAR */}
        <div className="app-bar">
          <h1 className="app-title">N-Health</h1>
          <div className="app-icons">
            <span>🔔</span>
            <span>👤</span>
          </div>
        </div>

        {/* HOME SCREEN */}
        {activeTab === 'home' && (
          <div className="home-screen">
            <div className="greeting">
              <h2>Hello, 👋 John</h2>
              <p>Your complete health companion</p>
            </div>

            {/* WALLET CARD */}
            <div className="wallet-card">
              <div className="wallet-header">
                <span>Wallet Balance</span>
              </div>
              <div className="wallet-amount">
                <h3>₦245,750.00</h3>
                <p>✓ NHIS Active</p>
              </div>
              <div className="wallet-actions">
                <button className="btn-primary">💰 Fund</button>
                <button className="btn-outline">📋 History</button>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="quick-actions">
              <button className="action-btn emergency">
                <span>🚨</span>
                <span>Emergency</span>
              </button>
              <button className="action-btn">
                <span>📅</span>
                <span>Appointments</span>
              </button>
              <button className="action-btn pharmacy">
                <span>💊</span>
                <span>Pharmacy</span>
              </button>
              <button className="action-btn">
                <span>🧬</span>
                <span>Labs</span>
              </button>
            </div>

            {/* QUICK ACTIONS ROW 2 */}
            <div className="quick-actions">
              <button className="action-btn">
                <span>🏥</span>
                <span>Providers</span>
              </button>
              <button className="action-btn">
                <span>❤️</span>
                <span>Donate</span>
              </button>
              <button className="action-btn">
                <span>🛡️</span>
                <span>Insurance</span>
              </button>
              <button className="action-btn">
                <span>💬</span>
                <span>Messages</span>
              </button>
            </div>

            {/* UPCOMING */}
            <div className="upcoming-section">
              <div className="section-header">
                <h3>📅 Upcoming</h3>
                <a href="#">See All</a>
              </div>

              <div className="appointment-item">
                <div className="avatar">👨‍⚕️</div>
                <div className="appointment-info">
                  <h4>Dr. Adebayo Ogunlesi</h4>
                  <p>Cardiology • Today, 10:00 AM</p>
                </div>
                <span className="time">Today</span>
              </div>

              <div className="appointment-item">
                <div className="avatar">👩‍⚕️</div>
                <div className="appointment-info">
                  <h4>Nurse Funmi Adeyemi</h4>
                  <p>Pediatric • Tomorrow, 2:00 PM</p>
                </div>
                <span className="time yellow">Tomorrow</span>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div className="bottom-nav">
          <button 
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            <span className="nav-icon">🚨</span>
            <span className="nav-label">Emergency</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Bookings</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'pharmacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('pharmacy')}
          >
            <span className="nav-icon">💊</span>
            <span className="nav-label">Pharmacy</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            <span className="nav-icon">🏥</span>
            <span className="nav-label">Providers</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-label">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
