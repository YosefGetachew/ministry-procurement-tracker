import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api';
import { ROLE_LABELS } from '../../constants';

function blankForm() {
  return { name: '', email: '', phone: '', password: '', role: 'officer' };
}

export default function UsersView({ users, showToast, onChanged }) {
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  async function createUser() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return showToast('Name, email, and an 8+ character password are required');
    setSaving(true);
    try {
      await api.createUser(form);
      setForm(blankForm());
      await onChanged();
      showToast('User created');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      await onChanged();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function changeRole(user, role) {
    try {
      await api.updateUser(user.id, { role });
      await onChanged();
    } catch (err) {
      showToast(err.message);
    }
  }

  return <>
    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>New User Registration</h2><p>Create an account and assign its workflow role</p></div></div>
      <div className="pt-user-registration-form">
        <div className="pt-user-form-grid">
          <div className="pt-field"><label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter the user's full name" /></div>
          <div className="pt-field"><label>Email address</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@moa.gov.et" /></div>
          <div className="pt-field"><label>Phone <span className="pt-optional-label">Optional</span></label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +251 911 000 000" /></div>
          <div className="pt-field"><label>Temporary password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" /><small className="pt-field-note">The user can change this after signing in.</small></div>
          <div className="pt-field"><label>Workflow role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="pt-user-form-action"><button className="pt-btn" onClick={createUser} disabled={saving}><Plus size={15} /> {saving ? 'Saving…' : 'Create user'}</button></div>
        </div>
      </div>
    </section>

    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>Users</h2></div><span className="pt-count-badge">{users.length}</span></div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th></tr></thead>
          <tbody>
            {users.map((user) => <tr key={user.id}>
              <td><strong>{user.name}</strong></td>
              <td className="pt-mono">{user.email}</td>
              <td><select value={user.role} onChange={(event) => changeRole(user, event.target.value)}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
              <td><button className="pt-text-btn" onClick={() => toggleActive(user)}>{user.isActive ? 'Active — deactivate' : 'Inactive — reactivate'}</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
