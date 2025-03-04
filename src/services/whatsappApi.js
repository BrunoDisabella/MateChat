/**
 * Servicio para interactuar con la API de WhatsApp Web
 */
class WhatsAppService {
  constructor(client) {
    this.client = client;
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