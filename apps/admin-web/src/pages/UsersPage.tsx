import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminUser } from '../api/admin';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLES = ['PATIENT', 'DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE', 'INSTITUTION'];
const roleLabel = (r: string) => ({ LAB: 'DIAGNOSTIC CENTER', INSTITUTION: 'HOSPITAL / CLINIC' } as Record<string, string>)[r] || r;

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(() => {
    adminApi
      .listUsers({ role: role || undefined, search: search || undefined, isActive: isActive || undefined, page })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => {});
  }, [role, search, isActive, page]);

  useEffect(() => { load(); }, [load]);

  // Super admins only: e.g. someone who signed up as a patient but is a nurse. They are signed out to apply it.
  const changeRole = async (u: AdminUser, role: string) => {
    if (!window.confirm(`Change ${u.name} from ${roleLabel(u.role)} to ${roleLabel(role)}?\n\nThey will be signed out, and a new provider must upload documents and be approved before serving patients.`)) return;
    setBusyId(u.id);
    try { await api.patch(`/admin/users/${u.id}/role`, { role }); load(); } catch (err) { alert(getErrorMessage(err)); } finally { setBusyId(null); }
  };

  const toggleStatus = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      await adminApi.setUserStatus(u.id, !u.isActive);
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">Every account across every role, in one place.</p>

      <div className="toolbar">
        <input placeholder="Search name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {users.length === 0 ? (
          <div className="empty-state">No users match these filters.</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name"><Link to={`/users/${u.id}`}>{u.name}</Link></td>
                  <td data-label="Email" className="users-email">{u.email}</td>
                  <td data-label="Role">{me?.isSuperAdmin && u.role !== 'ADMIN' ? (
                    <select className="role-select" value={u.role} disabled={busyId === u.id} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role of ${u.name}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  ) : <span className="badge badge-role">{roleLabel(u.role)}</span>}</td>
                  <td data-label="Status">
                    <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td data-label="Joined">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={u.isActive ? 'danger' : ''}
                      onClick={() => toggleStatus(u)}
                    >
                      {u.isActive ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <span>{total} total users</span>
        <div className="row-actions">
          <button className="outline" onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className="outline" onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
