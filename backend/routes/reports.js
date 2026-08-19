const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const REPORTS = {
  'annual-plan': { title: 'Annual Procurement Plan' },
  'plan-vs-actual': { title: 'Plan vs Actual' },
  'step-report': { title: 'Procurement STEP Report' },
  'delayed-procurement': { title: 'Delayed Procurement' },
  'monthly-quarterly-summary': { title: 'Monthly / Quarterly Summary' },
  'contract-payment-status': { title: 'Contract and Payment Status' },
  'project-officer-summary': { title: 'Project / Officer Summary' },
  'approval-status': { title: 'Approval Status' },
};

function delayDays(row) {
  const target = row.revised_date || row.original_date;
  if (!target) return 0;
  const comparison = row.status === 'Completed' && row.actual_date ? row.actual_date : new Date();
  return Math.max(0, Math.floor((new Date(comparison) - new Date(target)) / 86400000));
}

async function buildReport(code, user) {
  if (code === 'contract-payment-status') {
    const params = [];
    const scope = user.role === 'officer' ? 'WHERE pp.created_by = $1' : '';
    if (scope) params.push(user.id);
    const { rows } = await pool.query(
      `SELECT c.contract_number, a.reference AS activity_reference, p.name AS project,
              u.name AS officer, s.name AS supplier, c.original_amount, c.current_amount,
              c.final_amount, c.currency, c.contract_date, c.status,
              COALESCE(SUM(pay.amount), 0) AS paid_total,
              c.current_amount - COALESCE(SUM(pay.amount), 0) AS balance
       FROM contracts c JOIN suppliers s ON s.id = c.supplier_id
       JOIN procurement_activities a ON a.id = c.activity_id
       JOIN procurement_plans pp ON pp.id = a.plan_id JOIN projects p ON p.id = pp.project_id
       JOIN users u ON u.id = pp.created_by LEFT JOIN payments pay ON pay.contract_id = c.id
       ${scope} GROUP BY c.id, a.reference, p.name, u.name, s.name ORDER BY c.created_at DESC`, params
    );
    return { columns: ['Contract', 'Activity', 'Project', 'Officer', 'Supplier', 'Original amount', 'Current amount', 'Final amount', 'Currency', 'Contract date', 'Status', 'Paid total', 'Balance'], rows: rows.map((r) => [r.contract_number, r.activity_reference, r.project, r.officer, r.supplier, Number(r.original_amount), Number(r.current_amount), r.final_amount === null ? null : Number(r.final_amount), r.currency, r.contract_date, r.status, Number(r.paid_total), Number(r.balance)]) };
  }

  if (code === 'project-officer-summary' || code === 'monthly-quarterly-summary') {
    const params = [];
    const scope = user.role === 'officer' ? 'WHERE pp.created_by = $1' : '';
    if (scope) params.push(user.id);
    const { rows } = await pool.query(
      `SELECT p.code, p.name AS project, u.name AS officer, pp.fiscal_year, pp.category,
              a.method, a.currency, COUNT(DISTINCT pp.id)::int AS plans,
              COUNT(a.id)::int AS activities, COALESCE(SUM(a.amount), 0) AS total_amount
       FROM procurement_plans pp JOIN projects p ON p.id = pp.project_id
       JOIN users u ON u.id = pp.created_by LEFT JOIN procurement_activities a ON a.plan_id = pp.id
       ${scope}
       GROUP BY p.code, p.name, u.name, pp.fiscal_year, pp.category, a.method, a.currency
       ORDER BY pp.fiscal_year DESC, p.name, pp.category, a.method`, params
    );
    return { columns: ['Project code', 'Project', 'Officer', 'Fiscal year', 'Category', 'Method', 'Currency', 'Plans', 'Activities', 'Total amount'], rows: rows.map((r) => [r.code, r.project, r.officer, r.fiscal_year, r.category, r.method, r.currency, r.plans, r.activities, Number(r.total_amount)]) };
  }

  if (code === 'approval-status') {
    const params = [];
    const scope = user.role === 'officer' ? 'WHERE pp.created_by = $1' : '';
    if (scope) params.push(user.id);
    const { rows } = await pool.query(
      `SELECT pp.reference, pp.name, p.name AS project, pp.category, pp.fiscal_year,
              pp.status, pp.submitted_at, pp.director_decision, pp.director_decided_at,
              COUNT(cv.id) FILTER (WHERE cv.decision = 'Approve')::int AS approvals,
              COUNT(cv.id) FILTER (WHERE cv.decision = 'Reject')::int AS rejections
       FROM procurement_plans pp JOIN projects p ON p.id = pp.project_id
       LEFT JOIN committee_votes cv ON cv.plan_id = pp.id
       ${scope}
       GROUP BY pp.id, p.name ORDER BY pp.created_at DESC`, params
    );
    return { columns: ['Plan reference', 'Plan', 'Project', 'Category', 'Fiscal year', 'Status', 'Submitted', 'Director decision', 'Director decision date', 'Approvals', 'Rejections'], rows: rows.map((r) => [r.reference, r.name, r.project, r.category, r.fiscal_year, r.status, r.submitted_at, r.director_decision, r.director_decided_at, r.approvals, r.rejections]) };
  }

  const params = [];
  const scope = user.role === 'officer' ? 'WHERE pp.created_by = $1' : '';
  if (scope) params.push(user.id);
  const { rows } = await pool.query(
    `SELECT pp.reference AS plan_reference, pp.name AS plan_name, p.name AS project,
            pp.category, pp.fiscal_year, a.reference AS activity_reference, a.description,
            a.method, a.amount, a.currency, a.status AS activity_status, a.category_data,
            s.sequence_no, s.name AS stage_name, s.original_date, s.revised_date,
            s.actual_date, s.status, s.remarks
     FROM procurement_plans pp JOIN projects p ON p.id = pp.project_id
     JOIN procurement_activities a ON a.plan_id = pp.id
     LEFT JOIN activity_stages s ON s.activity_id = a.id
     ${scope}
     ORDER BY pp.created_at DESC, a.id, s.sequence_no`, params
  );

  if (code === 'annual-plan') {
    const seen = new Set();
    const activities = rows.filter((r) => !seen.has(r.activity_reference) && seen.add(r.activity_reference));
    return { columns: ['Plan reference', 'Plan', 'Project', 'Fiscal year', 'Category', 'Activity reference', 'Description', 'Method', 'Estimated amount', 'Currency', 'Status'], rows: activities.map((r) => [r.plan_reference, r.plan_name, r.project, r.fiscal_year, r.category, r.activity_reference, r.description, r.method, Number(r.amount), r.currency, r.activity_status]) };
  }

  const baseColumns = ['Plan reference', 'Project', 'Category', 'Activity reference', 'Description', 'Method', 'Amount', 'Currency', 'Stage no.', 'Stage', 'Original planned', 'Revised/current', 'Actual', 'Stage status', 'Delay days', 'Remarks'];
  const baseRows = rows.map((r) => [r.plan_reference, r.project, r.category, r.activity_reference, r.description, r.method, Number(r.amount), r.currency, r.sequence_no, r.stage_name, r.original_date, r.revised_date || r.original_date, r.actual_date, r.status, delayDays(r), r.remarks]);
  if (code === 'delayed-procurement') {
    return { columns: baseColumns, rows: baseRows.filter((row) => row[14] > 0) };
  }
  if (code === 'step-report') {
    return { columns: [...baseColumns, 'STEP activity details'], rows: rows.map((r, index) => [...baseRows[index], JSON.stringify(r.category_data || {})]) };
  }
  return { columns: baseColumns, rows: baseRows };
}

function safeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

router.get('/:code/preview', requireRole('officer', 'director', 'management'), async (req, res, next) => {
  if (!REPORTS[req.params.code]) return res.status(404).json({ error: 'Unknown report' });
  try {
    const data = await buildReport(req.params.code, req.user);
    res.json({ code: req.params.code, title: REPORTS[req.params.code].title, generatedAt: new Date().toISOString(), ...data });
  } catch (err) { next(err); }
});

router.get('/:code/export', requireRole('officer', 'director', 'management'), async (req, res, next) => {
  if (!REPORTS[req.params.code]) return res.status(404).json({ error: 'Unknown report' });
  const format = req.query.format;
  if (!['xlsx', 'pdf'].includes(format)) return res.status(400).json({ error: 'format must be xlsx or pdf' });
  try {
    const report = await buildReport(req.params.code, req.user);
    const title = REPORTS[req.params.code].title;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });
      sheet.addRow([title]);
      sheet.mergeCells(1, 1, 1, report.columns.length);
      sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF174C32' } };
      sheet.addRow([`Generated ${new Date().toISOString()} | Scope: ${req.user.role === 'officer' ? 'My assigned plans' : 'Ministry-wide'}`]);
      sheet.mergeCells(2, 1, 2, report.columns.length);
      const header = sheet.addRow(report.columns);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174C32' } };
      report.rows.forEach((row) => sheet.addRow(row));
      sheet.columns.forEach((column) => { column.width = Math.min(42, Math.max(12, ...column.values.map((v) => safeCell(v).length + 2))); });
      sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, report.rows.length + 3), column: report.columns.length } };
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.code}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.code}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', layout: report.columns.length > 10 ? 'landscape' : 'portrait', margin: 30 });
    doc.pipe(res);
    doc.fontSize(16).fillColor('#174c32').text(title);
    doc.moveDown(0.3).fontSize(8).fillColor('#66756b').text(`Generated ${new Date().toISOString()} | ${report.rows.length} rows`);
    doc.moveDown().fillColor('#111111');
    const visible = report.columns.slice(0, 8);
    doc.fontSize(7).font('Helvetica-Bold').text(visible.join(' | '));
    doc.moveDown(0.5).font('Helvetica');
    for (const row of report.rows) {
      if (doc.y > doc.page.height - 50) doc.addPage();
      doc.text(row.slice(0, 8).map(safeCell).join(' | '), { ellipsis: true, width: doc.page.width - 60 });
      doc.moveDown(0.25);
    }
    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
