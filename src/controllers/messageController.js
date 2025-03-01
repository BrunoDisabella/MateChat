// Obtener todos los mensajes
exports.getMessages = async (req, res) => {
  try {
    const { limit = 50, phoneNumber } = req.query;
    
    // Obtener el servicio de WhatsApp
    const whatsappService = req.app.get('whatsappService');
    
    if (!whatsappService) {
      console.warn('Servicio de WhatsApp no inicializado, devolviendo matriz vacía');
      return res.json([]);
    }
    
    // Filtrar mensajes en memoria
    let messages = [...whatsappService.messageMemory]; // Copia para no modificar el original
    
    if (phoneNumber) {
      messages = messages.filter(msg => msg.phoneNumber === phoneNumber);
    }
    
    // Ordenar por fecha (más reciente primero)
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limitar resultados
    if (limit && limit > 0) {
      messages = messages.slice(0, parseInt(limit));
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'No se pudieron obtener los mensajes' });
  }
};

// Obtener mensaje por ID
exports.getMessageById = async (req, res) => {
  try {
    const messageId = req.params.id;
    
    // Obtener el servicio de WhatsApp
    const whatsappService = req.app.get('whatsappService');
    
    if (!whatsappService) {
      console.warn('Servicio de WhatsApp no inicializado, mensaje no encontrado');
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    // Buscar mensaje en memoria
    const message = whatsappService.messageMemory.find(msg => msg.messageId === messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error al obtener mensaje:', error);
    res.status(500).json({ error: 'No se pudo obtener el mensaje' });
  }
};

// Crear un nuevo mensaje (para propósitos de prueba)
exports.createMessage = async (req, res) => {
  try {
    const { messageId, phoneNumber, content } = req.body;
    
    if (!messageId || !phoneNumber || !content) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Obtener el servicio de WhatsApp
    const whatsappService = req.app.get('whatsappService');
    
    if (!whatsappService) {
      console.warn('Servicio de WhatsApp no inicializado, creando mensaje simulado');
      const mockMessage = {
        messageId,
        phoneNumber,
        content,
        timestamp: new Date(),
        responseStatus: 'Pending'
      };
      return res.status(201).json(mockMessage);
    }
    
    // Crear nuevo mensaje en memoria
    const newMessage = {
      messageId,
      phoneNumber,
      content,
      timestamp: new Date(),
      responseStatus: 'Pending'
    };
    
    // Agregar a la memoria
    whatsappService.messageMemory.push(newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error al crear mensaje:', error);
    res.status(500).json({ error: 'No se pudo crear el mensaje' });
  }
};

// Actualizar estado del mensaje
exports.updateMessageStatus = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { responseStatus } = req.body;
    
    if (!responseStatus || !['Pending', 'Responded'].includes(responseStatus)) {
      return res.status(400).json({ error: 'Estado de respuesta inválido' });
    }
    
    // Obtener el servicio de WhatsApp
    const whatsappService = req.app.get('whatsappService');
    
    if (!whatsappService) {
      console.warn('Servicio de WhatsApp no inicializado, actualizando mensaje simulado');
      return res.json({ messageId, responseStatus });
    }
    
    // Encontrar y actualizar mensaje en memoria
    const messageIndex = whatsappService.messageMemory.findIndex(msg => msg.messageId === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    // Actualizar el mensaje
    whatsappService.messageMemory[messageIndex].responseStatus = responseStatus;
    const updatedMessage = whatsappService.messageMemory[messageIndex];
    
    res.json(updatedMessage);
  } catch (error) {
    console.error('Error al actualizar estado del mensaje:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado del mensaje' });
  }
};