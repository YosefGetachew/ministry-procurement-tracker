import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, CheckCircle2, Clock3, Download, FileBarChart2,
  FileSpreadsheet, RefreshCw, ShieldCheck,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api';
import KPICard from '../components/KPICard';
import { formatDate, formatMoney, PLAN_STATUS_META } from '../constants';

const COLORS = ['#0f766e', '#d6a72f', '#2563eb', '#b45309', '#7c3aed', '#b91c1c', '#64748b'];
const EXECUTIVE_REPORTS = [
  ['approval-status', 'Approval status', 'Governance decisions and committee voting'],
  ['delayed-procurement', 'Delayed procurement', 'Overdue activities requiring intervention'],
  ['contract-payment-status', 'Contract and payment status', 'Commitments, payments, and outstanding exposure'],
  ['project-officer-summary', 'Project / officer summary', 'Portfolio responsibility and workload'],
];

const tooltipStyle = { border: '1px solid #dde6ef', borderRadius: 8, fontSize: 11, boxShadow: '0 10px 28px rgba(15,23,42,.08)' };

function compactNumber(value) {
  return new Intl.NumberFormat('en-ET', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

function statusLabel(status) {
  return PLAN_STATUS_META[status]?.label || String(status).replaceAll('_', ' ');
}

function ChartEmpty({ message = 'No data matches the selected filters.' }) {
  return <div className="pt-chart-empty"><FileBarChart2 size={24} /><strong>No chart data yet</strong><span>{message}</span></div>;
}

export default function ExecutiveReportsView({ showToast, onSelectPlan }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fiscalYear: '', sectorId: '' });

  function load(nextFilters = filters) {
    setLoading(true);
    api.getExecutiveDashboard(nextFilters).then(setData).catch((error) => showToast(error.message)).finally(() => setLoading(false));
  }

  useEffect(() => { load({ fiscalYear: '', sectorId: '' }); }, []);

  const categoryData = useMemo(() => {
    const rows = new Map();
    (data?.categoryMix || []).forEach((item) => {
      if (!rows.has(item.category)) rows.set(item.category, { category: item.category });
      rows.get(item.category)[item.currency] = item.amount;
    });
    return [...rows.values()];
  }, [data]);

  const currencies = useMemo(() => [...new Set((data?.categoryMix || []).map((item) => item.currency))], [data]);
  const statusData = (data?.statusMix || []).map((item) => ({ ...item, label: statusLabel(item.status) }));
  const overview = data?.overview || {};
  const valueSummary = (data?.procurementValue || []).map((item) => formatMoney(item.amount, item.currency)).join(' · ') || 'No activity value';

  return <div className="pt-executive-dashboard">
    <section className="pt-executive-intro">
      <div><p className="pt-eyebrow">EXECUTIVE OVERSIGHT</p><h1>Procurement performance and decision report</h1><p>Ministry-wide visibility for leadership action, approval, and portfolio oversight.</p></div>
      <div className="pt-executive-freshness"><span>Live database</span><strong>{data ? `Updated ${formatDate(data.generatedAt)}` : 'Loading'}</strong></div>
    </section>

    <section className="pt-panel pt-executive-filters">
      <div className="pt-field"><label>Fiscal year</label><select value={filters.fiscalYear} onChange={(event) => setFilters({ ...filters, fiscalYear: event.target.value })}><option value="">All fiscal years</option>{data?.filters?.fiscal_years?.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
      <div className="pt-field"><label>Sector</label><select value={filters.sectorId} onChange={(event) => setFilters({ ...filters, sectorId: event.target.value })}><option value="">All sectors</option>{data?.filters?.sectors?.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
      <button className="pt-btn" onClick={() => load()} disabled={loading}><RefreshCw size={14} />{loading ? 'Refreshing…' : 'Apply filters'}</button>
      {(filters.fiscalYear || filters.sectorId) && <button className="pt-btn pt-btn-ghost" onClick={() => { const reset = { fiscalYear: '', sectorId: '' }; setFilters(reset); load(reset); }}>Clear</button>}
    </section>

    {loading && !data && <section className="pt-panel pt-empty">Preparing the executive dashboard…</section>}
    {data && <>
      <section className="pt-kpis pt-executive-kpis">
        <KPICard label="Procurement plans" value={overview.totalPlans || 0} sub={valueSummary} icon={FileBarChart2} />
        <KPICard label="Final approval rate" value={`${overview.approvalRate || 0}%`} sub={`${overview.approvedPlans || 0} finally approved`} icon={CheckCircle2} />
        <KPICard label="Awaiting decision" value={overview.awaitingDecision || 0} sub="Director, endorsing, or management review" icon={Clock3} />
        <KPICard label="Delayed milestones" value={overview.delayedStages || 0} sub="Past their current planned date" icon={AlertTriangle} />
        <KPICard label="Milestone completion" value={`${overview.completionRate || 0}%`} sub={`${overview.completedStages || 0} of ${overview.applicableStages || 0} applicable stages`} icon={ShieldCheck} />
        <KPICard label="Active contracts" value={overview.activeContracts || 0} sub="Currently under implementation" icon={Banknote} />
      </section>

      <section className="pt-executive-chart-grid">
        <article className="pt-panel pt-executive-chart">
          <div className="pt-panel-head"><div><h2>Plan pipeline</h2><p>Distribution across approval and implementation states</p></div></div>
          <div className="pt-chart-canvas">{statusData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="count" nameKey="label" innerRadius={64} outerRadius={94} paddingAngle={2}>{statusData.map((item, index) => <Cell key={item.status} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <ChartEmpty message="Plan statuses will appear after procurement plans are created." />}</div>
        </article>
        <article className="pt-panel pt-executive-chart">
          <div className="pt-panel-head"><div><h2>Approval movement</h2><p>Plans created and finally approved during the last 12 months</p></div></div>
          <div className="pt-chart-canvas"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthlyTrend} margin={{ top: 8, right: 18, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#edf2f6" /><XAxis dataKey="month" tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="created" name="Created" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} /><Line type="monotone" dataKey="approved" name="Finally approved" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
        </article>
        <article className="pt-panel pt-executive-chart">
          <div className="pt-panel-head"><div><h2>Procurement value by category</h2><p>Planned activity value; currencies are intentionally separated</p></div></div>
          <div className="pt-chart-canvas">{categoryData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#edf2f6" /><XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={54} /><YAxis tickFormatter={compactNumber} tick={{ fontSize: 10 }} /><Tooltip formatter={(value, name) => formatMoney(value, name)} contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} />{currencies.map((currency, index) => <Bar key={currency} dataKey={currency} name={currency} fill={COLORS[index]} radius={[5, 5, 0, 0]} />)}</BarChart></ResponsiveContainer> : <ChartEmpty message="Category values will appear after activities are added to plans." />}</div>
        </article>
        <article className="pt-panel pt-executive-chart">
          <div className="pt-panel-head"><div><h2>Sector performance</h2><p>Plan volume, final approvals, and overdue milestones</p></div></div>
          <div className="pt-chart-canvas">{data.sectorPerformance.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.sectorPerformance} margin={{ top: 8, right: 18, left: -10, bottom: 26 }}><CartesianGrid strokeDasharray="3 3" stroke="#edf2f6" /><XAxis dataKey="sector" tick={{ fontSize: 9 }} interval={0} angle={-14} textAnchor="end" height={62} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="plans" name="Plans" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="approved" name="Approved" fill="#0f766e" radius={[4, 4, 0, 0]} /><Bar dataKey="delayed" name="Delayed milestones" fill="#b45309" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <ChartEmpty message="Sector comparisons will appear when plans are linked to sector projects." />}</div>
        </article>
      </section>

      <section className="pt-executive-lower-grid">
        <article className="pt-panel">
          <div className="pt-panel-head"><div><h2>Leadership decision queue</h2><p>Oldest plans currently awaiting an approval decision</p></div><span className="pt-count-badge">{data.decisionQueue.length}</span></div>
          <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr><th>Plan</th><th>Sector / project</th><th>Status</th><th>Value</th><th>Waiting</th></tr></thead><tbody>{!data.decisionQueue.length && <tr><td colSpan="5" className="pt-empty">No plans are waiting for a decision.</td></tr>}{data.decisionQueue.map((plan) => <tr key={plan.id} className="pt-clickable-row" onClick={() => onSelectPlan(plan.id)}><td><strong>{plan.name}</strong><small>{plan.reference}</small></td><td>{plan.sector_name || 'Unassigned'}<small>{plan.project_name}</small></td><td>{statusLabel(plan.status)}</td><td>{plan.values.map((item) => formatMoney(item.amount, item.currency)).join(' · ') || '—'}</td><td><strong>{plan.days_waiting} days</strong></td></tr>)}</tbody></table></div>
        </article>
        <article className="pt-panel">
          <div className="pt-panel-head"><div><h2>Contract exposure</h2><p>Committed, paid, and outstanding value by currency</p></div></div>
          <div className="pt-exposure-list">{!data.contractExposure.length && <div className="pt-empty">No contracts match the selected filters.</div>}{data.contractExposure.map((item) => <div key={item.currency} className="pt-exposure-item"><div><span>{item.currency}</span><strong>{formatMoney(item.contract_value, item.currency)}</strong></div><dl><div><dt>Paid</dt><dd>{formatMoney(item.paid, item.currency)}</dd></div><div><dt>Outstanding</dt><dd>{formatMoney(item.outstanding, item.currency)}</dd></div></dl><div className="pt-progress-track"><i className="success" style={{ width: `${item.contract_value ? Math.min(100, Math.round((item.paid / item.contract_value) * 100)) : 0}%` }} /></div></div>)}</div>
        </article>
      </section>

      <section className="pt-panel pt-executive-report-library">
        <div className="pt-panel-head"><div><h2>Official report library</h2><p>Download ministry-wide supporting reports for meetings and follow-up</p></div></div>
        <div className="pt-executive-report-cards">{EXECUTIVE_REPORTS.map(([code, title, description]) => <article key={code}><span><FileSpreadsheet size={17} /></span><div><strong>{title}</strong><small>{description}</small></div><div><a href={api.reportExportUrl(code, 'pdf')} className="pt-text-btn"><Download size={13} />PDF</a><a href={api.reportExportUrl(code, 'xlsx')} className="pt-text-btn"><Download size={13} />Excel</a></div></article>)}</div>
      </section>
    </>}
  </div>;
}
