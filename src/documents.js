const sharp = require('sharp');
const { QRCode } = (() => { const q = require('qrcode'); return { QRCode: q }; })();
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { db, nextDocId } = require('./db');

const TEMPLATES = {
  certificate: { url: 'https://i.postimg.cc/HLTsQtJz/file-0000000083c08211b7fbce613b545018.png', file: 'certificate.png' },
  report: { url: 'https://i.postimg.cc/RZ500mv3/file-00000000e9fc8208baab832d0779cdd4.png', file: 'report.png' },
  idcard: { url: null, file: 'idcard.png' }
};

function ensureTemplate(type) {
  const t = TEMPLATES[type];
  const p = path.join(__dirname, '..', 'public', 'templates', t.file);
  if (fs.existsSync(p)) return p;
  if (t.url) {
    // downloaded at first use; admin can replace from Admin > Templates
  }
  return null;
}

async function downloadTemplates() {
  const out = {};
  for (const [type, t] of Object.entries(TEMPLATES)) {
    const p = path.join(__dirname, '..', 'public', 'templates', t.file);
    if (fs.existsSync(p)) { out[type] = 'exists'; continue; }
    if (!t.url) { out[type] = 'no-default-template'; continue; }
    try {
      const res = await fetch(t.url);
      if (!res.ok) { out[type] = 'download-failed ' + res.status; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(p, buf);
      out[type] = 'downloaded';
    } catch (e) { out[type] = 'download-failed ' + e.message; }
  }
  return out;
}

// default field maps (percent coordinates of template) used until admin maps fields
const DEFAULT_MAPS = {
  certificate: [
    { field: 'student_name', x: 26, y: 46.8, w: 48, h: 9.0, font_size: 3.0, align: 'center' },
    { field: 'achievement', x: 25, y: 55.5, w: 50, h: 4, font_size: 1.8, align: 'center' },
    { field: 'certificate_id', x: 24, y: 78.9, w: 16, h: 2.4, font_size: 1.4, align: 'left' },
    { field: 'date', x: 24, y: 81.9, w: 16, h: 2.2, font_size: 1.4, align: 'left' },
    { field: 'qr', x: 4.8, y: 77, w: 7, h: 8 }
  ],
  report: [
    { field: 'student_name', x: 20.8, y: 28.9, w: 12.5, h: 2.6, font_size: 1.2, align: 'left' },
    { field: 'class', x: 20.8, y: 31.1, w: 5, h: 2.2, font_size: 1.2, align: 'left' },
    { field: 'session', x: 20.8, y: 33.3, w: 9, h: 2.2, font_size: 1.2, align: 'left' },
    { field: 'roll_no', x: 20.8, y: 34.2, w: 15.5, h: 2.4, font_size: 1.1, align: 'left' },
    { field: 'student_id', x: 20.8, y: 42.4, w: 18, h: 2.2, font_size: 1.2, align: 'left' },
    { field: 'hindi', x: 33.3, y: 49.3, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'english', x: 33.3, y: 50.9, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'mathematics', x: 33.3, y: 52.4, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'science', x: 33.3, y: 54.0, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'social_science', x: 33.3, y: 55.6, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'computer', x: 33.3, y: 57.2, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'total', x: 33.3, y: 58.2, w: 4.5, h: 1.8, font_size: 1.0, align: 'center' },
    { field: 'percentage', x: 75, y: 55.7, w: 9.5, h: 2.6, font_size: 1.1, align: 'center' },
    { field: 'date', x: 73, y: 42.5, w: 15, h: 2.2, font_size: 1.1, align: 'left' },
    { field: 'qr', x: 2.6, y: 86.9, w: 7.5, h: 9.9 }
  ],
  idcard: []
};

const SUBJECT_LABELS = {
  hindi: 'Hindi', english: 'English', mathematics: 'Mathematics', science: 'Science',
  social_science: 'Social Science', computer: 'Computer'
};

function svgEscape(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildOverlay(meta, maps, W, H, verifyBase, wm) {
  const parts = [];
  const photos = [];
  const qrs = [];
  for (const m of maps) {
    const px = (m.x / 100) * W, py = (m.y / 100) * H;
    const pw = (m.w / 100) * W, ph = (m.h / 100) * H;
    if (m.field === 'student_photo') {
      if (meta.photoPath && fs.existsSync(meta.photoPath)) photos.push({ path: meta.photoPath, left: Math.round(px), top: Math.round(py), w: Math.round(pw), h: Math.round(ph) });
      continue;
    }
    if (m.field === 'qr') {
      if (meta.verifyUrl) qrs.push({ data: meta.verifyUrl, left: Math.round(px), top: Math.round(py), size: Math.round(Math.min(pw, ph)) });
      continue;
    }
    if (m.field === 'watermark') continue;
    let val = meta[m.field];
    if (val === undefined || val === null || val === '') {
      val = meta.subjectMarks && meta.subjectMarks[m.field];
    }
    if (val === undefined || val === null || val === '') continue; // never invent values
    const fsPx = m.font_size ? (m.font_size / 100) * H : Math.max(10, ph * 0.6);
    const anchor = m.align === 'center' ? 'middle' : m.align === 'right' ? 'end' : 'start';
    parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#ffffff" rx="2"/>`);
    const ax = m.align === 'center' ? px + pw / 2 : m.align === 'right' ? px + pw : px;
    parts.push(`<text x="${ax}" y="${py + fsPx}" font-family="DejaVu Sans, sans-serif" font-size="${fsPx}" fill="${m.color || '#111111'}" text-anchor="${anchor}">${svgEscape(val)}</text>`);
  }
  if (wm && wm.enabled) {
    const ws = wm.size ? wm.size * W : W * 0.4;
    const op = wm.opacity != null ? wm.opacity : 0.2;
    let wx = W / 2, wy = H / 2;
    if (wm.position === 'top-left') { wx = W * 0.2; wy = H * 0.15; }
    if (wm.position === 'top-right') { wx = W * 0.8; wy = H * 0.15; }
    if (wm.position === 'bottom-left') { wx = W * 0.2; wy = H * 0.85; }
    if (wm.position === 'bottom-right') { wx = W * 0.8; wy = H * 0.85; }
    parts.push(`<text x="${wx}" y="${wy}" font-family="DejaVu Sans, sans-serif" font-size="${ws}" fill="#555555" fill-opacity="${op}" text-anchor="middle" transform="rotate(${wm.rotation || 0} ${wx} ${wy})">${svgEscape(wm.text || 'RPIC SCHOOL')}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return { svg, photos, qrs };
}

async function generateDocument(type, student, extra) {
  const templatePath = ensureTemplate(type);
  if (!templatePath) throw new Error(`${type} template not found. Admin must upload it.`);
  const maps = db.prepare('SELECT * FROM field_maps WHERE template_type=? ORDER BY id').all(type);
  const mapList = maps.length ? maps : DEFAULT_MAPS[type] || [];
  const base = sharp(templatePath);
  const { width: W, height: H } = await base.metadata();
  const docId = nextDocId(type);
  const verifyUrl = `${extra.baseUrl}/verify/${docId}`;

  const meta = {
    student_name: student.name,
    student_id: student.student_code,
    class: student.class,
    session: student.session,
    roll_no: student.roll_no,
    certificate_id: docId,
    report_id: docId,
    verification_id: docId,
    date: new Date().toISOString().slice(0, 10),
    issue_date: new Date().toISOString().slice(0, 10),
    validity: student.session,
    school: extra.school || 'RPIC SCHOOL',
    achievement: extra.achievement || null,
    photoPath: student.photo_path ? path.join(__dirname, '..', 'public', student.photo_path) : null,
    verifyUrl,
    subjectMarks: extra.subjectMarks || null
  };

  const wm = { ...db.prepare('SELECT * FROM watermark_settings WHERE id=1').get() };
  const { svg, photos, qrs } = buildOverlay(meta, mapList, W, H, verifyUrl, wm);

  let img = sharp(templatePath).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
  const comps = [];
  for (const p of photos) {
    const resized = await sharp(p.path).resize(p.w, p.h, { fit: 'cover' }).toBuffer();
    comps.push({ input: resized, top: p.top, left: p.left });
  }
  for (const q of qrs) {
    const qrBuf = await QRCode.toBuffer(q.data, { width: q.size, margin: 1 });
    comps.push({ input: qrBuf, top: q.top, left: q.left });
  }
  if (comps.length) img = sharp(await img.toBuffer()).composite(comps);
  const pngPath = path.join(__dirname, '..', 'data', `${docId}.png`);
  await img.png({ quality: 100 }).toFile(pngPath);

  const png = fs.readFileSync(pngPath);
  const pngDoc = await PNGDocument(png);
  const pdfBytes = await pngDoc.save();
  const pdfPath = path.join(__dirname, '..', 'data', `${docId}.pdf`);
  fs.writeFileSync(pdfPath, pdfBytes);

  db.prepare('INSERT INTO documents(doc_id, doc_type, student_id, payload_json, png_path, pdf_path, status) VALUES (?,?,?,?,?,?,?)')
    .run(docId, type, student.id, JSON.stringify({ achievement: extra.achievement || null, subjectMarks: extra.subjectMarks || null }), `data/${docId}.png`, `data/${docId}.pdf`, extra.status || 'generated');

  return { docId, pngPath, pdfPath, verifyUrl };
}

async function PNGDocument(png) {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(png);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return pdfDoc;
}

function verificationPayload(docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE doc_id=?').get(docId);
  if (!doc) return null;
  const s = db.prepare('SELECT * FROM students WHERE id=?').get(doc.student_id);
  return {
    document_id: doc.doc_id,
    type: doc.doc_type,
    student_name: s ? s.name : null,
    class: s ? s.class : null,
    session: s ? s.session : null,
    issue_date: doc.created_at,
    status: doc.status
  };
}

module.exports = { generateDocument, verificationPayload, downloadTemplates, DEFAULT_MAPS, TEMPLATES, SUBJECT_LABELS };
