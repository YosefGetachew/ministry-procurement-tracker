import React, { useEffect, useState } from 'react';
import { CheckCircle2, Send, X } from 'lucide-react';
import { api } from '../api';
import {
  ACTIVITY_FIELDS, CATEGORY_FIELDS, fieldsForMethod, formatDate, formatMoney,
  methodsForCategory, stagesForMethod, stageRequiresPlannedDate, STAGE_STATUSES,
} from '../constants';
import StatusBadge from './StatusBadge';
import DualCalendarDateInput from './DualCalendarDateInput';

function MetadataFields({ fields, values, onChange, prefix }) {
  const set = (key, value) => onChange({ ...values, [key]: value });
  return fields.map((field) => (
    <div className="pt-field" key={field.key}>
      <label htmlFor={`${prefix}-${field.key}`}>{field.label}{field.required && <span className="pt-required-mark"> *</span>}</label>
      {field.type === 'boolean' ? (
        <select id={`${prefix}-${field.key}`} value={values[field.key] ? 'true' : 'false'} onChange={(e) => set(field.key, e.target.value === 'true')}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      ) : field.type === 'select' ? (
        <select id={`${prefix}-${field.key}`} value={values[field.key] || ''} onChange={(e) => set(field.key, e.target.value)}>
          <option value="">Select…</option>
          {field.options.map((opt) => <option key={opt}>{opt}</option>)}
        </select>
      ) : (
        <input id={`${prefix}-${field.key}`} type={field.type === 'number' ? 'number' : 'text'} value={values[field.key] || ''} onChange={(e) => set(field.key, e.target.value)} />
      )}
    </div>
  ));
}

function LegacyAddActivityForm({ category, defaultCurrency, onAdd, busy }) {
  const methods = methodsForCategory(category);
  const initialMethod = methods[0]?.code || '';
  const [values, setValues] = useState({ description: '', method: initialMethod, amount: '', currency: defaultCurrency || 'USD', categoryData: {}, plannedDates: stagesForMethod(initialMethod).map(() => '') });
  const [error, setError] = useState('');
  const stageNames = stagesForMethod(values.method, values.categoryData);

  function changeMethod(method) {
    setValues({ ...values, method, plannedDates: stagesForMethod(method).map(() => '') });
  }

  function updateCategoryData(categoryData) {
    const nextStages = stagesForMethod(values.method, categoryData);
    const previousStages = stagesForMethod(values.method, values.categoryData);
    setValues({
      ...values,
      categoryData,
      plannedDates: nextStages.length === previousStages.length ? values.plannedDates : nextStages.map(() => ''),
    });
  }

  function setPlannedDate(index, date) {
    const plannedDates = [...values.plannedDates];
    plannedDates[index] = date;
    setValues({ ...values, plannedDates });
  }

  async function submit() {
    if (!values.description.trim() || !values.method || !values.amount) {
      setError('Enter the activity description, method, and estimated amount.');
      return;
    }
    if (values.plannedDates.length !== stageNames.length || values.plannedDates.some((date, index) => stageRequiresPlannedDate(stageNames[index]) && !date)) {
      setError('Set a planned date for every scheduled procurement milestone. Actual-only events are recorded during implementation.');
      return;
    }
    setError('');
    try {
      await onAdd({ ...values, description: values.description.trim(), amount: Number(values.amount) });
      const method = methods[0]?.code || '';
      setValues({ description: '', method, amount: '', currency: defaultCurrency || 'USD', categoryData: {}, plannedDates: stagesForMethod(method).map(() => '') });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pt-activity-form">
      <div className="pt-form-section-head"><strong>Add planned procurement activity</strong><small>Fields follow the STEP plan supplied by the procurement office.</small></div>
      <div className="pt-field"><label htmlFor="act-desc">Activity description</label><textarea id="act-desc" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder="e.g. Small-scale irrigation pump sets" /></div>
      <div className="pt-form-grid">
        <div className="pt-field">
          <label htmlFor="act-method">Procurement method</label>
          <select id="act-method" value={values.method} onChange={(e) => changeMethod(e.target.value)}>
            {methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        </div>
        <div className="pt-amount-fields">
          <div className="pt-field"><label htmlFor="act-amount">Estimated amount</label><input id="act-amount" type="number" min="0" value={values.amount} onChange={(e) => setValues({ ...values, amount: e.target.value })} /></div>
          <div className="pt-field"><label htmlFor="act-currency">Currency</label><select id="act-currency" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value })}><option>USD</option><option>ETB</option></select></div>
        </div>
      </div>
      <h4 className="pt-form-subtitle">STEP activity details</h4>
      <div className="pt-form-grid">
        <MetadataFields fields={ACTIVITY_FIELDS} prefix="activity" values={values.categoryData} onChange={updateCategoryData} />
        <MetadataFields fields={fieldsForMethod(values.method)} prefix="method" values={values.categoryData} onChange={updateCategoryData} />
        <MetadataFields fields={CATEGORY_FIELDS[category] || []} prefix="category" values={values.categoryData} onChange={updateCategoryData} />
      </div>
      <h4 className="pt-form-subtitle">Planned milestone dates</h4>
      <p className="pt-form-note">The sequence matches the supplied STEP workbook. Scheduled milestones require planned dates; amendments and termination are actual-only events recorded during implementation.</p>
      <div className="pt-milestone-grid">
        {stageNames.map((name, index) => (
          <div className="pt-field" key={name}>
            <label htmlFor={`planned-${index}`}>{index + 1}. {name}</label>
            {stageRequiresPlannedDate(name)
              ? <DualCalendarDateInput id={`planned-${index}`} label={`${name} planned date`} value={values.plannedDates[index] || ''} onChange={(date) => setPlannedDate(index, date)} />
              : <span className="pt-actual-only-note">Actual date only · recorded during implementation</span>}
          </div>
        ))}
      </div>
      {error && <div className="pt-error-banner">{error}</div>}
      <button className="pt-btn pt-btn-ghost" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add activity'}</button>
    </div>
  );
}

function defaultCategoryData(fields = []) {
  const data = { inProcess: false, reviewType: 'Post', highSeaShRisk: false, processStatus: 'Planned', activityStatus: 'Draft' };
  fields.filter((field) => field.type === 'boolean').forEach((field) => { data[field.key] = false; });
  return data;
}

function AddActivityForm({ category, defaultCurrency, onAdd, busy }) {
  const methods = methodsForCategory(category);
  const initialMethod = methods[0]?.code || '';
  const makeInitialValues = (method = initialMethod) => {
    const categoryData = defaultCategoryData(fieldsForMethod(method));
    return { description: '', method, amount: '', currency: defaultCurrency || 'USD', categoryData, plannedDates: stagesForMethod(method, categoryData).map(() => '') };
  };
  const [values, setValues] = useState(() => makeInitialValues());
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const stageNames = stagesForMethod(values.method, values.categoryData);
  const methodDefinition = methods.find((method) => method.code === values.method);
  const profileFields = [...ACTIVITY_FIELDS, ...fieldsForMethod(values.method), ...(CATEGORY_FIELDS[category] || [])];
  const scheduledCount = stageNames.filter(stageRequiresPlannedDate).length;
  const actualOnlyCount = stageNames.length - scheduledCount;
  const requiredProfileFields = profileFields.filter((field) => field.required);
  const completedRequiredFields = requiredProfileFields.filter((field) => {
    const value = values.categoryData[field.key];
    return value !== undefined && value !== null && value !== '';
  }).length;
  const completedDates = stageNames.filter((name, index) => !stageRequiresPlannedDate(name) || values.plannedDates[index]).length;
  const totalChecks = 3 + requiredProfileFields.length + stageNames.length;
  const completedChecks = [values.description.trim(), values.method, Number(values.amount) > 0].filter(Boolean).length + completedRequiredFields + completedDates;
  const completion = totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0;

  function changeMethod(method) {
    const previousKeys = new Set(fieldsForMethod(values.method).map((field) => field.key));
    const categoryData = { ...values.categoryData };
    previousKeys.forEach((key) => { delete categoryData[key]; });
    fieldsForMethod(method)
      .filter((field) => field.type === 'boolean')
      .forEach((field) => { categoryData[field.key] = false; });
    setValues({ ...values, method, categoryData, plannedDates: stagesForMethod(method, categoryData).map(() => '') });
    setError('');
  }

  function updateCategoryData(categoryData) {
    const nextStages = stagesForMethod(values.method, categoryData);
    const previousStages = stagesForMethod(values.method, values.categoryData);
    setValues({ ...values, categoryData, plannedDates: nextStages.length === previousStages.length ? values.plannedDates : nextStages.map(() => '') });
  }

  function setPlannedDate(index, date) {
    const plannedDates = [...values.plannedDates];
    plannedDates[index] = date;
    setValues({ ...values, plannedDates });
  }

  function validateStep(index) {
    if (index === 0 && (!values.description.trim() || !values.method || Number(values.amount) <= 0)) return 'Enter the activity description, procurement method, and an estimated amount greater than zero.';
    if (index === 1) {
      const missing = requiredProfileFields.find((field) => {
        const value = values.categoryData[field.key];
        return value === undefined || value === null || value === '';
      });
      if (missing) return `${missing.label} is required.`;
    }
    if (index === 2) {
      if (values.plannedDates.length !== stageNames.length || values.plannedDates.some((date, milestoneIndex) => stageRequiresPlannedDate(stageNames[milestoneIndex]) && !date)) return 'Set a planned date for every scheduled milestone.';
      const scheduledDates = values.plannedDates.filter((date, milestoneIndex) => stageRequiresPlannedDate(stageNames[milestoneIndex]));
      for (let dateIndex = 1; dateIndex < scheduledDates.length; dateIndex += 1) {
        if (scheduledDates[dateIndex] < scheduledDates[dateIndex - 1]) return 'Planned dates must follow the procurement milestone sequence.';
      }
    }
    return '';
  }

  function continueTo(nextStep) {
    const issue = validateStep(step);
    if (issue) { setError(issue); return; }
    setError('');
    setStep(nextStep);
  }

  async function submit() {
    for (let index = 0; index < 3; index += 1) {
      const issue = validateStep(index);
      if (issue) { setStep(index); setError(issue); return; }
    }
    setError('');
    try {
      await onAdd({ ...values, description: values.description.trim(), amount: Number(values.amount) });
      setValues(makeInitialValues());
      setStep(0);
    } catch (err) {
      setError(err.message);
    }
  }

  const steps = [
    ['Activity', 'Description, method, and value'],
    ['STEP profile', 'Workbook classification fields'],
    ['Schedule', `${scheduledCount} planned · ${actualOnlyCount} actual-only`],
  ];

  return <div className="pt-activity-form pt-step-activity-form">
    <div className="pt-form-section-head"><strong>Add planned procurement activity</strong><small>Complete the three STEP sections. The activity reference is generated automatically.</small></div>
    <div className="pt-activity-completion"><div><span>Form completion</span><strong>{completion}%</strong></div><div className="pt-progress-track"><i className="success" style={{ width: `${completion}%` }} /></div></div>
    <div className="pt-form-steps">{steps.map(([label, note], index) => <button key={label} type="button" className={`${step === index ? 'active' : ''} ${step > index ? 'complete' : ''}`} onClick={() => index <= step && setStep(index)}><span>{index + 1}</span><div><strong>{label}</strong><small>{note}</small></div></button>)}</div>

    {step === 0 && <section className="pt-form-step-panel">
      <div className="pt-form-section-head"><strong>Activity and procurement method</strong><small>Choose the method first; its STEP milestone schedule is generated automatically.</small></div>
      <div className="pt-field"><label htmlFor="act-desc">Activity description <span className="pt-required-mark">*</span></label><textarea id="act-desc" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="e.g. Procurement of small-scale irrigation pump sets" /></div>
      <div className="pt-form-grid"><div className="pt-field"><label htmlFor="act-method">Procurement method <span className="pt-required-mark">*</span></label><select id="act-method" value={values.method} onChange={(event) => changeMethod(event.target.value)}>{methods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select><small className="pt-field-note">Template: {methodDefinition?.family || '—'} · {stageNames.length} tracked events</small></div><div className="pt-amount-fields"><div className="pt-field"><label htmlFor="act-amount">Estimated amount <span className="pt-required-mark">*</span></label><input id="act-amount" type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => setValues({ ...values, amount: event.target.value })} /></div><div className="pt-field"><label htmlFor="act-currency">Currency</label><select id="act-currency" value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value })}><option>USD</option><option>ETB</option></select></div></div></div>
    </section>}

    {step === 1 && <section className="pt-form-step-panel">
      <div className="pt-form-section-head"><strong>STEP activity profile</strong><small>Classification fields from the supplied STEP report. Fields marked * are required.</small></div>
      <div className="pt-form-grid"><MetadataFields fields={ACTIVITY_FIELDS} prefix="activity" values={values.categoryData} onChange={updateCategoryData} /></div>
      {(fieldsForMethod(values.method).length > 0 || (CATEGORY_FIELDS[category] || []).length > 0) && <><h4 className="pt-form-subtitle">Method and category information</h4><div className="pt-form-grid"><MetadataFields fields={fieldsForMethod(values.method)} prefix="method" values={values.categoryData} onChange={updateCategoryData} /><MetadataFields fields={CATEGORY_FIELDS[category] || []} prefix="category" values={values.categoryData} onChange={updateCategoryData} /></div></>}
    </section>}

    {step === 2 && <section className="pt-form-step-panel">
      <div className="pt-schedule-summary"><div><small>METHOD</small><strong>{methodDefinition?.label}</strong></div><div><small>SCHEDULED MILESTONES</small><strong>{scheduledCount}</strong></div><div><small>ACTUAL-ONLY EVENTS</small><strong>{actualOnlyCount}</strong></div></div>
      <div className="pt-form-section-head"><strong>Planned milestone schedule</strong><small>Dates must follow the sequence. Amendments and termination are recorded only when they occur.</small></div>
      <div className="pt-milestone-grid">{stageNames.map((name, index) => <div className={`pt-field ${!stageRequiresPlannedDate(name) ? 'actual-only' : ''}`} key={`${name}-${index}`}><label htmlFor={`planned-${index}`}><span>{index + 1}</span>{name}</label>{stageRequiresPlannedDate(name) ? <DualCalendarDateInput id={`planned-${index}`} label={`${name} planned date`} value={values.plannedDates[index] || ''} onChange={(date) => setPlannedDate(index, date)} /> : <span className="pt-actual-only-note">Actual date only · recorded during implementation</span>}</div>)}</div>
    </section>}

    {error && <div className="pt-error-banner">{error}</div>}
    <div className="pt-form-actions pt-step-form-actions">{step > 0 && <button className="pt-btn pt-btn-ghost" type="button" onClick={() => { setError(''); setStep(step - 1); }}>Back</button>}{step < 2 ? <button className="pt-btn" type="button" onClick={() => continueTo(step + 1)}>Continue</button> : <button className="pt-btn" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add activity to plan'}</button>}</div>
  </div>;
}

function StageRow({ stage, canSetTarget, canTrack, onUpdate, onReplan }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(stage.status);
  const [actualDate, setActualDate] = useState(stage.actualDate ? String(stage.actualDate).slice(0, 10) : '');
  const [remarks, setRemarks] = useState(stage.remarks || '');
  const [originalDate, setOriginalDate] = useState('');
  const [replanDate, setReplanDate] = useState('');
  const [replanReason, setReplanReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveDetails() {
    setBusy(true);
    try {
      await onUpdate(stage.id, { status, actualDate: actualDate || null, remarks });
    } finally {
      setBusy(false);
    }
  }

  async function setInitialDate() {
    if (!originalDate) return;
    setBusy(true);
    try {
      await onUpdate(stage.id, { originalDate });
    } finally {
      setBusy(false);
    }
  }

  async function submitReplan() {
    if (!replanDate || !replanReason.trim()) return;
    setBusy(true);
    try {
      await onReplan(stage.id, replanDate, replanReason.trim());
      setReplanDate('');
      setReplanReason('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-tl-row pt-stage-row">
      <div className="pt-tl-dot" style={{ background: stage.status === 'Completed' ? 'var(--ontrack)' : stage.status === 'NotApplicable' ? 'var(--line)' : 'var(--atrisk)' }} />
      <div className="pt-stage-main">
        <span className="pt-tl-label">{stage.sequenceNo}. {stage.name}</span>
        <small className="pt-stage-dates">
          Target: {formatDate(stage.revisedDate || stage.originalDate)}
          {stage.revisedDate && <> (was {formatDate(stage.originalDate)})</>}
          {' · '}Actual: {formatDate(stage.actualDate)}
        </small>
        {canSetTarget && stageRequiresPlannedDate(stage.name) && !stage.originalDate && (
          <div className="pt-stage-edit">
            <DualCalendarDateInput label={`${stage.name} target date`} value={originalDate} onChange={setOriginalDate} />
            <button className="pt-btn pt-btn-ghost" onClick={setInitialDate} disabled={busy || !originalDate}>Set target date</button>
          </div>
        )}
      </div>
      <span className="pt-stage-status">{stage.status}</span>
      {canTrack && (stage.originalDate || !stageRequiresPlannedDate(stage.name)) && (
        <button className="pt-text-btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Manage'}</button>
      )}
      {editing && (
        <div className="pt-stage-edit-panel">
          <div className="pt-form-grid">
            <div className="pt-field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STAGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="pt-field"><label>Actual date</label><DualCalendarDateInput label={`${stage.name} actual date`} value={actualDate} onChange={setActualDate} /></div>
          </div>
          <div className="pt-field"><label>Remarks</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          <button className="pt-btn pt-btn-ghost" onClick={saveDetails} disabled={busy}>Save</button>
          <div className="pt-replan-form">
            <strong>Replan target date</strong>
            <div className="pt-form-grid">
              <div className="pt-field"><label>New date</label><DualCalendarDateInput label={`${stage.name} replanned date`} value={replanDate} onChange={setReplanDate} /></div>
              <div className="pt-field"><label>Reason</label><input value={replanReason} onChange={(e) => setReplanReason(e.target.value)} placeholder="e.g. Supplier delay" /></div>
            </div>
            <button className="pt-btn pt-btn-ghost" onClick={submitReplan} disabled={busy || !replanDate || !replanReason.trim()}>Replan</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanDetailDrawer({ planId, viewerRole, currentUserName, onClose, onChanged }) {
  const [plan, setPlan] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [voteComment, setVoteComment] = useState('');
  const [managementComment, setManagementComment] = useState('');

  async function reload() {
    try {
      const [planData, summaryData] = await Promise.all([api.getPlan(planId), api.getApprovalSummary(planId)]);
      setPlan(planData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!planId) { setPlan(null); setSummary(null); return; }
    setError(null);
    reload();
  }, [planId]);

  if (!planId) return null;

  async function handleAddActivity(payload) {
    await api.addActivity(planId, payload);
    await reload();
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await api.submitPlan(planId);
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDirectorReview(decision) {
    setBusy(true);
    try {
      await api.directorReview(planId, decision, comment);
      setComment('');
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVote(decision) {
    setBusy(true);
    try {
      await api.castVote(planId, decision, voteComment);
      setVoteComment('');
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleManagementDecision(decision) {
    if (decision === 'Reject' && !managementComment.trim()) { setError('A reason for rejection is required.'); return; }
    setBusy(true);
    try {
      await api.managementDecision(planId, decision, managementComment);
      setManagementComment('');
      await reload();
      onChanged?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleStageUpdate(stageId, payload) {
    try {
      await api.updateStage(stageId, payload);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReplan(stageId, newDate, reason) {
    try {
      await api.replanStage(stageId, newDate, reason);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const canEditPlan = viewerRole === 'officer' && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(plan?.status);
  const canManageStages = viewerRole === 'officer' && ['FINALLY_APPROVED', 'REPLANNED'].includes(plan?.status);
  const alreadyVoted = summary?.committee.votes.some((v) => v.memberName === currentUserName);

  return (
    <div className="pt-overlay" onClick={onClose}>
      <div className="pt-drawer" role="dialog" aria-modal="true" aria-label="Plan details" onClick={(e) => e.stopPropagation()}>
        {!plan ? <div className="pt-empty">{error || 'Loading…'}</div> : <>
          <div className="pt-drawer-head">
            <div>
              <span className="pt-id">{plan.reference}</span>
              <h2 className="pt-display pt-drawer-title">{plan.name}</h2>
              <span className="pt-badge">{plan.category}</span> <StatusBadge status={plan.status} />
            </div>
            <button className="pt-close" aria-label="Close details" onClick={onClose}><X size={18} /></button>
          </div>

          {error && <div className="pt-error-banner">{error}</div>}

          <div className="pt-detail-grid">
            <div><span className="pt-detail-label">Project</span><br />{plan.projectName}</div>
            <div><span className="pt-detail-label">Fiscal year</span><br />{plan.fiscalYear}</div>
            <div><span className="pt-detail-label">Planning period</span><br />{formatDate(plan.periodStart)} – {formatDate(plan.periodEnd)}</div>
            <div><span className="pt-detail-label">Default currency</span><br />{plan.defaultCurrency}</div>
            <div><span className="pt-detail-label">Created by</span><br />{plan.createdByName}</div>
            <div><span className="pt-detail-label">Submitted</span><br />{formatDate(plan.submittedAt)}</div>
          </div>
          {plan.description && <p className="pt-notes">{plan.description}</p>}

          <h3 className="pt-section-title">Procurement activities</h3>
          {plan.activities.length === 0 && <p className="pt-field-help">No activities yet.</p>}
          {plan.activities.map((activity) => (
            <div className="pt-panel pt-activity-card" key={activity.id}>
              <div className="pt-activity-head">
                <div><strong>{activity.description}</strong><small>{activity.reference} · {activity.method} · {formatMoney(activity.amount, activity.currency)} · {activity.progress}% complete{activity.delayedStages ? ` · ${activity.delayedStages} delayed` : ''}</small></div>
              </div>
              <div className="pt-activity-meta">
                <span><b>Loan / credit:</b> {activity.categoryData.loanCreditNo || '—'}</span>
                <span><b>Component:</b> {activity.categoryData.component || '—'}</span>
                <span><b>Review:</b> {activity.categoryData.reviewType || '—'}</span>
                <span><b>Market:</b> {activity.categoryData.marketApproach || '—'}</span>
                <span><b>Process:</b> {activity.categoryData.processStatus || activity.status}</span>
              </div>
              <div className="pt-timeline">
                {activity.stages.map((stage) => (
                  <StageRow key={stage.id} stage={stage} canSetTarget={canEditPlan || canManageStages} canTrack={canManageStages} onUpdate={handleStageUpdate} onReplan={handleReplan} />
                ))}
              </div>
            </div>
          ))}

          {canEditPlan && <AddActivityForm category={plan.category} defaultCurrency={plan.defaultCurrency} onAdd={handleAddActivity} busy={busy} />}

          {summary && (
            <>
              <h3 className="pt-section-title">Approval progress</h3>
              <div className="pt-approval-summary">
                <div><span className="pt-detail-label">Director decision</span><br />{summary.director ? `${summary.director.decision}${summary.director.comment ? ` — ${summary.director.comment}` : ''}` : 'Pending'}</div>
                <div><span className="pt-detail-label">Endorsing Committee votes</span><br />{summary.committee.votes.length} of {summary.committee.size} cast ({summary.committee.approvalThreshold} endorsements needed)</div>
                {summary.committee.votes.map((v, i) => (
                  <div key={i} className="pt-vote-row"><strong>{v.memberName}</strong>: {v.decision}{v.comment ? ` — ${v.comment}` : ''}</div>
                ))}
                <div><span className="pt-detail-label">Ministry Management decision</span><br />{summary.management ? `${summary.management.decision} by ${summary.management.decidedByName}${summary.management.comment ? ` — ${summary.management.comment}` : ''}` : plan.status === 'MANAGEMENT_REVIEW' ? 'Pending' : 'Not reached'}</div>
              </div>
            </>
          )}

          <div className="pt-actions">
            {canEditPlan && plan.activities.length > 0 && (
              <button className="pt-btn" onClick={handleSubmit} disabled={busy}><Send size={14} /> {busy ? 'Submitting…' : 'Submit to Director'}</button>
            )}
            {viewerRole === 'director' && plan.status === 'SUBMITTED_TO_DIRECTOR' && (
              <div className="pt-review-panel">
                <div className="pt-field"><label>Comment (required to return/reject)</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
                <div className="pt-actions">
                  <button className="pt-btn" onClick={() => handleDirectorReview('APPROVE')} disabled={busy}><CheckCircle2 size={14} /> Approve &amp; send to Endorsing Committee</button>
                  <button className="pt-btn pt-btn-ghost" onClick={() => handleDirectorReview('RETURN')} disabled={busy}>Return for correction</button>
                  <button className="pt-btn pt-btn-danger" onClick={() => handleDirectorReview('REJECT')} disabled={busy}>Reject</button>
                </div>
              </div>
            )}
            {viewerRole === 'committee' && plan.status === 'COMMITTEE_REVIEW' && !alreadyVoted && (
              <div className="pt-review-panel">
                <div className="pt-field"><label>Comment (optional)</label><textarea value={voteComment} onChange={(e) => setVoteComment(e.target.value)} /></div>
                <div className="pt-actions">
                  <button className="pt-btn" onClick={() => handleVote('Approve')} disabled={busy}>Approve</button>
                  <button className="pt-btn pt-btn-danger" onClick={() => handleVote('Reject')} disabled={busy}>Reject</button>
                </div>
              </div>
            )}
            {viewerRole === 'management' && plan.status === 'MANAGEMENT_REVIEW' && !summary?.management && (
              <div className="pt-review-panel">
                <div className="pt-field"><label>Management comment (optional for approval; required for rejection)</label><textarea value={managementComment} onChange={(e) => setManagementComment(e.target.value)} /></div>
                <div className="pt-actions">
                  <button className="pt-btn" onClick={() => handleManagementDecision('Approve')} disabled={busy}><CheckCircle2 size={14} /> Give final approval</button>
                  <button className="pt-btn pt-btn-danger" onClick={() => handleManagementDecision('Reject')} disabled={busy || !managementComment.trim()}>Reject</button>
                </div>
              </div>
            )}
          </div>
        </>}
      </div>
    </div>
  );
}
