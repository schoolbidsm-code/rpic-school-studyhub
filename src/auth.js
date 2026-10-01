const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, getSetting } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'rpic-dev-secret-CHANGE-ME';

// ---- OTP provider interface ----
// Production: set OTP_PROVIDER ("msg91" | "twilio") + its credentials in .env
// Without a configured provider the app DOES NOT send SMS. The generated code is
// written to the server log only, for the admin's own first-time testing.
function otpProviderConfigured() {
  const p = process.env.OTP_PROVIDER;
  if (p === 'msg91') return !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID && process.env.MSG91_TEMPLATE_ID);
  if (p === 'twilio') return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  return false;
}

async function sendOtpSms(mobile, code) {
  if (!otpProviderConfigured()) {
    console.log(`[OTP DEV MODE - no provider configured] OTP for ${mobile}: ${code}`);
    return { sent: false, dev: true };
  }
  if (process.env.OTP_PROVIDER === 'msg91') {
    const url = `https://control.msg91.com/api/v5/flow/`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'authkey': process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobiles: `91${mobile}`, OTP: code, sender: process.env.MSG91_SENDER_ID })
    });
    if (!res.ok) throw new Error('OTP provider error');
    return { sent: true };
  }
  if (process.env.OTP_PROVIDER === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: `+91${mobile}`, From: process.env.TWILIO_FROM, Body: `RPIC School: Aapka OTP hai ${code}. Yeh kisi ke saath share na karein.` })
    });
    if (!res.ok) throw new Error('OTP provider error');
    return { sent: true };
  }
  throw new Error('OTP provider not supported');
}

function issueOtp(mobile) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = bcrypt.hashSync(code, 8);
  db.prepare('INSERT INTO otp_codes(mobile, code_hash, expires_at) VALUES (?,?,?)').run(mobile, hash, Date.now() + 10 * 60 * 1000);
  return code;
}
function verifyOtp(mobile, code) {
  const row = db.prepare('SELECT * FROM otp_codes WHERE mobile=? AND used=0 ORDER BY id DESC LIMIT 1').get(mobile);
  if (!row || row.expires_at < Date.now()) return false;
  const ok = bcrypt.compareSync(String(code), row.code_hash);
  if (ok) db.prepare('UPDATE otp_codes SET used=1 WHERE id=?').run(row.id);
  return ok;
}

function studentToken(s) {
  return jwt.sign({ sub: s.id, role: 'student' }, JWT_SECRET, { expiresIn: '30d' });
}
function adminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}
function readAuth(req) {
  const t = req.cookies && req.cookies.rpic_token;
  if (!t) return null;
  try { return jwt.verify(t, JWT_SECRET); } catch { return null; }
}
function requireStudent(req, res, next) {
  const a = readAuth(req);
  if (!a || a.role !== 'student') return res.status(401).json({ error: 'Login required' });
  req.studentId = a.sub;
  const s = db.prepare('SELECT * FROM students WHERE id=?').get(a.sub);
  if (!s) return res.status(401).json({ error: 'Login required' });
  req.student = s;
  next();
}
function requireAdmin(req, res, next) {
  const a = readAuth(req);
  if (!a || a.role !== 'admin') return res.status(401).json({ error: 'Admin login required' });
  next();
}
function adminPassword() { return process.env.ADMIN_PASSWORD || null; }

module.exports = { sendOtpSms, otpProviderConfigured, issueOtp, verifyOtp, studentToken, adminToken, requireStudent, requireAdmin, adminPassword, JWT_SECRET };
