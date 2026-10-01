const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getSetting, setSetting, notify } = require('../db');
const { requireAdmin } = require('../auth');
const { downloadTemplates, TEMPLATES } = require('../documents');
const rzp = require('../razorpay');

const router = express.Router();
const pdfUpload = multer({ dest: 'data/admin_files', limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /pdf|image/.test(f.mimetype)) });

// admin uploads go to private storage, never to public/
fs.mkdirSync(path.join(__dirname, '..', 'data', 'admin_files'), { recursive: true });

router.get('/api/admin/stats', requireAdmin, (req, res) => {
  const students = db.prepare('SELECT COUNT(*) c FROM students').get().c;
  const active = db.prepare('SELECT COUNT(DISTINCT student_id) c FROM login_activity WHERE login_at > datetime("now", "-7 days")').get().c;
  const paid = db.prepare("SELECT COUNT(*) c FROM orders WHERE status='PAID'").get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(amount),0) a FROM orders WHERE status='PAID'").get().a;
  res.json({ ok: true, students, active_users_7d: active, paid_orders: paid, revenue });
});

router.get('/api/admin/students', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, student_code, name, mobile, class, session, roll_no, photo_path, created_at FROM students ORDER BY id DESC').all();
  res.json({ ok: true, students: rows });
});

router.get('/api/admin/login-activity', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT l.*, s.name, s.mobile FROM login_activity l JOIN students s ON s.id=l.student_id ORDER BY l.id DESC LIMIT 200`).all();
  res.json({ ok: true, activity: rows });
});

router.get('/api/admin/questions', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM questions ORDER BY id DESC LIMIT 200').all();
  rows.forEach(r => r.options = r.options_json ? JSON.parse(r.options_json) : null);
  res.json({ ok: true, questions: rows });
});

router.post('/api/admin/questions', requireAdmin, (req, res) => {
  const q = req.body || {};
  if (!q.subject || !q.question || !q.answer) return res.status(400).json({ error: 'subject, question, answer zaroori hai' });
  const r = db.prepare('INSERT INTO questions(subject, chapter, type, question, options_json, answer, explanation, source_pdf, page_no, year, set_no, approved, confidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1)')
    .run(q.subject, q.chapter || null, q.type || 'mcq', q.question, q.options ? JSON.stringify(q.options) : null, q.answer, q.explanation || null, q.source_pdf || null, q.page_no || null, q.year || null, q.set_no || null);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.post('/api/admin/questions/:id/approve', requireAdmin, (req, res) => {
  db.prepare('UPDATE questions SET approved=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// PDF upload: admin file stays private; extraction from text PDFs
router.post('/api/admin/pdfs', requireAdmin, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF nahi mila' });
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Product name zaroori hai' });
    const stored = path.join('data', 'admin_files', req.file.filename);
    let extraction = 'not-extracted';
    let created = 0;
    if (b.extract_questions === 'yes') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(path.join(__dirname, '..', stored));
        const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\(?(a|A)\)?[).]\s*/.test(line) && i > 0) {
            const qText = lines[i - 1];
            const opts = [];
            for (let j = i; j < lines.length && opts.length < 4; j++) {
              const m = lines[j].match(/^\(?([a-dA-D])\)?[).]\s*(.*)/);
              if (m) opts.push(m[2]); else break;
            }
            if (opts.length >= 2 && qText.length > 8) {
              db.prepare('INSERT INTO questions(subject, chapter, type, question, options_json, answer, source_pdf, approved, confidence) VALUES (?,?,?,?,?,?,?,0,0.5)')
                .run(b.subject || 'General', b.chapter || null, 'mcq', qText, JSON.stringify(opts), opts[0], b.name);
              created++;
            }
          }
        }
        extraction = created ? `draft-${created}-questions` : 'no-questions-detected';
      } catch (e) { extraction = 'extraction-failed: ' + e.message; }
    }
    const code = `RPIC-PDF-${Date.now().toString(36).toUpperCase()}`;
    db.prepare('INSERT INTO products(product_code, name, subject, class, session, price, mrp, description, pdf_path, status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(code, b.name, b.subject || null, b.class || '10', b.session || '2026-27', Number(b.price) || 50, Number(b.mrp) || Number(b.price) || 50, b.description || null, stored, 'active');
    res.json({ ok: true, product_code: code, extraction, draft_questions: created, notice: created ? `${created} draft questions bane hain, Admin > Questions me review karke approve karein.` : 'Extraction me koi question detect nahi hua. Question manually add karein.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/admin/products', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json({ ok: true, products: rows });
});

router.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  db.prepare('UPDATE products SET name=?, subject=?, price=?, mrp=?, description=?, status=? WHERE id=?')
    .run(b.name || p.name, b.subject || p.subject, b.price != null ? Number(b.price) : p.price, b.mrp != null ? Number(b.mrp) : p.mrp, b.description || p.description, b.status || p.status, p.id);
  res.json({ ok: true });
});

router.get('/api/admin/orders', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT o.*, s.name student_name, s.mobile, p.name product_name FROM orders o JOIN students s ON s.id=o.student_id LEFT JOIN products p ON p.id=o.product_id ORDER BY o.id DESC`).all();
  res.json({ ok: true, orders: rows });
});

router.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status, delivery_status } = req.body || {};
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (status) db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, o.id);
  if (delivery_status) db.prepare('UPDATE orders SET delivery_status=? WHERE id=?').run(delivery_status, o.id);
  if (status || delivery_status) {
    const label = [status, delivery_status].filter(Boolean).join(' / ');
    notify('student', o.student_id, `Order ${o.order_no}: ${label}`, 'Status update dekh lijiye.');
  }
  res.json({ ok: true });
});

router.get('/api/admin/downloads', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT d.*, s.name student_name, p.name product FROM downloads d JOIN students s ON s.id=d.student_id JOIN products p ON p.id=d.product_id ORDER BY d.id DESC LIMIT 200`).all();
  res.json({ ok: true, downloads: rows });
});

router.get('/api/admin/documents', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT d.*, s.name student_name FROM documents d JOIN students s ON s.id=d.student_id ORDER BY d.id DESC`).all();
  res.json({ ok: true, documents: rows });
});

// certificate status: draft/generated/verified/official - admin controlled
router.put('/api/admin/documents/:docId/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['draft', 'generated', 'verified', 'official'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE documents SET status=? WHERE doc_id=?').run(status, req.params.docId);
  res.json({ ok: true });
});

router.post('/api/admin/exams', requireAdmin, (req, res) => {
  const e = req.body || {};
  if (!e.exam_type || !e.exam_date || !e.exam_time) return res.status(400).json({ error: 'exam_type, exam_date, exam_time zaroori hai' });
  const r = db.prepare('INSERT INTO exam_dates(exam_type, subject, exam_date, exam_time, syllabus, max_marks) VALUES (?,?,?,?,?,?)')
    .run(e.exam_type, e.subject || null, e.exam_date, e.exam_time, e.syllabus || null, e.max_marks || 100);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.delete('/api/admin/exams/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM exam_dates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/api/admin/templates', requireAdmin, (req, res) => {
  const out = {};
  for (const [type, t] of Object.entries(TEMPLATES)) {
    const p = path.join(__dirname, '..', 'public', 'templates', t.file);
    out[type] = fs.existsSync(p) ? 'loaded' : 'not-loaded';
  }
  const maps = {};
  for (const type of Object.keys(TEMPLATES)) maps[type] = db.prepare('SELECT * FROM field_maps WHERE template_type=?').all(type);
  res.json({ ok: true, templates: out, maps });
});

router.post('/api/admin/templates/download', requireAdmin, async (req, res) => {
  const out = await downloadTemplates();
  res.json({ ok: true, result: out });
});

// template field mapping: save coordinates per field
router.post('/api/admin/field-map', requireAdmin, (req, res) => {
  const m = req.body || {};
  if (!m.template_type || !m.field) return res.status(400).json({ error: 'template_type aur field zaroori hai' });
  db.prepare(`INSERT INTO field_maps(template_type, field, x, y, w, h, font_size, color, align) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(template_type, field) DO UPDATE SET x=excluded.x, y=excluded.y, w=excluded.w, h=excluded.h, font_size=excluded.font_size, color=excluded.color, align=excluded.align`)
    .run(m.template_type, m.field, m.x, m.y, m.w || 20, m.h || 4, m.font_size || 2, m.color || '#111111', m.align || 'left');
  res.json({ ok: true });
});

router.delete('/api/admin/field-map/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM field_maps WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/api/admin/watermark', requireAdmin, (req, res) => {
  const w = db.prepare('SELECT * FROM watermark_settings WHERE id=1').get() || { enabled: 0 };
  res.json({ ok: true, watermark: w });
});

router.post('/api/admin/watermark', requireAdmin, pdfUpload.single('logo'), (req, res) => {
  const b = req.body || {};
  db.prepare(`INSERT INTO watermark_settings(id, enabled, path, opacity, size, position, rotation) VALUES (1,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, path=COALESCE(excluded.path, watermark_settings.path), opacity=excluded.opacity, size=excluded.size, position=excluded.position, rotation=excluded.rotation`)
    .run(b.enabled === 'yes' || b.enabled === 'true' || b.enabled === 1 ? 1 : 0, req.file ? `data/admin_files/${req.file.filename}` : null, Number(b.opacity) || 0.2, Number(b.size) || 0.3, b.position || 'center', Number(b.rotation) || 0);
  res.json({ ok: true });
});

router.get('/api/admin/razorpay', requireAdmin, async (req, res) => {
  const v = await rzp.validateConfig();
  res.json({ ok: true, ...v });
});

router.get('/api/admin/settings', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const out = {};
  rows.forEach(r => { if (!/secret|password|key/i.test(r.key)) out[r.key] = r.value; });
  res.json({ ok: true, settings: out, school: getSetting('school_name', 'RPIC SCHOOL'), session: getSetting('session', '2026-27') });
});

router.post('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  for (const [k, v] of Object.entries(b)) {
    if (/secret|password|token/i.test(k)) continue; // secrets only via env
    setSetting(k, v);
  }
  res.json({ ok: true });
});

module.exports = router;
