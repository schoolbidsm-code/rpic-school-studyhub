const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'rpic.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT UNIQUE,
  name TEXT NOT NULL,
  mobile TEXT UNIQUE NOT NULL,
  class TEXT DEFAULT '10',
  session TEXT DEFAULT '2026-27',
  roll_no TEXT,
  photo_path TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS login_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  device TEXT,
  login_at TEXT DEFAULT (datetime('now')),
  logout_at TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  chapter TEXT,
  type TEXT NOT NULL DEFAULT 'mcq',
  question TEXT NOT NULL,
  options_json TEXT,
  answer TEXT NOT NULL,
  explanation TEXT,
  source_pdf TEXT, page_no TEXT, year TEXT, set_no TEXT,
  approved INTEGER DEFAULT 0,
  confidence REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT, mode TEXT DEFAULT 'practice',
  q_ids_json TEXT NOT NULL,
  answers_json TEXT,
  score REAL DEFAULT 0, max_marks REAL DEFAULT 0,
  correct INTEGER DEFAULT 0, incorrect INTEGER DEFAULT 0, unanswered INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0, time_taken INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  started_at TEXT DEFAULT (datetime('now')), submitted_at TEXT
);
CREATE TABLE IF NOT EXISTS exam_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type TEXT NOT NULL,
  subject TEXT,
  exam_date TEXT NOT NULL,
  exam_time TEXT NOT NULL,
  syllabus TEXT,
  max_marks INTEGER DEFAULT 100
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT UNIQUE NOT NULL,
  doc_type TEXT NOT NULL,
  student_id INTEGER NOT NULL,
  payload_json TEXT,
  png_path TEXT, pdf_path TEXT,
  status TEXT DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS field_maps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_type TEXT NOT NULL,
  field TEXT NOT NULL,
  x REAL, y REAL, w REAL, h REAL,
  font_size REAL, color TEXT DEFAULT '#111111', align TEXT DEFAULT 'left',
  UNIQUE(template_type, field)
);
CREATE TABLE IF NOT EXISTS watermark_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER DEFAULT 0,
  path TEXT, opacity REAL DEFAULT 0.2, size REAL DEFAULT 0.3,
  position TEXT DEFAULT 'center', rotation REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT UNIQUE,
  name TEXT NOT NULL,
  subject TEXT, class TEXT DEFAULT '10', session TEXT DEFAULT '2026-27',
  price REAL NOT NULL, mrp REAL,
  description TEXT,
  pdf_path TEXT, thumb_path TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  student_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pdf',
  product_id INTEGER,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  rzp_order_id TEXT, rzp_payment_id TEXT, receipt_no TEXT,
  address_json TEXT,
  delivery_status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL, product_id INTEGER, order_no TEXT,
  downloaded_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  code_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bip_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL, delta INTEGER NOT NULL,
  reason TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS study_streaks (
  student_id INTEGER PRIMARY KEY,
  last_date TEXT, count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS pdf_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_no TEXT UNIQUE,
  student_id INTEGER NOT NULL,
  product_id INTEGER,
  subject TEXT,
  message TEXT,
  price INTEGER,
  status TEXT DEFAULT 'REQUESTED',
  admin_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT DEFAULT 'student',
  student_id INTEGER,
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
try { db.exec('ALTER TABLE orders ADD COLUMN request_no TEXT'); } catch (e) {}
function notify(audience, studentId, title, body) {
  db.prepare('INSERT INTO notifications(audience, student_id, title, body) VALUES (?,?,?,?)').run(audience, studentId || null, title, body || '');
}

const STUDENT_PREFIX = { certificate: 'CERT', report: 'REPORT', idcard: 'ID' };
function nextDocId(type) {
  const p = STUDENT_PREFIX[type] || 'DOC';
  const row = db.prepare("SELECT COUNT(*) c FROM documents WHERE doc_type=?").get(type);
  return `${p}-2026-${String(row.c + 1).padStart(6, '0')}`;
}
function nextOrderNo() {
  const row = db.prepare("SELECT COUNT(*) c FROM orders").get();
  return `RPIC-ORD-2026-${String(row.c + 1).padStart(6, '0')}`;
}
function getSetting(key, dflt) {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return r ? r.value : dflt;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

module.exports = { db, nextDocId, nextOrderNo, getSetting, setSetting, notify };
