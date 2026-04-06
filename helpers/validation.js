function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function validatePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

module.exports = { validateEmail, validatePhone };
