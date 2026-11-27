import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

/** Number of "Talk to our team" enquiries nobody has handled yet (super admins only). */
function useNewEnquiries(enabled: boolean) {
  const [n, setN] = useState(0);
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => api.get<{ newCount: number }>('/admin-ops/marketing/leads/summary').then((r) => alive && setN(r.data.newCount)).catch(() => null);
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled, pathname, search]);
  return n;
}

export function Layout() {
  const { user, logout } = useAuth();
  const newEnquiries = useNewEnquiries(!!user?.isSuperAdmin);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/icon.svg" alt="" width={26} height={26} style={{ verticalAlign: -7, marginRight: 8, borderRadius: 6 }} />
          N-Health Admin
          {user?.isSuperAdmin && <span className="sidebar-badge">SUPER</span>}
        </div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Users
        </NavLink>
        {[['/operations', 'Operations'], ['/verifications', 'Provider verification'], ['/kyc', 'Identity (KYC)'], ['/facilities', 'Facility directory'], ['/gigs', 'Health jobs'], ['/campaigns', 'Donation campaigns'], ['/finance', 'Fees & payouts'], ['/revenue', 'Revenue'], ['/payouts', 'Coin payments by provider'], ['/tickets', 'Support tickets'], ['/catalogs', 'Catalogs & rates']].map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {label}
          </NavLink>
        ))}
        {user?.isSuperAdmin && (
          <>
            <NavLink to="/marketing?tab=leads" className={() => `nav-link${location.pathname === '/marketing' && new URLSearchParams(location.search).get('tab') === 'leads' ? ' active' : ''}`}>
              Enquiries {newEnquiries > 0 && <span className="nav-count">{newEnquiries}</span>}
            </NavLink>
            <NavLink to="/marketing" className={({ isActive }) => `nav-link${isActive && new URLSearchParams(location.search).get('tab') !== 'leads' ? ' active' : ''}`}>
              Marketing
            </NavLink>
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
