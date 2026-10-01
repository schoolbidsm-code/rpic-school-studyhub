const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db, nextOrderNo, getSetting } = require('../db');
const { requireStudent } = require('../auth');
const rzp = require('../razorpay');

const router = express.Router();

router.get('/api/products', requireStudent, (req, res) => {
  const rows = db.prepare("SELECT id, product_code, name, subject, class, session, price, mrp, description, thumb_path, status FROM products WHERE status='active'").all();
  const mine = db.prepare("SELECT product_id FROM orders WHERE student_id=? AND status='PAID'").all(req.studentId).map(o => o.product_id);
  rows.forEach(r => { r.purchased = mine.includes(r.id); r.pdf_path = undefined; });
  res.json({ ok: true, products: rows });
});

router.post('/api/payments/create-order', requireStudent, async (req, res) => {
  try {
    const { product_id } = req.body || {};
    if (!rzp.configured()) return res.status(400).json({ error: 'Razorpay is not configured.', status: 'NOT_CONFIGURED' });
    const p = db.prepare("SELECT * FROM products WHERE id=? AND status='active'").get(product_id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    if (p.pdf_path && !fs.existsSync(path.join(__dirname, '..', p.pdf_path))) return res.status(400).json({ error: 'PDF file abhi upload nahi hui hai' });
    const existing = db.prepare("SELECT * FROM orders WHERE student_id=? AND product_id=? AND status='PAID'").get(req.studentId, p.id);
    if (existing) return res.json({ ok: true, already_purchased: true, order: existing });
    const orderNo = nextOrderNo();
    const receiptNo = `RCPT-${Date.now()}`;
    const amount = Math.round(Number(p.price) * 100);
    const r = await rzp.client().orders.create({ amount, currency: 'INR', receipt: receiptNo, notes: { order_no: orderNo, product: p.name, student: req.student.student_code } });
    db.prepare('INSERT INTO orders(order_no, student_id, kind, product_id, amount, status, rzp_order_id, receipt_no) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(orderNo, req.studentId, 'pdf', p.id, Number(p.price), 'PENDING', r.id, receiptNo);
    res.json({ ok: true, order_no: orderNo, razorpay_order_id: r.id, amount: Number(p.price), currency: 'INR', key_id: rzp.keyId(), product: { id: p.id, name: p.name } });
  } catch (e) { res.status(500).json({ error: 'Razorpay order create nahi ho paya: ' + e.message, status: 'FAILED' }); }
});

router.post('/api/payments/verify', requireStudent, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_no } = req.body || {};
    if (!rzp.configured()) return res.status(400).json({ error: 'Razorpay is not configured.' });
    const o = db.prepare('SELECT * FROM orders WHERE order_no=? AND student_id=?').get(order_no, req.studentId);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected !== razorpay_signature) {
      db.prepare("UPDATE orders SET status='FAILED', rzp_payment_id=? WHERE id=?").run(razorpay_payment_id || null, o.id);
      return res.status(400).json({ error: 'Payment signature verify nahi hui. Content locked rahega.', status: 'FAILED' });
    }
    // double check with Razorpay API before unlocking
    const pay = await rzp.client().payments.fetch(razorpay_payment_id);
    if (pay.status !== 'captured') {
      db.prepare("UPDATE orders SET status='PROCESSING', rzp_payment_id=? WHERE id=?").run(razorpay_payment_id, o.id);
      return res.json({ ok: true, status: 'PROCESSING', notice: 'Payment abhi verify ho raha hai. PDF thodi der me unlock hoga.' });
    }
    db.prepare("UPDATE orders SET status='PAID', rzp_payment_id=? WHERE id=?").run(razorpay_payment_id, o.id);
    if (o.request_no) {
      const rr = db.prepare('SELECT * FROM pdf_requests WHERE request_no=?').get(o.request_no);
      if (rr && rr.student_id === req.studentId && ['APPROVED', 'PAYMENT_REQUIRED'].includes(rr.status)) {
        db.prepare("UPDATE pdf_requests SET status='PAID', updated_at=datetime('now') WHERE id=?").run(rr.id);
        notify('student', rr.student_id, `Request ${rr.request_no}: Payment mil gaya`, 'Admin PDF jaldi attach karke unlock karega.');
        notify('admin', null, 'PDF Request Paid', `${rr.request_no} ka payment Rs ${o.amount} verify ho gaya. Ab PDF attach karke Unlock/Complete karein.`);
      }
    }
    // unique access code for the protected PDF
    const access = crypto.randomBytes(6).toString('hex').toUpperCase();
    db.prepare('INSERT INTO access_codes(order_no, code_hash) VALUES (?,?) ON CONFLICT(order_no) DO UPDATE SET code_hash=excluded.code_hash')
      .run(o.order_no, bcrypt.hashSync(access, 10));
    res.json({ ok: true, status: 'PAID', access_code: access, payment: { order_id: razorpay_order_id, payment_id: razorpay_payment_id, receipt_no: o.receipt_no, amount: o.amount } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  try {
    if (!rzp.webhookSecret()) return res.status(400).send('Razorpay webhook is not configured.');
    const sig = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', rzp.webhookSecret()).update(req.body).digest('hex');
    if (sig !== expected) return res.status(400).send('Invalid webhook signature');
    const event = JSON.parse(req.body.toString());
    if (event.event === 'payment.captured' && event.payload && event.payload.payment && event.payload.payment.entity) {
      const ent = event.payload.payment.entity;
      const o = db.prepare('SELECT * FROM orders WHERE rzp_order_id=?').get(ent.order_id);
      if (o && o.status !== 'PAID') {
        db.prepare("UPDATE orders SET status='PAID', rzp_payment_id=? WHERE id=?").run(ent.id, o.id);
        const access = crypto.randomBytes(6).toString('hex').toUpperCase();
        db.prepare('INSERT INTO access_codes(order_no, code_hash) VALUES (?,?) ON CONFLICT(order_no) DO UPDATE SET code_hash=excluded.code_hash')
          .run(o.order_no, bcrypt.hashSync(access, 10));
      }
    }
    if (event.event === 'payment.failed') {
      const ent = event.payload && event.payload.payment && event.payload.payment.entity;
      if (ent) db.prepare("UPDATE orders SET status='FAILED', rzp_payment_id=? WHERE rzp_order_id=?").run(ent.id, ent.order_id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).send(e.message); }
});

router.get('/api/payments', requireStudent, (req, res) => {
  const rows = db.prepare(`SELECT o.order_no, o.rzp_order_id, o.rzp_payment_id, o.receipt_no, o.amount, o.status, o.created_at, p.name product
    FROM orders o LEFT JOIN products p ON p.id=o.product_id WHERE o.student_id=? ORDER BY o.id DESC`).all(req.studentId);
  res.json({ ok: true, payments: rows });
});

// secure authenticated download; never exposes admin file paths
router.get('/api/downloads/:productId', requireStudent, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.productId);
  if (!p || !p.pdf_path) return res.status(404).json({ error: 'PDF not found' });
  const o = db.prepare("SELECT * FROM orders WHERE student_id=? AND product_id=? AND status='PAID'").get(req.studentId, p.id);
  if (!o) return res.status(403).json({ error: 'Access Denied: yeh PDF purchase nahi ki gayi ya payment verify nahi hui.' });
  const file = path.join(__dirname, '..', p.pdf_path);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'PDF file missing' });
  db.prepare('INSERT INTO downloads(student_id, product_id, order_no) VALUES (?,?,?)').run(req.studentId, p.id, o.order_no);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${p.product_code || p.name}.pdf"`);
  res.sendFile(file);
});

router.get('/api/downloads/history', requireStudent, (req, res) => {
  const rows = db.prepare(`SELECT d.downloaded_at, d.order_no, p.name product FROM downloads d JOIN products p ON p.id=d.product_id WHERE d.student_id=? ORDER BY d.id DESC`).all(req.studentId);
  res.json({ ok: true, downloads: rows });
});

module.exports = router;
