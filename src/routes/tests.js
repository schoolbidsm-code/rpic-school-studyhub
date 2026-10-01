const express = require('express');
const { db, getSetting, setSetting } = require('../db');
const { requireStudent } = require('../auth');

const router = express.Router();

router.get('/api/questions', requireStudent, (req, res) => {
  const { subject, chapter, limit } = req.query;
  let rows;
  if (subject) rows = db.prepare('SELECT id, subject, chapter, type, question, options_json, year, set_no, source_pdf FROM questions WHERE approved=1 AND subject=? ORDER BY id LIMIT ?').all(String(subject), Number(limit) || 50);
  else rows = db.prepare('SELECT id, subject, chapter, type, question, options_json, year, set_no, source_pdf FROM questions WHERE approved=1 ORDER BY id LIMIT ?').all(Number(limit) || 50);
  rows.forEach(r => r.options = r.options_json ? JSON.parse(r.options_json) : null);
  res.json({ ok: true, questions: rows });
});

// create a test with N real approved questions
router.post('/api/tests', requireStudent, (req, res) => {
  const { subject, count, mode } = req.body || {};
  const n = [20, 30, 40, 50, 75, 100].includes(Number(count)) ? Number(count) : 20;
  let qs;
  if (subject) qs = db.prepare('SELECT id FROM questions WHERE approved=1 AND subject=? ORDER BY RANDOM() LIMIT ?').all(String(subject), n);
  else qs = db.prepare('SELECT id FROM questions WHERE approved=1 ORDER BY RANDOM() LIMIT ?').all(n);
  if (qs.length < 1) return res.status(400).json({ error: 'Is subject me abhi approved questions nahi hain. Admin se question bank bharein.' });
  const r = db.prepare('INSERT INTO tests(student_id, subject, mode, q_ids_json) VALUES (?,?,?,?)')
    .run(req.studentId, subject || null, mode || 'mock', JSON.stringify(qs.map(q => q.id)));
  const t = db.prepare('SELECT * FROM tests WHERE id=?').get(r.lastInsertRowid);
  t.questions = qs.map(q => db.prepare('SELECT id, subject, chapter, type, question, options_json FROM questions WHERE id=?').get(q.id))
    .map(q => ({ ...q, options: q.options_json ? JSON.parse(q.options_json) : null }));
  res.json({ ok: true, test: t });
});

// autosave answers
router.post('/api/tests/:id/save', requireStudent, (req, res) => {
  const t = db.prepare('SELECT * FROM tests WHERE id=? AND student_id=?').get(req.params.id, req.studentId);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  if (t.status !== 'in_progress') return res.status(400).json({ error: 'Test already submitted' });
  db.prepare('UPDATE tests SET answers_json=? WHERE id=?').run(JSON.stringify(req.body.answers || {}), t.id);
  res.json({ ok: true });
});

router.post('/api/tests/:id/submit', requireStudent, (req, res) => {
  const t = db.prepare('SELECT * FROM tests WHERE id=? AND student_id=?').get(req.params.id, req.studentId);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  if (t.status !== 'in_progress') return res.json({ ok: true, test: t });
  const answers = req.body && req.body.answers ? req.body.answers : (t.answers_json ? JSON.parse(t.answers_json) : {});
  const ids = JSON.parse(t.q_ids_json);
  let correct = 0, incorrect = 0, unanswered = 0, score = 0, maxMarks = 0;
  const detail = [];
  for (const qid of ids) {
    const q = db.prepare('SELECT * FROM questions WHERE id=?').get(qid);
    if (!q) continue;
    maxMarks += 1;
    const given = answers[qid];
    if (given === undefined || given === '' || given === null) { unanswered++; detail.push({ qid, given, answer: q.answer, correct: null }); }
    else if (String(given).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) { correct++; score += 1; detail.push({ qid, given, answer: q.answer, correct: true }); }
    else { incorrect++; detail.push({ qid, given, answer: q.answer, correct: false }); }
  }
  const accuracy = maxMarks ? Math.round((correct / maxMarks) * 1000) / 10 : 0;
  const timeTaken = req.body && req.body.time_taken ? Number(req.body.time_taken) : Math.round((Date.now() - new Date(t.started_at + 'Z').getTime()) / 1000);
  db.prepare(`UPDATE tests SET answers_json=?, score=?, max_marks=?, correct=?, incorrect=?, unanswered=?, accuracy=?, time_taken=?, status='submitted', submitted_at=datetime('now') WHERE id=?`)
    .run(JSON.stringify(answers), score, maxMarks, correct, incorrect, unanswered, accuracy, timeTaken, t.id);
  // BIP coins: educational points only, no money value
  db.prepare('INSERT INTO bip_ledger(student_id, delta, reason) VALUES (?,?,?)').run(req.studentId, correct, `Test #${t.id}`);
  const updated = db.prepare('SELECT * FROM tests WHERE id=?').get(t.id);
  updated.detail = detail;
  res.json({ ok: true, test: updated });
});

router.get('/api/tests/:id', requireStudent, (req, res) => {
  const t = db.prepare('SELECT * FROM tests WHERE id=? AND student_id=?').get(req.params.id, req.studentId);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  t.detail = null;
  res.json({ ok: true, test: t });
});

router.get('/api/tests', requireStudent, (req, res) => {
  const rows = db.prepare('SELECT id, subject, mode, score, max_marks, correct, incorrect, unanswered, accuracy, time_taken, status, started_at, submitted_at FROM tests WHERE student_id=? ORDER BY id DESC').all(req.studentId);
  res.json({ ok: true, tests: rows });
});

module.exports = router;
