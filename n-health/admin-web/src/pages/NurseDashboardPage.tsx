import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/NurseDashboard.css';

export function NurseDashboardPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'patients' | 'schedule' | 'vitals' | 'messages' | 'profile'>('home');

  const patients = [
    { id: '1', name: 'Amara Okafor', room: '304', condition: 'Post-Op', status: 'stable' },
    { id: '2', name: 'John Adeyemi', room: '312', condition: 'Acute Care', status: 'monitoring' },
  ];

  return (
    <div className="nurse-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>

        <StatusBar />

        <div className="app-bar">
          <h1 className="app-title">Nurse Funmi</h1>
          <div className="app-icons">
            <span>🔔</span>
            <span>👤</span>
          </div>
        </div>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="home-screen">
            <div className="greeting">
              <h2>Welcome, Funmi 👋</h2>
              <p>General Ward • Morning Shift</p>
            </div>

            {/* SHIFT CARD */}
            <div className="shift-card">
              <div className="shift-header">
                <span>Current Shift</span>
                <span className="shift-time">7:30 AM - 3:30 PM</span>
              </div>
              <div className="shift-stats">
                <div className="stat">
                  <div className="num">8</div>
                  <div className="label">Patients</div>
                </div>
                <div className="stat">
                  <div className="num">3</div>
                  <div className="label">Critical</div>
                </div>
                <div className="stat">
                  <div className="num">2</div>
                  <div className="label">Pending</div>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="quick-actions">
              <button className="action-btn">
                <span>🩺</span>
                <span>Vitals</span>
              </button>
              <button className="action-btn">
                <span>💊</span>
                <span>Meds</span>
              </button>
              <button className="action-btn">
                <span>📋</span>
                <span>Notes</span>
              </button>
              <button className="action-btn">
                <span>🚑</span>
                <span>Alert</span>
              </button>
            </div>

            {/* PATIENTS ON DUTY */}
            <div className="upcoming-section">
              <div className="section-header">
                <h3>👥 Assigned Patients</h3>
                <a href="#">See All</a>
              </div>

              {patients.map(patient => (
                <div key={patient.id} className="patient-card">
                  <div className="patient-header">
                    <div className="room-badge">Room {patient.room}</div>
                    <span className={`status-badge ${patient.status}`}>
                      {patient.status === 'stable' ? '✓ Stable' : '⚠️ Monitoring'}
                    </span>
                  </div>
                  <h4>{patient.name}</h4>
                  <p>{patient.condition}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PATIENTS TAB */}
        {activeTab === 'patients' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>👥 All Patients</h3>
            </div>

            {patients.map(patient => (
              <div key={patient.id} className="patient-card">
                <div className="patient-header">
                  <div className="room-badge">Room {patient.room}</div>
                  <span className={`status-badge ${patient.status}`}>
                    {patient.status === 'stable' ? '✓' : '⚠️'}
                  </span>
                </div>
                <h4>{patient.name}</h4>
                <p>{patient.condition}</p>
              </div>
            ))}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📅 Schedule</h3>
            </div>

            <div className="schedule-card">
              <h4>Today - Morning Shift</h4>
              <div className="time-range">7:30 AM - 3:30 PM</div>
              <p className="ward">General Ward</p>
            </div>

            <div className="schedule-card">
              <h4>Tomorrow - Night Shift</h4>
              <div className="time-range">10:00 PM - 6:00 AM</div>
              <p className="ward">ICU</p>
            </div>
          </div>
        )}

        {/* VITALS TAB */}
        {activeTab === 'vitals' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>🩺 Patient Vitals</h3>
            </div>

            <div className="vitals-card">
              <div className="vitals-header">
                <h4>Amara Okafor</h4>
                <span className="time">Room 304</span>
              </div>
              <div className="vitals-grid">
                <div className="vital">
                  <span className="label">BP</span>
                  <span className="value">120/80</span>
                  <span className="status">Normal</span>
                </div>
                <div className="vital">
                  <span className="label">HR</span>
                  <span className="value">72</span>
                  <span className="status">Normal</span>
                </div>
                <div className="vital">
                  <span className="label">O2</span>
                  <span className="value">98%</span>
                  <span className="status">Normal</span>
                </div>
                <div className="vital">
                  <span className="label">Temp</span>
                  <span className="value">36.8°C</span>
                  <span className="status">Normal</span>
                </div>
              </div>
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
              <div className="avatar">👨‍⚕️</div>
              <div className="message-info">
                <h4>Dr. Chidi</h4>
                <p>Check vitals for patient in 304</p>
              </div>
              <span className="time">10m</span>
            </div>

            <div className="message-item">
              <div className="avatar">👥</div>
              <div className="message-info">
                <h4>Shift Team</h4>
                <p>Handover meeting at 3:30 PM</p>
              </div>
              <span className="time">25m</span>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="home-screen">
            <div className="profile-header">
              <div className="avatar-large">👩‍⚕️</div>
              <h2>Funmi Adeyemi</h2>
              <p>Registered Nurse (RN)</p>
            </div>

            <div className="profile-section">
              <h3>Professional</h3>
              <div className="profile-item">
                <span className="label">License:</span>
                <span className="value">RN-2022-445</span>
              </div>
              <div className="profile-item">
                <span className="label">Hospital:</span>
                <span className="value">Lagos General</span>
              </div>
              <div className="profile-item">
                <span className="label">Ward:</span>
                <span className="value">General Ward</span>
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
            className={`nav-btn ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Patients</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Schedule</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'vitals' ? 'active' : ''}`}
            onClick={() => setActiveTab('vitals')}
          >
            <span className="nav-icon">🩺</span>
            <span className="nav-label">Vitals</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Msgs</span>
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
