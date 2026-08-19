const express = require('express');
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const serialize = (row) => ({ id: row.id, code: row.code, name: row.name, description: row.description || '', structureType: row.structure_type || 'sector', isActive: row.is_active });

router.get('/', requireRole('officer', 'director', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sectors ORDER BY name');
    res.json(rows.map(serialize));
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  try {
    const { rows } = await pool.query('INSERT INTO sectors (code, name, description) VALUES ($1,$2,$3) RETURNING *', [code, name, description]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Sector code or name already exists' });
    next(err);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  try {
    const { rows } = await pool.query('UPDATE sectors SET code = $1, name = $2, description = $3 WHERE id = $4 RETURNING *', [code, name, description, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Sector not found' });
    res.json(serialize(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Sector code or name already exists' });
    next(err);
  }
});

router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive is required' });
  try {
    const { rows } = await pool.query('UPDATE sectors SET is_active = $1 WHERE id = $2 RETURNING *', [req.body.isActive, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Sector not found' });
    res.json(serialize(rows[0]));
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM sectors WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Sector not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'This sector is used by leadership or project records and cannot be deleted. Deactivate it instead.' });
    next(err);
  }
});

module.exports = router;
