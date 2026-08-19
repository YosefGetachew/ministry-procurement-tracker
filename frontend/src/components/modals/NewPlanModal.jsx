import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES } from '../../constants';
import DualCalendarDateInput from '../DualCalendarDateInput';

function blankForm(projects) {
  return { projectId: projects[0]?.id || '', category: CATEGORIES[0] || '', name: '', fiscalYear: new Date().getFullYear(), periodStart: '', periodEnd: '', defaultCurrency: 'USD', description: '' };
}

export default function NewPlanModal({ open, projects, onSubmit, onClose }) {
  const [values, setValues] = useState(() => blankForm(projects));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;
  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

  async function submit() {
    if (!values.projectId || !values.category || !values.name.trim()) return setError('Select a project, category, and plan name');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...values, fiscalYear: Number(values.fiscalYear), periodStart: values.periodStart || null, periodEnd: values.periodEnd || null });
      setValues(blankForm(projects));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pt-overlay" onClick={onClose}>
      <div className="pt-drawer" role="dialog" aria-modal="true" aria-label="New procurement plan" onClick={(e) => e.stopPropagation()}>
        <div className="pt-drawer-head">
          <div><p className="pt-eyebrow">PROCUREMENT PLANNING</p><h2 className="pt-display pt-drawer-title">New procurement plan</h2></div>
          <button className="pt-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pt-field">
          <label>Project</label>
          <select value={values.projectId} onChange={set('projectId')}>
            {!projects.length && <option value="">No assigned projects</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="pt-form-grid">
          <div className="pt-field"><label>Category</label><select value={values.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="pt-field"><label>Fiscal year</label><input type="number" min="2020" max="2100" value={values.fiscalYear} onChange={set('fiscalYear')} /></div>
        </div>
        <div className="pt-form-grid">
          <div className="pt-field"><label>Planning period start</label><DualCalendarDateInput label="Planning period start" value={values.periodStart} onChange={(periodStart) => setValues({ ...values, periodStart })} /></div>
          <div className="pt-field"><label>Planning period end</label><DualCalendarDateInput label="Planning period end" value={values.periodEnd} onChange={(periodEnd) => setValues({ ...values, periodEnd })} /></div>
        </div>
        <div className="pt-field"><label>Default currency</label><select value={values.defaultCurrency} onChange={set('defaultCurrency')}><option>USD</option><option>ETB</option></select></div>
        <div className="pt-field"><label>Plan name</label><input value={values.name} onChange={set('name')} placeholder="e.g. FY2026 irrigation input acquisition" /></div>
        <div className="pt-field"><label>Description</label><textarea value={values.description} onChange={set('description')} /></div>
        {error && <div className="pt-error-banner">{error}</div>}
        <div className="pt-actions">
          <button className="pt-btn" onClick={submit} disabled={saving || !projects.length}>{saving ? 'Saving…' : 'Create plan'}</button>
          <button className="pt-btn pt-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
