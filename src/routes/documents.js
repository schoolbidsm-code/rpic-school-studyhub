const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, nextOrderNo, notify } = require('../db');
const { requireStudent } = require('../auth');
const { generateDocument, verificationPayload, SUBJECT_LABELS } = require('../documents');
const { computeProgress } = require('./progress');

const router = express.Router();

function baseUrl(req) { return `${req.protocol}://${req.get('host')}`; }

router.post('/api/documents/certificate/generate', requireStudent, async (req, res) => {
  try {
    const prog = computeProgress(req.studentId);
    // eligibility: at least one submitted test exists
    if (!prog.tests_completed) return res.status(400).json({ error: 'Certificate eligible nahi hai: abhi koi completed test result nahi hai.' });
    const achievement = req.body && req.body.achievement ? String(req.body.achievement).slice(0, 120) : `Academic Performance - ${prog.overall_percent}%`;
    const out = await generateDocument('certificate', req.student, { achievement, baseUrl: baseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/documents/report/generate', requireStudent, async (req, res) => {
  try {
    const prog = computeProgress(req.studentId);
    if (!prog.tests_completed) return res.status(400).json({ error: 'Progress Report eligible nahi hai: abhi koi completed test result nahi hai.' });
    const subjectMarks = {};
    for (const [s, v] of Object.entries(prog.bySubject)) {
      const key = Object.keys(SUBJECT_LABELS).find(k => SUBJECT_LABELS[k] === s) || s.toLowerCase().replace(/ /g, '_');
      subjectMarks[key] = v.not_attempted ? 'Not Attempted' : `${v.best}/${v.max_marks}`;
    }
    subjectMarks.total = `${Object.values(prog.bySubject).reduce((a, v) => a + (v.best || 0), 0)}/${Object.values(prog.bySubject).reduce((a, v) => a + (v.max_marks || 0), 0)}`;
    subjectMarks.percentage = `${prog.overall_percent}%`;
    const out = await generateDocument('report', req.student, { subjectMarks, baseUrl: baseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/documents/id-card/generate', requireStudent, async (req, res) => {
  try {
    if (!req.student.photo_path) return res.status(400).json({ error: 'ID Card ke liye pehle profile photo lagayein.' });
    const out = await generateDocument('idcard', req.student, { baseUrl: baseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ID card physical order
router.post('/api/documents/id-card/order', requireStudent, (req, res) => {
  const a = req.body || {};
  if (!a.name || !a.mobile || !a.address) return res.status(400).json({ error: 'Name, mobile aur address zaroori hai' });
  const orderNo = nextOrderNo();
  const fee = Number(process.env.ID_CARD_ORDER_FEE || 50);
  db.prepare('INSERT INTO orders(order_no, student_id, kind, amount, status, address_json) VALUES (?,?,?,?,?,?)')
    .run(orderNo, req.studentId, 'idcard', fee, 'PENDING', JSON.stringify({ name: a.name, mobile: a.mobile, address: a.address, required_date: a.required_date || null }));
  notify('admin', null, 'Naya ID Card Order', `${orderNo} · ${a.name} · Rs ${fee} · ${req.student.student_code}`);
  res.json({ ok: true, order_no: orderNo, amount: fee, status: 'PENDING', delivery_status: 'Pending' });
});

router.get('/api/orders', requireStudent, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE student_id=? ORDER BY id DESC').all(req.studentId);
  rows.forEach(o => { if (o.address_json) o.address = JSON.parse(o.address_json); });
  res.json({ ok: true, orders: rows });
});

router.get('/api/documents', requireStudent, (req, res) => {
  const rows = db.prepare('SELECT doc_id, doc_type, status, created_at FROM documents WHERE student_id=? ORDER BY id DESC').all(req.studentId);
  res.json({ ok: true, documents: rows });
});

router.get('/api/files/:docId/:kind', requireStudent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE doc_id=? AND student_id=?').get(req.params.docId, req.studentId);
  if (!doc) return res.status(403).json({ error: 'Access Denied' });
  const file = req.params.kind === 'pdf' ? doc.pdf_path : doc.png_path;
  if (!file || !fs.existsSync(path.join(__dirname, '..', file))) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', req.params.kind === 'pdf' ? 'application/pdf' : 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.doc_id}.${req.params.kind}"`);
  res.sendFile(path.join(__dirname, '..', file));
});

module.exports = router;
