const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Configura las rutas del webhook
 * @param {Object} whatsappClient - Cliente de WhatsApp 
 * @returns {Object} - Router de Express
 */
module.exports = (whatsappClient) => {
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

  // Configuración del webhook
  router.post('/config', verifyToken, (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere una URL para el webhook' 
      });
    }
    
    try {
      // Guardar URL del webhook (en producción, esto iría a una base de datos)
      process.env.WEBHOOK_URL = url;
      
      res.json({ 
        success: true, 
        message: 'Webhook configurado correctamente', 
        url 
      });
    } catch (error) {
      console.error('Error al configurar webhook:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al configurar webhook', 
        error: error.message 
      });
    }
  });

  // Obtiene la configuración actual del webhook
  router.get('/config', verifyToken, (req, res) => {
    try {
      const webhookUrl = process.env.WEBHOOK_URL || '';
      
      res.json({ 
        success: true, 
        url: webhookUrl 
      });
    } catch (error) {
      console.error('Error al obtener configuración del webhook:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener configuración del webhook', 
        error: error.message 
      });
    }
  });

  // Configura el evento de mensaje para enviar al webhook
  if (whatsappClient) {
    whatsappClient.on('message', async (message) => {
      const webhookUrl = process.env.WEBHOOK_URL;
      
      // Si hay una URL de webhook configurada, enviar el mensaje
      if (webhookUrl) {
        try {
          // Preparar datos del mensaje
          const messageData = {
            from: message.from,
            to: message.to,
            body: message.body,
            hasMedia: message.hasMedia,
            timestamp: message.timestamp,
            type: message.type,
            isForwarded: message.isForwarded,
            id: message.id._serialized
          };
          
          // Enviar al webhook
          await axios.post(webhookUrl, {
            event: 'message',
            data: messageData
          }, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.SECURITY_TOKEN
            }
          });
          
          console.log(`Mensaje enviado al webhook: ${webhookUrl}`);
        } catch (error) {
          console.error('Error al enviar mensaje al webhook:', error.message);
        }
      }
    });
  }

  return router;
};