const express = require('express');
const { db } = require('../db');
const { requireStudent } = require('../auth');

const router = express.Router();

// Class 10 UP Board formula quick-reference (real formulas, subject-grouped)
const FORMULAS = {
  'Science - Physics': [
    ['Mirror formula', '1/v + 1/u = 1/f  (spherical mirror; f = R/2)'],
    ['Lens formula', '1/v - 1/u = 1/f  (thin lens); Power P = 1/f (metre), unit dioptre'],
    ['Magnification', 'm = h\u2032/h = -v/u (mirror); m = v/u (lens)'],
    ['Refractive index', 'n = c/v = sin i / sin r (Snell\u2019s law)'],
    ['Ohm\u2019s law', 'V = IR'],
    ['Resistance of conductor', 'R = \u03c1l/A'],
    ['Series & parallel', 'Rs = R1+R2+R3;  1/Rp = 1/R1+1/R2+1/R3'],
    ['Electric power', 'P = VI = I\u00b2R = V\u00b2/R; Heat H = I\u00b2Rt'],
    ['Magnetic field, solenoid', 'B = \u03bc0 n I (inside a long solenoid)'],
    ['Right-hand thumb rule', 'Thumb = current direction, curled fingers = field direction'],
  ],
  'Science - Chemistry': [
    ['pH scale', 'pH = -log[H+]; pH < 7 acidic, = 7 neutral, > 7 basic'],
    ['Neutralisation', 'Acid + Base \u2192 Salt + Water'],
    ['Photosynthesis', '6CO2 + 6H2O \u2192 C6H12O6 + 6O2 (sunlight, chlorophyll)'],
    ['Respiration', 'C6H12O6 + 6O2 \u2192 6CO2 + 6H2O + energy'],
    ['Rancidity prevention', 'Antioxidants + nitrogen flushing in packets'],
    ['Plaster of Paris', 'CaSO4\u00b7\u00bdH2O + 1\u00bdH2O \u2192 CaSO4\u00b72H2O (gypsum)'],
    ['Baking soda', 'NaHCO3; washing soda: Na2CO3\u00b710H2O'],
  ],
  'Science - Biology': [
    ['Menstrual cycle', '~28 days; ovulation around day 14'],
    ['Mendel\u2019s ratio (F2)', 'Phenotype 3:1, Genotype 1:2:1 (monohybrid)'],
    ['Human sex determination', 'XX = female, XY = male; father\u2019s chromosome decides'],
    ['Trophic levels', '10% energy transfers to the next level'],
    ['Ozone', 'O3; depleted by CFCs'],
  ],
  'Mathematics': [
    ['Euclid division lemma', 'a = bq + r, 0 \u2264 r < b'],
    ['HCF \u00d7 LCM', 'HCF(a,b) \u00d7 LCM(a,b) = a \u00d7 b'],
    ['Quadratic formula', 'x = (-b \u00b1 \u221a(b\u00b2-4ac)) / 2a;  D = b\u00b2-4ac'],
    ['Nature of roots', 'D > 0 two real, D = 0 equal, D < 0 no real'],
    ['AP nth term & sum', 'an = a + (n-1)d;  Sn = n/2 [2a + (n-1)d] = n/2 (a+an)'],
    ['Trigonometric ratios', 'sin\u03b8 = P/H, cos\u03b8 = B/H, tan\u03b8 = P/B'],
    ['Identity set', 'sin\u00b2\u03b8+cos\u00b2\u03b8=1; 1+tan\u00b2\u03b8=sec\u00b2\u03b8; 1+cot\u00b2\u03b8=cosec\u00b2\u03b8'],
    ['Distance formula', 'd = \u221a((x2-x1)\u00b2 + (y2-y1)\u00b2)'],
    ['Section formula', 'x = (mx2+nx1)/(m+n), y = (my2+ny1)/(m+n)'],
    ['Area of triangle', '\u00bd |x1(y2-y3)+x2(y3-y1)+x3(y1-y2)|'],
    ['Circle: tangent', 'Tangent \u22a5 radius at the point of contact'],
    ['Areas related to circles', 'Sector area = (\u03b8/360)\u00d7\u03c0r\u00b2; arc length = (\u03b8/360)\u00d72\u03c0r'],
    ['Surface areas', 'Cone: \u03c0rl, V=\u2153\u03c0r\u00b2h; Sphere: 4\u03c0r\u00b2, V=\u2154\u03c0r\u00b3; Hemisphere: 2\u03c0r\u00b2, V=\u2154\u03c0r\u00b3'],
    ['Statistics', 'Mean = \u03a1fx/\u03a1f; Mode = l + ((f1-f0)/(2f1-f0-f2))h; Median by ogive'],
    ['Probability', 'P(E) = favourable/total; 0 \u2264 P(E) \u2264 1; P(E\u2032) = 1 - P(E)'],
  ],
};

router.get('/api/formulas', requireStudent, (req, res) => {
  res.json({ ok: true, groups: Object.entries(FORMULAS).map(([g, items]) => ({ group: g, items })) });
});

// Official 7-set model papers: questions carrying a set_no (824-DA ... 824-DG)
router.get('/api/sets', requireStudent, (req, res) => {
  const rows = db.prepare("SELECT set_no, COUNT(*) c, MIN(subject) subj FROM questions WHERE approved=1 AND set_no IS NOT NULL GROUP BY set_no ORDER BY set_no").all();
  res.json({ ok: true, sets: rows });
});

router.post('/api/sets/:setNo/start', requireStudent, (req, res) => {
  const qs = db.prepare('SELECT id FROM questions WHERE approved=1 AND set_no=? ORDER BY id LIMIT 50').all(String(req.params.setNo));
  if (!qs.length) return res.status(400).json({ error: 'Is set me abhi approved questions nahi hain.' });
  const r = db.prepare('INSERT INTO tests(student_id, subject, mode, q_ids_json) VALUES (?,?,?,?)')
    .run(req.studentId, '7-Set ' + String(req.params.setNo), 'set', JSON.stringify(qs.map(q => q.id)));
  const t = db.prepare('SELECT * FROM tests WHERE id=?').get(r.lastInsertRowid);
  t.questions = qs.map(q => db.prepare('SELECT id, subject, chapter, type, question, options_json FROM questions WHERE id=?').get(q.id))
    .map(q => ({ ...q, options: q.options_json ? JSON.parse(q.options_json) : null }));
  res.json({ ok: true, test: t });
});

// Previous year questions search (year marked by admin/OCR import)
router.get('/api/pyq', requireStudent, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ ok: true, questions: [] });
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  const rows = db.prepare(`SELECT id, subject, chapter, question, options_json, year, set_no FROM questions
    WHERE approved=1 AND year IS NOT NULL AND (question LIKE ? OR subject LIKE ? OR chapter LIKE ?) ORDER BY year DESC LIMIT 40`)
    .all(like, like, like);
  rows.forEach(r => r.options = r.options_json ? JSON.parse(r.options_json) : null);
  res.json({ ok: true, questions: rows });
});

// PDF-based question generation (needs AI_API_KEY, set from the admin/hosting Environment)
router.post('/api/ai/questions', requireStudent, async (req, res) => {
  const { text, subject, count } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Pehle PDF text ya notes paste karein' });
  if (!process.env.AI_API_KEY) return res.json({ ok: false, notice: 'AI key abhi configure nahi hai. AI_API_KEY set hone ke baad ye feature chalega.' });
  try {
    const r = await fetch(process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', messages: [
        { role: 'system', content: 'You write UP Board Class 10 practice questions in Hindi/English. Return ONLY a JSON array of objects: {"question","options":["a","b","c","d"],"answer":"a"}. No extra text.' },
        { role: 'user', content: `Subject: ${subject || 'Science'}. Make ${Number(count) || 10} new MCQ practice questions from this content (never direct copies):\n\n${String(text).slice(0, 6000)}` }], max_tokens: 1600 })
    });
    const data = await r.json();
    const raw = data.choices && data.choices[0] ? data.choices[0].message.content : '';
    const m = raw.match(/\[[\s\S]*\]/);
    let questions = [];
    try { questions = JSON.parse(m ? m[0] : '[]'); } catch {}
    res.json({ ok: true, questions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
