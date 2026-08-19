import React from 'react';
import { Bell } from 'lucide-react';
import { initials } from '../constants';
import { MinistryLogo } from './MinistryBrand';

export default function Topbar({ title, unreadAlerts, user }) {
  return (
    <header className="pt-topbar">
      <div className="pt-topbar-title"><MinistryLogo compact /><div><small>MOA PROCUREMENT TRACKING SYSTEM</small><strong>{title}</strong></div></div>
      <div className="pt-header-actions">
        <span className="pt-live"><i /> Live database</span>
        <button className="pt-icon-btn" aria-label="Notifications">
          <Bell size={16} />
          {unreadAlerts > 0 && <i />}
        </button>
        <div className="pt-avatar">{initials(user?.name)}</div>
      </div>
    </header>
  );
}
