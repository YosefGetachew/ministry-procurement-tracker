import React from 'react';
import {
  Bell, ClipboardList, FileText, FolderKanban,
  BarChart3, LayoutDashboard, LogOut, Settings, ShieldCheck, Users, FileBarChart2,
} from 'lucide-react';
import { initials, ROLE_LABELS } from '../constants';
import MinistryBrand from './MinistryBrand';

// Navigation per role (SDD 11.1). Screens that SDD lists separately (e.g.
// Director's "Plans for Review" and "Committee Progress") are folded into one
// Plans screen with a detail drawer that shows the right actions per status.
const NAV_BY_ROLE = {
  officer: [
    ['Dashboard', LayoutDashboard],
    ['My Projects', FolderKanban],
    ['Plans', ClipboardList],
    ['Contracts', FileText],
    ['Reports', BarChart3],
    ['Alerts', Bell],
  ],
  director: [
    ['Dashboard', LayoutDashboard],
    ['Executive Reports', FileBarChart2],
    ['Projects', FolderKanban],
    ['Plans', ClipboardList],
    ['Reports', BarChart3],
    ['Alerts', Bell],
  ],
  committee: [
    ['Dashboard', LayoutDashboard],
    ['Plans', ClipboardList],
    ['Alerts', Bell],
  ],
  management: [
    ['Dashboard', LayoutDashboard],
    ['Executive Reports', FileBarChart2],
    ['Plans', ClipboardList],
    ['Alerts', Bell],
  ],
  admin: [
    ['Dashboard', LayoutDashboard],
    ['Users', Users],
    ['Committee', ShieldCheck],
    ['Settings', Settings],
  ],
};

export default function Sidebar({ activeView, setActiveView, unreadAlerts, user, onLogout }) {
  const items = NAV_BY_ROLE[user?.role] || [];
  return (
    <aside className="pt-sidebar">
      <MinistryBrand />
      <span className="pt-nav-label">WORKSPACE</span>
      <nav className="pt-nav" aria-label="Dashboard sections">
        {items.map(([label, Icon]) => (
          <button
            key={label}
            className={`pt-nav-item ${activeView === label ? 'active' : ''}`}
            onClick={() => { setActiveView(label); window.scrollTo({ top: 0 }); }}
          >
            <Icon size={17} />{label}
            {label === 'Alerts' && unreadAlerts > 0 ? <em>{unreadAlerts}</em> : null}
          </button>
        ))}
      </nav>
      <div className="pt-sidebar-bottom">
        <div className="pt-profile">
          <span>{initials(user?.name)}</span>
          <div><strong>{user?.name}</strong><small>{ROLE_LABELS[user?.role] || ''}</small></div>
          <button className="pt-logout-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
