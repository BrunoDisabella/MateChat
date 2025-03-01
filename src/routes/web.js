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
  
  // Añadir parámetro para forzar acceso (para depuración)
  const forceAccess = req.query.force === 'true';
  
  // Log detallado para depuración
  console.log('Acceso a /chat:', {
    whatsappServiceExists: !!whatsappService,
    isConnected: whatsappService ? whatsappService.isConnected : false,
    userAgent: req.headers['user-agent'],
    forceAccess: forceAccess
  });
  
  // Verificar si WhatsApp está conectado o si hay un parámetro de fuerza
  if (forceAccess || (whatsappService && whatsappService.isConnected)) {
    console.log('Renderizando página de chat');
    res.render('chat');
  } else {
    // Redirigir a la página principal si no hay conexión
    console.log('Intentando acceder a /chat sin WhatsApp conectado. Redirigiendo a inicio.');
    res.redirect('/?reason=no_connection');
  }
});

module.exports = router;