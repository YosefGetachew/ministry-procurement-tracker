const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const COOKIE_NAME = 'token';
const SESSION_HOURS = 12;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Only failed attempts should count toward the limit. Counting successful
  // sign-ins can lock a shared ministry workstation out during normal use.
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many unsuccessful login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = $1 AND is_active', [email]);
    const user = rows[0];
    const match = user && await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.must_change_password };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).send();
});

router.get('/me', requireAuth, (req, res) => {
  pool.query('SELECT must_change_password FROM users WHERE id = $1', [req.user.id])
    .then(({ rows }) => res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, mustChangePassword: rows[0]?.must_change_password || false }))
    .catch((err) => res.status(500).json({ error: 'Unable to load current user' }));
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!currentPassword || newPassword.length < 10) return res.status(400).json({ error: 'Current password and a new password of at least 10 characters are required' });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'The new password must be different' });
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND is_active', [req.user.id]);
    if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) return res.status(401).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [passwordHash, req.user.id]);
    const payload = { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, mustChangePassword: false };
    res.cookie(COOKIE_NAME, jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` }), cookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
