const express = require('express');
const router = express.Router();

// Home page with QR code scanner
router.get('/', (req, res) => {
  res.render('index');
});

// Chat interface with connection check
router.get('/chat', (req, res) => {
  // Obtener el servicio de WhatsApp
  const whatsappService = req.app.get('whatsappService');
  
  // Verificar si WhatsApp está conectado
  if (whatsappService && whatsappService.isConnected) {
    res.render('chat');
  } else {
    // Redirigir a la página principal si no hay conexión
    console.log('Intentando acceder a /chat sin WhatsApp conectado. Redirigiendo a inicio.');
    res.redirect('/');
  }
});

module.exports = router;