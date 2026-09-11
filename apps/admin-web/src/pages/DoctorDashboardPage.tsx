import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/DoctorDashboard.css';

export function DoctorDashboardPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'appointments' | 'patients' | 'earnings' | 'messages' | 'profile'>('home');

  const appointments = [
    { id: '1', patientName: 'Amara Okafor', time: '10:00 AM', type: 'In-Person', status: 'confirmed' },
    { id: '2', patientName: 'John Adeyemi', time: '11:30 AM', type: 'Video Call', status: 'pending' },
  ];

  const patients = [
    { id: '1', name: 'Amara Okafor', condition: 'Hypertension', lastVisit: '2 weeks ago' },
    { id: '2', name: 'John Adeyemi', condition: 'Diabetes', lastVisit: '1 month ago' },
  ];

  return (
    <div className="doctor-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>

        <StatusBar />

        <div className="app-bar">
          <h1 className="app-title">Dr. Chidi</h1>
          <div className="app-icons">
            <span>🔔</span>
            <span>👤</span>
          </div>
        </div>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="home-screen">
            <div className="greeting">
              <h2>Welcome back 👋</h2>
              <p>Cardiologist • Lagos General</p>
            </div>

            {/* STATS GRID */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">📅</span>
                <div className="stat-value">12</div>
                <div className="stat-label">Today</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">💰</span>
                <div className="stat-value">₦45K</div>
                <div className="stat-label">Earnings</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">⭐</span>
                <div className="stat-value">4.8</div>
                <div className="stat-label">Rating</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">👥</span>
                <div className="stat-value">127</div>
                <div className="stat-label">Patients</div>
              </div>
            </div>

            {/* TODAY'S SCHEDULE */}
            <div className="upcoming-section">
              <div className="section-header">
                <h3>📅 Today's Schedule</h3>
                <a href="#">See All</a>
              </div>

              {appointments.map(apt => (
                <div key={apt.id} className="appointment-item">
                  <div className="avatar">👤</div>
                  <div className="appointment-info">
                    <h4>{apt.patientName}</h4>
                    <p>{apt.type} • {apt.time}</p>
                  </div>
                  <span className={`status ${apt.status}`}>
                    {apt.status === 'confirmed' ? '✓' : '⏳'}
                  </span>
                </div>
              ))}
            </div>

            {/* QUICK ACTIONS */}
            <div className="quick-actions">
              <button className="action-btn">
                <span>📞</span>
                <span>Call</span>
              </button>
              <button className="action-btn">
                <span>📋</span>
                <span>Notes</span>
              </button>
              <button className="action-btn">
                <span>💊</span>
                <span>Prescribe</span>
              </button>
              <button className="action-btn">
                <span>📊</span>
                <span>Reports</span>
              </button>
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📅 All Appointments</h3>
            </div>

            {appointments.map(apt => (
              <div key={apt.id} className="appointment-item">
                <div className="avatar">👤</div>
                <div className="appointment-info">
                  <h4>{apt.patientName}</h4>
                  <p>{apt.type} • {apt.time}</p>
                </div>
                <span className={`status ${apt.status}`}>
                  {apt.status === 'confirmed' ? '✓' : '⏳'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* PATIENTS TAB */}
        {activeTab === 'patients' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>👥 My Patients</h3>
            </div>

            {patients.map(patient => (
              <div key={patient.id} className="patient-item">
                <div className="avatar">👤</div>
                <div className="patient-info">
                  <h4>{patient.name}</h4>
                  <p>{patient.condition}</p>
                  <small>Last visit: {patient.lastVisit}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <div className="home-screen">
            <div className="earnings-card">
              <h3>Today's Earnings</h3>
              <div className="amount">₦45,000</div>
              <p className="period">12 consultations completed</p>
            </div>

            <div className="earnings-card">
              <h3>This Month</h3>
              <div className="amount">₦845,000</div>
              <p className="period">156 consultations</p>
            </div>

            <div className="earnings-card">
              <h3>Total Earnings</h3>
              <div className="amount">₦2.4M</div>
              <p className="period">Member since Jan 2025</p>
            </div>
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>💬 Messages</h3>
            </div>

            <div className="message-item">
              <div className="avatar">👤</div>
              <div className="message-info">
                <h4>Amara Okafor</h4>
                <p>Thanks for the consultation doc 👍</p>
              </div>
              <span className="time">2h</span>
            </div>

            <div className="message-item">
              <div className="avatar">👤</div>
              <div className="message-info">
                <h4>John Adeyemi</h4>
                <p>Can I reschedule my appointment?</p>
              </div>
              <span className="time">5h</span>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="home-screen">
            <div className="profile-header">
              <div className="avatar-large">👨‍⚕️</div>
              <h2>Dr. Chidi Obinna</h2>
              <p>Cardiologist</p>
            </div>

            <div className="profile-section">
              <h3>Professional Details</h3>
              <div className="profile-item">
                <span className="label">License No:</span>
                <span className="value">MD-2024-001</span>
              </div>
              <div className="profile-item">
                <span className="label">Hospital:</span>
                <span className="value">Lagos General</span>
              </div>
              <div className="profile-item">
                <span className="label">Experience:</span>
                <span className="value">8 years</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }}>Edit Profile</button>
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
            className={`nav-btn ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Appts</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Patients</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            <span className="nav-icon">💰</span>
            <span className="nav-label">Earnings</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Messages</span>
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
