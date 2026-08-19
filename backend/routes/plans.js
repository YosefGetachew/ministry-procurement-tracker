const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireRole = require('../middleware/requireRole');
const {
  CATEGORIES, CATEGORY_CODES, METHODS, STAGE_TEMPLATES, RFB_PREQUALIFICATION_STAGES,
  ACTIVITY_FIELDS, METHOD_FIELDS, CATEGORY_FIELDS,
  ACTUAL_ONLY_STAGES,
  COMMITTEE_APPROVAL_THRESHOLD, COMMITTEE_REJECT_THRESHOLD,
} = require('../constants');

function serializePlan(row) {
  return {
    id: row.id,
    reference: row.reference,
    projectId: row.project_id,
    projectName: row.project_name,
    category: row.category,
    name: row.name,
    fiscalYear: row.fiscal_year,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    defaultCurrency: row.default_currency || 'USD',
    description: row.description || '',
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    submittedAt: row.submitted_at,
    directorId: row.director_id,
    directorDecision: row.director_decision,
    directorComment: row.director_comment,
    directorDecidedAt: row.director_decided_at,
    finallyApprovedAt: row.finally_approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeActivity(row) {
  return {
    id: row.id,
    reference: row.reference,
    planId: row.plan_id,
    description: row.description,
    method: row.method,
    amount: Number(row.amount),
    currency: row.currency,
    categoryData: row.category_data,
    status: row.status,
    createdAt: row.created_at,
  };
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

function summarizeStages(stages) {
  const applicable = stages.filter((stage) => stage.status !== 'NotApplicable');
  const completed = applicable.filter((stage) => stage.status === 'Completed').length;
  const today = new Date();
  const delayedStages = applicable.filter((stage) => {
    const target = stage.revisedDate || stage.originalDate;
    const comparison = stage.status === 'Completed' ? stage.actualDate : today;
    return target && comparison && new Date(comparison) > new Date(target);
  }).length;
  return {
    progress: applicable.length ? Math.round((completed / applicable.length) * 100) : 0,
    delayedStages,
    missingPlannedDates: applicable.filter((stage) => !stage.originalDate && !ACTUAL_ONLY_STAGES.includes(stage.name)).length,
  };
}

const PLAN_SELECT = `
  SELECT pp.*, p.name AS project_name, u.name AS created_by_name
  FROM procurement_plans pp
  JOIN projects p ON p.id = pp.project_id
  JOIN users u ON u.id = pp.created_by
`;

async function loadPlan(client, id) {
  const { rows } = await client.query(`${PLAN_SELECT} WHERE pp.id = $1`, [id]);
  return rows[0] || null;
}

function canView(plan, user) {
  if (user.role === 'director') return true;
  if (user.role === 'officer') return plan.created_by === user.id;
  if (user.role === 'committee') return ['COMMITTEE_REVIEW', 'FINALLY_APPROVED', 'REJECTED_BY_COMMITTEE'].includes(plan.status);
  if (user.role === 'management') return ['MANAGEMENT_REVIEW', 'FINALLY_APPROVED', 'REJECTED_BY_MANAGEMENT'].includes(plan.status);
  return false;
}

async function createAlert(client, recipientId, type, message, relatedId) {
  await client.query(
    'INSERT INTO alerts (recipient_id, type, message, related_type, related_id) VALUES ($1,$2,$3,$4,$5)',
    [recipientId, type, message, 'plan', relatedId]
  );
}

async function hasActiveAssignment(client, projectId, officerId) {
  const { rows } = await client.query(
    `SELECT 1 FROM project_assignments pa JOIN projects p ON p.id = pa.project_id
     WHERE pa.project_id = $1 AND pa.officer_id = $2 AND pa.is_active AND p.status = 'Active'`,
    [projectId, officerId]
  );
  return rows.length > 0;
}

async function generatePlanReference(client, projectCode, fiscalYear, categoryCode) {
  const scope = `plan-ref-${projectCode}-${fiscalYear}-${categoryCode}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [scope]);
  const prefix = `${projectCode}-${fiscalYear}-${categoryCode}-`;
  const { rows } = await client.query('SELECT reference FROM procurement_plans WHERE reference LIKE $1 ORDER BY reference DESC LIMIT 1', [`${prefix}%`]);
  const next = rows.length ? Number(rows[0].reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function validateCategoryData(category, family, data = {}) {
  const fields = [...ACTIVITY_FIELDS, ...(METHOD_FIELDS[family] || []), ...(CATEGORY_FIELDS[category] || [])];
  for (const field of fields) {
    const value = data[field.key];
    if (field.required && (value === undefined || value === null || value === '')) return `${field.label} is required`;
    if (value === undefined || value === null || value === '') continue;
    if (field.type === 'number' && !Number.isFinite(Number(value))) return `${field.label} must be a number`;
    if (field.type === 'boolean' && typeof value !== 'boolean') return `${field.label} must be true or false`;
    if (field.type === 'select' && !field.options.includes(value)) return `${field.label} must be one of: ${field.options.join(', ')}`;
  }
  return null;
}

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// GET /api/plans - role-scoped list (Officer: own plans; Director: all; Committee: director-approved or later)
router.get('/', requireRole('officer', 'director', 'committee', 'management'), async (req, res, next) => {
  try {
    let where = '';
    const params = [];
    if (req.user.role === 'officer') {
      where = 'WHERE pp.created_by = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'committee') {
      where = "WHERE pp.status IN ('COMMITTEE_REVIEW', 'MANAGEMENT_REVIEW', 'FINALLY_APPROVED', 'REJECTED_BY_COMMITTEE', 'REJECTED_BY_MANAGEMENT')";
    } else if (req.user.role === 'management') {
      where = "WHERE pp.status IN ('MANAGEMENT_REVIEW', 'FINALLY_APPROVED', 'REJECTED_BY_MANAGEMENT')";
    }
    const { rows } = await pool.query(`${PLAN_SELECT} ${where} ORDER BY pp.created_at DESC`, params);
    res.json(rows.map(serializePlan));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireRole('officer', 'director', 'committee', 'management'), async (req, res, next) => {
  try {
    const plan = await loadPlan(pool, req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!canView(plan, req.user)) return res.status(403).json({ error: 'You do not have access to this plan' });

    const { rows: activities } = await pool.query('SELECT * FROM procurement_activities WHERE plan_id = $1 ORDER BY id', [req.params.id]);
    const activityIds = activities.map((a) => a.id);
    let stagesByActivity = {};
    if (activityIds.length) {
      const { rows: stages } = await pool.query('SELECT * FROM activity_stages WHERE activity_id = ANY($1) ORDER BY activity_id, sequence_no', [activityIds]);
      stagesByActivity = stages.reduce((acc, s) => {
        (acc[s.activity_id] ||= []).push(serializeStage(s));
        return acc;
      }, {});
    }
    res.json({
      ...serializePlan(plan),
      activities: activities.map((a) => {
        const stages = stagesByActivity[a.id] || [];
        return { ...serializeActivity(a), ...summarizeStages(stages), stages };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans - Officer creates a DRAFT category-specific plan in an assigned project
router.post('/', requireRole('officer'), async (req, res, next) => {
  const { projectId, category, name, fiscalYear, periodStart = null, periodEnd = null, defaultCurrency = 'USD', description = '' } = req.body;
  if (!Number.isInteger(Number(projectId))) return res.status(400).json({ error: 'projectId is required' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!Number.isInteger(Number(fiscalYear)) || Number(fiscalYear) < 2020 || Number(fiscalYear) > 2100) return res.status(400).json({ error: 'fiscalYear is invalid' });
  if (periodStart && !isValidDate(periodStart)) return res.status(400).json({ error: 'periodStart must be YYYY-MM-DD' });
  if (periodEnd && !isValidDate(periodEnd)) return res.status(400).json({ error: 'periodEnd must be YYYY-MM-DD' });
  if (periodStart && periodEnd && periodEnd < periodStart) return res.status(400).json({ error: 'periodEnd cannot be before periodStart' });
  if (!['USD', 'ETB'].includes(defaultCurrency)) return res.status(400).json({ error: 'defaultCurrency must be USD or ETB' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: assignments } = await client.query(
      `SELECT p.code FROM project_assignments pa JOIN projects p ON p.id = pa.project_id
       WHERE pa.project_id = $1 AND pa.officer_id = $2 AND pa.is_active AND p.status = 'Active'`,
      [Number(projectId), req.user.id]
    );
    if (!assignments.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not assigned to this project' });
    }
    const reference = await generatePlanReference(client, assignments[0].code, Number(fiscalYear), CATEGORY_CODES[category]);
    const { rows } = await client.query(
      `INSERT INTO procurement_plans (reference, project_id, category, name, fiscal_year, period_start, period_end, default_currency, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [reference, Number(projectId), category, name.trim(), Number(fiscalYear), periodStart, periodEnd, defaultCurrency, description, req.user.id]
    );
    await client.query('COMMIT');
    const plan = await loadPlan(pool, rows[0].id);
    res.status(201).json(serializePlan(plan));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.put('/:id', requireRole('officer'), async (req, res, next) => {
  try {
    const plan = await loadPlan(pool, req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.created_by !== req.user.id) return res.status(403).json({ error: 'You do not own this plan' });
    if (!(await hasActiveAssignment(pool, plan.project_id, req.user.id))) return res.status(403).json({ error: 'Your active assignment to this project is required' });
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(plan.status)) return res.status(409).json({ error: `Plan cannot be edited in status ${plan.status}` });

    const { name, description } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) return res.status(400).json({ error: 'name cannot be blank' });

    const sets = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name.trim()); }
    if (description !== undefined) { sets.push(`description = $${i++}`); values.push(description); }
    if (!sets.length) return res.status(400).json({ error: 'No editable fields provided' });
    values.push(req.params.id);
    await pool.query(`UPDATE procurement_plans SET ${sets.join(', ')} WHERE id = $${i}`, values);
    res.json(serializePlan(await loadPlan(pool, req.params.id)));
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/:id/activities - Officer adds a Procurement Activity; method template generates its stages
router.post('/:id/activities', requireRole('officer'), async (req, res, next) => {
  const { description, method, amount = 0, currency = 'USD', categoryData = {}, plannedDates = [] } = req.body;
  if (typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'description is required' });
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });
  if (!['USD', 'ETB'].includes(currency)) return res.status(400).json({ error: 'currency must be USD or ETB' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: plans } = await client.query('SELECT * FROM procurement_plans WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!plans.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
    const plan = plans[0];
    if (plan.created_by !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You do not own this plan' }); }
    if (!(await hasActiveAssignment(client, plan.project_id, req.user.id))) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Your active assignment to this project is required' }); }
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(plan.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Activities cannot be added in status ${plan.status}` }); }

    const methodDef = METHODS.find((m) => m.code === method);
    if (!methodDef || !methodDef.categories.includes(plan.category)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `method must be a valid method for category ${plan.category}` });
    }
    const categoryError = validateCategoryData(plan.category, methodDef.family, categoryData);
    if (categoryError) { await client.query('ROLLBACK'); return res.status(400).json({ error: categoryError }); }

    const baseStageNames = STAGE_TEMPLATES[methodDef.family] || [];
    const stageNames = methodDef.family === 'RFB' && categoryData.prequalification
      ? [...RFB_PREQUALIFICATION_STAGES, ...baseStageNames]
      : baseStageNames;
    const hasInvalidPlannedDates = !Array.isArray(plannedDates)
      || plannedDates.length !== stageNames.length
      || plannedDates.some((date, index) => !ACTUAL_ONLY_STAGES.includes(stageNames[index]) && !isValidDate(date))
      || plannedDates.some((date, index) => ACTUAL_ONLY_STAGES.includes(stageNames[index]) && date && !isValidDate(date));
    if (hasInvalidPlannedDates) {
      await client.query('ROLLBACK');
      const plannedCount = stageNames.filter((name) => !ACTUAL_ONLY_STAGES.includes(name)).length;
      return res.status(400).json({ error: `Provide a valid planned date for all ${plannedCount} scheduled ${methodDef.label} milestones` });
    }
    const scheduledDates = plannedDates.filter((date, index) => !ACTUAL_ONLY_STAGES.includes(stageNames[index]));
    for (let index = 1; index < scheduledDates.length; index += 1) {
      if (scheduledDates[index] < scheduledDates[index - 1]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Planned milestone dates must follow the procurement sequence' });
      }
    }

    const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS count FROM procurement_activities WHERE plan_id = $1', [req.params.id]);
    const reference = `${plan.reference}-A${String(countRows[0].count + 1).padStart(2, '0')}`;

    const { rows: activityRows } = await client.query(
      `INSERT INTO procurement_activities (reference, plan_id, description, method, amount, currency, category_data, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [reference, req.params.id, description.trim(), method, Number(amount), currency, JSON.stringify(categoryData), categoryData.processStatus || 'Planned']
    );
    const activity = activityRows[0];

    for (let seq = 0; seq < stageNames.length; seq++) {
      await client.query(
        'INSERT INTO activity_stages (activity_id, sequence_no, name, original_date) VALUES ($1,$2,$3,$4)',
        [activity.id, seq + 1, stageNames[seq], plannedDates[seq] || null]
      );
    }
    await client.query('COMMIT');

    const { rows: stages } = await pool.query('SELECT * FROM activity_stages WHERE activity_id = $1 ORDER BY sequence_no', [activity.id]);
    res.status(201).json({ ...serializeActivity(activity), stages: stages.map(serializeStage) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/plans/:id/submit - Officer submits a complete plan to the Director
router.post('/:id/submit', requireRole('officer'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: plans } = await client.query('SELECT * FROM procurement_plans WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!plans.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
    const plan = plans[0];
    if (plan.created_by !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You do not own this plan' }); }
    if (!(await hasActiveAssignment(client, plan.project_id, req.user.id))) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Your active assignment to this project is required' }); }
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(plan.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Plan cannot be submitted from status ${plan.status}` }); }

    const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS count FROM procurement_activities WHERE plan_id = $1', [req.params.id]);
    if (countRows[0].count === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'A plan must contain at least one Procurement Activity before submission' }); }

    const { rows: missingDateRows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM activity_stages s
       JOIN procurement_activities a ON a.id = s.activity_id
       WHERE a.plan_id = $1 AND s.original_date IS NULL AND NOT (s.name = ANY($2::text[]))`,
      [req.params.id, ACTUAL_ONLY_STAGES]
    );
    if (missingDateRows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Set all planned milestone dates before submission (${missingDateRows[0].count} missing)` });
    }

    await client.query("UPDATE procurement_plans SET status = 'SUBMITTED_TO_DIRECTOR', submitted_at = now() WHERE id = $1", [req.params.id]);

    const { rows: directors } = await client.query("SELECT id FROM users WHERE role = 'director' AND is_active");
    for (const director of directors) {
      await createAlert(client, director.id, 'PLAN_SUBMITTED', `Plan ${plan.reference} was submitted for your review.`, plan.id);
    }
    await client.query('COMMIT');
    res.json(serializePlan(await loadPlan(pool, req.params.id)));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/plans/:id/director-review - Director approves (-> committee), returns, or rejects
router.post('/:id/director-review', requireRole('director'), async (req, res, next) => {
  const { decision, comment = '' } = req.body;
  if (!['APPROVE', 'RETURN', 'REJECT'].includes(decision)) return res.status(400).json({ error: 'decision must be APPROVE, RETURN, or REJECT' });
  if (decision !== 'APPROVE' && !comment.trim()) return res.status(400).json({ error: 'A comment is required to return or reject a plan' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: plans } = await client.query('SELECT * FROM procurement_plans WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!plans.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
    const plan = plans[0];
    if (plan.status !== 'SUBMITTED_TO_DIRECTOR') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Plan is not awaiting Director review (status ${plan.status})` }); }

    if (decision === 'APPROVE') {
      const { rows: committeeCount } = await client.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active');
      if (committeeCount[0].count !== 5) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Exactly 5 active committee members are required before approval; currently ${committeeCount[0].count}` });
      }
    }

    // APPROVE moves straight into committee review — SDD's DIRECTOR_APPROVED
    // state and the "send to committee" action happen as one step (§6.2).
    const nextStatus = decision === 'APPROVE' ? 'COMMITTEE_REVIEW' : decision === 'RETURN' ? 'RETURNED_FOR_CORRECTION' : 'REJECTED_BY_DIRECTOR';
    await client.query(
      `UPDATE procurement_plans SET status = $1, director_id = $2, director_decision = $3, director_comment = $4, director_decided_at = now() WHERE id = $5`,
      [nextStatus, req.user.id, decision, comment, req.params.id]
    );

    if (decision === 'APPROVE') {
      await createAlert(client, plan.created_by, 'DIRECTOR_APPROVED', `Plan ${plan.reference} was approved by the Director and sent to committee review.`, plan.id);
      const { rows: members } = await client.query('SELECT user_id FROM committee_members WHERE is_active');
      for (const member of members) {
        await createAlert(client, member.user_id, 'COMMITTEE_REVIEW_READY', `Plan ${plan.reference} is ready for committee review.`, plan.id);
      }
    } else {
      await createAlert(client, plan.created_by, decision === 'RETURN' ? 'PLAN_RETURNED' : 'PLAN_REJECTED', `Plan ${plan.reference} was ${decision === 'RETURN' ? 'returned for correction' : 'rejected'}: ${comment}`, plan.id);
    }
    await client.query('COMMIT');
    res.json(serializePlan(await loadPlan(pool, req.params.id)));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/plans/:id/votes - Committee member casts one Approve/Reject vote
router.post('/:id/votes', requireRole('committee'), async (req, res, next) => {
  const { decision, comment = '' } = req.body;
  if (!['Approve', 'Reject'].includes(decision)) return res.status(400).json({ error: 'decision must be Approve or Reject' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: members } = await client.query('SELECT id FROM committee_members WHERE user_id = $1 AND is_active', [req.user.id]);
    if (!members.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You are not an active committee member' }); }

    // Lock the plan row so two concurrent votes can't both observe a count
    // just under the threshold and both push the plan into a final state.
    const { rows: plans } = await client.query('SELECT * FROM procurement_plans WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!plans.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
    const plan = plans[0];
    if (plan.status !== 'COMMITTEE_REVIEW') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Plan is not open for committee voting (status ${plan.status})` }); }

    const { rows: existing } = await client.query('SELECT id FROM committee_votes WHERE plan_id = $1 AND member_id = $2', [req.params.id, req.user.id]);
    if (existing.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'You have already submitted a decision for this plan' }); }

    await client.query('INSERT INTO committee_votes (plan_id, member_id, decision, comment) VALUES ($1,$2,$3,$4)', [req.params.id, req.user.id, decision, comment]);

    const { rows: tally } = await client.query(
      `SELECT decision, COUNT(*)::int AS count FROM committee_votes WHERE plan_id = $1 GROUP BY decision`,
      [req.params.id]
    );
    const approvals = tally.find((t) => t.decision === 'Approve')?.count || 0;
    const rejections = tally.find((t) => t.decision === 'Reject')?.count || 0;
    if (approvals >= COMMITTEE_APPROVAL_THRESHOLD) {
      await client.query("UPDATE procurement_plans SET status = 'MANAGEMENT_REVIEW' WHERE id = $1", [req.params.id]);
      await createAlert(client, plan.created_by, 'COMMITTEE_ENDORSED', `Plan ${plan.reference} was endorsed and sent to Ministry Management.`, plan.id);
      const { rows: managers } = await client.query("SELECT id FROM users WHERE role = 'management' AND is_active");
      for (const manager of managers) await createAlert(client, manager.id, 'MANAGEMENT_REVIEW_READY', `Plan ${plan.reference} is ready for Ministry Management approval.`, plan.id);
    } else if (rejections >= COMMITTEE_REJECT_THRESHOLD) {
      await client.query("UPDATE procurement_plans SET status = 'REJECTED_BY_COMMITTEE' WHERE id = $1", [req.params.id]);
      await createAlert(client, plan.created_by, 'COMMITTEE_REJECTED', `Plan ${plan.reference} was rejected by the Endorsing Committee.`, plan.id);
    }
    await client.query('COMMIT');
    res.status(201).json(serializePlan(await loadPlan(pool, req.params.id)));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/plans/:id/approval-summary - Director decision + committee tally, for Officer/Director/Committee
router.post('/:id/management-decision', requireRole('management'), async (req, res, next) => {
  const decision = String(req.body.decision || '');
  const comment = String(req.body.comment || '').trim();
  if (!['Approve', 'Reject'].includes(decision)) return res.status(400).json({ error: 'decision must be Approve or Reject' });
  if (decision === 'Reject' && !comment) return res.status(400).json({ error: 'A rejection reason is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: managementMembers } = await client.query('SELECT id FROM management_members WHERE user_id = $1 AND is_active', [req.user.id]);
    if (!managementMembers.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You are not an active Ministry Management Committee member' }); }
    const { rows } = await client.query('SELECT * FROM procurement_plans WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
    const plan = rows[0];
    if (plan.status !== 'MANAGEMENT_REVIEW') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Plan is not awaiting Ministry Management approval (status ${plan.status})` }); }
    await client.query('INSERT INTO management_decisions (plan_id, decided_by, decision, comment) VALUES ($1,$2,$3,$4)', [plan.id, req.user.id, decision, comment]);
    const nextStatus = decision === 'Approve' ? 'FINALLY_APPROVED' : 'REJECTED_BY_MANAGEMENT';
    await client.query('UPDATE procurement_plans SET status = $1, finally_approved_at = CASE WHEN $1 = $2 THEN now() ELSE NULL END WHERE id = $3', [nextStatus, 'FINALLY_APPROVED', plan.id]);
    await createAlert(client, plan.created_by, decision === 'Approve' ? 'PLAN_FINALLY_APPROVED' : 'PLAN_REJECTED_BY_MANAGEMENT', `Plan ${plan.reference} was ${decision === 'Approve' ? 'approved' : 'rejected'} by Ministry Management.${comment ? ` ${comment}` : ''}`, plan.id);
    if (plan.director_id) await createAlert(client, plan.director_id, decision === 'Approve' ? 'PLAN_FINALLY_APPROVED' : 'PLAN_REJECTED_BY_MANAGEMENT', `Plan ${plan.reference} was ${decision === 'Approve' ? 'approved' : 'rejected'} by Ministry Management.`, plan.id);
    await client.query('COMMIT');
    res.json(serializePlan(await loadPlan(pool, plan.id)));
  } catch (err) { await client.query('ROLLBACK'); if (err.code === '23505') return res.status(409).json({ error: 'A management decision has already been recorded' }); next(err); }
  finally { client.release(); }
});

router.get('/:id/approval-summary', requireRole('officer', 'director', 'committee', 'management'), async (req, res, next) => {
  try {
    const plan = await loadPlan(pool, req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!canView(plan, req.user)) return res.status(403).json({ error: 'You do not have access to this plan' });

    const { rows: votes } = await pool.query(
      `SELECT cv.decision, cv.comment, cv.voted_at, u.name AS member_name FROM committee_votes cv
       JOIN users u ON u.id = cv.member_id WHERE cv.plan_id = $1 ORDER BY cv.voted_at`,
      [req.params.id]
    );
    const { rows: committee } = await pool.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active');
    const { rows: managementRows } = await pool.query(`SELECT md.decision, md.comment, md.decided_at, u.name AS decided_by_name FROM management_decisions md JOIN users u ON u.id = md.decided_by WHERE md.plan_id = $1`, [req.params.id]);
    res.json({
      status: plan.status,
      director: plan.director_id ? { id: plan.director_id, decision: plan.director_decision, comment: plan.director_comment, decidedAt: plan.director_decided_at } : null,
      committee: {
        size: committee[0].count,
        approvalThreshold: COMMITTEE_APPROVAL_THRESHOLD,
        votes: votes.map((v) => ({ memberName: v.member_name, decision: v.decision, comment: v.comment, votedAt: v.voted_at })),
      },
      management: managementRows[0] ? { decision: managementRows[0].decision, comment: managementRows[0].comment, decidedAt: managementRows[0].decided_at, decidedByName: managementRows[0].decided_by_name } : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
