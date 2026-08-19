const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

// GET /api/my-projects - Officer: only actively assigned projects (SDD 10.2)
router.get('/', requireRole('officer'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, s.name AS sector_name FROM projects p
       JOIN project_assignments pa ON pa.project_id = p.id
       LEFT JOIN sectors s ON s.id = p.sector_id
       WHERE pa.officer_id = $1 AND pa.is_active AND p.status = 'Active'
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map((row) => ({
      id: row.id, code: row.code, name: row.name, description: row.description || '',
      sectorId: row.sector_id, sectorName: row.sector_name || '',
      fundingSource: row.funding_source || '', startDate: row.start_date, endDate: row.end_date,
      status: row.status, createdAt: row.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
