import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api';
import { formatDate } from '../../constants';
import StatusBadge from '../../components/StatusBadge';
import NewPlanModal from '../../components/modals/NewPlanModal';

export default function PlansView({ plans, projects, onSelect, onChanged }) {
  const [showNew, setShowNew] = useState(false);

  async function handleCreate(payload) {
    await api.createPlan(payload);
    setShowNew(false);
    onChanged();
  }

  return (
    <section className="pt-panel">
      <div className="pt-panel-head">
        <div><h2>My procurement plans</h2><p>Create category-specific plans, add activities, and submit for Director review</p></div>
        <button className="pt-btn" onClick={() => setShowNew(true)}><Plus size={15} /> New plan</button>
      </div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>PLAN</th><th>PROJECT</th><th>CATEGORY</th><th>FISCAL YEAR</th><th>STATUS</th></tr></thead>
          <tbody>
            {!plans.length && <tr><td colSpan="5" className="pt-empty">No plans yet. Create one to get started.</td></tr>}
            {plans.map((plan) => (
              <tr key={plan.id} tabIndex="0" onClick={() => onSelect(plan.id)}>
                <td><strong>{plan.name}</strong><small>{plan.reference} · {formatDate(plan.createdAt)}</small></td>
                <td>{plan.projectName}</td>
                <td>{plan.category}</td>
                <td>{plan.fiscalYear}</td>
                <td><StatusBadge status={plan.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewPlanModal open={showNew} projects={projects} onSubmit={handleCreate} onClose={() => setShowNew(false)} />
    </section>
  );
}
