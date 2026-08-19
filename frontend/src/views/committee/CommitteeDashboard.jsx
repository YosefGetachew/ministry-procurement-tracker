import React from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock3, Users } from 'lucide-react';
import KPICard from '../../components/KPICard';
import { formatDate, formatMoney } from '../../constants';

function DecisionBar({ label, value, total, tone }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div className="pt-decision-row"><div><span>{label}</span><strong>{value}</strong></div><div className="pt-progress-track"><i className={tone} style={{ width: `${percent}%` }} /></div></div>;
}

export default function CommitteeDashboard({ summary, onSelectPlan }) {
  if (!summary) return null;
  const decisions = summary.myDecisions || [];
  const approved = decisions.find((item) => item.decision === 'Approve')?.count || 0;
  const rejected = decisions.find((item) => item.decision === 'Reject')?.count || 0;
  const totalDecisions = approved + rejected;
  const values = summary.valueUnderReview || [];

  return <div className="pt-committee-dashboard">
    <section className="pt-kpis">
      <KPICard label="Awaiting my vote" value={summary.plansPendingMyVote || 0} sub="Action required" icon={AlertTriangle} />
      <KPICard label="Open committee plans" value={summary.openCommitteePlans || 0} sub="Across all members" icon={Clock3} />
      <KPICard label="My decisions" value={totalDecisions} sub={`${approved} approved · ${rejected} rejected`} icon={CheckCircle2} />
      <KPICard label="Committee participation" value={`${summary.participationRate || 0}%`} sub="Votes submitted on open plans" icon={Users} />
    </section>

    <section className="pt-committee-grid">
      <article className="pt-panel pt-committee-queue">
        <div className="pt-panel-head"><div><h2>Decision queue</h2><p>Director-approved plans awaiting your decision</p></div><span className="pt-count-badge">{summary.pendingPlans?.length || 0}</span></div>
        <div className="pt-queue-list">
          {!summary.pendingPlans?.length && <div className="pt-empty">You have no pending votes.</div>}
          {summary.pendingPlans?.map((plan) => <button key={plan.id} className="pt-queue-item" onClick={() => onSelectPlan(plan.id)}>
            <div><strong>{plan.name}</strong><small>{plan.reference} · {plan.projectName}</small></div>
            <div className="pt-queue-meta"><span>{plan.votesCast}/5 votes</span><small>{plan.daysWaiting} day{plan.daysWaiting === 1 ? '' : 's'} waiting</small></div>
          </button>)}
        </div>
      </article>

      <article className="pt-panel">
        <div className="pt-panel-head"><div><h2>Value under review</h2><p>Total procurement activity value by currency</p></div><Banknote size={18} /></div>
        <div className="pt-value-stack">
          {!values.length && <div className="pt-empty">No plan value is currently under review.</div>}
          {values.map((item) => <div key={item.currency}><small>{item.currency}</small><strong>{formatMoney(item.amount, item.currency)}</strong></div>)}
        </div>
        <div className="pt-decision-breakdown">
          <h3>My decision history</h3>
          <DecisionBar label="Approved" value={approved} total={totalDecisions} tone="success" />
          <DecisionBar label="Rejected" value={rejected} total={totalDecisions} tone="danger" />
        </div>
      </article>
    </section>

    <section className="pt-committee-grid pt-committee-grid-lower">
      <article className="pt-panel">
        <div className="pt-panel-head"><div><h2>Committee participation</h2><p>Votes submitted on plans currently in review</p></div></div>
        <div className="pt-participation-list">
          {summary.memberParticipation?.map((member) => <div key={member.id} className="pt-participation-row"><div><strong>{member.name}</strong><small>{member.votesCast} of {summary.openCommitteePlans || 0} open plans</small></div><span>{member.rate}%</span></div>)}
        </div>
      </article>
      <article className="pt-panel">
        <div className="pt-panel-head"><div><h2>My recent decisions</h2><p>Your latest recorded committee votes</p></div></div>
        <div className="pt-recent-decisions">
          {!summary.recentDecisions?.length && <div className="pt-empty">No decisions recorded yet.</div>}
          {summary.recentDecisions?.map((decision) => <button key={decision.id} onClick={() => onSelectPlan(decision.planId)}><span className={`pt-decision-dot ${decision.decision.toLowerCase()}`} /><div><strong>{decision.planName}</strong><small>{decision.reference} · {formatDate(decision.votedAt)}</small></div><em>{decision.decision}</em></button>)}
        </div>
      </article>
    </section>
  </div>;
}
