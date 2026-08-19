import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { formatDate, formatMoney } from '../../constants';
import DualCalendarDateInput from '../../components/DualCalendarDateInput';

export default function ContractsView({ plans, showToast }) {
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [eligibleActivities, setEligibleActivities] = useState([]);
  const [form, setForm] = useState({ activityId: '', supplierId: '', newSupplierName: '', contractNumber: '', originalAmount: '', contractDate: '' });
  const [saving, setSaving] = useState(false);
  const [expandedContract, setExpandedContract] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentType: 'Interim', paymentDate: '', remarks: '' });
  const [payingBusy, setPayingBusy] = useState(false);

  async function reload() {
    const [contractRows, supplierRows] = await Promise.all([api.listContracts(), api.listSuppliers()]);
    setContracts(contractRows);
    setSuppliers(supplierRows);

    const trackable = plans.filter((p) => ['FINALLY_APPROVED', 'REPLANNED'].includes(p.status));
    const details = await Promise.all(trackable.map((p) => api.getPlan(p.id)));
    const contractedActivityIds = new Set(contractRows.map((c) => c.activityId));
    const activities = details.flatMap((plan) => plan.activities
      .filter((a) => !contractedActivityIds.has(a.id))
      .map((a) => ({ id: a.id, label: `${a.reference} — ${a.description}` })));
    setEligibleActivities(activities);
  }

  useEffect(() => { reload(); }, [plans]);

  async function submitContract() {
    if (!form.activityId || !form.contractNumber.trim() || !form.originalAmount || !form.contractDate) return showToast('Fill in all required contract fields');
    setSaving(true);
    try {
      let supplierId = form.supplierId;
      if (!supplierId && form.newSupplierName.trim()) {
        const created = await api.createSupplier({ name: form.newSupplierName.trim() });
        supplierId = created.id;
      }
      if (!supplierId) return showToast('Select or add a supplier');
      await api.createContract({
        activityId: Number(form.activityId), supplierId: Number(supplierId),
        contractNumber: form.contractNumber.trim(), originalAmount: Number(form.originalAmount), contractDate: form.contractDate,
      });
      setForm({ activityId: '', supplierId: '', newSupplierName: '', contractNumber: '', originalAmount: '', contractDate: '' });
      await reload();
      showToast('Contract registered');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(contractId) {
    if (!paymentForm.amount || !paymentForm.paymentDate) return showToast('Fill in payment amount and date');
    setPayingBusy(true);
    try {
      await api.addPayment(contractId, { amount: Number(paymentForm.amount), paymentDate: paymentForm.paymentDate, remarks: paymentForm.remarks });
      setPaymentForm({ amount: '', paymentType: 'Interim', paymentDate: '', remarks: '' });
      setExpandedContract(null);
      await reload();
      showToast('Payment recorded');
    } catch (err) {
      showToast(err.message);
    } finally {
      setPayingBusy(false);
    }
  }

  return <>
    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>Register a contract</h2><p>Available once a plan's activity has been finally approved</p></div></div>
      <div className="pt-activity-form">
      <div className="pt-field">
        <label>Activity</label>
        <select value={form.activityId} onChange={(e) => setForm({ ...form, activityId: e.target.value })}>
          <option value="">Select an activity awaiting contract…</option>
          {eligibleActivities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <div className="pt-form-grid">
        <div className="pt-field">
          <label>Supplier</label>
          <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Select existing…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="pt-field"><label>Or add new supplier</label><input value={form.newSupplierName} onChange={(e) => setForm({ ...form, newSupplierName: e.target.value })} placeholder="Supplier name" /></div>
      </div>
      <div className="pt-form-grid">
        <div className="pt-field"><label>Contract number</label><input value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} /></div>
        <div className="pt-field"><label>Original amount (ETB)</label><input type="number" min="0" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} /></div>
      </div>
      <div className="pt-field"><label>Contract date</label><DualCalendarDateInput label="Contract date" value={form.contractDate} onChange={(contractDate) => setForm({ ...form, contractDate })} required /></div>
      <button className="pt-btn" onClick={submitContract} disabled={saving}>{saving ? 'Saving…' : 'Register contract'}</button>
      </div>
    </section>

    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>Contracts &amp; payments</h2></div><span className="pt-count-badge">{contracts.length}</span></div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>CONTRACT</th><th>SUPPLIER</th><th>AMOUNT</th><th>BALANCE</th><th>STATUS</th><th /></tr></thead>
          <tbody>
            {!contracts.length && <tr><td colSpan="6" className="pt-empty">No contracts registered yet.</td></tr>}
            {contracts.map((c) => (
              <React.Fragment key={c.id}>
                <tr tabIndex="0" onClick={() => setExpandedContract(expandedContract === c.id ? null : c.id)}>
                  <td><strong>{c.contractNumber}</strong><small>{c.activityReference}</small></td>
                  <td>{c.supplierName}</td>
                  <td className="pt-mono">{formatMoney(c.currentAmount, c.currency)}</td>
                  <td className="pt-mono">{formatMoney(c.balance, c.currency)}</td>
                  <td>{c.status}</td>
                  <td>{expandedContract === c.id ? 'Close' : 'Add payment'}</td>
                </tr>
                {expandedContract === c.id && (
                  <tr><td colSpan="6">
                    <div className="pt-inline-form">
                    <div className="pt-form-grid">
                      <div className="pt-field"><label>Amount ({c.currency})</label><input type="number" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
                      <div className="pt-field"><label>Payment date</label><DualCalendarDateInput label="Payment date" value={paymentForm.paymentDate} onChange={(paymentDate) => setPaymentForm({ ...paymentForm, paymentDate })} required /></div>
                    </div>
                    <div className="pt-field"><label>Payment type</label><select value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}><option>Advance</option><option>Interim</option><option>Final</option><option>Retention</option></select></div>
                    <div className="pt-field"><label>Remarks</label><input value={paymentForm.remarks} onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })} /></div>
                    <button className="pt-btn pt-btn-ghost" onClick={() => submitPayment(c.id)} disabled={payingBusy}>{payingBusy ? 'Saving…' : 'Record payment'}</button>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
