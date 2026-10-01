const { getSetting, setSetting } = require('./db');

function keyId() { return process.env.RAZORPAY_KEY_ID || null; }
function keySecret() { return process.env.RAZORPAY_KEY_SECRET || null; }
function webhookSecret() { return process.env.RAZORPAY_WEBHOOK_SECRET || null; }
function configured() { return !!(keyId() && keySecret()); }
function client() {
  if (!configured()) return null;
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: keyId(), key_secret: keySecret() });
}
async function validateConfig() {
  if (!configured()) return { status: 'not_configured' };
  try {
    const rzp = client();
    await rzp.payments.all({ count: 1 });
    return { status: 'connected', mode: keyId().startsWith('rzp_live') ? 'live' : 'test' };
  } catch (e) {
    return { status: 'failed', error: e.message };
  }
}
module.exports = { configured, client, keyId, webhookSecret, validateConfig };
