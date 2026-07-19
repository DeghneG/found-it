function requireAuth(req, res, next) {
  // Bypass auth for now
  if (!req.session.userId) {
    req.session.userId = '00000000-0000-0000-0000-000000000000';
    req.session.userName = 'Guest User';
    req.session.userEmail = 'guest@usa.edu.ph';
    req.session.isAdmin = true;
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

module.exports = { requireAuth, requireAdmin };
