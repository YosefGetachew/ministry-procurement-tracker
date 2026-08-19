const express = require('express');
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const ALLOWED_LISTS = new Set(['funding_source']);
const LEADERSHIP_POSITIONS = new Set(['state_minister', 'minister', 'ceo', 'minister_office_head']);
const serialize = (row) => ({ id: row.id, listKey: row.list_key, code: row.code, label: row.label, description: row.description || '', sortOrder: row.sort_order, isActive: row.is_active });

router.get('/options', requireRole('officer', 'director', 'admin'), async (req, res, next) => {
  const listKey = String(req.query.listKey || '').trim();
  if (!ALLOWED_LISTS.has(listKey)) return res.status(400).json({ error: 'Unsupported dropdown list' });
  try {
    const { rows } = await pool.query('SELECT * FROM lookup_options WHERE list_key = $1 ORDER BY sort_order, label', [listKey]);
    res.json(rows.map(serialize));
  } catch (err) { next(err); }
});

router.post('/options', requireRole('admin'), async (req, res, next) => {
  const listKey = String(req.body.listKey || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase();
  const label = String(req.body.label || '').trim();
  const description = String(req.body.description || '').trim();
  if (!ALLOWED_LISTS.has(listKey)) return res.status(400).json({ error: 'Unsupported dropdown list' });
  if (!code || !label) return res.status(400).json({ error: 'Code and name are required' });
  try {
    const { rows } = await pool.query('INSERT INTO lookup_options (list_key, code, label, description) VALUES ($1,$2,$3,$4) RETURNING *', [listKey, code, label, description]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Code or name already exists in this list' });
    next(err);
  }
});

router.put('/options/:id', requireRole('admin'), async (req, res, next) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const label = String(req.body.label || '').trim();
  const description = String(req.body.description || '').trim();
  if (!code || !label) return res.status(400).json({ error: 'Code and name are required' });
  try {
    const { rows } = await pool.query('UPDATE lookup_options SET code = $1, label = $2, description = $3 WHERE id = $4 RETURNING *', [code, label, description, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Dropdown option not found' });
    res.json(serialize(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Code or name already exists in this list' });
    next(err);
  }
});

router.patch('/options/:id', requireRole('admin'), async (req, res, next) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive is required' });
  try {
    const { rows } = await pool.query('UPDATE lookup_options SET is_active = $1 WHERE id = $2 RETURNING *', [req.body.isActive, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Dropdown option not found' });
    res.json(serialize(rows[0]));
  } catch (err) { next(err); }
});

const serializeLeader = (row) => ({ id: row.id, position: row.position, sectorId: row.sector_id, sectorName: row.sector_name || '', name: row.name, email: row.email, phone: row.phone, biography: row.biography || '', isActive: row.is_active });

router.get('/leadership', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT lr.*, s.name AS sector_name FROM leadership_registry lr LEFT JOIN sectors s ON s.id = lr.sector_id ORDER BY CASE lr.position WHEN 'minister' THEN 1 WHEN 'ceo' THEN 2 WHEN 'minister_office_head' THEN 3 ELSE 4 END, s.name`);
    res.json(rows.map(serializeLeader));
  } catch (err) { next(err); }
});

router.post('/leadership', requireRole('admin'), async (req, res, next) => {
  const position = String(req.body.position || '').trim();
  const sectorId = req.body.sectorId ? Number(req.body.sectorId) : null;
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const biography = String(req.body.biography || '').trim();
  if (!LEADERSHIP_POSITIONS.has(position)) return res.status(400).json({ error: 'Select a valid leadership position' });
  if (position === 'state_minister' && !Number.isInteger(sectorId)) return res.status(400).json({ error: 'Sector is required for a State Minister' });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return res.status(400).json({ error: 'Name, valid email, and phone are required' });
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  try {
    if (position === 'state_minister') {
      const { rows: count } = await pool.query("SELECT COUNT(*)::int AS count FROM leadership_registry WHERE position = 'state_minister' AND is_active");
      if (count[0].count >= 4) return res.status(409).json({ error: 'All four active State Minister seats are already registered' });
    }
    const { rows } = await pool.query(`INSERT INTO leadership_registry (position, sector_id, name, email, phone, biography) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [position, position === 'state_minister' ? sectorId : null, name, email, phone, biography]);
    const { rows: full } = await pool.query(`SELECT lr.*, s.name AS sector_name FROM leadership_registry lr LEFT JOIN sectors s ON s.id = lr.sector_id WHERE lr.id = $1`, [rows[0].id]);
    res.status(201).json(serializeLeader(full[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That office/sector or email is already registered' });
    next(err);
  }
});

router.put('/leadership/:id', requireRole('admin'), async (req, res, next) => {
  const position = String(req.body.position || '').trim();
  const sectorId = req.body.sectorId ? Number(req.body.sectorId) : null;
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const biography = String(req.body.biography || '').trim();
  if (!LEADERSHIP_POSITIONS.has(position)) return res.status(400).json({ error: 'Select a valid leadership position' });
  if (position === 'state_minister' && !Number.isInteger(sectorId)) return res.status(400).json({ error: 'Sector is required for a State Minister' });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return res.status(400).json({ error: 'Name, valid email, and phone are required' });
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  try {
    const { rows } = await pool.query(`UPDATE leadership_registry SET position = $1, sector_id = $2, name = $3, email = $4, phone = $5, biography = $6, updated_at = now() WHERE id = $7 RETURNING *`, [position, position === 'state_minister' ? sectorId : null, name, email, phone, biography, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Leadership record not found' });
    const { rows: full } = await pool.query(`SELECT lr.*, s.name AS sector_name FROM leadership_registry lr LEFT JOIN sectors s ON s.id = lr.sector_id WHERE lr.id = $1`, [req.params.id]);
    res.json(serializeLeader(full[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That office/sector or email is already registered' });
    next(err);
  }
});

router.patch('/leadership/:id', requireRole('admin'), async (req, res, next) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive is required' });
  try {
    if (req.body.isActive) {
      const { rows: records } = await pool.query('SELECT name, email, phone FROM leadership_registry WHERE id = $1', [req.params.id]);
      if (!records.length) return res.status(404).json({ error: 'Leadership record not found' });
      const record = records[0];
      if (!record.name || !/^\S+@\S+\.\S+$/.test(record.email || '') || !/^\+?[0-9][0-9 ()-]{6,28}$/.test(record.phone || '')) return res.status(400).json({ error: 'Complete the name, valid email, and phone before activation' });
    }
    const { rows } = await pool.query('UPDATE leadership_registry SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING *', [req.body.isActive, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Leadership record not found' });
    res.json(serializeLeader(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Another active person already occupies this seat' });
    next(err);
  }
});

router.delete('/leadership/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows: memberships } = await pool.query('SELECT id FROM management_members WHERE leadership_id = $1 LIMIT 1', [req.params.id]);
    if (memberships.length) return res.status(409).json({ error: 'This office holder is already registered in the Management Committee. Deactivate the membership instead to preserve committee history.' });
    const { rows } = await pool.query('DELETE FROM leadership_registry WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Leadership record not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'This office holder is referenced by committee records and cannot be deleted.' });
    next(err);
  }
});

module.exports = router;
