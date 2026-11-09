import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          N-Health Admin
          {user?.isSuperAdmin && <span className="sidebar-badge">SUPER</span>}
        </div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Users
        </NavLink>
        {[['/operations', 'Operations'], ['/verifications', 'Provider verification'], ['/kyc', 'Identity (KYC)'], ['/campaigns', 'Donation campaigns'], ['/finance', 'Fees & payouts'], ['/revenue', 'Revenue'], ['/payouts', 'Coin payments by provider'], ['/tickets', 'Support tickets'], ['/catalogs', 'Catalogs & rates']].map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {label}
          </NavLink>
        ))}
        {user?.isSuperAdmin && (
          <>
            <NavLink to="/admins" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Admin Accounts
            </NavLink>
            <NavLink to="/integrations" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Integration status
            </NavLink>
            <NavLink to="/audit-log" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Audit Log
            </NavLink>
          </>
        )}
        <div style={{ padding: '20px', marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{user?.email}</div>
          <button className="outline" onClick={logout} style={{ width: '100%' }}>
            Log Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
