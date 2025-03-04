/**
 * Servicio para interactuar con la API de WhatsApp Web
 */
class WhatsAppService {
  constructor(client) {
    this.client = client;
    this.chatCache = {}; // Caché para almacenar información de chats
  }
  
  /**
   * Obtiene todos los chats del usuario
   * @returns {Promise<Array>} - Lista de chats
   */
  async getAllChats() {
    try {
      const chats = await this.client.getChats();
      
      // Mapear chats para incluir solo la información necesaria
      const formattedChats = await Promise.all(chats.map(async (chat) => {
        const lastMessage = chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp,
          fromMe: chat.lastMessage.fromMe
        } : null;
        
        let profilePic = null;
        try {
          if (!chat.isGroup) {
            profilePic = await this.client.getProfilePicUrl(chat.id._serialized);
          }
        } catch (err) {
          console.log(`No se pudo obtener foto de perfil para ${chat.name}`);
        }
        
        return {
          id: chat.id._serialized,
          name: chat.name,
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          timestamp: chat.timestamp,
          lastMessage,
          profilePic
        };
      }));
      
      // Ordenar chats por timestamp descendente (más recientes primero)
      formattedChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Almacenar en caché
      this.chatCache = formattedChats.reduce((acc, chat) => {
        acc[chat.id] = chat;
        return acc;
      }, {});
      
      return {
        success: true,
        chats: formattedChats
      };
    } catch (error) {
      console.error('Error al obtener chats:', error);
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener chats'
      };
    }
  }
  
  /**
   * Obtiene los mensajes de un chat específico
   * @param {string} chatId - ID del chat
   * @param {number} limit - Número de mensajes a obtener (defecto: 50)
   * @returns {Promise<Array>} - Lista de mensajes
   */
  async getChatMessages(chatId, limit = 50) {
    try {
      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      // Mapear mensajes para incluir solo la información necesaria
      const formattedMessages = messages.map(msg => ({
        id: msg.id._serialized,
        body: msg.body,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        hasMedia: msg.hasMedia,
        type: msg.type,
        sender: msg.from
      }));
      
      return {
        success: true,
        messages: formattedMessages,
        chatInfo: this.chatCache[chatId] || {
          id: chatId,
          name: chat.name,
          isGroup: chat.isGroup
        }
      };
    } catch (error) {
      console.error('Error al obtener mensajes de chat:', error);
      return {
        success: false,
        error: error.message,
        message: 'Error al obtener mensajes'
      };
    }
  }

  /**
   * Envía un mensaje de texto a un número de WhatsApp
   * @param {string} to - Número de teléfono con código de país (ej: 54XXXXXXXXXX@c.us)
   * @param {string} message - Mensaje a enviar
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendMessage(to, message) {
    try {
      // Validar formato del número
      if (!to.includes('@c.us')) {
        to = `${to}@c.us`;
      }

      // Enviar el mensaje
      const response = await this.client.sendMessage(to, message);
      
      return {
        success: true,
        messageId: response.id.id,
        timestamp: response.timestamp,
        message: 'Mensaje enviado correctamente'
      };
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      return {
        success: false,
        error: error.message,
        message: 'Error al enviar mensaje'
      };
    }
  }

  /**
   * Verifica si un número está registrado en WhatsApp
   * @param {string} number - Número de teléfono con código de país (sin @c.us)
   * @returns {Promise<Object>} - Estado de verificación
   */
  async checkNumberStatus(number) {
    try {
      // Validar y formatear el número si es necesario
      if (number.includes('@c.us')) {
        number = number.split('@')[0];
      }
      
      const response = await this.client.isRegisteredUser(`${number}@c.us`);
      
      return {
        success: true,
        isRegistered: response,
        number
      };
    } catch (error) {
      console.error('Error al verificar número:', error);
      return {
        success: false,
        error: error.message,
        number
      };
    }
  }

  /**
   * Envía un mensaje a un chat grupal
   * @param {string} groupId - ID del grupo (ej: XXXXXX@g.us)
   * @param {string} message - Mensaje a enviar
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendGroupMessage(groupId, message) {
    try {
      // Validar formato del ID del grupo
      if (!groupId.includes('@g.us')) {
        groupId = `${groupId}@g.us`;
      }

      const response = await this.client.sendMessage(groupId, message);
      
      return {
        success: true,
        messageId: response.id.id,
        timestamp: response.timestamp,
        message: 'Mensaje de grupo enviado correctamente'
      };
    } catch (error) {
      console.error('Error al enviar mensaje al grupo:', error);
      return {
        success: false,
        error: error.message,
        message: 'Error al enviar mensaje al grupo'
      };
    }
  }

  /**
   * Obtiene el estado del cliente de WhatsApp
   * @returns {Object} - Estado del cliente
   */
  getStatus() {
    try {
      const status = {
        connected: this.client.info !== undefined,
        info: this.client.info || {}
      };
      
      return {
        success: true,
        status
      };
    } catch (error) {
      console.error('Error al obtener estado:', error);
      return {
        success: false,
        error: error.message,
        status: { connected: false }
      };
    }
  }
}

module.exports = WhatsAppService;