const express = require('express');
const pool = require('../db');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireRole('director', 'management'));

function filtersFrom(query) {
  const values = [];
  const clauses = [];
  const fiscalYear = Number.parseInt(query.fiscalYear, 10);
  const sectorId = Number.parseInt(query.sectorId, 10);

  if (Number.isInteger(fiscalYear)) {
    values.push(fiscalYear);
    clauses.push(`pp.fiscal_year = $${values.length}`);
  }
  if (Number.isInteger(sectorId)) {
    values.push(sectorId);
    clauses.push(`p.sector_id = $${values.length}`);
  }

  return {
    values,
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    selected: {
      fiscalYear: Number.isInteger(fiscalYear) ? fiscalYear : null,
      sectorId: Number.isInteger(sectorId) ? sectorId : null,
    },
  };
}

router.get('/', async (req, res, next) => {
  const { values, where, selected } = filtersFrom(req.query);
  const filteredPlans = `
    WITH filtered_plans AS (
      SELECT pp.*, p.name AS project_name, p.sector_id, s.name AS sector_name
      FROM procurement_plans pp
      JOIN projects p ON p.id = pp.project_id
      LEFT JOIN sectors s ON s.id = p.sector_id
      ${where}
    )`;

  try {
    const [filterOptions, overview, valuesByCurrency, statusMix, categoryMix, sectorPerformance, monthlyCreated, monthlyApproved, contractExposure, decisionQueue] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE((SELECT json_agg(year ORDER BY year DESC) FROM (SELECT DISTINCT fiscal_year AS year FROM procurement_plans) years), '[]') AS fiscal_years,
          COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name) ORDER BY name) FROM sectors WHERE is_active), '[]') AS sectors`),
      pool.query(`${filteredPlans}
        SELECT COUNT(*)::int AS total_plans,
          COUNT(*) FILTER (WHERE status = 'FINALLY_APPROVED')::int AS approved_plans,
          COUNT(*) FILTER (WHERE status IN ('SUBMITTED_TO_DIRECTOR','COMMITTEE_REVIEW','MANAGEMENT_REVIEW'))::int AS awaiting_decision,
          COUNT(*) FILTER (WHERE status IN ('REJECTED_BY_DIRECTOR','REJECTED_BY_COMMITTEE','REJECTED_BY_MANAGEMENT'))::int AS rejected_plans,
          (SELECT COUNT(*)::int FROM activity_stages st
             JOIN procurement_activities pa ON pa.id = st.activity_id
             JOIN filtered_plans fp2 ON fp2.id = pa.plan_id
           WHERE st.status NOT IN ('Completed','NotApplicable')
             AND COALESCE(st.revised_date, st.original_date) < CURRENT_DATE) AS delayed_stages,
          (SELECT COUNT(*)::int FROM activity_stages st
             JOIN procurement_activities pa ON pa.id = st.activity_id
             JOIN filtered_plans fp2 ON fp2.id = pa.plan_id
           WHERE st.status = 'Completed') AS completed_stages,
          (SELECT COUNT(*)::int FROM activity_stages st
             JOIN procurement_activities pa ON pa.id = st.activity_id
             JOIN filtered_plans fp2 ON fp2.id = pa.plan_id
           WHERE st.status <> 'NotApplicable') AS applicable_stages,
          (SELECT COUNT(*)::int FROM contracts c
             JOIN procurement_activities pa ON pa.id = c.activity_id
             JOIN filtered_plans fp2 ON fp2.id = pa.plan_id
           WHERE c.status = 'Active') AS active_contracts
        FROM filtered_plans`, values),
      pool.query(`${filteredPlans}
        SELECT pa.currency, COALESCE(SUM(pa.amount), 0)::float AS amount
        FROM procurement_activities pa JOIN filtered_plans fp ON fp.id = pa.plan_id
        GROUP BY pa.currency ORDER BY pa.currency`, values),
      pool.query(`${filteredPlans}
        SELECT status, COUNT(*)::int AS count FROM filtered_plans
        GROUP BY status ORDER BY count DESC, status`, values),
      pool.query(`${filteredPlans}
        SELECT fp.category, pa.currency, COALESCE(SUM(pa.amount), 0)::float AS amount
        FROM filtered_plans fp JOIN procurement_activities pa ON pa.plan_id = fp.id
        GROUP BY fp.category, pa.currency ORDER BY fp.category, pa.currency`, values),
      pool.query(`${filteredPlans}
        SELECT COALESCE(fp.sector_name, 'Unassigned') AS sector,
          COUNT(DISTINCT fp.id)::int AS plans,
          COUNT(DISTINCT fp.id) FILTER (WHERE fp.status = 'FINALLY_APPROVED')::int AS approved,
          COUNT(DISTINCT st.id) FILTER (WHERE st.status NOT IN ('Completed','NotApplicable') AND COALESCE(st.revised_date, st.original_date) < CURRENT_DATE)::int AS delayed
        FROM filtered_plans fp
        LEFT JOIN procurement_activities pa ON pa.plan_id = fp.id
        LEFT JOIN activity_stages st ON st.activity_id = pa.id
        GROUP BY COALESCE(fp.sector_name, 'Unassigned') ORDER BY plans DESC, sector`, values),
      pool.query(`${filteredPlans}
        SELECT date_trunc('month', created_at)::date AS month, COUNT(*)::int AS count
        FROM filtered_plans WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY month ORDER BY month`, values),
      pool.query(`${filteredPlans}
        SELECT date_trunc('month', finally_approved_at)::date AS month, COUNT(*)::int AS count
        FROM filtered_plans
        WHERE finally_approved_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY month ORDER BY month`, values),
      pool.query(`${filteredPlans}
        SELECT c.currency,
          COALESCE(SUM(c.current_amount), 0)::float AS contract_value,
          COALESCE(SUM(COALESCE(pay.paid, 0)), 0)::float AS paid,
          COALESCE(SUM(c.current_amount - COALESCE(pay.paid, 0)), 0)::float AS outstanding
        FROM contracts c
        JOIN procurement_activities pa ON pa.id = c.activity_id
        JOIN filtered_plans fp ON fp.id = pa.plan_id
        LEFT JOIN (SELECT contract_id, SUM(amount) FILTER (WHERE status = 'Paid') AS paid FROM payments GROUP BY contract_id) pay ON pay.contract_id = c.id
        GROUP BY c.currency ORDER BY c.currency`, values),
      pool.query(`${filteredPlans}
        SELECT fp.id, fp.reference, fp.name, fp.project_name, fp.sector_name, fp.status,
          COALESCE((CURRENT_DATE - COALESCE(fp.director_decided_at, fp.submitted_at, fp.updated_at)::date), 0)::int AS days_waiting,
          COALESCE(json_agg(json_build_object('currency', totals.currency, 'amount', totals.amount)) FILTER (WHERE totals.currency IS NOT NULL), '[]') AS values
        FROM filtered_plans fp
        LEFT JOIN (SELECT plan_id, currency, SUM(amount)::float AS amount FROM procurement_activities GROUP BY plan_id, currency) totals ON totals.plan_id = fp.id
        WHERE fp.status IN ('SUBMITTED_TO_DIRECTOR','COMMITTEE_REVIEW','MANAGEMENT_REVIEW')
        GROUP BY fp.id, fp.reference, fp.name, fp.project_name, fp.sector_name, fp.status, fp.director_decided_at, fp.submitted_at, fp.updated_at
        ORDER BY days_waiting DESC, fp.reference LIMIT 10`, values),
    ]);

    const base = overview.rows[0];
    const totalPlans = base.total_plans || 0;
    const applicableStages = base.applicable_stages || 0;
    const monthMap = new Map();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const key = date.toISOString().slice(0, 10);
      monthMap.set(key, { month: key, created: 0, approved: 0 });
    }
    monthlyCreated.rows.forEach((row) => { const key = new Date(row.month).toISOString().slice(0, 10); if (monthMap.has(key)) monthMap.get(key).created = row.count; });
    monthlyApproved.rows.forEach((row) => { const key = new Date(row.month).toISOString().slice(0, 10); if (monthMap.has(key)) monthMap.get(key).approved = row.count; });

    res.json({
      generatedAt: new Date().toISOString(),
      selectedFilters: selected,
      filters: filterOptions.rows[0],
      overview: {
        totalPlans,
        approvedPlans: base.approved_plans || 0,
        approvalRate: totalPlans ? Math.round((base.approved_plans / totalPlans) * 100) : 0,
        awaitingDecision: base.awaiting_decision || 0,
        rejectedPlans: base.rejected_plans || 0,
        delayedStages: base.delayed_stages || 0,
        completedStages: base.completed_stages || 0,
        applicableStages,
        completionRate: applicableStages ? Math.round((base.completed_stages / applicableStages) * 100) : 0,
        activeContracts: base.active_contracts || 0,
      },
      procurementValue: valuesByCurrency.rows,
      statusMix: statusMix.rows,
      categoryMix: categoryMix.rows,
      sectorPerformance: sectorPerformance.rows.map((row) => ({ ...row, approvalRate: row.plans ? Math.round((row.approved / row.plans) * 100) : 0 })),
      monthlyTrend: [...monthMap.values()],
      contractExposure: contractExposure.rows,
      decisionQueue: decisionQueue.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
