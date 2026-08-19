const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

// GET /api/officers - Director: list active Officers, for the project-assignment picker
router.get('/', requireRole('director'), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, name, email FROM users WHERE role = 'officer' AND is_active ORDER BY name");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
