import React from 'react';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../constants';

export default function ManagementPlansView({ plans, onSelect }) {
  const pending = plans.filter((plan) => plan.status === 'MANAGEMENT_REVIEW');
  const decided = plans.filter((plan) => ['FINALLY_APPROVED', 'REJECTED_BY_MANAGEMENT'].includes(plan.status));
  return <section className="pt-panel">
    <div className="pt-panel-head"><div><h2>Ministry Management approval</h2><p>Final approval of plans endorsed by the Endorsing Committee</p></div><span className="pt-count-badge">{pending.length}</span></div>
    <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr><th>PLAN</th><th>PROJECT</th><th>CATEGORY</th><th>STATUS</th></tr></thead><tbody>
      {!pending.length && <tr><td colSpan="4" className="pt-empty">No plans are awaiting management approval.</td></tr>}
      {pending.map((plan) => <tr key={plan.id} tabIndex="0" onClick={() => onSelect(plan.id)}><td><strong>{plan.name}</strong><small>{plan.reference} · {formatDate(plan.submittedAt)}</small></td><td>{plan.projectName}</td><td>{plan.category}</td><td><StatusBadge status={plan.status} /></td></tr>)}
    </tbody></table></div>
    {!!decided.length && <><div className="pt-panel-head"><div><h2>Completed management decisions</h2></div></div><div className="pt-table-scroll"><table className="pt-data-table"><tbody>{decided.map((plan) => <tr key={plan.id} onClick={() => onSelect(plan.id)}><td><strong>{plan.name}</strong><small>{plan.reference}</small></td><td>{plan.projectName}</td><td>{plan.category}</td><td><StatusBadge status={plan.status} /></td></tr>)}</tbody></table></div></>}
  </section>;
}
