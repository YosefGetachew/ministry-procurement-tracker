import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Banknote, CheckCircle2, ClipboardCheck,
  Clock3, RefreshCw, ShieldAlert,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../api';
import KPICard from '../../components/KPICard';
import { formatDate, formatMoney, PLAN_STATUS_META } from '../../constants';

const COLORS = ['#0f766e', '#d6a72f', '#2563eb', '#b91c1c', '#64748b'];
const tooltipStyle = { border: '1px solid #dde6ef', borderRadius: 8, fontSize: 11, boxShadow: '0 10px 28px rgba(15,23,42,.08)' };

function statusLabel(status) {
  return PLAN_STATUS_META[status]?.label || String(status).replaceAll('_', ' ');
}

function EmptyVisual({ children }) {
  return <div className="pt-chart-empty"><ClipboardCheck size={24} /><strong>No procurement data yet</strong><span>{children}</span></div>;
}

export default function MinisterDashboard({ showToast, onSelectPlan, onOpenReports }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.getExecutiveDashboard().then(setData).catch((error) => showToast(error.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const statusCounts = useMemo(() => Object.fromEntries((data?.statusMix || []).map((item) => [item.status, item.count])), [data]);
  const pipeline = useMemo(() => {
    if (!data) return [];
    const pending = ['SUBMITTED_TO_DIRECTOR', 'DIRECTOR_APPROVED', 'COMMITTEE_REVIEW', 'MANAGEMENT_REVIEW'].reduce((sum, key) => sum + (statusCounts[key] || 0), 0);
    const rejected = ['REJECTED_BY_DIRECTOR', 'REJECTED_BY_COMMITTEE', 'REJECTED_BY_MANAGEMENT', 'CANCELLED'].reduce((sum, key) => sum + (statusCounts[key] || 0), 0);
    const preparation = ['DRAFT', 'RETURNED_FOR_CORRECTION', 'REPLANNED'].reduce((sum, key) => sum + (statusCounts[key] || 0), 0);
    return [
      { name: 'Finally approved', value: statusCounts.FINALLY_APPROVED || 0 },
      { name: 'Pending approval', value: pending },
      { name: 'Preparation / revision', value: preparation },
      { name: 'Rejected / cancelled', value: rejected },
      { name: 'Closed', value: statusCounts.CLOSED || 0 },
    ].filter((item) => item.value > 0);
  }, [data, statusCounts]);

  if (!data && loading) return <section className="pt-panel pt-empty">Preparing the Minister dashboard…</section>;
  if (!data) return null;

  const overview = data.overview;
  const managementQueue = data.decisionQueue.filter((plan) => plan.status === 'MANAGEMENT_REVIEW');
  const valueSummary = data.procurementValue.map((item) => formatMoney(item.amount, item.currency)).join(' · ') || 'No planned value recorded';
  const topSectors = data.sectorPerformance.slice(0, 6);

  return <div className="pt-minister-dashboard">
    <section className="pt-minister-hero">
      <div>
        <p className="pt-eyebrow">MINISTERIAL BRIEFING</p>
        <h1>MoA procurement oversight</h1>
        <p>High-level performance, financial exposure, and decisions requiring leadership attention.</p>
      </div>
      <div className="pt-minister-hero-actions">
        <span>Live as of {formatDate(data.generatedAt)}</span>
        <button className="pt-btn pt-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        <button className="pt-btn" onClick={onOpenReports}>Full executive reports <ArrowRight size={14} /></button>
      </div>
    </section>

    <section className="pt-kpis pt-minister-kpis">
      <KPICard label="Total procurement plans" value={overview.totalPlans || 0} sub={valueSummary} icon={ClipboardCheck} />
      <KPICard label="Final approval rate" value={`${overview.approvalRate || 0}%`} sub={`${overview.approvedPlans || 0} plans finally approved`} icon={CheckCircle2} />
      <KPICard label="Ministerial decisions" value={statusCounts.MANAGEMENT_REVIEW || 0} sub="Endorsed plans awaiting final approval" icon={ShieldAlert} />
      <KPICard label="Delayed milestones" value={overview.delayedStages || 0} sub="Past the latest approved target date" icon={AlertTriangle} />
      <KPICard label="Active contracts" value={overview.activeContracts || 0} sub="Contracts currently under implementation" icon={Banknote} />
    </section>

    <section className="pt-minister-attention">
      <div className="pt-minister-attention-title"><ShieldAlert size={18} /><div><strong>Executive attention</strong><small>Issues with the greatest immediate leadership impact</small></div></div>
      <div><span className={(statusCounts.MANAGEMENT_REVIEW || 0) ? 'urgent' : 'clear'}>{statusCounts.MANAGEMENT_REVIEW || 0}</span><p><strong>Final approvals required</strong><small>Plans already endorsed by committee</small></p></div>
      <div><span className={overview.delayedStages ? 'warning' : 'clear'}>{overview.delayedStages || 0}</span><p><strong>Overdue milestones</strong><small>Implementation schedule exceptions</small></p></div>
      <div><span className={overview.rejectedPlans ? 'warning' : 'clear'}>{overview.rejectedPlans || 0}</span><p><strong>Rejected plans</strong><small>Across all approval levels</small></p></div>
    </section>

    <section className="pt-minister-main-grid">
      <article className="pt-panel pt-minister-chart">
        <div className="pt-panel-head"><div><h2>Portfolio approval position</h2><p>Where the ministry's procurement plans currently stand</p></div></div>
        <div className="pt-chart-canvas">{pipeline.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pipeline} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={2}>{pipeline.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <EmptyVisual>Approval distribution appears after plans enter the workflow.</EmptyVisual>}</div>
      </article>

      <article className="pt-panel pt-minister-chart">
        <div className="pt-panel-head"><div><h2>Sector delivery snapshot</h2><p>Plan volume, approvals, and delayed milestones by sector</p></div></div>
        <div className="pt-chart-canvas">{topSectors.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topSectors} margin={{ top: 8, right: 12, left: -14, bottom: 34 }}><CartesianGrid strokeDasharray="3 3" stroke="#edf2f6" /><XAxis dataKey="sector" tick={{ fontSize: 8 }} interval={0} angle={-15} textAnchor="end" height={68} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="plans" name="Plans" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="approved" name="Approved" fill="#0f766e" radius={[4, 4, 0, 0]} /><Bar dataKey="delayed" name="Delayed milestones" fill="#b45309" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyVisual>Sector comparisons appear when procurement plans are registered.</EmptyVisual>}</div>
      </article>
    </section>

    <section className="pt-minister-lower-grid">
      <article className="pt-panel">
        <div className="pt-panel-head"><div><h2>Plans awaiting the Minister's decision</h2><p>Committee-endorsed plans ready for final approval</p></div><span className="pt-count-badge">{managementQueue.length}</span></div>
        <div className="pt-minister-decision-list">
          {!managementQueue.length && <div className="pt-empty">No plans currently require a ministerial decision.</div>}
          {managementQueue.map((plan) => <button key={plan.id} onClick={() => onSelectPlan(plan.id)}><span><Clock3 size={15} /></span><div><strong>{plan.name}</strong><small>{plan.reference} · {plan.project_name} · {plan.sector_name || 'Unassigned sector'}</small></div><div><strong>{plan.days_waiting} days</strong><small>{plan.values.map((item) => formatMoney(item.amount, item.currency)).join(' · ') || 'No value'}</small></div><ArrowRight size={15} /></button>)}
        </div>
      </article>

      <article className="pt-panel">
        <div className="pt-panel-head"><div><h2>Financial position</h2><p>Contract commitments and payment exposure</p></div></div>
        <div className="pt-minister-finance-list">
          {!data.contractExposure.length && <div className="pt-empty">No contract exposure has been recorded.</div>}
          {data.contractExposure.map((item) => {
            const paidRate = item.contract_value ? Math.min(100, Math.round((item.paid / item.contract_value) * 100)) : 0;
            return <div key={item.currency}><header><span>{item.currency}</span><strong>{formatMoney(item.contract_value, item.currency)}</strong></header><dl><div><dt>Paid</dt><dd>{formatMoney(item.paid, item.currency)}</dd></div><div><dt>Outstanding</dt><dd>{formatMoney(item.outstanding, item.currency)}</dd></div></dl><div className="pt-progress-track"><i className="success" style={{ width: `${paidRate}%` }} /></div><small>{paidRate}% paid against current contract value</small></div>;
          })}
        </div>
      </article>
    </section>
  </div>;
}
