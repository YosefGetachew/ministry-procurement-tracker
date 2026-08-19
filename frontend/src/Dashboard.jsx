import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Bell, CheckCircle2, ClipboardList, FolderKanban, ShieldCheck,
} from 'lucide-react';
import { api } from './api';
import { useAuth } from './auth/AuthContext';
import { useToast } from './hooks/useToast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import KPICard from './components/KPICard';
import PlanDetailDrawer from './components/PlanDetailDrawer';

import MyProjectsView from './views/officer/MyProjectsView';
import OfficerPlansView from './views/officer/PlansView';
import ContractsView from './views/officer/ContractsView';
import DirectorProjectsView from './views/director/ProjectsView';
import DirectorPlansView from './views/director/PlansView';
import CommitteePlansView from './views/committee/PlansView';
import CommitteeDashboard from './views/committee/CommitteeDashboard';
import ManagementPlansView from './views/management/PlansView';
import MinisterDashboard from './views/management/MinisterDashboard';
import AdminUsersView from './views/admin/UsersView';
import AdminCommitteeView from './views/admin/CommitteeView';
import AdminSettingsView from './views/admin/SettingsView';
import AlertsView from './views/AlertsView';
import ReportsView from './views/ReportsView';
import ExecutiveReportsView from './views/ExecutiveReportsView';

function DashboardSummary({ role, summary }) {
  if (!summary) return null;
  if (role === 'officer') {
    return <section className="pt-kpis">
      <KPICard label="Assigned projects" value={summary.assignedProjects} icon={FolderKanban} />
      <KPICard label="Unread alerts" value={summary.unreadAlerts} icon={Bell} />
      <KPICard label="Missing planned dates" value={summary.activitiesNeedingPlannedDates || 0} icon={AlertTriangle} />
      <KPICard label="Delayed stages" value={summary.delayedStages || 0} icon={AlertTriangle} />
      {summary.plansByStatus.map((s) => <KPICard key={s.status} label={s.status.replaceAll('_', ' ')} value={s.count} icon={ClipboardList} />)}
    </section>;
  }
  if (role === 'director') {
    return <section className="pt-kpis">
      <KPICard label="Active projects" value={summary.activeProjects} icon={FolderKanban} />
      <KPICard label="Awaiting my review" value={summary.plansAwaitingReview} icon={AlertTriangle} />
      <KPICard label="In committee review" value={summary.plansInCommitteeReview} icon={ClipboardList} />
      <KPICard label="Finally approved" value={summary.plansFinallyApproved} icon={CheckCircle2} />
    </section>;
  }
  if (role === 'committee') {
    return <section className="pt-kpis">
      <KPICard label="Pending my vote" value={summary.plansPendingMyVote} icon={AlertTriangle} />
      {summary.myDecisions.map((d) => <KPICard key={d.decision} label={`My ${d.decision.toLowerCase()}s`} value={d.count} icon={CheckCircle2} />)}
    </section>;
  }
  if (role === 'management') {
    return <section className="pt-kpis">
      <KPICard label="Awaiting final approval" value={summary.plansAwaitingManagement || 0} icon={AlertTriangle} />
      <KPICard label="Finally approved" value={summary.plansFinallyApproved || 0} icon={CheckCircle2} />
      <KPICard label="Rejected by management" value={summary.plansRejectedByManagement || 0} icon={ClipboardList} />
      <KPICard label="Unread alerts" value={summary.unreadAlerts || 0} icon={Bell} />
    </section>;
  }
  return <section className="pt-kpis">
    <KPICard label="Endorsing Committee" value={summary.activeCommitteeMembers} icon={ShieldCheck} />
    <KPICard label="Management Committee" value={summary.activeManagementMembers || 0} icon={ShieldCheck} />
    {summary.usersByRole.map((u) => <KPICard key={u.role} label={`${u.role}s`} value={u.count} icon={ClipboardList} />)}
  </section>;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { toast, showToast } = useToast();
  const [activeView, setActiveView] = useState('Dashboard');
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [committees, setCommittees] = useState({ endorsing: [], management: [] });
  const [sectors, setSectors] = useState([]);
  const [fundingSources, setFundingSources] = useState([]);
  const [leadership, setLeadership] = useState([]);

  const reloadAlerts = useCallback(() => api.listAlerts().then(setAlerts).catch(() => {}), []);
  const reloadPlans = useCallback(() => api.listPlans().then(setPlans).catch((err) => showToast(err.message)), [showToast]);
  const reloadProjects = useCallback(() => {
    const call = user.role === 'director' ? api.listProjects() : api.listMyProjects();
    return call.then(setProjects).catch((err) => showToast(err.message));
  }, [user.role, showToast]);
  const reloadUsers = useCallback(() => api.listUsers().then(setUsers).catch((err) => showToast(err.message)), [showToast]);
  const reloadCommittee = useCallback(() => api.listCommittees().then(setCommittees).catch((err) => showToast(err.message)), [showToast]);
  const reloadSectors = useCallback(() => api.listSectors().then(setSectors).catch((err) => showToast(err.message)), [showToast]);
  const reloadFundingSources = useCallback(() => api.listLookupOptions('funding_source').then(setFundingSources).catch((err) => showToast(err.message)), [showToast]);
  const reloadLeadership = useCallback(() => api.listLeadership().then(setLeadership).catch((err) => showToast(err.message)), [showToast]);
  const reloadSummary = useCallback(() => api.getDashboard().then(setSummary).catch(() => {}), []);

  useEffect(() => {
    reloadAlerts();
    reloadSummary();
    if (user.role === 'admin') { reloadUsers(); reloadCommittee(); reloadSectors(); reloadFundingSources(); reloadLeadership(); return; }
    if (user.role === 'director') { reloadSectors(); reloadFundingSources(); }
    if (user.role === 'officer' || user.role === 'director') reloadProjects();
    reloadPlans();
  }, [user.role]);

  const unreadAlerts = alerts.filter((a) => a.status === 'unread').length;

  function markAlertRead(id) {
    api.markAlertRead(id).then(reloadAlerts).catch((err) => showToast(err.message));
  }

  function handlePlanChanged() {
    reloadPlans();
    reloadSummary();
    reloadAlerts();
  }

  return (
    <div className="pt-shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} unreadAlerts={unreadAlerts} user={user} onLogout={logout} />
      <section className="pt-workspace">
        <Topbar title={activeView} unreadAlerts={unreadAlerts} user={user} />
        <main className="pt-content">
          {activeView === 'Dashboard' && !['committee', 'management'].includes(user.role) && <DashboardSummary role={user.role} summary={summary} />}
          {activeView === 'Dashboard' && user.role === 'committee' && <CommitteeDashboard summary={summary} onSelectPlan={setSelectedPlanId} />}
          {activeView === 'Dashboard' && user.role === 'management' && <MinisterDashboard showToast={showToast} onSelectPlan={setSelectedPlanId} onOpenReports={() => setActiveView('Executive Reports')} />}

          {user.role === 'officer' && activeView === 'My Projects' && <MyProjectsView projects={projects} />}
          {user.role === 'officer' && activeView === 'Plans' && (
            <OfficerPlansView plans={plans} projects={projects} onSelect={setSelectedPlanId} onChanged={reloadPlans} />
          )}
          {user.role === 'officer' && activeView === 'Contracts' && <ContractsView plans={plans} showToast={showToast} />}
          {user.role === 'officer' && activeView === 'Reports' && <ReportsView showToast={showToast} />}

          {user.role === 'director' && activeView === 'Projects' && (
            <DirectorProjectsView projects={projects} sectors={sectors} fundingSources={fundingSources} showToast={showToast} onChanged={reloadProjects} />
          )}
          {user.role === 'director' && activeView === 'Plans' && <DirectorPlansView plans={plans} onSelect={setSelectedPlanId} />}
          {user.role === 'director' && activeView === 'Reports' && <ReportsView showToast={showToast} />}
          {user.role === 'director' && activeView === 'Executive Reports' && <ExecutiveReportsView showToast={showToast} onSelectPlan={setSelectedPlanId} />}

          {user.role === 'committee' && activeView === 'Plans' && <CommitteePlansView plans={plans} onSelect={setSelectedPlanId} />}
          {user.role === 'management' && activeView === 'Plans' && <ManagementPlansView plans={plans} onSelect={setSelectedPlanId} />}
          {user.role === 'management' && activeView === 'Executive Reports' && <ExecutiveReportsView showToast={showToast} onSelectPlan={setSelectedPlanId} />}

          {user.role === 'admin' && activeView === 'Users' && <AdminUsersView users={users} showToast={showToast} onChanged={reloadUsers} />}
          {user.role === 'admin' && activeView === 'Committee' && (
            <AdminCommitteeView committees={committees} sectors={sectors} leadership={leadership} showToast={showToast} onChanged={reloadCommittee} />
          )}
          {user.role === 'admin' && activeView === 'Settings' && <AdminSettingsView sectors={sectors} fundingSources={fundingSources} leadership={leadership} showToast={showToast} onSectorsChanged={reloadSectors} onFundingSourcesChanged={reloadFundingSources} onLeadershipChanged={reloadLeadership} />}

          {activeView === 'Alerts' && <AlertsView alerts={alerts} onMarkRead={markAlertRead} />}
        </main>
      </section>

      {['officer', 'director', 'committee', 'management'].includes(user.role) && (
        <PlanDetailDrawer
          planId={selectedPlanId}
          viewerRole={user.role}
          currentUserName={user.name}
          onClose={() => setSelectedPlanId(null)}
          onChanged={handlePlanChanged}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
