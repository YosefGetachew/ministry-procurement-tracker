const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const pool = require('../db');
const { sendCommitteeInvitation } = require('../email');

const ROLES = ['officer', 'director', 'committee', 'management', 'admin'];
const COMMITTEE_TYPES = { endorsing: { role: 'committee', table: 'committee_members' }, management: { role: 'management', table: 'management_members' } };

function temporaryPassword() {
  return `${randomBytes(7).toString('base64url')}aA7!`;
}

function serializeUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone || '', biography: row.biography || '', role: row.role, isActive: row.is_active, mustChangePassword: row.must_change_password, createdAt: row.created_at };
}

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(serializeUser));
  } catch (err) {
    next(err);
  }
});

router.post('/users', async (req, res, next) => {
  const { name, email, password, role } = req.body;
  const phone = String(req.body.phone || '').trim();
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'email is required' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  if (phone && !/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), phone, passwordHash, role]
    );
    res.status(201).json(serializeUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists' });
    next(err);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  const { role, isActive } = req.body;
  if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
  if (isActive !== undefined && typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be a boolean' });

  const sets = [];
  const values = [];
  let i = 1;
  if (role !== undefined) { sets.push(`role = $${i++}`); values.push(role); }
  if (isActive !== undefined) { sets.push(`is_active = $${i++}`); values.push(isActive); }
  if (!sets.length) return res.status(400).json({ error: 'No editable fields provided' });

  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(serializeUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/committee', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT cm.*, u.name, u.email FROM committee_members cm JOIN users u ON u.id = cm.user_id ORDER BY cm.created_at`
    );
    res.json(rows.map((row) => ({ id: row.id, userId: row.user_id, name: row.name, email: row.email, isActive: row.is_active })));
  } catch (err) {
    next(err);
  }
});

router.post('/committee', async (req, res, next) => {
  const userId = Number(req.body.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'userId is required' });
  try {
    const { rows: users } = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'committee' AND is_active", [userId]);
    if (!users.length) return res.status(400).json({ error: 'userId must belong to an active user with the committee role' });

    const { rows: activeCount } = await pool.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active');
    if (activeCount[0].count >= 5) return res.status(409).json({ error: 'The committee already has 5 active members' });

    const { rows } = await pool.query(
      `INSERT INTO committee_members (user_id, is_active) VALUES ($1, true)
       ON CONFLICT (user_id) DO UPDATE SET is_active = true RETURNING *`,
      [userId]
    );
    res.status(201).json({ id: rows[0].id, userId: rows[0].user_id, isActive: rows[0].is_active });
  } catch (err) {
    next(err);
  }
});

router.patch('/committee/:id', async (req, res, next) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });
  try {
    const { rows } = await pool.query('UPDATE committee_members SET is_active = $1 WHERE id = $2 RETURNING *', [req.body.isActive, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Committee member not found' });
    res.json({ id: rows[0].id, userId: rows[0].user_id, isActive: rows[0].is_active });
  } catch (err) {
    next(err);
  }
});

router.get('/committees', async (req, res, next) => {
  try {
    const [endorsing, management] = await Promise.all([
      pool.query(`SELECT cm.id, cm.user_id, cm.is_active, cm.created_at, u.name, u.email, u.phone, u.biography
                  FROM committee_members cm JOIN users u ON u.id = cm.user_id ORDER BY u.name`),
      pool.query(`SELECT mm.id, mm.user_id, mm.is_active, mm.created_at, mm.leadership_id, u.name, u.email, u.phone, u.biography, lr.position, s.name AS sector_name
                  FROM management_members mm JOIN users u ON u.id = mm.user_id
                  LEFT JOIN leadership_registry lr ON lr.id = mm.leadership_id LEFT JOIN sectors s ON s.id = lr.sector_id ORDER BY u.name`),
    ]);
    const serialize = (row) => ({ id: row.id, userId: row.user_id, leadershipId: row.leadership_id || null, position: row.position || '', sectorName: row.sector_name || '', name: row.name, email: row.email, phone: row.phone || '', biography: row.biography || '', isActive: row.is_active, createdAt: row.created_at });
    res.json({ endorsing: endorsing.rows.map(serialize), management: management.rows.map(serialize) });
  } catch (err) { next(err); }
});

router.post('/committees/register', async (req, res, next) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const biography = String(req.body.biography || '').trim();
  const committeeType = String(req.body.committeeType || '').trim();
  const leadershipId = req.body.leadershipId ? Number(req.body.leadershipId) : null;
  const definition = COMMITTEE_TYPES[committeeType];
  if (!definition) return res.status(400).json({ error: 'committeeType must be endorsing or management' });
  if (committeeType === 'endorsing') {
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (committeeType === 'endorsing') {
      const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active');
      if (rows[0].count >= 5) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The Endorsing Committee already has 5 active members' }); }
    }
    let resolved = { name, email, phone, biography };
    if (committeeType === 'management') {
      if (!Number.isInteger(leadershipId)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Select a registered Ministry leadership seat' }); }
      const { rows: leaders } = await client.query('SELECT * FROM leadership_registry WHERE id = $1 AND is_active', [leadershipId]);
      if (!leaders.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'The selected leadership record is not active' }); }
      resolved = { name: leaders[0].name, email: leaders[0].email, phone: leaders[0].phone, biography: leaders[0].biography || '' };
      const { rows: managementCount } = await client.query('SELECT COUNT(*)::int AS count FROM management_members WHERE is_active');
      if (managementCount[0].count >= 7) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'All seven Management Committee seats are filled' }); }
    }
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: users } = await client.query(
      `INSERT INTO users (name, email, phone, biography, password_hash, role, is_active, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,true,true) RETURNING *`,
      [resolved.name, resolved.email, resolved.phone, resolved.biography, passwordHash, definition.role]
    );
    const user = users[0];
    const { rows: memberships } = committeeType === 'management'
      ? await client.query('INSERT INTO management_members (user_id, leadership_id, is_active) VALUES ($1,$2,true) RETURNING *', [user.id, leadershipId])
      : await client.query('INSERT INTO committee_members (user_id, is_active) VALUES ($1,true) RETURNING *', [user.id]);
    const delivery = await sendCommitteeInvitation({ name: resolved.name, email: resolved.email, committeeType, temporaryPassword: password });
    await client.query('COMMIT');
    res.status(201).json({
      member: { id: memberships[0].id, userId: user.id, leadershipId, ...resolved, isActive: true },
      delivery: delivery.mode,
      message: delivery.mode === 'smtp' ? 'Invitation email sent' : `Invitation saved to development outbox (${delivery.filename})`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists' });
    next(err);
  } finally { client.release(); }
});

router.patch('/committees/:committeeType/:id', async (req, res, next) => {
  const definition = COMMITTEE_TYPES[req.params.committeeType];
  if (!definition) return res.status(400).json({ error: 'committeeType must be endorsing or management' });
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be a boolean' });
  try {
    if (req.params.committeeType === 'endorsing' && req.body.isActive) {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM committee_members WHERE is_active AND id <> $1', [req.params.id]);
      if (rows[0].count >= 5) return res.status(409).json({ error: 'The Endorsing Committee already has 5 active members' });
    }
    const { rows } = await pool.query(`UPDATE ${definition.table} SET is_active = $1 WHERE id = $2 RETURNING *`, [req.body.isActive, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Committee member not found' });
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [req.body.isActive, rows[0].user_id]);
    res.json({ id: rows[0].id, userId: rows[0].user_id, isActive: rows[0].is_active });
  } catch (err) { next(err); }
});

router.put('/committees/endorsing/:id', async (req, res, next) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const biography = String(req.body.biography || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  try {
    const { rows } = await pool.query(`
      UPDATE users u SET name = $1, email = $2, phone = $3, biography = $4
      FROM committee_members cm
      WHERE cm.id = $5 AND cm.user_id = u.id
      RETURNING u.id, u.name, u.email, u.phone, u.biography
    `, [name, email, phone, biography, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Endorsing Committee member not found' });
    res.json({ id: Number(req.params.id), userId: rows[0].id, ...rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists' });
    next(err);
  }
});

router.delete('/committees/:committeeType/:id', async (req, res, next) => {
  const definition = COMMITTEE_TYPES[req.params.committeeType];
  if (!definition) return res.status(400).json({ error: 'committeeType must be endorsing or management' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: members } = await client.query(`SELECT user_id FROM ${definition.table} WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!members.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Committee assignment not found' }); }
    const userId = members[0].user_id;
    const historyQuery = req.params.committeeType === 'endorsing'
      ? 'SELECT COUNT(*)::int AS count FROM committee_votes WHERE member_id = $1'
      : 'SELECT COUNT(*)::int AS count FROM management_decisions WHERE decided_by = $1';
    const { rows: history } = await client.query(historyQuery, [userId]);
    if (history[0].count > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This member has recorded committee decisions and cannot be removed. Deactivate the member instead to preserve approval history.' }); }
    await client.query('DELETE FROM alerts WHERE recipient_id = $1', [userId]);
    await client.query(`DELETE FROM ${definition.table} WHERE id = $1`, [req.params.id]);
    await client.query('DELETE FROM users WHERE id = $1 AND role = $2', [userId, definition.role]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') return res.status(409).json({ error: 'This member is referenced by system records and cannot be removed. Deactivate the member instead.' });
    next(err);
  } finally { client.release(); }
});

module.exports = router;
