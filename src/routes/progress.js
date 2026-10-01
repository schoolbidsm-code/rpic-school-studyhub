const express = require('express');
const { db } = require('../db');
const { requireStudent } = require('../auth');

const router = express.Router();

const SUBJECTS = ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Computer'];

function computeProgress(studentId) {
  const rows = db.prepare("SELECT subject, MAX(score) best, MAX(max_marks) mm, COUNT(*) attempts, ROUND(AVG(accuracy),1) avg_acc, SUM(correct) c, SUM(max_marks) tot FROM tests WHERE student_id=? AND status='submitted' GROUP BY subject").all(studentId);
  const bySubject = {};
  for (const s of SUBJECTS) {
    const r = rows.find(x => (x.subject || '').toLowerCase() === s.toLowerCase());
    bySubject[s] = r ? { best: r.best, max_marks: r.mm || 100, attempts: r.attempts, accuracy: r.avg_acc, percent: r.mm ? Math.round((r.best / r.mm) * 1000) / 10 : 0 } : { best: 0, max_marks: 0, attempts: 0, accuracy: 0, percent: 0, not_attempted: true };
  }
  const overall = db.prepare("SELECT COUNT(*) tests_done, ROUND(AVG(accuracy),1) acc FROM tests WHERE student_id=? AND status='submitted'").get(studentId);
  const streak = db.prepare('SELECT count FROM study_streaks WHERE student_id=?').get(studentId);
  const coins = db.prepare('SELECT COALESCE(SUM(delta),0) b FROM bip_ledger WHERE student_id=?').get(studentId).b;
  const totalPct = rows.length ? Math.round(rows.reduce((a, r) => a + (r.mm ? r.best / r.mm : 0), 0) / rows.length * 1000) / 10 : 0;
  return { bySubject, tests_completed: overall.tests_done || 0, overall_accuracy: overall.acc || 0, overall_percent: totalPct, streak: streak ? streak.count : 0, bip_coins: coins };
}

router.get('/api/progress', requireStudent, (req, res) => {
  res.json({ ok: true, progress: computeProgress(req.studentId) });
});

router.get('/api/exams', (req, res) => {
  const rows = db.prepare('SELECT * FROM exam_dates ORDER BY exam_date').all();
  res.json({ ok: true, exams: rows, server_time: new Date().toISOString() });
});

module.exports = { router, computeProgress };
