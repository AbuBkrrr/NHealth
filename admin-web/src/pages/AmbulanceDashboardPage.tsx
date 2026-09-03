import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/AmbulanceDashboard.css';

export function AmbulanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'active' | 'history' | 'messages' | 'profile'>('home');

  const requests = [
    { id: '1', location: 'VI, Lagos', priority: 'urgent', time: '5 mins ago' },
    { id: '2', location: 'Lekki Phase 1', priority: 'normal', time: '10 mins ago' },
  ];

  return (
    <div className="ambulance-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>
        <StatusBar />
        <div className="app-bar">
          <h1 className="app-title">Rapid Response</h1>
          <div className="app-icons">
            <span>🔔</span>
            <span>👤</span>
          </div>
        </div>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="home-screen">
            <div className="greeting">
              <h2>Status: On Duty 🟢</h2>
              <p>Ready for emergencies</p>
            </div>

            <div className="status-card">
              <div className="driver-info">
                <div className="avatar-large">🚑</div>
                <h3>Ambulance Unit #7</h3>
                <p>Available • 2 Staff</p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>📍</span>
                <div className="stat-value">12</div>
                <div className="stat-label">Today</div>
              </div>
              <div className="stat-card">
                <span>✅</span>
                <div className="stat-value">98%</div>
                <div className="stat-label">Success</div>
              </div>
              <div className="stat-card">
                <span>⭐</span>
                <div className="stat-value">4.9</div>
                <div className="stat-label">Rating</div>
              </div>
            </div>

            <div className="quick-actions">
              <button className="action-btn online">
                <span>🟢</span>
                <span>Online</span>
              </button>
              <button className="action-btn">
                <span>📍</span>
                <span>GPS</span>
              </button>
              <button className="action-btn">
                <span>📞</span>
                <span>Contact</span>
              </button>
              <button className="action-btn">
                <span>📊</span>
                <span>Stats</span>
              </button>
            </div>

            <div className="upcoming-section">
              <div className="section-header">
                <h3>🚨 New Requests</h3>
                <a href="#">See All</a>
              </div>
              {requests.map(req => (
                <div key={req.id} className={`request-item ${req.priority}`}>
                  <div className="request-priority">
                    {req.priority === 'urgent' ? '🔴' : '🟡'}
                  </div>
                  <div className="request-info">
                    <h4>{req.location}</h4>
                    <p>{req.time}</p>
                  </div>
                  <button className="btn-accept">Accept</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>🚨 Requests</h3>
            </div>
            {requests.map(req => (
              <div key={req.id} className={`request-item ${req.priority}`}>
                <div className="request-priority">
                  {req.priority === 'urgent' ? '🔴' : '🟡'}
                </div>
                <div className="request-info">
                  <h4>{req.location}</h4>
                  <p>{req.time}</p>
                </div>
                <button className="btn-accept">Accept</button>
              </div>
            ))}
          </div>
        )}

        {/* ACTIVE TAB */}
        {activeTab === 'active' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>🚑 Active Trip</h3>
            </div>
            <div className="active-trip">
              <div className="trip-status">
                <span className="badge">In Transit</span>
              </div>
              <h4>VI, Lagos</h4>
              <p>ETA: 8 minutes</p>
              <div className="trip-actions">
                <button className="btn btn-small">📞 Call</button>
                <button className="btn btn-small">📍 Navigate</button>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📋 Trip History</h3>
            </div>
            <div className="history-item completed">
              <h4>VI, Lagos</h4>
              <p>Completed • 45 mins ago</p>
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
              <div className="avatar">📞</div>
              <div className="message-info">
                <h4>Dispatch Center</h4>
                <p>New urgent request in VI</p>
              </div>
              <span className="time">2m</span>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="home-screen">
            <div className="profile-header">
              <div className="avatar-large">🚑</div>
              <h2>Unit #7</h2>
              <p>Rapid Response</p>
            </div>
            <div className="profile-section">
              <h3>Vehicle Info</h3>
              <div className="profile-item">
                <span className="label">Plate:</span>
                <span className="value">LA-123-XYZ</span>
              </div>
              <div className="profile-item">
                <span className="label">Staff:</span>
                <span className="value">2 Officers</span>
              </div>
              <div className="profile-item">
                <span className="label">Status:</span>
                <span className="value">🟢 Available</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>Edit Profile</button>
          </div>
        )}

        <div className="bottom-nav">
          <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="nav-icon">🏠</span><span className="nav-label">Home</span>
          </button>
          <button className={`nav-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
            <span className="nav-icon">🚨</span><span className="nav-label">Requests</span>
          </button>
          <button className={`nav-btn ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
            <span className="nav-icon">🚑</span><span className="nav-label">Active</span>
          </button>
          <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <span className="nav-icon">📋</span><span className="nav-label">History</span>
          </button>
          <button className={`nav-btn ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
            <span className="nav-icon">💬</span><span className="nav-label">Msgs</span>
          </button>
          <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <span className="nav-icon">👤</span><span className="nav-label">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
