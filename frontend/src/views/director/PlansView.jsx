import React, { useState } from 'react';
import { formatDate } from '../../constants';
import StatusBadge from '../../components/StatusBadge';

const FILTERS = ['All', 'SUBMITTED_TO_DIRECTOR', 'COMMITTEE_REVIEW', 'FINALLY_APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED_BY_DIRECTOR', 'REJECTED_BY_COMMITTEE', 'REPLANNED'];

export default function PlansView({ plans, onSelect }) {
  const [filter, setFilter] = useState('All');
  const visible = filter === 'All' ? plans : plans.filter((p) => p.status === filter);

  return (
    <section className="pt-panel">
      <div className="pt-panel-head">
        <div><h2>Ministry-wide plans</h2><p>Review submitted plans and monitor progress through committee approval</p></div>
        <select className="pt-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((f) => <option key={f} value={f}>{f.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>PLAN</th><th>PROJECT</th><th>CATEGORY</th><th>OFFICER</th><th>STATUS</th></tr></thead>
          <tbody>
            {!visible.length && <tr><td colSpan="5" className="pt-empty">No plans match this filter.</td></tr>}
            {visible.map((plan) => (
              <tr key={plan.id} tabIndex="0" onClick={() => onSelect(plan.id)}>
                <td><strong>{plan.name}</strong><small>{plan.reference} · {formatDate(plan.submittedAt || plan.createdAt)}</small></td>
                <td>{plan.projectName}</td>
                <td>{plan.category}</td>
                <td>{plan.createdByName}</td>
                <td><StatusBadge status={plan.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
