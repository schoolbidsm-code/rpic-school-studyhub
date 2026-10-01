const aw = document.getElementById('aw');
let TAB = 'stats';
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function api(path, opts) {
  const r = await fetch(path, opts && { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
}
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }

const TABS = ['stats','students','activity','requests','questions','pdfs','products','orders','downloads','documents','exams','templates','watermark','razorpay','notifications','health','settings'];

async function boot() {
  try { await api('/api/admin/stats'); } catch { return login(); }
  render();
}
function login() {
  aw.innerHTML = `<div class="card" style="max-width:400px"><b>Admin Login</b>
    <input id="pw" type="password" placeholder="Admin password (.env ADMIN_PASSWORD)">
    <button class="btn" id="lg">Login</button></div>`;
  document.getElementById('lg').onclick = async () => {
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('pw').value }) }); render(); }
    catch (e) { toast(e.message); }
  };
}

async function render() {
  aw.innerHTML = `<div class="tabs">${TABS.map(t => `<button class="${t === TAB ? 'on' : ''}" onclick="TAB='${t}';render()">${t.toUpperCase()}</button>`).join('')}</div><div id="tb"><p class="muted">Loading...</p></div>`;
  const tb = document.getElementById('tb');
  try {
    if (TAB === 'stats') {
      const s = await api('/api/admin/stats');
      tb.innerHTML = `<div class="card"><div class="grid2">
        <div class="stat"><b>${s.students}</b><span>Total Students</span></div>
        <div class="stat"><b>${s.active_users_7d}</b><span>Active (7d)</span></div>
        <div class="stat"><b>${s.paid_orders}</b><span>Paid Orders</span></div>
        <div class="stat"><b>₹${s.revenue}</b><span>Revenue</span></div></div></div>`;
    }
    if (TAB === 'students') {
      const s = await api('/api/admin/students');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Code</th><th>Name</th><th>Mobile</th><th>Class</th><th>Joined</th></tr>
      ${s.students.map(x => `<tr><td>${esc(x.student_code)}</td><td>${esc(x.name)}</td><td>${esc(x.mobile)}</td><td>${esc(x.class)}</td><td>${esc(x.created_at)}</td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'activity') {
      const s = await api('/api/admin/login-activity');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Student</th><th>Device</th><th>Login</th><th>Logout</th></tr>
      ${s.activity.map(x => `<tr><td>${esc(x.name)} ${esc(x.mobile)}</td><td style="font-size:10px">${esc(x.device)}</td><td>${esc(x.login_at)}</td><td>${esc(x.logout_at) || '-'}</td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'questions') {
      const s = await api('/api/admin/questions');
      tb.innerHTML = `<div class="card"><b>Naya Question</b>
        <select id="qsub">${['Hindi','English','Mathematics','Science','Social Science','Computer'].map(x => `<option>${x}</option>`).join('')}</select>
        <input id="qch" placeholder="Chapter"><textarea id="qq" placeholder="Question"></textarea>
        <input id="qo" placeholder="Options (A,B,C,D comma se)"><input id="qa" placeholder="Answer (option text)">
        <button class="btn" id="addq">Add + Approve</button></div>
      <div class="card"><table class="table"><tr><th>Sub</th><th>Question</th><th>Approved</th><th></th></tr>
      ${s.questions.slice(0, 50).map(x => `<tr><td>${esc(x.subject)}</td><td style="max-width:300px">${esc(x.question).slice(0, 80)}</td><td>${x.approved ? '✔' : 'draft'}</td>
        <td>${x.approved ? '' : `<button onclick="approveQ(${x.id})">Approve</button> `}<button onclick="delQ(${x.id})">🗑</button></td></tr>`).join('')}</table></div>`;
      document.getElementById('addq').onclick = async () => {
        try {
          const opts = document.getElementById('qo').value.split(',').map(s => s.trim()).filter(Boolean);
          await api('/api/admin/questions', { method: 'POST', body: JSON.stringify({
            subject: document.getElementById('qsub').value, chapter: document.getElementById('qch').value,
            question: document.getElementById('qq').value, options: opts.length ? opts : null,
            answer: document.getElementById('qa').value, type: opts.length ? 'mcq' : 'short' }) });
          toast('Question add ho gaya'); render();
        } catch (e) { toast(e.message); }
      };
    }
    if (TAB === 'pdfs') {
      tb.innerHTML = `<div class="card"><b>PDF Upload (Admin file, private)</b>
        <form id="upf">
        <input name="name" placeholder="Product name" required>
        <select name="subject">${['Hindi','English','Mathematics','Science','Social Science','Computer'].map(x => `<option>${x}</option>`).join('')}</select>
        <input name="price" type="number" value="50" placeholder="Price ₹"><input name="mrp" type="number" value="50" placeholder="MRP ₹">
        <input name="session" value="2026-27">
        <input type="file" name="pdf" accept="application/pdf" required>
        <label><input type="checkbox" name="extract" value="yes"> Questions auto-extract karke draft me daalein (text PDF)</label>
        <button class="btn" type="submit">Upload</button></form></div>`;
      document.getElementById('upf').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target, fd = new FormData(f);
        fd.append('extract_questions', f.extract.checked ? 'yes' : 'no');
        const r = await fetch('/api/admin/pdfs', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) return toast(d.error || 'Upload fail');
        toast(d.notice || 'Upload ho gaya'); render();
      };
    }
    if (TAB === 'products') {
      const s = await api('/api/admin/products');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Code</th><th>Name</th><th>Price</th><th>MRP</th><th>Status</th><th></th></tr>
      ${s.products.map(x => `<tr><td>${esc(x.product_code)}</td><td>${esc(x.name)}</td>
        <td><input style="width:70px" id="pr${x.id}" value="${x.price}"></td><td><input style="width:70px" id="mr${x.id}" value="${x.mrp || ''}"></td>
        <td>${esc(x.status)}</td><td><button onclick="saveP(${x.id})">Save</button></td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'orders') {
      const s = await api('/api/admin/orders');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Order</th><th>Student</th><th>Kind</th><th>₹</th><th>Status</th><th>Delivery</th><th></th></tr>
      ${s.orders.map(x => `<tr><td>${esc(x.order_no)}</td><td>${esc(x.student_name)}</td><td>${esc(x.kind)}</td><td>${x.amount}</td>
        <td><select onchange="setO(${x.id},this.value,null)">${['PENDING','PROCESSING','PAID','FAILED','CANCELLED','REFUNDED'].map(st => `<option ${st === x.status ? 'selected' : ''}>${st}</option>`).join('')}</select></td>
        <td><select onchange="setO(${x.id},null,this.value)">${['Pending','Processing','Approved','Printed','Shipped','Delivered','Cancelled'].map(st => `<option ${st === x.delivery_status ? 'selected' : ''}>${st}</option>`).join('')}</select></td>
        <td>${esc(x.rzp_payment_id || '')}</td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'downloads') {
      const s = await api('/api/admin/downloads');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Student</th><th>Product</th><th>Order</th><th>When</th></tr>
      ${s.downloads.map(x => `<tr><td>${esc(x.student_name)}</td><td>${esc(x.product)}</td><td>${esc(x.order_no)}</td><td>${esc(x.downloaded_at)}</td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'documents') {
      const s = await api('/api/admin/documents');
      tb.innerHTML = `<div class="card"><table class="table"><tr><th>Doc ID</th><th>Type</th><th>Student</th><th>Status</th><th>Set</th></tr>
      ${s.documents.map(x => `<tr><td>${esc(x.doc_id)}</td><td>${esc(x.doc_type)}</td><td>${esc(x.student_name)}</td><td>${esc(x.status)}</td>
      <td><select onchange="setDoc('${esc(x.doc_id)}',this.value)">${['draft','generated','verified','official'].map(st => `<option ${st === x.status ? 'selected' : ''}>${st}</option>`).join('')}</select></td></tr>`).join('')}</table></div>`;
    }
    if (TAB === 'exams') {
      tb.innerHTML = `<div class="card"><b>Exam Date Add</b>
        <select id="et"><option>HALF-YEARLY</option><option>BOARD</option></select>
        <select id="es"><option value="">All Subjects</option>${['Hindi','English','Mathematics','Science','Social Science','Computer'].map(x => `<option>${x}</option>`).join('')}</select>
        <input id="ed" type="date"><input id="etm" type="time" value="10:30"><input id="esy" placeholder="Syllabus">
        <button class="btn" id="adde">Add Exam</button></div>`;
      const d = await api('/api/exams');
      tb.innerHTML += `<div class="card"><table class="table"><tr><th>Type</th><th>Subject</th><th>Date</th><th>Time</th><th></th></tr>
      ${d.exams.map(x => `<tr><td>${esc(x.exam_type)}</td><td>${esc(x.subject || 'All')}</td><td>${esc(x.exam_date)}</td><td>${esc(x.exam_time)}</td><td><button onclick="delE(${x.id})">🗑</button></td></tr>`).join('')}</table></div>`;
      document.getElementById('adde').onclick = async () => {
        try { await api('/api/admin/exams', { method: 'POST', body: JSON.stringify({ exam_type: document.getElementById('et').value, subject: document.getElementById('es').value || null, exam_date: document.getElementById('ed').value, exam_time: document.getElementById('etm').value, syllabus: document.getElementById('esy').value }) }); toast('Exam add ho gaya, sabhi students ke liye update'); render(); } catch (e) { toast(e.message); }
      };
    }
    if (TAB === 'templates') {
      const s = await api('/api/admin/templates');
      tb.innerHTML = `<div class="card"><b>Templates</b>
        ${Object.entries(s.templates).map(([t, st]) => `<div class="row" style="margin:6px 0"><span style="flex:1">${t}</span><span class="pill ${st === 'loaded' ? 'ok' : 'bad'}">${st}</span></div>`).join('')}
        <button class="btn sec" onclick="dlT()">Default templates download karein</button></div>
      <div class="card"><b>Field Mapping</b><p class="muted">Template par field ki position (% me x,y,width,height) set karein. Ek baar set karne ke baad documents automatic bharenge.</p>
        <select id="mtt"><option>certificate</option><option>report</option><option>idcard</option></select>
        <select id="mfl">${['student_name','student_id','student_photo','class','session','roll_no','date','certificate_id','achievement','qr','watermark','hindi','english','mathematics','science','social_science','computer','total','percentage','school','validity'].map(f => `<option>${f}</option>`).join('')}</select>
        <input id="mx" placeholder="x %"><input id="my" placeholder="y %"><input id="mw" placeholder="width %"><input id="mh" placeholder="height %"><input id="mfs" placeholder="font size % of height">
        <button class="btn" id="savemap">Save Mapping</button>
        ${Object.entries(s.maps).filter(([, v]) => v.length).map(([t, v]) => `<p style="margin-top:10px"><b>${t}</b></p>` + v.map(m => `<div class="row" style="font-size:12px"><span style="flex:1">${esc(m.field)}: x=${m.x} y=${m.y} w=${m.w} h=${m.h}</span><button onclick="delMap(${m.id})">🗑</button></div>`).join('')).join('')}</div>`;
      document.getElementById('savemap').onclick = async () => {
        try { await api('/api/admin/field-map', { method: 'POST', body: JSON.stringify({ template_type: document.getElementById('mtt').value, field: document.getElementById('mfl').value, x: +document.getElementById('mx').value, y: +document.getElementById('my').value, w: +document.getElementById('mw').value, h: +document.getElementById('mh').value, font_size: +document.getElementById('mfs').value || 2 }) }); toast('Mapping save'); render(); } catch (e) { toast(e.message); }
      };
    }
    if (TAB === 'watermark') {
      const s = await api('/api/admin/watermark');
      const w = s.watermark;
      tb.innerHTML = `<div class="card"><b>Watermark / Branding</b>
        <form id="wmf">
        <label><input type="checkbox" name="enabled" ${w.enabled ? 'checked' : ''}> Enable</label>
        <input type="file" name="logo" accept="image/*">
        <input name="opacity" value="${w.opacity ?? 0.2}" placeholder="Opacity 0-1">
        <input name="size" value="${w.size ?? 0.3}" placeholder="Size (0-1 of width)">
        <select name="position">${['center','top-left','top-right','bottom-left','bottom-right'].map(p => `<option ${p === w.position ? 'selected' : ''}>${p}</option>`).join('')}</select>
        <input name="rotation" value="${w.rotation ?? 0}" placeholder="Rotation degrees">
        <button class="btn" type="submit">Save</button></form></div>`;
      document.getElementById('wmf').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.append('enabled', e.target.enabled.checked ? 'yes' : 'no');
        const r = await fetch('/api/admin/watermark', { method: 'POST', body: fd });
        const d = await r.json(); r.ok ? (toast('Watermark save ho gaya'), render()) : toast(d.error);
      };
    }
    if (TAB === 'razorpay') {
      const s = await api('/api/admin/razorpay');
      const cls = s.status === 'connected' ? 'ok' : s.status === 'failed' ? 'bad' : '';
      tb.innerHTML = `<div class="card"><b>Razorpay</b><p><span class="pill ${cls}">${s.status.toUpperCase()}</span> ${s.mode ? '(' + s.mode + ')' : ''}</p>
        <p class="muted" style="margin-top:8px">Razorpay Key ID, Key Secret aur Webhook Secret server ke .env file me set hote hain (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET). Frontend me kabhi nahi. Yahan connect ho jaye to "Connected" dikhega.</p></div>`;
    }
    if (TAB === 'settings') {
      const s = await api('/api/admin/settings');
      tb.innerHTML = `<div class="card"><b>School Settings</b>
        <label>School Name</label><input id="snm" value="${esc(s.school)}">
        <label>Session</label><input id="ssn" value="${esc(s.session)}">
        <button class="btn" id="sv">Save</button></div>`;
      document.getElementById('sv').onclick = async () => {
        try { await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ school_name: document.getElementById('snm').value, session: document.getElementById('ssn').value }) }); toast('Save ho gaya'); } catch (e) { toast(e.message); }
      };
    }
    if (TAB === 'requests') {
      const s = await api('/api/admin/requests');
      tb.innerHTML = `<div class="card"><b>PDF Requests</b>
        ${s.requests.length ? `<table class="table"><tr><th>Request</th><th>Student</th><th>Subject</th><th>Status</th><th>Price</th><th>Action</th></tr>
        ${s.requests.map(r => `<tr><td>${esc(r.request_no)}<br><small class="muted">${esc(r.created_at)}</small></td><td>${esc(r.student_name || '')}<br><small class="muted">${esc(r.student_code || '')}</small></td><td>${esc(r.subject)}${r.message ? '<br><small class="muted">' + esc(r.message).slice(0, 80) + '</small>' : ''}</td><td><span class="pill">${esc(r.status)}</span>${r.admin_note ? '<br><small class="muted">' + esc(r.admin_note).slice(0, 60) + '</small>' : ''}</td><td>${r.price != null ? 'Rs ' + r.price : '-'}</td>
        <td style="white-space:nowrap">
          <input id="rp${r.id}" placeholder="Rs" style="width:52px" value="${r.price ?? ''}">
          <button onclick="setR(${r.id},'UNDER_REVIEW')">Review</button>
          <button onclick="setR(${r.id},'APPROVED')">Approve</button>
          <button onclick="setR(${r.id},'PAYMENT_REQUIRED')">Pay Maango</button>
          <button onclick="setR(${r.id},'UNLOCKED')">Unlock</button>
          <button onclick="setR(${r.id},'COMPLETED')">Complete</button>
          <button onclick="setR(${r.id},'REJECTED')">Reject</button>
        </td></tr>`).join('')}</table>` : '<p class="muted">Abhi koi request nahi aayi.</p>'}
        <p class="muted" style="margin-top:8px">Flow: REQUESTED → UNDER_REVIEW → APPROVED (price set) → PAYMENT_REQUIRED → (student pays, auto PAID) → PDF attach karke UNLOCKED → COMPLETED. Student ko har status change ka notification milta hai.</p></div>`;
    }
    if (TAB === 'notifications') {
      const s = await api('/api/admin/notifications');
      tb.innerHTML = `<div class="card"><b>Admin Notifications</b>${s.notifications.length ? s.notifications.map(n => `<div class="row" style="border-bottom:1px solid #eef1f6;padding:8px 0"><div style="flex:1"><b>${esc(n.title)}</b><br><small class="muted">${esc(n.body)}</small></div><small class="muted">${esc(n.created_at)}</small></div>`).join('') : '<p class="muted">Koi notification nahi.</p>'}</div>`;
    }
    if (TAB === 'health') {
      const s = await api('/api/admin/health');
      const cls = (v) => v === 'Connected' ? 'ok' : v === 'Error' ? 'bad' : '';
      tb.innerHTML = `<div class="card"><b>System Health</b><div class="grid2" style="margin-top:8px">${Object.entries(s.checks).map(([k, v]) => `<div class="stat"><span class="pill ${cls(v)}">${esc(v)}</span><span style="margin-top:6px">${esc(k)}</span></div>`).join('')}</div>
        <p class="muted" style="margin-top:8px">Uptime: ${Math.round(s.uptime_s / 60)} minute · ${esc(s.time)} (server time)</p>
        <p class="muted">Status yahan asli checks se aata hai. "Not Configured" ka matlab: us service ki key .env me set nahi hai. 24/7 chalane ke liye app ko production hosting par deploy karna hoga; free-tier hosting band ho sakti hai.</p></div>`;
    }
  } catch (e) { tb.innerHTML = `<div class="card"><p class="pill bad">Error</p><p class="muted">${esc(e.message)}</p></div>`; }
}
window.approveQ = async (id) => { await api(`/api/admin/questions/${id}/approve`, { method: 'POST' }); toast('Approved'); render(); };
window.delQ = async (id) => { await api(`/api/admin/questions/${id}`, { method: 'DELETE' }); render(); };
window.saveP = async (id) => { await api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify({ price: +document.getElementById('pr' + id).value, mrp: +document.getElementById('mr' + id).value }) }); toast('Product save'); };
window.setO = async (id, status, delivery) => { await api(`/api/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, delivery_status: delivery }) }); toast('Order update'); };
window.setDoc = async (docId, status) => { await api(`/api/admin/documents/${docId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Status set: ' + status); };
window.delE = async (id) => { await api(`/api/admin/exams/${id}`, { method: 'DELETE' }); render(); };
window.delMap = async (id) => { await api(`/api/admin/field-map/${id}`, { method: 'DELETE' }); render(); };
window.setR = async (id, status) => { try { const el = document.getElementById('rp' + id); const price = el && el.value !== '' ? +el.value : undefined; await api(`/api/admin/requests/${id}`, { method: 'PUT', body: JSON.stringify({ status, price }) }); toast('Request update: ' + status); render(); } catch (e) { toast(e.message); } };
window.dlT = async () => { const d = await api('/api/admin/templates/download', { method: 'POST' }); toast(JSON.stringify(d.result)); render(); };
boot();
