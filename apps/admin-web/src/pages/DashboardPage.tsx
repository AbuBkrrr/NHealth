import React, { useEffect, useState } from 'react';
import { adminApi, Stats } from '../api/admin';

const ROLE_LABEL: Record<string, string> = {
  PATIENT: 'Patients',
  DOCTOR: 'Doctors',
  PHARMACY: 'Pharmacies',
  LAB: 'Labs',
  AMBULANCE: 'Ambulances',
  NURSE: 'Nurses',
  ADMIN: 'Admins',
};

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">A live snapshot across every role and module.</p>

      <div className="stat-grid">
        {Object.entries(stats.usersByRole).map(([role, count]) => (
          <div className="stat-card" key={role}>
            <div className="stat-number">{count}</div>
            <div className="stat-label">{ROLE_LABEL[role] ?? role}</div>
          </div>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.pendingAppointments}</div>
          <div className="stat-label">Pending appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.pendingPayments}</div>
          <div className="stat-label">Payments awaiting confirmation</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.openEmergencies}</div>
          <div className="stat-label">Open emergencies</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">₦{stats.totalDonations.toLocaleString()}</div>
          <div className="stat-label">Total donations received</div>
        </div>
      </div>
    </div>
  );
}
