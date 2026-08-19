import React from 'react';
import { useAuth } from './auth/AuthContext';
import LoginScreen from './components/LoginScreen';
import Dashboard from './Dashboard';
import ChangePasswordScreen from './components/ChangePasswordScreen';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="pt-boot">Loading Ministry of Agriculture procurement tracker…</div>;
  if (!user) return <LoginScreen />;
  if (user.mustChangePassword) return <ChangePasswordScreen />;
  return <Dashboard />;
}
