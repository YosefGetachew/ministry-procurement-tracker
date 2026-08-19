const express = require('express');
const router = express.Router();
const pool = require('../db');

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    relatedType: row.related_type,
    relatedId: row.related_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alerts WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE alerts SET status = 'read' WHERE id = $1 AND recipient_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alert not found' });
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
