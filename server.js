require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/student'));
app.use(require('./src/routes/tests'));
app.use(require('./src/routes/progress').router);
app.use(require('./src/routes/documents'));
app.use(require('./src/routes/verify'));
app.use(require('./src/routes/payments'));
app.use(require('./src/routes/requests'));
app.use(require('./src/routes/system'));
app.use(require('./src/routes/features'));
app.use(require('./src/routes/admin'));

// Ask RPIC AI: floating assistant (Hindi/English/Hinglish). Needs OPENAI-compatible key or fallback notice.
app.post('/api/ai/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Sawal likhein' });
  if (!process.env.AI_API_KEY) return res.json({ ok: false, notice: 'AI abhi configure nahi hai. Admin panel me AI_API_KEY set karein.' });
  try {
    const r = await fetch(process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', messages: [
        { role: 'system', content: 'You are Ask RPIC AI, a friendly Class 10 UP Board study helper. Reply in the language the student used (Hindi, English or Hinglish). Explain questions, chapters, formulas, definitions, revision and doubts simply. Never claim your answer is an official board answer.' },
        { role: 'user', content: String(question).slice(0, 2000) }], max_tokens: 800 })
    });
    const data = await r.json();
    res.json({ ok: true, answer: data.choices && data.choices[0] ? data.choices[0].message.content : 'Jawab nahi mil paya' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RPIC SCHOOL - CLASS 10 STUDY HUB running on port ${PORT}`));
