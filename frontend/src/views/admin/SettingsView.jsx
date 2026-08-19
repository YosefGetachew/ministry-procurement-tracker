import React, { useState } from 'react';
import { Landmark, Plus, Settings2, X } from 'lucide-react';
import { api } from '../../api';

const LISTS = [
  { key: 'sectors', label: 'Sectors & offices', singular: 'sector', help: 'Organize projects under Ministry sectors and executive offices.' },
  { key: 'leadership', label: 'Ministry leadership', singular: 'leader', help: 'Register the seven office holders who form the Management Committee.' },
  { key: 'funding_source', label: 'Funding sources', singular: 'funding source', help: 'Values available when a Director creates a project.' },

];
const POSITION_LABELS = { state_minister: 'Sector State Minister', minister: 'Minister', ceo: 'CEO', minister_office_head: 'Minister Office Head' };
const emptyListForm = () => ({ code: '', name: '', description: '' });
const emptyLeaderForm = () => ({ position: 'state_minister', sectorId: '', name: '', email: '', phone: '', biography: '' });

export default function SettingsView({ sectors, fundingSources, leadership, showToast, onSectorsChanged, onFundingSourcesChanged, onLeadershipChanged }) {
  const [activeList, setActiveList] = useState('sectors');
  const [form, setForm] = useState(emptyListForm());
  const [leaderForm, setLeaderForm] = useState(emptyLeaderForm());
  const [busy, setBusy] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [optionForm, setOptionForm] = useState({ code: '', name: '', description: '' });
  const [savingOption, setSavingOption] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [editLeaderForm, setEditLeaderForm] = useState(emptyLeaderForm());
  const [savingLeader, setSavingLeader] = useState(false);
  const selected = LISTS.find((item) => item.key === activeList);
  const options = activeList === 'sectors' ? sectors : fundingSources;
  const stateMinisters = leadership.filter((leader) => leader.position === 'state_minister' && leader.isActive).length;

  function chooseList(key) { setActiveList(key); setForm(emptyListForm()); }

  async function createListValue() {
    if (!form.code.trim() || !form.name.trim()) return showToast('Code and name are required');
    setBusy(true);
    try {
      if (activeList === 'sectors') { await api.createSector(form); await onSectorsChanged(); }
      else { await api.createLookupOption({ listKey: activeList, code: form.code, label: form.name, description: form.description }); await onFundingSourcesChanged(); }
      setForm(emptyListForm()); showToast(`${selected.singular} added`);
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  async function createLeader() {
    if (!leaderForm.name.trim() || !leaderForm.email.trim() || !leaderForm.phone.trim()) return showToast('Name, email, and phone are required');
    if (leaderForm.position === 'state_minister' && !leaderForm.sectorId) return showToast('Select the State Minister sector');
    setBusy(true);
    try {
      const payload = { ...leaderForm, sectorId: leaderForm.sectorId ? Number(leaderForm.sectorId) : null };
      await api.createLeadership(payload);
      setLeaderForm(emptyLeaderForm()); await onLeadershipChanged(); showToast('Leadership office holder registered');
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  async function toggle(option) {
    try {
      if (activeList === 'sectors') { await api.setSectorActive(option.id, !option.isActive); await onSectorsChanged(); }
      else { await api.setLookupOptionActive(option.id, !option.isActive); await onFundingSourcesChanged(); }
    } catch (err) { showToast(err.message); }
  }

  function openEditOption(option) {
    setEditingOption(option);
    setOptionForm({ code: option.code, name: option.name || option.label, description: option.description || '' });
  }

  async function saveOption() {
    if (!optionForm.code.trim() || !optionForm.name.trim()) return showToast('Code and name are required');
    setSavingOption(true);
    try {
      if (activeList === 'sectors') {
        await api.updateSector(editingOption.id, { code: optionForm.code, name: optionForm.name, description: optionForm.description });
        await onSectorsChanged();
      } else {
        await api.updateLookupOption(editingOption.id, { code: optionForm.code, label: optionForm.name, description: optionForm.description });
        await onFundingSourcesChanged();
      }
      setEditingOption(null);
      showToast(`${selected.singular} updated`);
    } catch (err) { showToast(err.message); } finally { setSavingOption(false); }
  }

  async function deleteSector(sector) {
    if (!window.confirm(`Delete the ${sector.name} sector? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteSector(sector.id);
      await onSectorsChanged();
      showToast('Sector deleted');
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  async function toggleLeader(leader) {
    try { await api.setLeadershipActive(leader.id, !leader.isActive); await onLeadershipChanged(); }
    catch (err) { showToast(err.message); }
  }

  function openEditLeader(leader) {
    setEditingLeader(leader);
    setEditLeaderForm({ position: leader.position, sectorId: leader.sectorId || '', name: leader.name, email: leader.email, phone: leader.phone || '', biography: leader.biography || '' });
  }

  async function saveLeader() {
    if (!editLeaderForm.name.trim() || !editLeaderForm.email.trim() || !editLeaderForm.phone.trim()) return showToast('Name, email, and phone are required');
    if (editLeaderForm.position === 'state_minister' && !editLeaderForm.sectorId) return showToast('Select the State Minister sector');
    setSavingLeader(true);
    try {
      const payload = { ...editLeaderForm, sectorId: editLeaderForm.sectorId ? Number(editLeaderForm.sectorId) : null };
      await api.updateLeadership(editingLeader.id, payload);
      setEditingLeader(null);
      await onLeadershipChanged();
      showToast('Leadership office holder updated');
    } catch (err) { showToast(err.message); } finally { setSavingLeader(false); }
  }

  async function deleteLeader(leader) {
    if (!window.confirm(`Delete ${leader.name} from the Ministry Leadership registry? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteLeadership(leader.id);
      await onLeadershipChanged();
      showToast('Leadership office holder deleted');
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  return <section className="pt-settings-layout">
    <aside className="pt-settings-menu pt-panel">
      <div className="pt-panel-head"><div><h2><Settings2 size={18} /> Settings registry</h2><p>Choose a registry to maintain</p></div></div>
      <nav aria-label="System settings">{LISTS.map((item) => <button key={item.key} className={activeList === item.key ? 'active' : ''} onClick={() => chooseList(item.key)}><span>{item.label}</span><small>{item.help}</small></button>)}</nav>
    </aside>

    {activeList === 'leadership' ? <section className="pt-panel">
      <div className="pt-panel-head"><div><h2><Landmark size={18} /> Ministry leadership</h2><p>Four sector State Ministers plus the Minister, CEO, and Minister Office Head.</p></div><span className="pt-count-badge">{leadership.filter((item) => item.isActive).length}/7</span></div>
      <div className="pt-activity-form">
        <div className="pt-form-grid">
          <div className="pt-field"><label>Office</label><select value={leaderForm.position} onChange={(e) => setLeaderForm({ ...leaderForm, position: e.target.value, sectorId: '' })}><option value="state_minister">Sector State Minister ({stateMinisters}/4)</option><option value="minister">Minister</option><option value="ceo">CEO</option><option value="minister_office_head">Minister Office Head</option></select></div>
          {leaderForm.position === 'state_minister' && <div className="pt-field"><label>Sector</label><select value={leaderForm.sectorId} onChange={(e) => setLeaderForm({ ...leaderForm, sectorId: e.target.value })}><option value="">Select sector…</option>{sectors.filter((sector) => sector.isActive && sector.structureType === 'sector').map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>}
        </div>
        <div className="pt-form-grid"><div className="pt-field"><label>Full name</label><input value={leaderForm.name} onChange={(e) => setLeaderForm({ ...leaderForm, name: e.target.value })} /></div><div className="pt-field"><label>Email</label><input type="email" value={leaderForm.email} onChange={(e) => setLeaderForm({ ...leaderForm, email: e.target.value })} /></div></div>
        <div className="pt-field"><label>Phone</label><input type="tel" value={leaderForm.phone} onChange={(e) => setLeaderForm({ ...leaderForm, phone: e.target.value })} placeholder="e.g. +251 911 000 000" /></div>
        <div className="pt-field"><label>Biography <span className="pt-optional-label">Optional</span></label><textarea value={leaderForm.biography} onChange={(e) => setLeaderForm({ ...leaderForm, biography: e.target.value })} /></div>
        <button className="pt-btn" onClick={createLeader} disabled={busy}><Plus size={14} /> {busy ? 'Saving…' : 'Register office holder'}</button>
      </div>
      <div className="pt-table-scroll"><table className="pt-data-table pt-leadership-table"><thead><tr><th>OFFICE HOLDER</th><th>OFFICE / SECTOR</th><th>STATUS</th><th /></tr></thead><tbody>
        {!leadership.length && <tr><td colSpan="4" className="pt-empty">No Ministry leadership registered.</td></tr>}
        {leadership.map((leader) => <tr key={leader.id}><td><strong>{leader.name}</strong><small>{leader.email} · {leader.phone || 'Phone required'}</small></td><td>{POSITION_LABELS[leader.position]}{leader.sectorName ? ` — ${leader.sectorName}` : ''}</td><td>{leader.isActive ? 'Active' : leader.phone ? 'Inactive' : 'Incomplete'}</td><td><div className="pt-row-actions"><button className="pt-text-btn" onClick={() => openEditLeader(leader)}>Edit</button><button className="pt-text-btn" onClick={() => toggleLeader(leader)}>{leader.isActive ? 'Deactivate' : 'Activate'}</button><button className="pt-text-btn pt-text-danger" onClick={() => deleteLeader(leader)} disabled={busy}>Delete</button></div></td></tr>)}
      </tbody></table></div>
    </section> : <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>{selected.label}</h2><p>{selected.help}</p></div><span className="pt-count-badge">{options.length}</span></div>
      <div className="pt-activity-form">
        <div className="pt-form-grid"><div className="pt-field"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Short unique code" /></div><div className="pt-field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name" /></div></div>
        <div className="pt-field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <button className="pt-btn" onClick={createListValue} disabled={busy}><Plus size={14} /> {busy ? 'Saving…' : `Add ${selected.singular}`}</button>
      </div>
      <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr><th>NAME</th><th>DESCRIPTION</th><th>STATUS</th><th /></tr></thead><tbody>
        {!options.length && <tr><td colSpan="4" className="pt-empty">No values configured.</td></tr>}
        {options.map((option) => <tr key={option.id}><td><strong>{option.name || option.label}</strong><small>{option.code}</small></td><td>{option.description || '—'}</td><td>{option.isActive ? 'Active' : 'Inactive'}</td><td>{activeList === 'sectors' ? <div className="pt-row-actions"><button className="pt-text-btn" onClick={() => openEditOption(option)}>Edit</button><button className="pt-text-btn" onClick={() => toggle(option)}>{option.isActive ? 'Deactivate' : 'Activate'}</button><button className="pt-text-btn pt-text-danger" onClick={() => deleteSector(option)} disabled={busy}>Delete</button></div> : <div className="pt-row-actions"><button className="pt-text-btn" onClick={() => openEditOption(option)}>Edit</button><button className="pt-text-btn" onClick={() => toggle(option)}>{option.isActive ? 'Deactivate' : 'Reactivate'}</button></div>}</td></tr>)}
      </tbody></table></div>
    </section>}

    {editingOption && (
      <div className="pt-overlay" onClick={() => setEditingOption(null)}>
        <div className="pt-drawer" role="dialog" aria-modal="true" aria-label={`Edit ${selected.singular}`} onClick={(e) => e.stopPropagation()}>
          <div className="pt-drawer-head">
            <div><p className="pt-eyebrow">{selected.label.toUpperCase()}</p><h2 className="pt-display pt-drawer-title">Edit {selected.singular}</h2></div>
            <button className="pt-close" aria-label="Close" onClick={() => setEditingOption(null)}><X size={18} /></button>
          </div>
          <div className="pt-form-grid">
            <div className="pt-field"><label>Code</label><input value={optionForm.code} onChange={(e) => setOptionForm({ ...optionForm, code: e.target.value })} placeholder="Short unique code" /></div>
            <div className="pt-field"><label>Name</label><input value={optionForm.name} onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })} placeholder="Display name" /></div>
          </div>
          <div className="pt-field"><label>Description</label><textarea value={optionForm.description} onChange={(e) => setOptionForm({ ...optionForm, description: e.target.value })} /></div>
          <div className="pt-actions">
            <button className="pt-btn" onClick={saveOption} disabled={savingOption}>{savingOption ? 'Saving…' : 'Save changes'}</button>
            <button className="pt-btn pt-btn-ghost" onClick={() => setEditingOption(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    {editingLeader && (
      <div className="pt-overlay" onClick={() => setEditingLeader(null)}>
        <div className="pt-drawer" role="dialog" aria-modal="true" aria-label="Edit leadership office holder" onClick={(e) => e.stopPropagation()}>
          <div className="pt-drawer-head">
            <div><p className="pt-eyebrow">MINISTRY LEADERSHIP</p><h2 className="pt-display pt-drawer-title">Edit office holder</h2></div>
            <button className="pt-close" aria-label="Close" onClick={() => setEditingLeader(null)}><X size={18} /></button>
          </div>
          <div className="pt-form-grid">
            <div className="pt-field"><label>Office</label><select value={editLeaderForm.position} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, position: e.target.value, sectorId: '' })}><option value="state_minister">Sector State Minister ({stateMinisters}/4)</option><option value="minister">Minister</option><option value="ceo">CEO</option><option value="minister_office_head">Minister Office Head</option></select></div>
            {editLeaderForm.position === 'state_minister' && <div className="pt-field"><label>Sector</label><select value={editLeaderForm.sectorId} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, sectorId: e.target.value })}><option value="">Select sector…</option>{sectors.filter((sector) => sector.isActive && sector.structureType === 'sector').map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>}
          </div>
          <div className="pt-form-grid"><div className="pt-field"><label>Full name</label><input value={editLeaderForm.name} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, name: e.target.value })} /></div><div className="pt-field"><label>Email</label><input type="email" value={editLeaderForm.email} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, email: e.target.value })} /></div></div>
          <div className="pt-field"><label>Phone</label><input type="tel" value={editLeaderForm.phone} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, phone: e.target.value })} placeholder="e.g. +251 911 000 000" /></div>
          <div className="pt-field"><label>Biography <span className="pt-optional-label">Optional</span></label><textarea value={editLeaderForm.biography} onChange={(e) => setEditLeaderForm({ ...editLeaderForm, biography: e.target.value })} /></div>
          <div className="pt-actions">
            <button className="pt-btn" onClick={saveLeader} disabled={savingLeader}>{savingLeader ? 'Saving…' : 'Save changes'}</button>
            <button className="pt-btn pt-btn-ghost" onClick={() => setEditingLeader(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
  </section>;
}
