import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api';

export default function SectorsView({ sectors, showToast, onChanged }) {
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!form.code.trim() || !form.name.trim()) return showToast('Sector code and name are required');
    setBusy(true);
    try {
      await api.createSector(form);
      setForm({ code: '', name: '', description: '' });
      await onChanged();
      showToast('Sector created');
    } catch (err) { showToast(err.message); } finally { setBusy(false); }
  }

  async function toggle(sector) {
    try { await api.setSectorActive(sector.id, !sector.isActive); await onChanged(); }
    catch (err) { showToast(err.message); }
  }

  return <section className="pt-panel">
    <div className="pt-panel-head"><div><h2>Sectors</h2><p>Projects are organized under sectors</p></div></div>
    <div className="pt-activity-form">
      <div className="pt-form-grid"><div className="pt-field"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div><div className="pt-field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div></div>
      <div className="pt-field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <button className="pt-btn" onClick={create} disabled={busy}><Plus size={14} /> {busy ? 'Saving…' : 'Add sector'}</button>
    </div>
    <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr><th>SECTOR</th><th>DESCRIPTION</th><th>STATUS</th><th /></tr></thead><tbody>{!sectors.length && <tr><td colSpan="4" className="pt-empty">No sectors configured.</td></tr>}{sectors.map((sector) => <tr key={sector.id}><td><strong>{sector.name}</strong><small>{sector.code}</small></td><td>{sector.description || '—'}</td><td>{sector.isActive ? 'Active' : 'Inactive'}</td><td><button className="pt-text-btn" onClick={() => toggle(sector)}>{sector.isActive ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div>
  </section>;
}
