const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const unread = await pool.query("SELECT COUNT(*)::int AS count FROM alerts WHERE recipient_id = $1 AND status = 'unread'", [req.user.id]);

    if (req.user.role === 'officer') {
      const projects = await pool.query("SELECT COUNT(*)::int AS count FROM project_assignments WHERE officer_id = $1 AND is_active", [req.user.id]);
      const byStatus = await pool.query('SELECT status, COUNT(*)::int AS count FROM procurement_plans WHERE created_by = $1 GROUP BY status', [req.user.id]);
      const missingPlannedDates = await pool.query(
        `SELECT COUNT(*)::int AS count FROM activity_stages s JOIN procurement_activities a ON a.id = s.activity_id
         JOIN procurement_plans pp ON pp.id = a.plan_id WHERE pp.created_by = $1 AND s.original_date IS NULL`, [req.user.id]
      );
      const delayedStages = await pool.query(
        `SELECT COUNT(*)::int AS count FROM activity_stages s JOIN procurement_activities a ON a.id = s.activity_id
         JOIN procurement_plans pp ON pp.id = a.plan_id
         WHERE pp.created_by = $1 AND s.status NOT IN ('Completed','NotApplicable')
           AND COALESCE(s.revised_date, s.original_date) < CURRENT_DATE`, [req.user.id]
      );
      return res.json({
        role: 'officer',
        assignedProjects: projects.rows[0].count,
        plansByStatus: byStatus.rows,
        unreadAlerts: unread.rows[0].count,
        activitiesNeedingPlannedDates: missingPlannedDates.rows[0].count,
        delayedStages: delayedStages.rows[0].count,
      });
    }

    if (req.user.role === 'director') {
      const awaitingReview = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'SUBMITTED_TO_DIRECTOR'");
      const committeeReview = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'COMMITTEE_REVIEW'");
      const finallyApproved = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'FINALLY_APPROVED'");
      const returned = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'RETURNED_FOR_CORRECTION'");
      const projects = await pool.query("SELECT COUNT(*)::int AS count FROM projects WHERE status = 'Active'");
      const recentReplans = await pool.query(
        `SELECT ar.old_date, ar.new_date, ar.reason, ar.changed_at, s.name AS stage_name, pp.reference AS plan_reference
         FROM activity_revisions ar
         JOIN activity_stages s ON s.id = ar.stage_id
         JOIN procurement_activities pa ON pa.id = s.activity_id
         JOIN procurement_plans pp ON pp.id = pa.plan_id
         ORDER BY ar.changed_at DESC LIMIT 10`
      );
      return res.json({
        role: 'director',
        activeProjects: projects.rows[0].count,
        plansAwaitingReview: awaitingReview.rows[0].count,
        plansInCommitteeReview: committeeReview.rows[0].count,
        plansFinallyApproved: finallyApproved.rows[0].count,
        plansReturned: returned.rows[0].count,
        recentReplans: recentReplans.rows,
        unreadAlerts: unread.rows[0].count,
      });
    }

    if (req.user.role === 'committee') {
      const pending = await pool.query(
        `SELECT COUNT(*)::int AS count FROM procurement_plans pp
         WHERE pp.status = 'COMMITTEE_REVIEW'
         AND NOT EXISTS (SELECT 1 FROM committee_votes cv WHERE cv.plan_id = pp.id AND cv.member_id = $1)`,
        [req.user.id]
      );
      const myDecisions = await pool.query('SELECT decision, COUNT(*)::int AS count FROM committee_votes WHERE member_id = $1 GROUP BY decision', [req.user.id]);
      const open = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'COMMITTEE_REVIEW'");
      const pendingPlans = await pool.query(
        `SELECT pp.id, pp.reference, pp.name, p.name AS project_name,
                (CURRENT_DATE - pp.director_decided_at::date)::int AS days_waiting,
                COUNT(cv.id)::int AS votes_cast
         FROM procurement_plans pp JOIN projects p ON p.id = pp.project_id
         LEFT JOIN committee_votes cv ON cv.plan_id = pp.id
         WHERE pp.status = 'COMMITTEE_REVIEW'
           AND NOT EXISTS (SELECT 1 FROM committee_votes mine WHERE mine.plan_id = pp.id AND mine.member_id = $1)
         GROUP BY pp.id, p.name ORDER BY pp.director_decided_at NULLS LAST LIMIT 8`, [req.user.id]
      );
      const valueUnderReview = await pool.query(
        `SELECT pa.currency, COALESCE(SUM(pa.amount), 0)::float AS amount
         FROM procurement_activities pa JOIN procurement_plans pp ON pp.id = pa.plan_id
         WHERE pp.status = 'COMMITTEE_REVIEW' GROUP BY pa.currency ORDER BY pa.currency`
      );
      const participation = await pool.query(
        `SELECT u.id, u.name, COUNT(cv.id)::int AS votes_cast
         FROM committee_members cm JOIN users u ON u.id = cm.user_id
         LEFT JOIN committee_votes cv ON cv.member_id = u.id
           AND cv.plan_id IN (SELECT id FROM procurement_plans WHERE status = 'COMMITTEE_REVIEW')
         WHERE cm.is_active GROUP BY u.id, u.name ORDER BY u.name`
      );
      const recentDecisions = await pool.query(
        `SELECT cv.id, cv.plan_id, cv.decision, cv.voted_at, pp.reference, pp.name AS plan_name
         FROM committee_votes cv JOIN procurement_plans pp ON pp.id = cv.plan_id
         WHERE cv.member_id = $1 ORDER BY cv.voted_at DESC LIMIT 6`, [req.user.id]
      );
      const openCount = open.rows[0].count;
      const memberParticipation = participation.rows.map((row) => ({
        id: row.id, name: row.name, votesCast: row.votes_cast,
        rate: openCount ? Math.round((row.votes_cast / openCount) * 100) : 0,
      }));
      const totalPossibleVotes = openCount * memberParticipation.length;
      const totalVotesCast = memberParticipation.reduce((sum, member) => sum + member.votesCast, 0);
      return res.json({
        role: 'committee',
        plansPendingMyVote: pending.rows[0].count,
        openCommitteePlans: openCount,
        myDecisions: myDecisions.rows,
        pendingPlans: pendingPlans.rows.map((row) => ({ id: row.id, reference: row.reference, name: row.name, projectName: row.project_name, daysWaiting: Math.max(row.days_waiting || 0, 0), votesCast: row.votes_cast })),
        valueUnderReview: valueUnderReview.rows,
        memberParticipation,
        participationRate: totalPossibleVotes ? Math.round((totalVotesCast / totalPossibleVotes) * 100) : 0,
        recentDecisions: recentDecisions.rows.map((row) => ({ id: row.id, planId: row.plan_id, decision: row.decision, votedAt: row.voted_at, reference: row.reference, planName: row.plan_name })),
        unreadAlerts: unread.rows[0].count,
      });
    }

    if (req.user.role === 'management') {
      const awaiting = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'MANAGEMENT_REVIEW'");
      const approved = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'FINALLY_APPROVED'");
      const rejected = await pool.query("SELECT COUNT(*)::int AS count FROM procurement_plans WHERE status = 'REJECTED_BY_MANAGEMENT'");
      return res.json({
        role: 'management',
        plansAwaitingManagement: awaiting.rows[0].count,
        plansFinallyApproved: approved.rows[0].count,
        plansRejectedByManagement: rejected.rows[0].count,
        unreadAlerts: unread.rows[0].count,
      });
    }

    // admin
    const users = await pool.query('SELECT role, COUNT(*)::int AS count FROM users WHERE is_active GROUP BY role');
    const committeeSize = await pool.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active');
    const managementSize = await pool.query('SELECT COUNT(*)::int AS count FROM management_members WHERE is_active');
    res.json({ role: 'admin', usersByRole: users.rows, activeCommitteeMembers: committeeSize.rows[0].count, activeManagementMembers: managementSize.rows[0].count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
