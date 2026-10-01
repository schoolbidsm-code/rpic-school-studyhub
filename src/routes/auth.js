const express = require('express');
const bcrypt = require('bcryptjs');
const { db, nextDocId } = require('../db');
const { sendOtpSms, otpProviderConfigured, issueOtp, verifyOtp, studentToken, adminToken, adminPassword } = require('../auth');

const router = express.Router();

router.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body || {};
    if (!/^[6-9]\d{9}$/.test(String(mobile || ''))) return res.status(400).json({ error: 'Sahi 10 digit mobile number bhejein' });
    const m = String(mobile);
    let s = db.prepare('SELECT * FROM students WHERE mobile=?').get(m);
    let isNew = false;
    if (!s) {
      isNew = true;
      const c = db.prepare('SELECT COUNT(*) c FROM students').get().c;
      s = { id: null, student_code: `RPIC-STU-2026-${String(c + 1).padStart(4, '0')}` };
    }
    const code = issueOtp(m);
    const out = await sendOtpSms(m, code);
    res.json({ ok: true, new_user: isNew, otp_sent: out.sent, dev_notice: out.dev ? 'OTP server log me gaya hai (SMS provider configured nahi hai). Production ke liye OTP provider set karein.' : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/auth/verify-otp', (req, res) => {
  const { mobile, code, name } = req.body || {};
  if (!/^[6-9]\d{9}$/.test(String(mobile || ''))) return res.status(400).json({ error: 'Invalid mobile' });
  if (!verifyOtp(String(mobile), String(code))) return res.status(400).json({ error: 'OTP galat hai ya expire ho gaya' });
  let s = db.prepare('SELECT * FROM students WHERE mobile=?').get(String(mobile));
  if (!s) {
    const c = db.prepare('SELECT COUNT(*) c FROM students').get().c;
    const student_code = `RPIC-STU-2026-${String(c + 1).padStart(4, '0')}`;
    const r = db.prepare('INSERT INTO students(name, mobile, student_code) VALUES (?,?,?)')
      .run(String(name || 'Student'), String(mobile), student_code);
    s = db.prepare('SELECT * FROM students WHERE id=?').get(r.lastInsertRowid);
  }
  db.prepare('INSERT INTO login_activity(student_id, device) VALUES (?,?)').run(s.id, (req.headers['user-agent'] || '').slice(0, 200));
  const token = studentToken(s);
  res.cookie('rpic_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true, student: { id: s.id, name: s.name, student_code: s.student_code } });
});

router.post('/api/auth/logout', (req, res) => {
  const { readAuth } = require('../auth');
  const a = readAuth(req);
  if (a && a.role === 'student') db.prepare("UPDATE login_activity SET logout_at=datetime('now') WHERE student_id=? AND logout_at IS NULL").run(a.sub);
  res.clearCookie('rpic_token').json({ ok: true });
});

router.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!adminPassword()) return res.status(400).json({ error: 'Admin password .env me set nahi hai (ADMIN_PASSWORD)' });
  if (password !== adminPassword()) return res.status(401).json({ error: 'Galat password' });
  const token = adminToken();
  res.cookie('rpic_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 3600 * 1000 });
  res.json({ ok: true });
});

router.get('/api/config', (req, res) => {
  res.json({ otp_configured: otpProviderConfigured(), razorpay_configured: require('../razorpay').configured() });
});

module.exports = router;
