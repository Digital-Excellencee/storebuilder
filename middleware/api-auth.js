const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || config.SESSION_SECRET;

function verifyApiToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function requireApiAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized - No token' });
  }
  const decoded = verifyApiToken(auth.split(' ')[1]);
  if (!decoded || decoded.role !== 'vendor') {
    return res.status(401).json({ success: false, error: 'Unauthorized - Invalid token' });
  }
  req.apiUserId = decoded.userId;
  req.apiUserEmail = decoded.email;
  next();
}

module.exports = {
  verifyApiToken,
  requireApiAuth
};
