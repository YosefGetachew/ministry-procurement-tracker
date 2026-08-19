import React, { useState } from 'react';
import { formatDate } from '../../constants';
import StatusBadge from '../../components/StatusBadge';

export default function PlansView({ plans, onSelect }) {
  const [tab, setTab] = useState('pending');
  const pending = plans.filter((p) => p.status === 'COMMITTEE_REVIEW');
  const decided = plans.filter((p) => ['FINALLY_APPROVED', 'REJECTED_BY_COMMITTEE', 'REPLANNED'].includes(p.status));
  const visible = tab === 'pending' ? pending : decided;

  return (
    <section className="pt-panel">
      <div className="pt-panel-head">
        <div><h2>Committee review</h2><p>Vote on Director-approved plans, or review your past decisions</p></div>
        <div className="pt-nav" style={{ flexDirection: 'row', gap: 8 }}>
          <button className={`pt-nav-item ${tab === 'pending' ? 'active' : ''}`} style={{ width: 'auto' }} onClick={() => setTab('pending')}>Plans for review<em>{pending.length}</em></button>
          <button className={`pt-nav-item ${tab === 'decided' ? 'active' : ''}`} style={{ width: 'auto' }} onClick={() => setTab('decided')}>My decisions</button>
        </div>
      </div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>PLAN</th><th>PROJECT</th><th>CATEGORY</th><th>STATUS</th></tr></thead>
          <tbody>
            {!visible.length && <tr><td colSpan="4" className="pt-empty">Nothing here yet.</td></tr>}
            {visible.map((plan) => (
              <tr key={plan.id} tabIndex="0" onClick={() => onSelect(plan.id)}>
                <td><strong>{plan.name}</strong><small>{plan.reference} · {formatDate(plan.submittedAt || plan.createdAt)}</small></td>
                <td>{plan.projectName}</td>
                <td>{plan.category}</td>
                <td><StatusBadge status={plan.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
