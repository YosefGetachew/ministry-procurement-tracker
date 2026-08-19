const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function serializeSupplier(row) {
  return { id: row.id, name: row.name, contact: row.contact || '', isActive: row.is_active };
}

function serializeContract(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    activityReference: row.activity_reference,
    contractNumber: row.contract_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    originalAmount: Number(row.original_amount),
    currentAmount: Number(row.current_amount),
    finalAmount: row.final_amount === null ? null : Number(row.final_amount),
    currency: row.currency || 'ETB',
    contractDate: row.contract_date,
    status: row.status,
    paidTotal: Number(row.paid_total || 0),
    balance: Number(row.current_amount) - Number(row.paid_total || 0),
  };
}

function serializePayment(row) {
  return { id: row.id, contractId: row.contract_id, amount: Number(row.amount), paymentType: row.payment_type, paymentDate: row.payment_date, status: row.status, remarks: row.remarks || '' };
}

router.get('/suppliers', requireRole('officer', 'director'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE is_active ORDER BY name');
    res.json(rows.map(serializeSupplier));
  } catch (err) {
    next(err);
  }
});

router.post('/suppliers', requireRole('officer'), async (req, res, next) => {
  const { name, contact = '' } = req.body;
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query('INSERT INTO suppliers (name, contact) VALUES ($1,$2) RETURNING *', [name.trim(), contact]);
    res.status(201).json(serializeSupplier(rows[0]));
  } catch (err) {
    next(err);
  }
});

const CONTRACT_SELECT = `
  SELECT c.*, s.name AS supplier_name, pa.reference AS activity_reference,
    COALESCE((SELECT SUM(amount) FROM payments WHERE contract_id = c.id), 0) AS paid_total
  FROM contracts c
  JOIN suppliers s ON s.id = c.supplier_id
  JOIN procurement_activities pa ON pa.id = c.activity_id
`;

router.get('/contracts', requireRole('officer', 'director'), async (req, res, next) => {
  try {
    let where = '';
    const params = [];
    if (req.user.role === 'officer') {
      where = 'WHERE pp.created_by = $1';
      params.push(req.user.id);
    }
    const { rows } = await pool.query(
      `${CONTRACT_SELECT} JOIN procurement_plans pp ON pp.id = pa.plan_id ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows.map(serializeContract));
  } catch (err) {
    next(err);
  }
});

router.post('/contracts', requireRole('officer'), async (req, res, next) => {
  const { activityId, contractNumber, supplierId, originalAmount, contractDate } = req.body;
  if (!Number.isInteger(Number(activityId))) return res.status(400).json({ error: 'activityId is required' });
  if (typeof contractNumber !== 'string' || !contractNumber.trim()) return res.status(400).json({ error: 'contractNumber is required' });
  if (!Number.isInteger(Number(supplierId))) return res.status(400).json({ error: 'supplierId is required' });
  if (!Number.isFinite(Number(originalAmount)) || Number(originalAmount) < 0) return res.status(400).json({ error: 'originalAmount must be a non-negative number' });
  if (!isValidDate(contractDate)) return res.status(400).json({ error: 'contractDate must be a valid date in YYYY-MM-DD format' });

  try {
    const { rows: activities } = await pool.query(
      `SELECT pa.id, pa.currency, pp.created_by, pp.status FROM procurement_activities pa
       JOIN procurement_plans pp ON pp.id = pa.plan_id WHERE pa.id = $1`,
      [Number(activityId)]
    );
    if (!activities.length) return res.status(404).json({ error: 'Activity not found' });
    if (activities[0].created_by !== req.user.id) return res.status(403).json({ error: 'You do not own this plan' });
    if (!['FINALLY_APPROVED', 'REPLANNED'].includes(activities[0].status)) return res.status(409).json({ error: 'Contracts can only be registered once the plan is finally approved' });

    const { rows } = await pool.query(
      `INSERT INTO contracts (activity_id, contract_number, supplier_id, original_amount, current_amount, currency, contract_date)
       VALUES ($1,$2,$3,$4,$4,$5,$6) RETURNING *`,
      [Number(activityId), contractNumber.trim(), Number(supplierId), Number(originalAmount), activities[0].currency || 'ETB', contractDate]
    );
    const { rows: full } = await pool.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [rows[0].id]);
    res.status(201).json(serializeContract(full[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This contract number or activity already has a contract registered' });
    next(err);
  }
});

router.put('/contracts/:id', requireRole('officer'), async (req, res, next) => {
  const { currentAmount, finalAmount, status } = req.body;
  if (currentAmount !== undefined && (!Number.isFinite(Number(currentAmount)) || Number(currentAmount) < 0)) return res.status(400).json({ error: 'currentAmount must be a non-negative number' });
  if (finalAmount !== undefined && finalAmount !== null && (!Number.isFinite(Number(finalAmount)) || Number(finalAmount) < 0)) return res.status(400).json({ error: 'finalAmount must be a non-negative number' });
  if (status !== undefined && !['Active', 'Completed', 'Terminated'].includes(status)) return res.status(400).json({ error: 'status must be Active, Completed, or Terminated' });

  try {
    const { rows: existing } = await pool.query(
      `SELECT c.*, pp.created_by FROM contracts c
       JOIN procurement_activities pa ON pa.id = c.activity_id
       JOIN procurement_plans pp ON pp.id = pa.plan_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Contract not found' });
    if (existing[0].created_by !== req.user.id) return res.status(403).json({ error: 'You do not own this plan' });
    if (currentAmount !== undefined) {
      const { rows: paidRows } = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE contract_id = $1', [req.params.id]);
      if (Number(currentAmount) < Number(paidRows[0].total)) return res.status(409).json({ error: `Current amount cannot be below the paid total of ${paidRows[0].total}` });
    }

    const sets = [];
    const values = [];
    let i = 1;
    if (currentAmount !== undefined) { sets.push(`current_amount = $${i++}`); values.push(currentAmount); }
    if (finalAmount !== undefined) { sets.push(`final_amount = $${i++}`); values.push(finalAmount); }
    if (status !== undefined) { sets.push(`status = $${i++}`); values.push(status); }
    if (!sets.length) return res.status(400).json({ error: 'No editable fields provided' });
    values.push(req.params.id);
    await pool.query(`UPDATE contracts SET ${sets.join(', ')} WHERE id = $${i}`, values);

    const { rows: full } = await pool.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json(serializeContract(full[0]));
  } catch (err) {
    next(err);
  }
});

router.post('/contracts/:id/payments', requireRole('officer'), async (req, res, next) => {
  const { amount, paymentType = 'Interim', paymentDate, remarks = '' } = req.body;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });
  if (!isValidDate(paymentDate)) return res.status(400).json({ error: 'paymentDate must be a valid date in YYYY-MM-DD format' });
  if (!['Advance', 'Interim', 'Final', 'Retention'].includes(paymentType)) return res.status(400).json({ error: 'paymentType must be Advance, Interim, Final, or Retention' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: contracts } = await client.query(
      `SELECT c.*, pp.created_by FROM contracts c
       JOIN procurement_activities pa ON pa.id = c.activity_id
       JOIN procurement_plans pp ON pp.id = pa.plan_id WHERE c.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!contracts.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Contract not found' }); }
    const contract = contracts[0];
    if (contract.created_by !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You do not own this plan' }); }

    const { rows: paidRows } = await client.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE contract_id = $1', [req.params.id]);
    const balance = Number(contract.current_amount) - Number(paidRows[0].total);
    if (Number(amount) > balance) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Payment exceeds the remaining balance of ${balance}` }); }

    const { rows } = await client.query(
      'INSERT INTO payments (contract_id, amount, payment_type, payment_date, remarks) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, Number(amount), paymentType, paymentDate, remarks]
    );
    await client.query('COMMIT');
    res.status(201).json(serializePayment(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
