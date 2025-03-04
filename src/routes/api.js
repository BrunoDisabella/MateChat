const express = require('express');
const router = express.Router();

/**
 * Configura las rutas de la API
 * @param {Object} whatsappService - Servicio de WhatsApp
 * @returns {Object} - Router de Express
 */
module.exports = (whatsappService) => {
  // Middleware para verificar token de seguridad
  const verifyToken = (req, res, next) => {
    const token = req.headers['x-api-key'] || req.query.token;
    const securityToken = process.env.SECURITY_TOKEN;
    
    if (!token || token !== securityToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'No autorizado. Token inválido o faltante.' 
      });
    }
    
    next();
  };

  // Ruta para verificar estado de la API
  router.get('/status', verifyToken, (req, res) => {
    const status = whatsappService.getStatus();
    res.json(status);
  });
  
  // Ruta para obtener todos los chats
  router.get('/chats', verifyToken, async (req, res) => {
    try {
      const result = await whatsappService.getAllChats();
      res.json(result);
    } catch (error) {
      console.error('Error en /api/chats:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener chats', 
        error: error.message 
      });
    }
  });
  
  // Ruta para obtener mensajes de un chat específico
  router.get('/chats/:chatId/messages', verifyToken, async (req, res) => {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    if (!chatId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere ID de chat' 
      });
    }
    
    try {
      const result = await whatsappService.getChatMessages(chatId, limit);
      res.json(result);
    } catch (error) {
      console.error('Error en /api/chats/:chatId/messages:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener mensajes', 
        error: error.message 
      });
    }
  });

  // Ruta para enviar mensaje
  router.post('/send', verifyToken, async (req, res) => {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requieren los campos "to" y "message"' 
      });
    }
    
    try {
      const result = await whatsappService.sendMessage(to, message);
      res.json(result);
    } catch (error) {
      console.error('Error en /api/send:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al enviar mensaje', 
        error: error.message 
      });
    }
  });

  // Ruta para verificar si un número está registrado en WhatsApp
  router.get('/check/:number', verifyToken, async (req, res) => {
    const { number } = req.params;
    
    if (!number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un número de teléfono' 
      });
    }
    
    try {
      const result = await whatsappService.checkNumberStatus(number);
      res.json(result);
    } catch (error) {
      console.error('Error en /api/check:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al verificar número', 
        error: error.message 
      });
    }
  });

  // Ruta para enviar mensaje a un grupo
  router.post('/send-group', verifyToken, async (req, res) => {
    const { groupId, message } = req.body;
    
    if (!groupId || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requieren los campos "groupId" y "message"' 
      });
    }
    
    try {
      const result = await whatsappService.sendGroupMessage(groupId, message);
      res.json(result);
    } catch (error) {
      console.error('Error en /api/send-group:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al enviar mensaje al grupo', 
        error: error.message 
      });
    }
  });

  return router;
};