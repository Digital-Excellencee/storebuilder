const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2$120000$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const value = String(passwordHash || '');
  if (!value.startsWith('pbkdf2$')) {
    return false;
  }
  const parts = value.split('$');
  if (parts.length !== 4) {
    return false;
  }
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  const actual = crypto.pbkdf2Sync(String(password || ''), salt, iterations, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch (error) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
