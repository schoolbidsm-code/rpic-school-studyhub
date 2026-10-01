const express = require('express');
const { db, notify } = require('../db');
const { requireStudent, requireAdmin } = require('../auth');
const router = express.Router();
const ALLOWED = ['REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_REQUIRED','PAID','UNLOCKED','COMPLETED','REJECTED'];

function nextReqNo() {
  const c = db.prepare('SELECT COUNT(*) c FROM pdf_requests').get().c;
  return `RPIC-REQ-2026-${String(c + 1).padStart(5, '0')}`;
}

// Student: create a PDF request
router.post('/api/requests', requireStudent, (req, res) => {
  const { subject, message, product_id } = req.body || {};
  if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'Subject select karein' });
  const no = nextReqNo();
  db.prepare('INSERT INTO pdf_requests(request_no, student_id, product_id, subject, message) VALUES (?,?,?,?,?)')
    .run(no, req.studentId, product_id ? Number(product_id) : null, String(subject).trim().slice(0, 100), String(message || '').slice(0, 2000));
  notify('admin', null, 'Nayi PDF Request', `${req.student.student_code} (${req.student.name}) ne ${subject} ke liye request bheji: ${no}`);
  res.json({ ok: true, request_no: no, status: 'REQUESTED' });
});

// Student: own requests only
router.get('/api/requests', requireStudent, (req, res) => {
  const rows = db.prepare(`SELECT r.*, p.name AS product_name FROM pdf_requests r
    LEFT JOIN products p ON p.id = r.product_id WHERE r.student_id=? ORDER BY r.id DESC`).all(req.studentId);
  res.json({ ok: true, requests: rows });
});

// Admin: all requests
router.get('/api/admin/requests', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT r.*, s.name AS student_name, s.student_code, p.name AS product_name
    FROM pdf_requests r LEFT JOIN students s ON s.id = r.student_id LEFT JOIN products p ON p.id = r.product_id
    ORDER BY r.id DESC`).all();
  res.json({ ok: true, requests: rows });
});

// Admin: update request (status / price / note / attach product)
router.put('/api/admin/requests/:id', requireAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM pdf_requests WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  const { status, price, admin_note, product_id } = req.body || {};
  if (status && !ALLOWED.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const newStatus = status || r.status;
  const newPrice = price != null && price !== '' ? Math.round(Number(price)) : r.price;
  if (newStatus === 'PAYMENT_REQUIRED' && !newPrice) return res.status(400).json({ error: 'Pehle price set karein' });
  const newProduct = product_id != null && product_id !== '' ? Number(product_id) : r.product_id;
  db.prepare("UPDATE pdf_requests SET status=?, price=?, admin_note=?, product_id=?, updated_at=datetime('now') WHERE id=?")
    .run(newStatus, newPrice, admin_note != null ? String(admin_note).slice(0, 1000) : r.admin_note, newProduct, r.id);
  if (newStatus !== r.status) {
    const note = newStatus === 'PAYMENT_REQUIRED' ? `Payment kar dijiye. Price: Rs ${newPrice}. App ke PDF Request page par Pay button hai.` : (admin_note || '');
    notify('student', r.student_id, `Request ${r.request_no}: ${newStatus.replace(/_/g, ' ')}`, note);
  }
  res.json({ ok: true, status: newStatus, price: newPrice });
});

module.exports = router;
