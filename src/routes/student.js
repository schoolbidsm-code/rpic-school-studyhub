const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { requireStudent } = require('../auth');

const router = express.Router();
const upload = multer({ dest: 'public/uploads', limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /image\//.test(f.mimetype)) });

router.get('/api/student/profile', requireStudent, (req, res) => {
  res.json({ ok: true, student: { ...req.student, photo_path: req.student.photo_path } });
});

router.put('/api/student/profile', requireStudent, (req, res) => {
  const { name, roll_no } = req.body || {};
  if (name) db.prepare('UPDATE students SET name=? WHERE id=?').run(String(name).slice(0, 60), req.studentId);
  if (roll_no !== undefined) db.prepare('UPDATE students SET roll_no=? WHERE id=?').run(String(roll_no || '').slice(0, 30), req.studentId);
  const s = db.prepare('SELECT * FROM students WHERE id=?').get(req.studentId);
  res.json({ ok: true, student: s });
});

router.post('/api/student/photo', requireStudent, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Photo nahi mili' });
  db.prepare('UPDATE students SET photo_path=? WHERE id=?').run(`uploads/${req.file.filename}`, req.studentId);
  res.json({ ok: true, photo_path: `uploads/${req.file.filename}` });
});

router.get('/api/student/bip', requireStudent, (req, res) => {
  const bal = db.prepare('SELECT COALESCE(SUM(delta),0) b FROM bip_ledger WHERE student_id=?').get(req.studentId).b;
  res.json({ ok: true, balance: bal });
});

router.post('/api/student/streak', requireStudent, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT * FROM study_streaks WHERE student_id=?').get(req.studentId);
  if (!row) db.prepare('INSERT INTO study_streaks(student_id,last_date,count) VALUES(?,?,1)').run(req.studentId, today);
  else if (row.last_date === today) { /* same day */ }
  else {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    db.prepare('UPDATE study_streaks SET last_date=?, count=? WHERE student_id=?').run(today, row.last_date === y ? row.count + 1 : 1, req.studentId);
  }
  const r = db.prepare('SELECT * FROM study_streaks WHERE student_id=?').get(req.studentId);
  res.json({ ok: true, streak: r.count });
});

module.exports = router;
