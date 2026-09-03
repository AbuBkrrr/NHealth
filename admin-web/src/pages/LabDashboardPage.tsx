import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/LabDashboard.css';

export function LabDashboardPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'tests' | 'results' | 'samples' | 'messages' | 'profile'>('home');

  const tests = [
    { id: '1', patient: 'Amara Okafor', test: 'Full Blood Count', status: 'completed' },
    { id: '2', patient: 'John Adeyemi', test: 'COVID-19 Test', status: 'pending' },
  ];

  return (
    <div className="lab-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>
        <StatusBar />
        <div className="app-bar">
          <h1 className="app-title">ProLab</h1>
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
              <p>Lagos Central Lab</p>
            </div>

            <div className="lab-card">
              <h3>Today's Tests</h3>
              <div className="amount">42</div>
              <div className="breakdown">
                <span>✅ 28 Done</span>
                <span>⏳ 14 Pending</span>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>🧪</span>
                <div className="stat-value">1,240</div>
                <div className="stat-label">Samples</div>
              </div>
              <div className="stat-card">
                <span>📊</span>
                <div className="stat-value">98%</div>
                <div className="stat-label">Accuracy</div>
              </div>
              <div className="stat-card">
                <span>⭐</span>
                <div className="stat-value">4.9</div>
                <div className="stat-label">Rating</div>
              </div>
            </div>

            <div className="quick-actions">
              <button className="action-btn">
                <span>🧬</span>
                <span>Tests</span>
              </button>
              <button className="action-btn">
                <span>📋</span>
                <span>Results</span>
              </button>
              <button className="action-btn">
                <span>🔬</span>
                <span>Samples</span>
              </button>
              <button className="action-btn">
                <span>📊</span>
                <span>Reports</span>
              </button>
            </div>

            <div className="upcoming-section">
              <div className="section-header">
                <h3>🧪 Recent Tests</h3>
                <a href="#">See All</a>
              </div>
              {tests.map(test => (
                <div key={test.id} className="test-item">
                  <div className="test-info">
                    <h4>{test.patient}</h4>
                    <p>{test.test}</p>
                  </div>
                  <span className={`status ${test.status}`}>
                    {test.status === 'completed' ? '✅' : '⏳'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TESTS TAB */}
        {activeTab === 'tests' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>🧪 All Tests</h3>
            </div>
            {tests.map(test => (
              <div key={test.id} className="test-item">
                <div className="test-info">
                  <h4>{test.patient}</h4>
                  <p>{test.test}</p>
                </div>
                <span className={`status ${test.status}`}>
                  {test.status === 'completed' ? '✅' : '⏳'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📊 Results</h3>
            </div>
            <div className="result-card">
              <h4>Amara Okafor</h4>
              <p>Full Blood Count - Ready</p>
              <button className="btn btn-small">View Report</button>
            </div>
          </div>
        )}

        {/* SAMPLES TAB */}
        {activeTab === 'samples' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>🧬 Samples</h3>
            </div>
            <div className="sample-card">
              <div className="sample-info">
                <h4>Sample #12345</h4>
                <p>Blood • Amara Okafor</p>
              </div>
              <span className="status received">Received</span>
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
                <p>Result ready for patient 304</p>
              </div>
              <span className="time">20m</span>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="home-screen">
            <div className="profile-header">
              <div className="avatar-large">🔬</div>
              <h2>ProLab</h2>
              <p>Lagos Central</p>
            </div>
            <div className="profile-section">
              <h3>Lab Info</h3>
              <div className="profile-item">
                <span className="label">License:</span>
                <span className="value">LAB-2023-156</span>
              </div>
              <div className="profile-item">
                <span className="label">Address:</span>
                <span className="value">VI, Lagos</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>Edit Profile</button>
          </div>
        )}

        <div className="bottom-nav">
          <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="nav-icon">🏠</span><span className="nav-label">Home</span>
          </button>
          <button className={`nav-btn ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => setActiveTab('tests')}>
            <span className="nav-icon">🧪</span><span className="nav-label">Tests</span>
          </button>
          <button className={`nav-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            <span className="nav-icon">📊</span><span className="nav-label">Results</span>
          </button>
          <button className={`nav-btn ${activeTab === 'samples' ? 'active' : ''}`} onClick={() => setActiveTab('samples')}>
            <span className="nav-icon">🧬</span><span className="nav-label">Samples</span>
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
