import React, { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import '../styles/PharmacyDashboard.css';

export function PharmacyDashboardPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'inventory' | 'orders' | 'sales' | 'messages' | 'profile'>('home');

  const orders = [
    { id: '1', patient: 'Amara Okafor', items: 3, total: '₦15,500', status: 'ready' },
    { id: '2', patient: 'John Adeyemi', items: 2, total: '₦8,200', status: 'pending' },
  ];

  const inventory = [
    { id: '1', name: 'Paracetamol 500mg', qty: 120, price: '₦50' },
    { id: '2', name: 'Amoxicillin 250mg', qty: 45, price: '₦200' },
  ];

  return (
    <div className="pharmacy-container">
      <div className="phone-frame">
        <div className="phone-notch"></div>

        <StatusBar />

        <div className="app-bar">
          <h1 className="app-title">Pharmacy Plus</h1>
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
              <p>Lekki Branch • Open Now</p>
            </div>

            {/* SALES CARD */}
            <div className="sales-card">
              <div className="sales-info">
                <h3>Today's Sales</h3>
                <div className="amount">₦87,500</div>
                <p className="period">24 orders completed</p>
              </div>
              <span className="icon">💰</span>
            </div>

            {/* STATS GRID */}
            <div className="stats-grid">
              <div className="stat-card">
                <span>📦</span>
                <div className="stat-value">1,240</div>
                <div className="stat-label">Stock Items</div>
              </div>
              <div className="stat-card">
                <span>⏳</span>
                <div className="stat-value">8</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card">
                <span>✅</span>
                <div className="stat-value">24</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="quick-actions">
              <button className="action-btn">
                <span>🛒</span>
                <span>Sell</span>
              </button>
              <button className="action-btn">
                <span>📦</span>
                <span>Stock</span>
              </button>
              <button className="action-btn">
                <span>🔍</span>
                <span>Search</span>
              </button>
              <button className="action-btn">
                <span>📊</span>
                <span>Reports</span>
              </button>
            </div>

            {/* PENDING ORDERS */}
            <div className="upcoming-section">
              <div className="section-header">
                <h3>📋 Pending Orders</h3>
                <a href="#">See All</a>
              </div>

              {orders.filter(o => o.status === 'pending').map(order => (
                <div key={order.id} className="order-item">
                  <div className="order-header">
                    <h4>{order.patient}</h4>
                    <span className="amount">{order.total}</span>
                  </div>
                  <p className="order-detail">{order.items} items • Pending</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📦 Inventory</h3>
            </div>

            {inventory.map(item => (
              <div key={item.id} className="inventory-item">
                <div className="item-info">
                  <h4>{item.name}</h4>
                  <p className="qty">Qty: {item.qty}</p>
                </div>
                <div className="item-price">{item.price}</div>
              </div>
            ))}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="home-screen">
            <div className="section-header">
              <h3>📋 All Orders</h3>
            </div>

            {orders.map(order => (
              <div key={order.id} className="order-item">
                <div className="order-header">
                  <h4>{order.patient}</h4>
                  <span className="amount">{order.total}</span>
                </div>
                <p className="order-detail">{order.items} items • {order.status}</p>
              </div>
            ))}
          </div>
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <div className="home-screen">
            <div className="sales-card large">
              <h3>Today's Sales</h3>
              <div className="amount">₦87,500</div>
              <p className="period">24 orders completed</p>
            </div>

            <div className="sales-card">
              <h3>This Week</h3>
              <div className="amount">₦487,200</div>
              <p className="period">142 orders</p>
            </div>

            <div className="sales-card">
              <h3>This Month</h3>
              <div className="amount">₦1,850,000</div>
              <p className="period">580 orders</p>
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
                <p>Is the medication available?</p>
              </div>
              <span className="time">15m</span>
            </div>

            <div className="message-item">
              <div className="avatar">🚚</div>
              <div className="message-info">
                <h4>Supply Vendor</h4>
                <p>Delivery scheduled for 3 PM</p>
              </div>
              <span className="time">1h</span>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="home-screen">
            <div className="profile-header">
              <div className="avatar-large">💊</div>
              <h2>Pharmacy Plus</h2>
              <p>Lekki Branch</p>
            </div>

            <div className="profile-section">
              <h3>Pharmacy Details</h3>
              <div className="profile-item">
                <span className="label">License:</span>
                <span className="value">PH-2023-089</span>
              </div>
              <div className="profile-item">
                <span className="label">Address:</span>
                <span className="value">Lekki Phase 1</span>
              </div>
              <div className="profile-item">
                <span className="label">Phone:</span>
                <span className="value">+234 901 234 5678</span>
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
            className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <span className="nav-icon">📦</span>
            <span className="nav-label">Stock</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">Orders</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <span className="nav-icon">💰</span>
            <span className="nav-label">Sales</span>
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
