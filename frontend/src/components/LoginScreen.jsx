import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import MinistryBrand from './MinistryBrand';

export default function LoginScreen() {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  return (
    <div className="pt-login-shell">
      <form className="pt-login-card" onSubmit={handleSubmit}>
        <MinistryBrand login />
        <h1>Sign in</h1>
        <p>Use your ministry account to access the procurement tracker.</p>
        <div className="pt-field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="pt-field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {authError && <div className="pt-login-error">{authError}</div>}
        <button className="pt-btn pt-btn-block" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
