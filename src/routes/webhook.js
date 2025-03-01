const express = require('express');
const router = express.Router();

// Implementación del webhook para recibir eventos de WhatsApp
router.post('/whatsapp', (req, res) => {
  try {
    const { body } = req;
    console.log('Webhook recibido:', JSON.stringify(body, null, 2));
    
    // Procesar mensajes entrantes
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      
      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          if (change.field === 'messages') {
            const messages = change.value?.messages || [];
            
            for (const message of messages) {
              // Procesar el mensaje
              const from = message.from;
              const messageId = message.id;
              const timestamp = message.timestamp;
              
              // Determinar el tipo de mensaje
              if (message.type === 'text') {
                const text = message.text?.body;
                console.log(`Mensaje de texto recibido de ${from}: ${text}`);
                
                // Aquí puedes implementar lógica para responder automáticamente
                // o almacenar el mensaje en una base de datos
              } else if (message.type === 'image') {
                console.log(`Imagen recibida de ${from}`);
              } else if (message.type === 'document') {
                console.log(`Documento recibido de ${from}`);
              } else {
                console.log(`Otro tipo de mensaje recibido de ${from}`);
              }
            }
          }
        }
      }
    }
    
    // Devolver un 200 OK para confirmar la recepción del webhook
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error al procesar webhook:', error);
    res.status(500).send('ERROR');
  }
});

// Verificación de webhook (requerido por WhatsApp)
router.get('/whatsapp', (req, res) => {
  try {
    // Estos valores deberían estar en el archivo .env
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'matechat_verify_token';
    
    // Parámetros de la solicitud
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Verificar el modo y el token
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responder con el desafío para verificar
      console.log('Webhook verificado');
      res.status(200).send(challenge);
    } else {
      // Error de verificación
      console.log('Verificación de webhook fallida');
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('Error en verificación de webhook:', error);
    res.sendStatus(500);
  }
});

module.exports = router;