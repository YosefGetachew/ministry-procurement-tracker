import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { setMeta } from '../constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    (async () => {
      const [meta, me] = await Promise.allSettled([api.getMeta(), api.me()]);
      if (meta.status === 'fulfilled') setMeta(meta.value);
      if (me.status === 'fulfilled') setUser(me.value);
      setReady(true);
    })();
  }, []);

  async function login(email, password) {
    setAuthError(null);
    try {
      setUser(await api.login(email, password));
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  async function changePassword(currentPassword, newPassword) {
    await api.changePassword(currentPassword, newPassword);
    setUser({ ...user, mustChangePassword: false });
  }

  return (
    <AuthContext.Provider value={{ user, ready, authError, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
