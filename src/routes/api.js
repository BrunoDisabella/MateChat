const express = require('express');
const router = express.Router();
const whatsappApi = require('../services/whatsappApi');

// Ruta para inicializar la conexión con WhatsApp
router.post('/whatsapp/initialize', async (req, res) => {
  try {
    const result = await whatsappApi.initialize();
    if (result.success) {
      res.status(200).json({
        success: true,
        businessInfo: result.businessInfo
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al inicializar la conexión con WhatsApp'
    });
  }
});

// Ruta para enviar un mensaje
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    // Validar parámetros
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los parámetros "to" y "message"'
      });
    }
    
    // Verificar conexión
    if (!whatsappApi.isConnected()) {
      return res.status(403).json({
        success: false,
        error: 'No hay conexión con WhatsApp. Inicialice primero.'
      });
    }
    
    const result = await whatsappApi.sendTextMessage(to, message);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar mensaje'
    });
  }
});

// Ruta para obtener conversaciones
router.get('/whatsapp/conversations', async (req, res) => {
  try {
    // Verificar conexión
    if (!whatsappApi.isConnected()) {
      return res.status(403).json({
        success: false,
        error: 'No hay conexión con WhatsApp. Inicialice primero.'
      });
    }
    
    const result = await whatsappApi.getConversations();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener conversaciones'
    });
  }
});

// Ruta para obtener mensajes de una conversación
router.get('/whatsapp/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar conexión
    if (!whatsappApi.isConnected()) {
      return res.status(403).json({
        success: false,
        error: 'No hay conexión con WhatsApp. Inicialice primero.'
      });
    }
    
    const result = await whatsappApi.getMessages(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener mensajes'
    });
  }
});

// Ruta para obtener estado de conexión
router.get('/whatsapp/status', (req, res) => {
  const connected = whatsappApi.isConnected();
  const businessInfo = whatsappApi.getBusinessInfo();
  
  res.status(200).json({
    success: true,
    connected,
    businessInfo
  });
});

module.exports = router;