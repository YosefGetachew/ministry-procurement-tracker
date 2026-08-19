import React from 'react';
import { formatDate } from '../constants';

export default function AlertsView({ alerts, onMarkRead }) {
  return (
    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>Alerts</h2><p>Workflow notifications addressed to you</p></div><span className="pt-count-badge">{alerts.filter((a) => a.status === 'unread').length}</span></div>
      <div className="pt-alert-list">
        {!alerts.length && <div className="pt-empty">No alerts yet.</div>}
        {alerts.map((alert) => (
          <div className={`pt-alert-row ${alert.status}`} key={alert.id}>
            <div>
              <strong>{alert.type.replaceAll('_', ' ')}</strong>
              <p>{alert.message}</p>
              <small>{formatDate(alert.createdAt)}</small>
            </div>
            {alert.status === 'unread' && <button className="pt-btn pt-btn-ghost" onClick={() => onMarkRead(alert.id)}>Mark read</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
