import React, { useState } from 'react';
import { Plus, ShieldCheck, Users } from 'lucide-react';
import { api } from '../../api';

const TYPES = {
  endorsing: { label: 'Endorsing Committee', description: 'Five members independently vote on Director-approved plans.', icon: ShieldCheck, size: 5 },
  management: { label: 'Ministry Management Committee', description: 'Four State Ministers, the Minister, CEO, and Minister Office Head.', icon: Users, size: 7 },
};
const POSITION_LABELS = { state_minister: 'Sector State Minister', minister: 'Minister', ceo: 'CEO', minister_office_head: 'Minister Office Head' };

export default function CommitteeView({ committees, sectors, leadership, showToast, onChanged }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', biography: '', committeeType: 'endorsing' });
  const [managementPosition, setManagementPosition] = useState('state_minister');
  const [managementSectorId, setManagementSectorId] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [busy, setBusy] = useState(false);
  const registeredLeadershipIds = new Set(committees.management.filter((member) => member.isActive).map((member) => member.leadershipId));
  const selectedLeader = leadership.find((leader) => leader.isActive && !registeredLeadershipIds.has(leader.id) && leader.position === managementPosition && (managementPosition !== 'state_minister' || String(leader.sectorId) === String(managementSectorId)));

  async function register() {
    if (form.committeeType === 'endorsing' && (!form.name.trim() || !form.email.trim() || !form.phone.trim())) return showToast('Name, email, and phone are required');
    if (form.committeeType === 'management' && !selectedLeader) return showToast('No active office holder is registered for that office or sector');
    setBusy(true);
    try {
      const payload = form.committeeType === 'management' ? { committeeType: 'management', leadershipId: selectedLeader.id } : form;
      const result = editingMemberId
        ? await api.updateEndorsingCommitteeMember(editingMemberId, payload)
        : await api.registerCommitteeMember(payload);
      setForm({ ...form, name: '', email: '', phone: '', biography: '' });
      setEditingMemberId(null);
      await onChanged(); showToast(editingMemberId ? 'Endorsing Committee member updated' : result.message);
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  async function toggle(type, member) {
    try { await api.setRegisteredCommitteeMemberActive(type, member.id, !member.isActive); await onChanged(); }
    catch (err) { showToast(err.message); }
  }

  function editEndorsingMember(member) {
    setEditingMemberId(member.id);
    setForm({ name: member.name, email: member.email, phone: member.phone || '', biography: member.biography || '', committeeType: 'endorsing' });
  }

  async function removeMember(type, member) {
    if (!window.confirm(`Remove ${member.name} from the ${TYPES[type].label}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.removeCommitteeMember(type, member.id);
      if (editingMemberId === member.id) { setEditingMemberId(null); setForm({ name: '', email: '', phone: '', biography: '', committeeType: 'endorsing' }); }
      await onChanged();
      showToast(`${TYPES[type].label} assignment removed`);
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  return <div className="pt-committee-admin">
    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>Register committee member</h2><p>Management members are selected automatically from the Ministry leadership registry.</p></div></div>
      <div className="pt-activity-form">
        <div className="pt-field"><label>Committee type</label><select value={form.committeeType} disabled={Boolean(editingMemberId)} onChange={(e) => setForm({ ...form, committeeType: e.target.value })}><option value="endorsing">Endorsing Committee</option><option value="management">Ministry Management Committee</option></select></div>
        {form.committeeType === 'endorsing' ? <>
          <div className="pt-form-grid"><div className="pt-field"><label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="pt-field"><label>Email address</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div></div>
          <div className="pt-field"><label>Phone number</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +251 911 000 000" /></div>
          <div className="pt-field"><label>Biography <span className="pt-optional-label">Optional</span></label><textarea value={form.biography} onChange={(e) => setForm({ ...form, biography: e.target.value })} /></div>
        </> : <>
          <div className="pt-form-grid">
            <div className="pt-field"><label>Management office</label><select value={managementPosition} onChange={(e) => { setManagementPosition(e.target.value); setManagementSectorId(''); }}><option value="state_minister">Sector State Minister</option><option value="minister">Minister</option><option value="ceo">CEO</option><option value="minister_office_head">Minister Office Head</option></select></div>
            {managementPosition === 'state_minister' && <div className="pt-field"><label>Sector</label><select value={managementSectorId} onChange={(e) => setManagementSectorId(e.target.value)}><option value="">Select sector…</option>{sectors.filter((sector) => sector.isActive && sector.structureType === 'sector').map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>}
          </div>
          <div className={`pt-auto-member ${selectedLeader ? 'found' : ''}`}><Users size={19} />{selectedLeader ? <div><small>AUTOMATICALLY SELECTED</small><strong>{selectedLeader.name}</strong><span>{selectedLeader.email} · {selectedLeader.phone}</span></div> : <div><strong>No registered office holder selected</strong><span>Register the office holder under Settings → Ministry leadership first.</span></div>}</div>
        </>}
        <div className="pt-invitation-note"><ShieldCheck size={18} /><span>A temporary password is emailed automatically and must be changed at first sign-in.</span></div>
        <button className="pt-btn" onClick={register} disabled={busy || (form.committeeType === 'management' && !selectedLeader)}><Plus size={15} /> {busy ? 'Saving…' : editingMemberId ? 'Save committee member' : 'Register member & send invitation'}</button>
        {editingMemberId && <button className="pt-text-btn" onClick={() => { setEditingMemberId(null); setForm({ name: '', email: '', phone: '', biography: '', committeeType: 'endorsing' }); }}>Cancel editing</button>}
      </div>
    </section>

    <section className="pt-committee-registry-grid">{Object.entries(TYPES).map(([type, meta]) => {
      const members = committees[type] || []; const active = members.filter((member) => member.isActive).length; const Icon = meta.icon;
      return <section className="pt-panel" key={type}>
        <div className="pt-panel-head"><div><h2><Icon size={18} /> {meta.label}</h2><p>{meta.description}</p></div><span className="pt-count-badge">{active}/{meta.size}</span></div>
        <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr><th>MEMBER</th><th>STATUS</th></tr></thead><tbody>
          {!members.length && <tr><td colSpan="2" className="pt-empty">No members registered.</td></tr>}
          {members.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.position ? `${POSITION_LABELS[member.position]}${member.sectorName ? ` — ${member.sectorName}` : ''} · ` : ''}{member.email}{member.phone ? ` · ${member.phone}` : ''}</small>{member.biography && <small className="pt-member-bio">{member.biography}</small>}</td><td><span className={`pt-member-state ${member.isActive ? 'active' : ''}`}>{member.isActive ? 'Active' : 'Inactive'}</span><div className="pt-row-actions">{type === 'endorsing' && <button className="pt-text-btn" onClick={() => editEndorsingMember(member)}>Edit</button>}<button className="pt-text-btn" onClick={() => toggle(type, member)}>{member.isActive ? 'Deactivate' : 'Activate'}</button><button className="pt-text-btn pt-text-danger" onClick={() => removeMember(type, member)} disabled={busy}>Remove</button></div></td></tr>)}
        </tbody></table></div>
      </section>;
    })}</section>
  </div>;
}
