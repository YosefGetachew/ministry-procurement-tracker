const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

function serialize(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sectorId: row.sector_id,
    sectorName: row.sector_name || '',
    description: row.description || '',
    fundingSource: row.funding_source || '',
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function serializeAssignment(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    officerId: row.officer_id,
    officerName: row.officer_name,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function validateFields(body, { creating = false } = {}) {
  const required = ['code', 'name'];
  if (creating && required.some((key) => typeof body[key] !== 'string' || !body[key].trim())) {
    return 'code and name are required';
  }
  for (const key of ['code', 'name']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || !body[key].trim())) return `${key} cannot be blank`;
  }
  if (body.status !== undefined && !['Active', 'Closed'].includes(body.status)) return 'status must be Active or Closed';
  for (const key of ['startDate', 'endDate']) {
    if (body[key] !== undefined && body[key] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body[key])) return `${key} must be a valid date in YYYY-MM-DD format`;
  }
  return null;
}

// GET /api/projects - Director only, per SDD 15.2 permission matrix
router.get('/', requireRole('director'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT p.*, s.name AS sector_name FROM projects p LEFT JOIN sectors s ON s.id = p.sector_id ORDER BY s.name, p.created_at DESC');
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('director'), async (req, res, next) => {
  const validationError = validateFields(req.body, { creating: true });
  if (validationError) return res.status(400).json({ error: validationError });
  const { code, name, sectorId, description = '', fundingSource = '', startDate = null, endDate = null } = req.body;
  if (!Number.isInteger(Number(sectorId))) return res.status(400).json({ error: 'sectorId is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (code, name, sector_id, description, funding_source, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code.trim(), name.trim(), Number(sectorId), description, fundingSource, startDate, endDate, req.user.id]
    );
    const { rows: full } = await pool.query('SELECT p.*, s.name AS sector_name FROM projects p LEFT JOIN sectors s ON s.id = p.sector_id WHERE p.id = $1', [rows[0].id]);
    res.status(201).json(serialize(full[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A project with this code already exists' });
    next(err);
  }
});

router.put('/:id', requireRole('director'), async (req, res, next) => {
  const validationError = validateFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const fieldMap = { name: 'name', sectorId: 'sector_id', description: 'description', fundingSource: 'funding_source', startDate: 'start_date', endDate: 'end_date', status: 'status' };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [key, column] of Object.entries(fieldMap)) {
    if (req.body[key] !== undefined) {
      sets.push(`${column} = $${i}`);
      values.push(req.body[key]);
      i++;
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No editable fields provided' });

  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/assignments', requireRole('director'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pa.*, u.name AS officer_name FROM project_assignments pa
       JOIN users u ON u.id = pa.officer_id
       WHERE pa.project_id = $1 ORDER BY pa.created_at DESC`,
      [req.params.id]
    );
    res.json(rows.map(serializeAssignment));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/assignments', requireRole('director'), async (req, res, next) => {
  const officerId = Number(req.body.officerId);
  if (!Number.isInteger(officerId)) return res.status(400).json({ error: 'officerId is required' });
  try {
    const { rows: officers } = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'officer' AND is_active", [officerId]);
    if (!officers.length) return res.status(400).json({ error: 'officerId must belong to an active Procurement Officer' });

    const { rows } = await pool.query(
      `INSERT INTO project_assignments (project_id, officer_id, assigned_by, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (project_id, officer_id) DO UPDATE SET is_active = true, assigned_by = $3
       RETURNING *`,
      [req.params.id, officerId, req.user.id]
    );
    const { rows: named } = await pool.query('SELECT pa.*, u.name AS officer_name FROM project_assignments pa JOIN users u ON u.id = pa.officer_id WHERE pa.id = $1', [rows[0].id]);
    res.status(201).json(serializeAssignment(named[0]));
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Project not found' });
    next(err);
  }
});

module.exports = router;
