import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { getErrorMessage } from '../api/client';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (id) adminApi.getUserDetail(id).then(setUser).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await adminApi.setUserStatus(user.id, !user.isActive);
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <p>Loading...</p>;

  const profile =
    user.patientProfile || user.doctorProfile || user.pharmacyProfile || user.labProfile || user.ambulanceProfile || user.nurseProfile;

  return (
    <div>
      <button className="outline" onClick={() => navigate('/users')} style={{ marginBottom: 16 }}>
        ← Back to Users
      </button>
      <h1 className="page-title">{user.name}</h1>
      <p className="page-subtitle">{user.email} · {user.role}</p>

      <div className="card">
        <span className={`badge ${user.isActive ? 'badge-active' : 'badge-inactive'}`}>
          {user.isActive ? 'Active' : 'Suspended'}
        </span>
        <div style={{ marginTop: 16 }}>
          <button className={user.isActive ? 'danger' : ''} onClick={toggleStatus}>
            {user.isActive ? 'Suspend Account' : 'Reactivate Account'}
          </button>
        </div>
      </div>

      {profile && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Role details</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
