# RPIC SCHOOL — CLASS 10 STUDY HUB
UP BOARD • 2026–27 • Developed by Divyansh Singh

Mobile-first educational PWA: real Express backend + SQLite database + OTP login +
question bank + tests + progress + certificate/report/ID card generation from the
exact user templates with QR verification + Razorpay paid PDFs with server-side
signature verification + ID card orders + admin panel.

## Chalane ka tarika (VPS / Railway / Render / Render-like)

1. Node 20+ chahiye.
2. `npm install`
3. `cp .env.example .env` — values bharo (kam se kam `ADMIN_PASSWORD`, `JWT_SECRET`).
4. `npm start` — app `http://localhost:3000` par chalega.
5. First login: koi bhi mobile number → OTP server log me print hoga (dev mode).
   Production me `OTP_PROVIDER=msg91|twilio` + credentials set karo, tab real SMS jayega.
6. Razorpay: `.env` me `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
   Jab tak set nahi hain, app saaf saaf "Razorpay is not configured" dikhata hai — fake success kabhi nahi.
7. Hosting: Railway/Render par repo deploy karo, start command `npm start`, ek persistent
   disk `/data` par mount karke env `DATA_DIR` (code path.join se `data/` use karta hai) use karo.

## Kya REAL hai, kya user-configured

REAL (code me chal raha hai):
- OTP login flow (dev/log mode + msg91/twilio provider ready)
- Student dashboard, profile, photo, streak, BIP ledger (educational points only)
- Question bank (MCQ/short/long), mock test 20–100 Q, timer, autosave, auto-submit, results
- Progress compute actual submitted tests se (no fake marks)
- Certificate + Progress Report generation overlaying the exact user template images
  with admin field mapping, watermark system, unique IDs (CERT/REPORT/ID-2026-XXXXXX),
  QR → public verification page (`/verify/<doc-id>`)
- Digital ID card module
- Razorpay order create → checkout → signature verify → API double-check → webhook;
  statuses PENDING/PROCESSING/PAID/FAILED/CANCELLED/REFUNDED; unlock only after server verify
- Protected PDFs: private admin storage, authenticated download endpoint (403 unauthorized),
  per-order unique access code (bcrypt hashed), download logs
- ID card physical order flow with Order ID + delivery status
- Admin panel: stats, students, login activity, questions (add/approve/delete),
  PDF upload + text extraction drafts, products price/MRP, orders, downloads, documents status,
  exam dates (countdown updates for all students), templates + field mapping, watermark, Razorpay status
- PWA: manifest + service worker + icons

USER-CONFIGURED (aapke account se):
- Razorpay keys (dashboard se Test/Live)
- SMS OTP provider account
- Production hosting/domain
- Official RPIC logo (public/ me `logo.png` daalein; topbar aur ID card use karega)
- AI key for Ask RPIC AI (optional)

## Tests
`npm start` ke baad: login flow, test create/submit, report generate, product buy flow (test mode keys).
