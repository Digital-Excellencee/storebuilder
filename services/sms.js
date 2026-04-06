const { sanitizePhone } = require('../helpers/html');

function buildOtpMessage(template, storeName, otp) {
  return String(template || 'Your OTP for {{STORE}} is {{OTP}}')
    .replace(/\{\{STORE\}\}/g, storeName || 'your store')
    .replace(/\{\{OTP\}\}/g, otp);
}

async function sendFast2SmsOtp(store, phone, otp) {
  const app = store && store.apps && store.apps.fast2sms;
  if (!app || !app.installed || !app.configured || !app.apiKey) {
    console.log(`[OTP SKIPPED] ${phone} -> ${otp}`);
    return false;
  }
  const cleanPhone = sanitizePhone(phone || '');
  if (!cleanPhone) return false;
  const message = buildOtpMessage(app.template, store && store.name, otp);
  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: app.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: app.route || 'q',
        sender_id: app.senderId || 'FSTSMS',
        message,
        language: 'english',
        numbers: cleanPhone
      })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[FAST2SMS ERROR] ${response.status} ${text}`);
      return false;
    }
    console.log(`[FAST2SMS SENT] ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error(`[FAST2SMS ERROR] ${error.message}`);
    return false;
  }
}

module.exports = {
  sendFast2SmsOtp,
  buildOtpMessage
};
