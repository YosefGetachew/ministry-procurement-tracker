import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import MinistryBrand from './MinistryBrand';

export default function ChangePasswordScreen() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError('New passwords do not match');
    setBusy(true);
    setError('');
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="pt-login-shell">
    <form className="pt-login-card" onSubmit={submit}>
      <MinistryBrand login />
      <p className="pt-eyebrow">ACCOUNT SECURITY</p>
      <h1>Change temporary password</h1>
      <p>You must choose a private password before accessing procurement records.</p>
      {error && <div className="pt-login-error">{error}</div>}
      <div className="pt-field"><label>Current password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
      <div className="pt-field"><label>New password</label><input type="password" minLength="10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
      <div className="pt-field"><label>Confirm new password</label><input type="password" minLength="10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
      <button className="pt-btn pt-btn-block" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      <button type="button" className="pt-text-btn" onClick={logout}>Sign out</button>
    </form>
  </main>;
}
