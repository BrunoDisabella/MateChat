let whatsappService = null;

exports.setWhatsAppService = (service) => {
  whatsappService = service;
};

// Handle incoming messages from WhatsApp
exports.handleWebhook = async (req, res) => {
  // This endpoint is for N8N to receive WhatsApp messages
  // The actual message handling is done in the whatsappService
  console.log('Webhook recibido:', req.body);
  res.status(200).json({ status: 'received' });
};

// Send a message via WhatsApp
exports.sendMessage = async (req, res) => {
  try {
    const { phoneNumber, content } = req.body;
    
    if (!phoneNumber || !content) {
      return res.status(400).json({ error: 'Phone number and content are required' });
    }
    
    if (!whatsappService) {
      return res.status(500).json({ error: 'WhatsApp service not initialized' });
    }
    
    if (!whatsappService.isConnected) {
      return res.status(503).json({ error: 'WhatsApp is not connected' });
    }
    
    const response = await whatsappService.sendMessage(phoneNumber, content);
    res.status(200).json({ status: 'sent', messageId: response.id._serialized });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
};

// Get the current WhatsApp connection status
exports.getStatus = (req, res) => {
  if (!whatsappService) {
    return res.status(500).json({ error: 'WhatsApp service not initialized' });
  }

  // Verificar el estado real del cliente
  try {
    if (whatsappService.client && whatsappService.isConnected) {
      // Intentar obtener información adicional para verificar que la conexión es real
      whatsappService.client.getState()
        .then(state => {
          console.log('Estado real de WhatsApp API:', state);
          const status = whatsappService.getStatus();
          status.state = state;
          res.json(status);
        })
        .catch(err => {
          console.warn('Error al obtener estado real de la API:', err);
          // Continuar con el estado básico
          const status = whatsappService.getStatus();
          res.json(status);
        });
    } else {
      // Devolver el estado básico
      const status = whatsappService.getStatus();
      res.json(status);
    }
  } catch (error) {
    console.error('Error al verificar estado:', error);
    // En caso de error, devolver estado básico
    const status = whatsappService.getStatus();
    res.json(status);
  }
};