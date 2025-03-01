const express = require('express');
const router = express.Router();

// Home page with QR code scanner
router.get('/', (req, res) => {
  res.render('index');
});

// Chat interface
router.get('/chat', (req, res) => {
  res.render('chat');
});

module.exports = router;