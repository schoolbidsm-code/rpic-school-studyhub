const root = document.getElementById('root');
const nav = document.getElementById('nav');
const fab = document.getElementById('fab');
let STUDENT = null;
let CURRENT_TEST = null;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function api(path, opts) {
  const r = await fetch(path, opts && { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}

// ---------- LOGIN ----------
function loginScreen() {
  nav.style.display = 'none'; fab.style.display = 'none';
  root.innerHTML = `
  <div class="topbar"><div class="t"><h1>RPIC SCHOOL</h1><small>CLASS 10 STUDY HUB · UP BOARD · 2026-27</small></div></div>
  <div class="container" style="padding-top:40px">
    <div class="card" style="text-align:center">
      <div style="font-size:44px">🎓</div>
      <h1 style="font-size:20px;margin:8px 0">RPIC SCHOOL</h1>
      <p class="muted">CLASS 10 STUDY HUB<br>UP BOARD · 2026-27<br>Developed by Divyansh Singh</p>
    </div>
    <div class="card">
      <label>Mobile Number</label>
      <input id="mob" type="tel" maxlength="10" placeholder="10 digit mobile number">
      <button class="btn" id="sendOtp">Send OTP</button>
      <div id="step2" style="display:none">
        <label>OTP</label><input id="otp" type="number" maxlength="6" placeholder="6 digit OTP">
        <input id="nm" placeholder="Aapka naam (naye students ke liye)">
        <button class="btn" id="doLogin">Login</button>
      </div>
      <p class="muted" id="otpNote"></p>
    </div>
    <div class="card"><a href="/admin.html" style="color:var(--brand);font-size:13px">Admin Login</a></div>
  </div>`;
  document.getElementById('sendOtp').onclick = async () => {
    try {
      const mob = document.getElementById('mob').value.trim();
      const d = await api('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ mobile: mob }) });
      document.getElementById('step2').style.display = 'block';
      document.getElementById('otpNote').textContent = d.otp_sent ? 'OTP bhej diya gaya hai.' : (d.dev_notice || 'OTP server log me hai (SMS provider configure nahi hai).');
    } catch (e) { toast(e.message); }
  };
  document.getElementById('doLogin').onclick = async () => {
    try {
      const d = await api('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({
        mobile: document.getElementById('mob').value.trim(),
        code: document.getElementById('otp').value.trim(),
        name: document.getElementById('nm').value.trim() }) });
      STUDENT = d.student; route();
    } catch (e) { toast(e.message); }
  };
}

// ---------- DASHBOARD ----------
async function vDashboard() {
  const [p, exams] = await Promise.all([api('/api/progress'), api('/api/exams')]);
  const pr = p.progress;
  root.innerHTML = `
  <div class="topbar"><div class="t"><h1>RPIC SCHOOL</h1><small>CLASS 10 STUDY HUB · UP BOARD · 2026-27</small></div></div>
  <div class="container">
    <div class="card"><div class="row"><div>
      <b style="font-size:17px">${esc(STUDENT.name)}</b><br><small class="muted">${esc(STUDENT.student_code)} · Class ${esc(STUDENT.class || '10')}</small>
    </div></div></div>
    <div class="card"><div class="grid2">
      <div class="stat"><b>${pr.tests_completed}</b><span>Tests Completed</span></div>
      <div class="stat"><b>${pr.overall_accuracy}%</b><span>Accuracy</span></div>
      <div class="stat"><b>${pr.overall_percent}%</b><span>Overall</span></div>
      <div class="stat"><b>${pr.bip_coins}</b><span>BIP Coins</span></div>
    </div></div>
    ${exams.exams.length ? exams.exams.slice(0, 2).map(e => `
      <div class="card"><b>${esc(e.exam_type)} ${e.subject ? '· ' + esc(e.subject) : ''}</b>
      <p class="muted">${esc(e.exam_date)} ${esc(e.exam_time)}</p>
      <div class="countdown" data-when="${esc(e.exam_date)}T${esc(e.exam_time)}">
        <div class="cd"><b class="dd">-</b><span>DAYS</span></div><div class="cd"><b class="hh">-</b><span>HOURS</span></div>
        <div class="cd"><b class="mm">-</b><span>MIN</span></div><div class="cd"><b class="ss">-</b><span>SEC</span></div>
      </div></div>`).join('') : '<div class="card muted">Exam dates admin ne abhi set nahi ki hain.</div>'}
    <h2 class="sec">Quick Actions</h2>
    <div class="grid2">
      <button class="btn sec" onclick="location.hash='#study'">📚 Study</button>
      <button class="btn sec" onclick="location.hash='#tests'">📝 Mock Test</button>
      <button class="btn sec" onclick="location.hash='#certificates'">🏅 Certificates</button>
      <button class="btn sec" onclick="location.hash='#store'">🛒 Paid PDFs</button>
    </div>
    <h2 class="sec">More</h2>
    <div class="grid2">
      <button class="btn sec" onclick="location.hash='#idcard'">🪪 ID Card</button>
      <button class="btn sec" onclick="location.hash='#orders'">📦 ID Card Orders</button>
      <button class="btn sec" onclick="location.hash='#payments'">💳 Payments</button>
      <button class="btn sec" onclick="location.hash='#progress'">📊 Progress Report</button>
    </div>
  </div>`;
  tickCountdowns();
}

function tickCountdowns() {
  document.querySelectorAll('[data-when]').forEach(el => {
    const t = new Date(el.dataset.when).getTime();
    const iv = setInterval(() => {
      if (!document.body.contains(el)) return clearInterval(iv);
      let s = Math.max(0, Math.floor((t - Date.now()) / 1000));
      el.querySelector('.dd').textContent = Math.floor(s / 86400);
      el.querySelector('.hh').textContent = Math.floor(s % 86400 / 3600);
      el.querySelector('.mm').textContent = Math.floor(s % 3600 / 60);
      el.querySelector('.ss').textContent = s % 60;
    }, 1000);
  });
}

// ---------- STUDY ----------
async function vStudy() {
  root.innerHTML = topbar('STUDY') + `<div class="container"><div class="card">
    <b>Subjects</b><p class="muted">Question Bank aur Study Material</p></div>
    <div class="card" id="subs">Loading...</div>
    <div id="qbank"></div></div>`;
  const d = await api('/api/questions?limit=200');
  const bySub = {};
  d.questions.forEach(q => { (bySub[q.subject] = bySub[q.subject] || []).push(q); });
  document.getElementById('subs').innerHTML = Object.keys(bySub).length
    ? Object.entries(bySub).map(([s, qs]) => `<div class="row" style="margin:8px 0"><b style="flex:1">${esc(s)}</b><span class="muted">${qs.length} questions</span><button class="btn sec" style="width:auto;padding:6px 12px;margin:0" onclick="viewChapter('${esc(s)}')">Dekhein</button></div>`).join('')
    : '<p class="muted">Abhi koi approved questions nahi hain. Admin question bank bharega to yahan dikhega.</p>';
}
window.viewChapter = (sub) => {
  api('/api/questions?limit=200').then(d => {
    document.getElementById('qbank').innerHTML = d.questions.filter(q => q.subject === sub).slice(0, 30).map(q => `
      <div class="card qitem"><small class="pill ok">${esc(q.type.toUpperCase())}</small>
      <p style="margin:8px 0">${esc(q.question)}</p>
      ${q.options ? q.options.map(o => `<div class="qopt">${esc(o)}</div>`).join('') : ''}</div>`).join('');
  });
};

// ---------- TESTS ----------
async function vTests() {
  const d = await api('/api/tests');
  root.innerHTML = topbar('TESTS') + `<div class="container">
    <div class="card"><b>Naya Test</b>
    <label>Subject</label>
    <select id="tsub"><option value="">All Subjects</option>${['Hindi','English','Mathematics','Science','Social Science','Computer'].map(s => `<option>${s}</option>`).join('')}</select>
    <label>Questions</label>
    <select id="tcnt">${[20,30,40,50,75,100].map(n => `<option ${n===20?'selected':''}>${n}</option>`).join('')}</select>
    <button class="btn" id="startT">Start Test</button></div>
    <h2 class="sec">Mere Tests</h2>
    ${d.tests.length ? d.tests.map(t => `<div class="card"><div class="row">
      <div style="flex:1"><b>${esc(t.subject || 'All')}</b> <span class="pill ${t.status === 'submitted' ? 'ok' : 'PENDING'}">${t.status}</span><br>
      <small class="muted">${t.status === 'submitted' ? t.score + '/' + t.max_marks + ' · ' + t.accuracy + '% · ' + t.time_taken + 's' : t.started_at}</small></div>
      ${t.status === 'submitted' ? '' : `<button class="btn" style="width:auto;padding:8px 14px;margin:0" onclick="resumeTest(${t.id})">Resume</button>`}
    </div></div>`).join('') : '<div class="card muted">Abhi koi test nahi diya.</div>'}</div>`;
  document.getElementById('startT').onclick = async () => {
    try {
      const d2 = await api('/api/tests', { method: 'POST', body: JSON.stringify({
        subject: document.getElementById('tsub').value || null,
        count: document.getElementById('tcnt').value, mode: 'mock' }) });
      CURRENT_TEST = d2.test; location.hash = '#test';
    } catch (e) { toast(e.message); }
  };
}
window.resumeTest = async (id) => {
  const d = await api('/api/tests/' + id);
  const t = d.test;
  if (t.status !== 'in_progress') return toast('Test already submitted');
  try {
    const full = await api('/api/tests', { method: 'POST', body: JSON.stringify({ subject: t.subject, count: 20 }) });
    full.test.id = t.id; // resume same test: reuse question list from original
    const qs = JSON.parse(t.q_ids_json);
    const list = await api('/api/questions?limit=200');
    // fetch the original questions via a lightweight join endpoint is avoided; rebuild from bank
    const bank = list.questions;
    full.test.questions = qs.map(qid => bank.find(b => b.id === qid)).filter(Boolean);
    CURRENT_TEST = full.test; CURRENT_TEST.savedAnswers = t.answers_json ? JSON.parse(t.answers_json) : {};
    location.hash = '#test';
  } catch (e) { toast(e.message); }
};

// ---------- TEST RUNNER ----------
function vTest() {
  if (!CURRENT_TEST) { location.hash = '#tests'; return; }
  const qs = CURRENT_TEST.questions || [];
  let idx = 0;
  const answers = CURRENT_TEST.savedAnswers || {};
  const start = Date.now();
  root.innerHTML = topbar('TEST · ' + (CURRENT_TEST.subject || 'All')) + `<div class="container" id="tbox"></div>`;
  const box = document.getElementById('tbox');
  function render() {
    const q = qs[idx];
    if (!q) return finish();
    box.innerHTML = `<div class="card">
      <div class="row"><b>Q${idx + 1}/${qs.length}</b><span style="flex:1"></span><small class="muted" id="timer"></small></div>
      <p style="margin:10px 0">${esc(q.question)}</p>
      ${(q.options || []).map((o, i) => `<div class="qopt ${answers[q.id] === o ? 'sel' : ''}" onclick="pick('${esc(q.id)}',${i})">${esc(o)}</div>`).join('')}
      ${q.options ? '' : `<input id="sa" placeholder="Answer likhein" value="${esc(answers[q.id] || '')}">`}
      <div class="grid2">
        <button class="btn sec" ${idx === 0 ? 'disabled' : ''} onclick="nav2(${idx - 1})">Previous</button>
        <button class="btn" onclick="nav2(${idx + 1})">${idx === qs.length - 1 ? 'Submit' : 'Next'}</button>
      </div></div>`;
    box.scrollIntoView();
  }
  window.pick = (qid, i) => { answers[qid] = qs.find(q => String(q.id) === String(qid)).options[i]; render(); };
  window.nav2 = async (n) => {
    const q = qs[idx];
    if (q && !q.options) { const sa = document.getElementById('sa'); if (sa) answers[q.id] = sa.value; }
    if (n >= qs.length) return finish();
    idx = n; render();
  };
  async function finish() {
    const t = Date.now() - start;
    try {
      await api(`/api/tests/${CURRENT_TEST.id}/save`, { method: 'POST', body: JSON.stringify({ answers }) });
      const d = await api(`/api/tests/${CURRENT_TEST.id}/submit`, { method: 'POST', body: JSON.stringify({ answers, time_taken: Math.round(t / 1000) }) });
      CURRENT_TEST.result = d.test;
      location.hash = '#result';
    } catch (e) { toast(e.message); }
  }
  const iv = setInterval(() => {
    if (!document.body.contains(box)) return clearInterval(iv);
    const s = Math.floor((Date.now() - start) / 1000);
    const el = document.getElementById('timer');
    if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  render();
}

function vResult() {
  const t = CURRENT_TEST && CURRENT_TEST.result;
  if (!t) { location.hash = '#tests'; return; }
  root.innerHTML = topbar('RESULT') + `<div class="container">
    <div class="card" style="text-align:center"><b style="font-size:26px;color:var(--brand)">${t.score}/${t.max_marks}</b><br>
    <span class="pill ${t.accuracy >= 50 ? 'ok' : 'bad'}">${t.accuracy}% accuracy</span></div>
    <div class="card"><div class="grid2">
      <div class="stat"><b>${t.correct}</b><span>Correct</span></div>
      <div class="stat"><b>${t.incorrect}</b><span>Incorrect</span></div>
      <div class="stat"><b>${t.unanswered}</b><span>Unanswered</span></div>
      <div class="stat"><b>${t.time_taken}s</b><span>Time</span></div>
    </div></div>
    <p class="muted" style="text-align:center">Result permanent save ho gaya hai. Progress me dikh jayega.</p>
    <button class="btn" onclick="location.hash='#progress'">Progress dekhein</button>
    <button class="btn sec" onclick="location.hash='#tests'">Aur test dein</button></div>`;
}

// ---------- PROGRESS ----------
async function vProgress() {
  const p = await api('/api/progress');
  const pr = p.progress;
  root.innerHTML = topbar('PROGRESS') + `<div class="container">
    <div class="card"><b>Overall</b><div class="grid2">
      <div class="stat"><b>${pr.overall_percent}%</b><span>Overall</span></div>
      <div class="stat"><b>${pr.overall_accuracy}%</b><span>Accuracy</span></div>
      <div class="stat"><b>${pr.tests_completed}</b><span>Tests</span></div>
      <div class="stat"><b>${pr.streak}</b><span>Streak days</span></div>
    </div></div>
    <div class="card"><b>Subjects</b>${Object.entries(pr.bySubject).map(([s, v]) => `
      <div class="row" style="margin:10px 0"><span style="flex:1">${esc(s)}</span>
      <span class="muted">${v.not_attempted ? 'Not Attempted' : v.best + '/' + v.max_marks + ' · ' + v.percent + '%'}</span></div>`).join('')}</div>
    <div class="card"><b>Progress Report Card</b><p class="muted">Actual test results se banegi. Koi fake marks nahi.</p>
      <button class="btn" id="genReport">Generate Report</button><div id="repOut"></div></div></div>`;
  document.getElementById('genReport').onclick = async () => {
    try {
      const d = await api('/api/documents/report/generate', { method: 'POST', body: JSON.stringify({}) });
      document.getElementById('repOut').innerHTML = `
        <img src="/${d.pngPath.replace(/^data\//, 'uploads/../')}" style="display:none">
        <div class="row" style="margin-top:8px"><span class="muted" style="flex:1">${d.docId}</span>
        <a class="btn sec" style="width:auto;padding:8px 14px;margin:0" href="/api/files/${d.docId}/pdf">PDF</a>
        <a class="btn sec" style="width:auto;padding:8px 14px;margin:0" href="/api/files/${d.docId}/png">PNG</a></div>`;
    } catch (e) { toast(e.message); }
  };
}

// ---------- CERTIFICATES + ID CARD ----------
function topbar(title) {
  return `<div class="topbar"><div class="t"><h1>RPIC SCHOOL</h1><small>${esc(title)} · UP BOARD · 2026-27</small></div></div>`;
}

async function vCertificates() {
  const d = await api('/api/documents');
  const certs = d.documents.filter(x => x.doc_type === 'certificate');
  const reps = d.documents.filter(x => x.doc_type === 'report');
  const ids = d.documents.filter(x => x.doc_type === 'idcard');
  root.innerHTML = topbar('CERTIFICATES & DOCUMENTS') + `<div class="container">
    <div class="card"><b>Certificate</b><p class="muted">Eligible achievement par hi banta hai, actual result se.</p>
      <button class="btn" id="genCert">Generate Certificate</button><div id="certOut"></div>
      ${certs.length ? certs.map(c => `<div class="row" style="margin:8px 0"><span class="muted" style="flex:1">${c.doc_id}</span><span class="pill ok">${c.status}</span>
        <a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${c.doc_id}/pdf">PDF</a></div>`).join('') : '<p class="muted">Abhi koi certificate earned nahi hua.</p>'}</div>
    <div class="card"><b>Progress Report</b>${reps.length ? reps.map(c => `<div class="row" style="margin:8px 0"><span class="muted" style="flex:1">${c.doc_id}</span><a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${c.doc_id}/pdf">PDF</a></div>`).join('') : '<p class="muted">Abhi koi report nahi bani.</p>'}</div>
    <div class="card"><b>Digital ID Card</b><p class="muted">Profile photo ke saath banta hai.</p>
      <button class="btn" id="genId">Generate ID Card</button><div id="idOut"></div>
      ${ids.length ? ids.map(c => `<div class="row" style="margin:8px 0"><span class="muted" style="flex:1">${c.doc_id}</span><a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${c.doc_id}/png">PNG</a></div>`).join('') : ''}</div>
    <div class="card"><a href="#idcard" style="color:var(--brand)">🪪 ID Card print order karna hai? Yahan se karein</a></div></div>`;
  document.getElementById('genCert').onclick = async () => {
    try {
      const d2 = await api('/api/documents/certificate/generate', { method: 'POST', body: JSON.stringify({}) });
      document.getElementById('certOut').innerHTML = `<div class="row" style="margin-top:8px"><span class="muted" style="flex:1">${d2.docId}</span>
        <a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${d2.docId}/pdf">PDF</a>
        <a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${d2.docId}/png">PNG</a></div>`;
    } catch (e) { toast(e.message); }
  };
  document.getElementById('genId').onclick = async () => {
    try {
      const d2 = await api('/api/documents/id-card/generate', { method: 'POST', body: JSON.stringify({}) });
      document.getElementById('idOut').innerHTML = `<div class="row" style="margin-top:8px"><span class="muted" style="flex:1">${d2.docId}</span>
        <a class="btn sec" style="width:auto;padding:6px 10px;margin:0" href="/api/files/${d2.docId}/png">PNG</a></div>`;
    } catch (e) { toast(e.message); }
  };
}

// ---------- PAID PDF STORE + RAZORPAY ----------
async function vStore() {
  const d = await api('/api/products');
  root.innerHTML = topbar('PAID PDFs') + `<div class="container">
    <p class="muted" style="margin:8px 2px">Payment verify hone ke baad hi PDF unlock hota hai. Real Razorpay payment.</p>
    ${d.products.length ? d.products.map(p => `<div class="card">
      <div class="row"><div style="flex:1"><b>${esc(p.name)}</b><br>
      <small class="muted">${esc(p.subject || '')} · ${esc(p.session || '')}</small><br>
      <span style="font-size:16px;color:var(--brand)"><b>₹${p.price}</b></span>
      ${p.mrp && p.mrp > p.price ? `<small class="muted" style="text-decoration:line-through">₹${p.mrp}</small>` : ''}</div>
      ${p.purchased ? '<span class="pill ok">PURCHASED</span>' : `<button class="btn" style="width:auto;padding:10px 16px;margin:0" onclick="buy(${p.id})">Kharidein</button>`}
      ${p.purchased ? `<a class="btn sec" style="width:auto;padding:10px 14px;margin:0" href="/api/downloads/${p.id}">Download</a>` : ''}</div>
      ${p.description ? `<p class="muted" style="margin-top:8px">${esc(p.description)}</p>` : ''}</div>`).join('') : '<div class="card muted">Abhi koi product nahi hai. Admin PDFs upload karega.</div>'}</div>`;
}
window.buy = async (productId) => {
  try {
    const o = await api('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    if (o.already_purchased) return toast('Yeh PDF already purchase hai, Download available hai.');
    loadScript('https://checkout.razorpay.com/v1/checkout.js', () => {
      const rz = new Razorpay({
        key: o.key_id, amount: Math.round(o.amount * 100), currency: 'INR',
        name: 'RPIC SCHOOL', description: o.product.name, order_id: o.razorpay_order_id,
        prefill: { contact: STUDENT ? STUDENT.mobile || '' : '' }, theme: { color: '#1a3c8f' },
        handler: async (resp) => {
          try {
            const v = await api('/api/payments/verify', { method: 'POST', body: JSON.stringify({
              order_no: o.order_no, razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }) });
            if (v.status === 'PAID') toast('Payment verified. PDF unlocked. Access code: ' + v.access_code);
            else if (v.status === 'PROCESSING') toast(v.notice);
            route();
          } catch (e) { toast(e.message); }
        },
        modal: { ondismiss: () => toast('Payment cancel ho gaya') }
      });
      rz.open();
    });
  } catch (e) { toast(e.message); }
};
function loadScript(src, cb) {
  if (document.querySelector(`script[src="${src}"]`)) return cb();
  const s = document.createElement('script'); s.src = src; s.onload = cb; document.body.appendChild(s);
}

// ---------- PAYMENTS / ORDERS / PROFILE ----------
async function vPayments() {
  const [p, h] = await Promise.all([api('/api/payments'), api('/api/downloads/history')]);
  root.innerHTML = topbar('PAYMENTS') + `<div class="container">
    <div class="card"><b>Payment History</b>${p.payments.length ? `<table class="table"><tr><th>Order</th><th>Product</th><th>₹</th><th>Status</th><th>Date</th></tr>
      ${p.payments.map(x => `<tr><td>${esc(x.order_no)}</td><td>${esc(x.product || 'ID Card')}</td><td>${x.amount}</td><td><span class="pill ${x.status === 'PAID' ? 'ok' : x.status === 'FAILED' ? 'bad' : ''}">${x.status}</span></td><td>${esc(x.created_at)}</td></tr>`).join('')}</table>`
      : '<p class="muted">Abhi koi payment nahi hui.</p>'}</div>
    <div class="card"><b>Download History</b>${h.downloads.length ? h.downloads.map(x => `<div class="row" style="margin:6px 0"><span style="flex:1;font-size:13px">${esc(x.product)}</span><small class="muted">${esc(x.downloaded_at)}</small></div>`).join('') : '<p class="muted">Abhi koi download nahi hua.</p>'}</div></div>`;
}

async function vOrders() {
  const d = await api('/api/orders');
  root.innerHTML = topbar('ID CARD ORDERS') + `<div class="container">
    <div class="card"><b>Naya ID Card Order (print/delivery)</b>
      <input id="onm" placeholder="Student Name"><input id="omb" placeholder="Mobile Number">
      <textarea id="oad" placeholder="Address (delivery ke liye)"></textarea><input id="odt" type="date">
      <button class="btn" id="placeOrder">Order Place Karein</button></div>
    <h2 class="sec">Mere Orders</h2>
    ${d.orders.length ? d.orders.map(o => `<div class="card"><b>${esc(o.order_no)}</b>
      <div class="row" style="margin-top:6px"><span class="pill ${o.status === 'PAID' ? 'ok' : ''}">${o.status}</span>
      <span class="muted" style="flex:1">Delivery: ${esc(o.delivery_status)}</span><b>₹${o.amount}</b></div>
      ${o.address ? `<p class="muted" style="margin-top:6px">${esc(o.address.name || '')} · ${esc(o.address.address || '')}</p>` : ''}</div>`).join('') : '<div class="card muted">Abhi koi order nahi kiya.</div>'}</div>`;
  document.getElementById('placeOrder').onclick = async () => {
    try {
      const r = await api('/api/documents/id-card/order', { method: 'POST', body: JSON.stringify({
        name: document.getElementById('onm').value, mobile: document.getElementById('omb').value,
        address: document.getElementById('oad').value, required_date: document.getElementById('odt').value }) });
      toast('Order placed: ' + r.order_no + '. Payment admin confirm karega.'); route();
    } catch (e) { toast(e.message); }
  };
}

async function vProfile() {
  const [p, b] = await Promise.all([api('/api/student/profile'), api('/api/student/bip')]);
  const s = p.student;
  root.innerHTML = topbar('PROFILE') + `<div class="container">
    <div class="card"><div class="row">
      ${s.photo_path ? `<img class="avatar" src="/${esc(s.photo_path)}">` : '<div class="avatar"></div>'}
      <div style="flex:1"><b>${esc(s.name)}</b><br><small class="muted">${esc(s.student_code)} · Class ${esc(s.class || '10')} · ${esc(s.session || '')}</small><br>
      <small class="muted">BIP Coins: ${b.balance}</small></div></div>
      <label style="margin-top:12px">Naam</label><input id="pnm" value="${esc(s.name)}">
      <label>Roll Number</label><input id="prn" value="${esc(s.roll_no || '')}">
      <label>Profile Photo</label><input id="pph" type="file" accept="image/*">
      <button class="btn" id="saveP">Save Profile</button></div>
    <div class="card"><a href="#" id="logout" style="color:var(--bad)">Logout</a></div></div>`;
  document.getElementById('saveP').onclick = async () => {
    try {
      await api('/api/student/profile', { method: 'PUT', body: JSON.stringify({ name: document.getElementById('pnm').value, roll_no: document.getElementById('prn').value }) });
      const f = document.getElementById('pph').files[0];
      if (f) { const fd = new FormData(); fd.append('photo', f); await fetch('/api/student/photo', { method: 'POST', body: fd }); }
      toast('Profile save ho gayi'); route();
    } catch (e) { toast(e.message); }
  };
  document.getElementById('logout').onclick = async (e) => {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' }); STUDENT = null; loginScreen();
  };
}


// ---------- PDF REQUESTS ----------
function pillCls(s) { return ['PAID','UNLOCKED','COMPLETED','APPROVED'].includes(s) ? 'ok' : (s === 'REJECTED' ? 'bad' : ''); }
async function vRequests() {
  const [pd, rd] = await Promise.all([api('/api/products'), api('/api/requests')]);
  root.innerHTML = topbar('PDF Request') + `
    <div class="card"><b>Nayi PDF Request</b>
      <label>Subject</label>
      <select id="rsub">${['Hindi','English','Mathematics','Science','Social Science','Computer','Other'].map(s => `<option>${s}</option>`).join('')}</select>
      <label>Product (optional)</label>
      <select id="rprod"><option value="">Custom PDF</option>${pd.products.map(p => `<option value="${p.id}">${esc(p.name)} (Rs ${p.price})</option>`).join('')}</select>
      <textarea id="rmsg" placeholder="Kya chahiye? Subject, chapter, kitne PDF, kab tak..."></textarea>
      <button class="btn" id="rsend">Request bhejein</button>
    </div>
    <p class="muted" style="margin:4px 2px">Request bhejne ke baad admin review karega. Approve hone par yahin Pay button aayega.</p>
    ${rd.requests.map(r => `<div class="card">
      <div class="row"><b style="flex:1">${esc(r.subject)}</b><span class="pill ${pillCls(r.status)}">${esc(r.status.replace(/_/g,' '))}</span></div>
      <small class="muted">${esc(r.request_no)} · ${esc(r.created_at)}</small>
      ${r.message ? `<p class="muted" style="margin:6px 0 0">${esc(r.message)}</p>` : ''}
      ${r.admin_note ? `<p style="margin:6px 0 0"><small>Admin: ${esc(r.admin_note)}</small></p>` : ''}
      ${r.status === 'PAYMENT_REQUIRED' ? `<button class="btn" style="margin-top:8px" onclick="payReq('${esc(r.request_no)}')">Ab pay karein (Rs ${r.price})</button>` : ''}
      ${['PAID','UNLOCKED','COMPLETED'].includes(r.status) && r.product_id ? `<a class="btn sec" style="width:auto;padding:10px 14px;margin:8px 0 0" href="/api/downloads/${r.product_id}">Download</a>` : ''}
    </div>`).join('') || '<div class="card muted">Abhi koi request nahi hai.</div>'}`;
  document.getElementById('rsend').onclick = async () => {
    try {
      const r = await api('/api/requests', { method: 'POST', body: JSON.stringify({ subject: document.getElementById('rsub').value, product_id: document.getElementById('rprod').value || null, message: document.getElementById('rmsg').value }) });
      toast('Request bhej di gayi: ' + r.request_no); route();
    } catch (e) { toast(e.message); }
  };
}
window.payReq = async (no) => {
  try {
    const o = await api('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ request_no: no }) });
    if (o.already_purchased) return toast('Payment already ho chuka hai.');
    loadScript('https://checkout.razorpay.com/v1/checkout.js', () => {
      const rz = new Razorpay({
        key: o.key_id, amount: Math.round(o.amount * 100), currency: 'INR',
        name: 'RPIC SCHOOL', description: no, order_id: o.razorpay_order_id,
        prefill: { contact: STUDENT ? STUDENT.mobile || '' : '' }, theme: { color: '#1a3c8f' },
        handler: async (resp) => {
          try {
            const v = await api('/api/payments/verify', { method: 'POST', body: JSON.stringify({
              order_no: o.order_no, razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }) });
            if (v.status === 'PAID') toast('Payment verified. Request PAID ho gayi.');
            else if (v.status === 'PROCESSING') toast(v.notice);
            route();
          } catch (e) { toast(e.message); }
        },
        modal: { ondismiss: () => toast('Payment cancel ho gaya') }
      });
      rz.open();
    });
  } catch (e) { toast(e.message); }
};

// ---------- NOTIFICATIONS ----------
async function vNotifications() {
  const d = await api('/api/notifications');
  root.innerHTML = topbar('Notifications') + (d.notifications.length
    ? d.notifications.map(n => `<div class="card" style="${n.read ? '' : 'border-left:3px solid var(--brand)'}">
        <b>${esc(n.title)}</b><p class="muted" style="margin:4px 0 0">${esc(n.body)}</p>
        <small class="muted">${esc(n.created_at)}</small></div>`).join('')
    : '<div class="card muted">Abhi koi notification nahi.</div>');
  await api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) }).catch(() => {});
}

// ---------- ASK RPIC AI (chat) ----------
const AI_HIST_KEY = 'rpic_ai_chat';
function aiHist() { try { return JSON.parse(localStorage.getItem(AI_HIST_KEY) || '[]'); } catch (e) { return []; } }
function saveHist(h) { try { localStorage.setItem(AI_HIST_KEY, JSON.stringify(h.slice(-60))); } catch (e) {} }
function aiBubble(m) {
  return `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.text).replace(/\n/g, '<br>')}${m.role === 'ai' ? `<span class="copy" onclick="navigator.clipboard.writeText(this.parentElement.getAttribute('data-raw'))">copy</span>` : ''}</div>`.replace("class=\"msg " + (m.role === 'user' ? 'me' : 'ai') + "\"", "data-raw=\"" + esc(m.text).replace(/"/g, '&quot;') + "\" class=\"msg " + (m.role === 'user' ? 'me' : 'ai') + "\"");
}
async function vAI() {
  const hist = aiHist();
  root.innerHTML = topbar('Ask RPIC AI') + `
    <div id="aichat" class="chat">${hist.length ? hist.map(aiBubble).join('') : '<div class="card muted">Namaste! Main Ask RPIC AI hoon. Class 10 ka koi bhi sawal puchein: Maths, Science, Hindi, English, Social Science, Computer, revision ya doubts.</div>'}</div>
    <div class="chips">${['Light chapter samjhao','Board exam kaise top karein?','Quadratic formula','Trigonometry basics'].map(q => `<button class="chip" onclick="aiSuggest(this)">${q}</button>`).join('')}</div>
    <div class="chatbar"><input id="aiin" placeholder="Apna sawal likhein..."><button class="btn" id="aisend" style="width:auto;padding:10px 16px;margin:0">Bhejein</button></div>
    <div class="row" style="gap:8px;padding:0 4px 12px">
      <button class="btn sec" style="width:auto;padding:8px 12px;margin:0" onclick="aiClear()">New Chat</button>
      <button class="btn sec" style="width:auto;padding:8px 12px;margin:0" onclick="aiStop()">Stop</button>
    </div>`;
  const box = document.getElementById('aichat'); box.scrollTop = box.scrollHeight;
  const send = async () => {
    const inp = document.getElementById('aiin'); const q = inp.value.trim(); if (!q) return;
    inp.value = '';
    const h = aiHist(); h.push({ role: 'user', text: q }); saveHist(h);
    box.insertAdjacentHTML('beforeend', aiBubble({ role: 'user', text: q }) + '<div class="msg ai typing" id="aityping">likh raha hoon...</div>');
    box.scrollTop = box.scrollHeight;
    window.aiCtl = new AbortController();
    try {
      const r = await fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }), signal: window.aiCtl.signal });
      const d = await r.json();
      const text = d.answer || d.notice || d.error || 'Jawab nahi mila. Dobara koshish karein.';
      const h2 = aiHist(); h2.push({ role: 'ai', text }); saveHist(h2);
      const tp = document.getElementById('aityping'); if (tp) tp.remove();
      box.insertAdjacentHTML('beforeend', aiBubble({ role: 'ai', text }));
      box.scrollTop = box.scrollHeight;
    } catch (e) {
      const tp = document.getElementById('aityping'); if (tp) tp.remove();
      box.insertAdjacentHTML('beforeend', `<div class="msg ai">Error: ${esc(e.message)} <button class="btn sec" style="width:auto;padding:6px 10px;margin:4px 0 0" onclick="route()">Retry</button></div>`);
      box.scrollTop = box.scrollHeight;
    }
  };
  document.getElementById('aisend').onclick = send;
  document.getElementById('aiin').onkeydown = (e) => { if (e.key === 'Enter') send(); };
}
window.aiClear = () => { localStorage.removeItem(AI_HIST_KEY); route(); };
window.aiSuggest = (b) => { document.getElementById('aiin').value = b.textContent; document.getElementById('aisend').click(); };
window.aiStop = () => { if (window.aiCtl) window.aiCtl.abort(); };

// ---------- ROUTER ----------
const VIEWS = { dashboard: vDashboard, study: vStudy, tests: vTests, test: vTest, result: vResult, progress: vProgress, certificates: vCertificates, store: vStore, payments: vPayments, orders: vOrders, profile: vProfile, requests: vRequests, notifications: vNotifications, ai: vAI };
async function route() {
  const h = (location.hash || '#dashboard').slice(1);
  if (!STUDENT) {
    try { const p = await api('/api/student/profile'); STUDENT = p.student; } catch { return loginScreen(); }
  }
  nav.style.display = 'flex'; fab.style.display = 'block';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === h));
  const v = VIEWS[h] || vDashboard;
  try { await v(); } catch (e) { if (String(e.message).includes('Login')) { STUDENT = null; loginScreen(); } else toast(e.message); }
}
window.addEventListener('hashchange', route);
fab.onclick = () => { location.hash = '#ai'; };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
route();
