import React, { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api } from '../../api';
import { formatDate } from '../../constants';
import DualCalendarDateInput from '../../components/DualCalendarDateInput';

function blankProject() {
  return { code: '', name: '', sectorId: '', description: '', fundingSource: '', startDate: '', endDate: '' };
}

export default function ProjectsView({ projects, sectors, fundingSources, showToast, onChanged }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(blankProject());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [pickedOfficer, setPickedOfficer] = useState('');

  useEffect(() => { api.listOfficers().then(setOfficers).catch(() => {}); }, []);

  async function toggleExpand(projectId) {
    if (expanded === projectId) { setExpanded(null); return; }
    setExpanded(projectId);
    setAssignments(await api.listAssignments(projectId));
  }

  async function createProject() {
    if (!form.code.trim() || !form.name.trim() || !form.sectorId) return showToast('Sector or office, code, and name are required');
    setSaving(true);
    try {
      await api.createProject({ ...form, startDate: form.startDate || null, endDate: form.endDate || null });
      setForm(blankProject());
      setShowNew(false);
      onChanged();
      showToast('Project created');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function assignOfficer(projectId) {
    if (!pickedOfficer) return;
    try {
      await api.assignOfficer(projectId, Number(pickedOfficer));
      setAssignments(await api.listAssignments(projectId));
      setPickedOfficer('');
      showToast('Officer assigned');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function toggleAssignment(assignmentId, isActive, projectId) {
    try {
      await api.setAssignmentActive(assignmentId, isActive);
      setAssignments(await api.listAssignments(projectId));
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <section className="pt-panel">
      <div className="pt-panel-head">
        <div><h2>Projects</h2><p>Create projects and assign Procurement Officers to work on them</p></div>
        <button className="pt-btn" onClick={() => setShowNew((v) => !v)}><Plus size={15} /> New project</button>
      </div>

      {showNew && (
        <div className="pt-activity-form">
          <div className="pt-form-grid">
            <div className="pt-field"><label>Project Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. IRR" /></div>
            <div className="pt-field"><label>Project Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <div className="pt-field"><label>Sector / executive office</label><select value={form.sectorId} onChange={(e) => setForm({ ...form, sectorId: e.target.value })}><option value="">Select sector or office…</option><optgroup label="Ministry sectors">{sectors.filter((sector) => sector.isActive && sector.structureType === 'sector').map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</optgroup><optgroup label="Executive offices">{sectors.filter((sector) => sector.isActive && sector.structureType !== 'sector').map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</optgroup></select></div>
          <div className="pt-field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="pt-form-grid-3">
            <div className="pt-field"><label>Funding source</label><select value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}><option value="">Select funding source…</option>{fundingSources.filter((source) => source.isActive).map((source) => <option key={source.id} value={source.label}>{source.label}</option>)}</select></div>
            <div className="pt-field"><label>Start date</label><DualCalendarDateInput label="Project start date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} /></div>
            <div className="pt-field"><label>End date</label><DualCalendarDateInput label="Project end date" value={form.endDate} onChange={(endDate) => setForm({ ...form, endDate })} /></div>
          </div>
          
          <button className="pt-btn" onClick={createProject} disabled={saving}>{saving ? 'Saving…' : 'Create project'}</button>
        </div>
      )}

      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>PROJECT</th><th>SECTOR / OFFICE</th><th>FUNDING</th><th>DATES</th><th>STATUS</th><th>OFFICERS</th></tr></thead>
          <tbody>
            {!projects.length && <tr><td colSpan="6" className="pt-empty">No projects yet.</td></tr>}
            {projects.map((p) => (
              <React.Fragment key={p.id}>
                <tr>
                  <td><strong>{p.name}</strong><small>{p.code}</small></td>
                  <td>{p.sectorName || '—'}</td>
                  <td>{p.fundingSource || '—'}</td>
                  <td className="pt-mono">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                  <td>{p.status}</td>
                  <td>
                    <button className="pt-btn pt-btn-ghost" onClick={() => toggleExpand(p.id)}>
                      <Users size={13} /> {expanded === p.id ? 'Close' : 'Assign officers'}
                    </button>
                  </td>
                </tr>
                {expanded === p.id && (
                  <tr><td colSpan="6">
                    <div className="pt-plan-summary">
                      {!assignments.length && <div><small>OFFICERS</small><strong>None assigned yet</strong></div>}
                      {assignments.map((a) => (
                        <div key={a.id}>
                          <small>OFFICER</small>
                          <strong>{a.officerName}</strong>
                          <button className="pt-text-btn" onClick={() => toggleAssignment(a.id, !a.isActive, p.id)}>{a.isActive ? 'Deactivate' : 'Reactivate'}</button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-form-grid">
                      <div className="pt-field">
                        <label>Assign an officer</label>
                        <select value={pickedOfficer} onChange={(e) => setPickedOfficer(e.target.value)}>
                          <option value="">Select an officer…</option>
                          {officers.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
                        </select>
                      </div>
                      <div className="pt-field" style={{ alignSelf: 'end' }}>
                        <button className="pt-btn" onClick={() => assignOfficer(p.id)} disabled={!pickedOfficer}><Plus size={14} /> Assign</button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
