const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');
const { STAGE_STATUSES } = require('../constants');

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function serializeStage(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    sequenceNo: row.sequence_no,
    name: row.name,
    originalDate: row.original_date,
    revisedDate: row.revised_date,
    actualDate: row.actual_date,
    status: row.status,
    remarks: row.remarks || '',
  };
}

async function loadStageWithPlan(client, stageId) {
  const { rows } = await client.query(
    `SELECT s.*, pa.plan_id, pp.created_by AS plan_owner, pp.status AS plan_status, pp.director_id, pp.reference AS plan_reference
     FROM activity_stages s
     JOIN procurement_activities pa ON pa.id = s.activity_id
     JOIN procurement_plans pp ON pp.id = pa.plan_id
     WHERE s.id = $1`,
    [stageId]
  );
  return rows[0] || null;
}

// PATCH /api/stages/:id - Officer updates status/actual date/remarks, or sets the
// initial target date the first time (SDD 8: "Completed requires actual date").
router.patch('/:id', requireRole('officer'), async (req, res, next) => {
  const { status, actualDate, remarks, originalDate } = req.body;
  if (status !== undefined && !STAGE_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STAGE_STATUSES.join(', ')}` });
  if (actualDate !== undefined && actualDate !== null && !isValidDate(actualDate)) return res.status(400).json({ error: 'actualDate must be a valid date in YYYY-MM-DD format' });
  if (originalDate !== undefined && !isValidDate(originalDate)) return res.status(400).json({ error: 'originalDate must be a valid date in YYYY-MM-DD format' });

  try {
    const stage = await loadStageWithPlan(pool, req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.plan_owner !== req.user.id) return res.status(403).json({ error: 'You do not own this plan' });
    const isDraftPlanning = ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(stage.plan_status);
    const isApprovedTracking = ['FINALLY_APPROVED', 'REPLANNED'].includes(stage.plan_status);
    if (!isDraftPlanning && !isApprovedTracking) return res.status(409).json({ error: 'This stage cannot be updated in the plan\'s current status' });
    if (isDraftPlanning && (status !== undefined || actualDate !== undefined || remarks !== undefined)) {
      return res.status(409).json({ error: 'Only the planned target date can be set while the plan is in draft' });
    }

    const effectiveActualDate = actualDate !== undefined ? actualDate : stage.actual_date;
    if (status === 'Completed' && !effectiveActualDate) return res.status(400).json({ error: 'Completed requires an actual date' });
    if (effectiveActualDate && stage.sequence_no > 1) {
      const { rows: predecessors } = await pool.query(
        `SELECT actual_date FROM activity_stages WHERE activity_id = $1 AND sequence_no < $2
         AND status <> 'NotApplicable' ORDER BY sequence_no DESC LIMIT 1`,
        [stage.activity_id, stage.sequence_no]
      );
      if (predecessors[0]?.actual_date && String(effectiveActualDate).slice(0, 10) < String(predecessors[0].actual_date).slice(0, 10)) {
        return res.status(400).json({ error: 'Actual date cannot be earlier than the previous applicable stage actual date' });
      }
    }
    if (originalDate !== undefined && stage.original_date) return res.status(409).json({ error: 'The initial target date is already set; use replan to change it' });

    const sets = [];
    const values = [];
    let i = 1;
    if (originalDate !== undefined) { sets.push(`original_date = $${i++}`); values.push(originalDate); }
    if (status !== undefined) { sets.push(`status = $${i++}`); values.push(status); }
    if (actualDate !== undefined) { sets.push(`actual_date = $${i++}`); values.push(actualDate); }
    if (remarks !== undefined) { sets.push(`remarks = $${i++}`); values.push(remarks); }
    if (!sets.length) return res.status(400).json({ error: 'No editable fields provided' });

    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE activity_stages SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    res.json(serializeStage(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /api/stages/:id/replan - revise a stage's target date, preserving the original (SDD 8, Replanning)
router.post('/:id/replan', requireRole('officer'), async (req, res, next) => {
  const { newDate, reason } = req.body;
  if (!isValidDate(newDate)) return res.status(400).json({ error: 'newDate must be a valid date in YYYY-MM-DD format' });
  if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stage = await loadStageWithPlan(client, req.params.id);
    if (!stage) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Stage not found' }); }
    if (stage.plan_owner !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You do not own this plan' }); }
    if (!['FINALLY_APPROVED', 'REPLANNED'].includes(stage.plan_status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only an approved plan\'s stages can be replanned' }); }
    if (!stage.original_date) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Set an initial target date for this stage before replanning it' }); }

    const oldDate = stage.revised_date || stage.original_date;
    await client.query('UPDATE activity_stages SET revised_date = $1 WHERE id = $2', [newDate, req.params.id]);
    await client.query(
      'INSERT INTO activity_revisions (stage_id, old_date, new_date, reason, changed_by) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, oldDate, newDate, reason.trim(), req.user.id]
    );
    if (stage.plan_status === 'FINALLY_APPROVED') {
      await client.query("UPDATE procurement_plans SET status = 'REPLANNED' WHERE id = $1", [stage.plan_id]);
    }

    const recipients = stage.director_id ? [stage.director_id] : (await client.query("SELECT id FROM users WHERE role = 'director' AND is_active")).rows.map((r) => r.id);
    for (const recipientId of recipients) {
      await client.query(
        'INSERT INTO alerts (recipient_id, type, message, related_type, related_id) VALUES ($1,$2,$3,$4,$5)',
        [recipientId, 'ACTIVITY_REPLANNED', `${stage.plan_reference}: stage "${stage.name}" replanned from ${oldDate || 'unset'} to ${newDate}. Reason: ${reason.trim()}`, 'plan', stage.plan_id]
      );
    }
    await client.query('COMMIT');

    const { rows } = await pool.query('SELECT * FROM activity_stages WHERE id = $1', [req.params.id]);
    res.json(serializeStage(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
