const express = require('express');
const { verificationPayload } = require('../documents');

const router = express.Router();

// public verification page payload - only authorized fields
router.get('/api/verify/:docId', (req, res) => {
  const p = verificationPayload(req.params.docId);
  if (!p) return res.status(404).json({ valid: false, error: 'Document not found' });
  res.json({ valid: true, ...p });
});

module.exports = router;
