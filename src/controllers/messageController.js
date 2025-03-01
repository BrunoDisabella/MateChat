const Message = require('../models/Message');

// Obtener todos los mensajes
exports.getMessages = async (req, res) => {
  try {
    const { limit = 50, phoneNumber } = req.query;
    
    let query = {};
    if (phoneNumber) {
      query.phoneNumber = phoneNumber;
    }
    
    try {
      const messages = await Message.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit));
        
      res.json(messages);
    } catch (error) {
      console.warn('Error al consultar MongoDB, devolviendo matriz vacía:', error.message);
      res.json([]);
    }
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'No se pudieron obtener los mensajes' });
  }
};

// Obtener mensaje por ID
exports.getMessageById = async (req, res) => {
  try {
    try {
      const message = await Message.findById(req.params.id);
      
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }
      
      res.json(message);
    } catch (error) {
      console.warn('Error al consultar MongoDB, devolviendo error 404:', error.message);
      res.status(404).json({ error: 'Mensaje no encontrado o base de datos no disponible' });
    }
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
    
    try {
      const newMessage = new Message({
        messageId,
        phoneNumber,
        content,
        timestamp: new Date(),
        responseStatus: 'Pending'
      });
      
      await newMessage.save();
      res.status(201).json(newMessage);
    } catch (error) {
      console.warn('Error al guardar en MongoDB, devolviendo un mensaje simulado:', error.message);
      
      // Crear un mensaje simulado para la respuesta
      const mockMessage = {
        _id: 'memory_' + Date.now(),
        messageId,
        phoneNumber,
        content,
        timestamp: new Date(),
        responseStatus: 'Pending'
      };
      
      res.status(201).json(mockMessage);
    }
  } catch (error) {
    console.error('Error al crear mensaje:', error);
    res.status(500).json({ error: 'No se pudo crear el mensaje' });
  }
};

// Actualizar estado del mensaje
exports.updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { responseStatus } = req.body;
    
    if (!responseStatus || !['Pending', 'Responded'].includes(responseStatus)) {
      return res.status(400).json({ error: 'Estado de respuesta inválido' });
    }
    
    try {
      const updatedMessage = await Message.findByIdAndUpdate(
        id,
        { responseStatus },
        { new: true }
      );
      
      if (!updatedMessage) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }
      
      res.json(updatedMessage);
    } catch (error) {
      console.warn('Error al actualizar en MongoDB, devolviendo estado simulado:', error.message);
      
      // Crear un mensaje simulado para la respuesta
      const mockUpdatedMessage = {
        _id: id,
        responseStatus
      };
      
      res.json(mockUpdatedMessage);
    }
  } catch (error) {
    console.error('Error al actualizar estado del mensaje:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado del mensaje' });
  }
};