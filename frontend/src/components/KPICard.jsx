import React from 'react';

export default function KPICard({ label, value, sub, icon: Icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <Icon size={16} strokeWidth={1.75} color="var(--primary-soft)" />
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
