import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api';

const REPORTS = [
  ['annual-plan', 'Annual Procurement Plan'],
  ['plan-vs-actual', 'Plan vs Actual'],
  ['step-report', 'Procurement STEP Report'],
  ['delayed-procurement', 'Delayed Procurement'],
  ['monthly-quarterly-summary', 'Monthly / Quarterly Summary'],
  ['contract-payment-status', 'Contract and Payment Status'],
  ['project-officer-summary', 'Project / Officer Summary'],
  ['approval-status', 'Approval Status'],
];

export default function ReportsView({ showToast }) {
  const [code, setCode] = useState('annual-plan');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.previewReport(code).then(setReport).catch((err) => showToast(err.message)).finally(() => setLoading(false));
  }, [code]);

  return <section className="pt-panel">
    <div className="pt-panel-head">
      <div><h2>Report center</h2><p>Preview system data and export the same result to PDF or Excel</p></div>
      <div className="pt-actions">
        <a className="pt-btn pt-btn-ghost" href={api.reportExportUrl(code, 'pdf')}><Download size={14} /> PDF</a>
        <a className="pt-btn" href={api.reportExportUrl(code, 'xlsx')}><Download size={14} /> Excel</a>
      </div>
    </div>
    <div className="pt-report-controls"><div className="pt-field"><label>Report</label><select value={code} onChange={(e) => setCode(e.target.value)}>{REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    {loading && <p className="pt-empty">Preparing preview…</p>}
    {report && !loading && <div className="pt-table-scroll"><table className="pt-data-table"><thead><tr>{report.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{!report.rows.length && <tr><td colSpan={report.columns.length} className="pt-empty">No records match this report.</td></tr>}{report.rows.slice(0, 100).map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex}>{value === null || value === undefined ? '—' : String(value)}</td>)}</tr>)}</tbody></table></div>}
    {report?.rows.length > 100 && <p className="pt-field-help">Preview limited to 100 rows. Exports include all {report.rows.length} rows.</p>}
  </section>;
}
