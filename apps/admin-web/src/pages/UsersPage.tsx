import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminUser } from '../api/admin';
import { getErrorMessage } from '../api/client';

const ROLES = ['PATIENT', 'DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE'];

export function UsersPage() {
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
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/users/${u.id}`}>{u.name}</Link></td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-role">{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
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
