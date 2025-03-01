const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const whatsappController = require('../controllers/whatsappController');

// Message routes
router.get('/messages', messageController.getMessages);
router.get('/messages/:id', messageController.getMessageById);
router.post('/messages', messageController.createMessage);
router.put('/messages/:id/status', messageController.updateMessageStatus);

// WhatsApp routes
router.post('/whatsapp-webhook', whatsappController.handleWebhook);
router.post('/send-message', whatsappController.sendMessage);
router.get('/whatsapp-status', whatsappController.getStatus);

// Endpoint para acuse de recibo de conexión (para depuración)
router.post('/acknowledge-connection', (req, res) => {
  console.log('Cliente reconoce conexión exitosa:', req.body);
  res.status(200).json({ success: true });
});

module.exports = router;