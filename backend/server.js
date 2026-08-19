require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const pool = require('./db');
const constants = require('./constants');
const requireAuth = require('./middleware/requireAuth');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const myProjectsRoutes = require('./routes/myProjects');
const officerRoutes = require('./routes/officers');
const assignmentRoutes = require('./routes/assignments');
const planRoutes = require('./routes/plans');
const stageRoutes = require('./routes/stages');
const contractRoutes = require('./routes/contracts');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const executiveDashboardRoutes = require('./routes/executiveDashboard');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const sectorRoutes = require('./routes/sectors');
const settingsRoutes = require('./routes/settings');
const requireRole = require('./middleware/requireRole');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set (see .env.example)');
}

const app = express();

app.use(helmet());
app.use((req, res, next) => {
  req.traceId = req.get('x-request-id') || randomUUID();
  res.setHeader('x-request-id', req.traceId);
  next();
});
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const allowed = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  if (origin && origin !== allowed) return res.status(403).json({ error: 'Origin not allowed', traceId: req.traceId });
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable', message: err.message });
  }
});

app.get('/api/meta', (req, res) => {
  res.json(constants);
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/sectors', requireAuth, sectorRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/my-projects', requireAuth, myProjectsRoutes);
app.use('/api/officers', requireAuth, officerRoutes);
app.use('/api/assignments', requireAuth, assignmentRoutes);
app.use('/api/plans', requireAuth, planRoutes);
app.use('/api/stages', requireAuth, stageRoutes);
app.use('/api/contracts', requireAuth, contractRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/executive-dashboard', requireAuth, executiveDashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/admin', requireAuth, requireRole('admin'), adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', traceId: req.traceId });
});

app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: 'error', traceId: req.traceId, method: req.method, path: req.path, message: err.message }));
  res.status(500).json({ error: 'Internal server error', traceId: req.traceId });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Ministry of Agriculture procurement API running on http://localhost:${PORT}`);
});
