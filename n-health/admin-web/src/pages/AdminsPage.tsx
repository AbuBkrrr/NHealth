import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, AdminAccount } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AdminsPage() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.listAdmins().then(setAdmins).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.createAdmin({ name, email, password, isSuperAdmin });
      setShowForm(false);
      setName(''); setEmail(''); setPassword(''); setIsSuperAdmin(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (a: AdminAccount) => {
    setBusyId(a.id);
    try {
      await adminApi.updateAdmin(a.id, { isActive: !a.isActive });
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleSuper = async (a: AdminAccount) => {
    setBusyId(a.id);
    try {
      await adminApi.updateAdmin(a.id, { isSuperAdmin: !a.isSuperAdmin });
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeAdmin = async (a: AdminAccount) => {
    if (!confirm(`Permanently delete ${a.name}'s admin account?`)) return;
    setBusyId(a.id);
    try {
      await adminApi.deleteAdmin(a.id);
      load();
    } catch (err) {
      alert(getErrorMessage(err));
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Admin Accounts</h1>
      <p className="page-subtitle">Only super admins can create or manage other admin accounts.</p>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Status</th><th>Super Admin</th><th></th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  <span className={`badge ${a.isActive ? 'badge-active' : 'badge-inactive'}`}>
                    {a.isActive ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td>{a.isSuperAdmin && <span className="badge badge-super">SUPER</span>}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="outline"
                      onClick={() => toggleActive(a)}
                      disabled={busyId === a.id || a.id === currentUser?.id}
                    >
                      {a.isActive ? 'Suspend' : 'Reactivate'}
                    </button>
                    <button
                      className="outline"
                      onClick={() => toggleSuper(a)}
                      disabled={busyId === a.id || a.id === currentUser?.id}
                    >
                      {a.isSuperAdmin ? 'Remove Super' : 'Make Super'}
                    </button>
                    <button
                      className="danger"
                      onClick={() => removeAdmin(a)}
                      disabled={busyId === a.id || a.id === currentUser?.id}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{ marginTop: 16 }}>+ Create Admin Account</button>
      ) : (
        <form className="card" onSubmit={createAdmin} style={{ marginTop: 16, maxWidth: 400 }}>
          <h3 style={{ marginTop: 0 }}>New admin account</h3>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
                style={{ width: 'auto', marginRight: 8 }}
              />
              Grant super admin access
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
            <button type="button" className="outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
