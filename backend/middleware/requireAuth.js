const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    const passwordRoutes = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'];
    if (req.user.mustChangePassword && !passwordRoutes.includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ error: 'Change your temporary password before accessing procurement records', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = requireAuth;
