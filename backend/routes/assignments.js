const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

// PATCH /api/assignments/:id - Director activates/deactivates an Officer's project assignment
router.patch('/:id', requireRole('director'), async (req, res, next) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE project_assignments SET is_active = $1 WHERE id = $2 RETURNING *',
      [req.body.isActive, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ id: rows[0].id, projectId: rows[0].project_id, officerId: rows[0].officer_id, isActive: rows[0].is_active });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
