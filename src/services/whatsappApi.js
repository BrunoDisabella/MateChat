const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

class WhatsAppAPI {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: whatsappConfig.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whatsappConfig.accessToken}`
      }
    });
    
    this.phoneNumberId = whatsappConfig.phoneNumberId;
    this.connected = false;
    this.businessInfo = null;
  }

  /**
   * Inicializa la conexión con la API de WhatsApp
   */
  async initialize() {
    try {
      // Verificar que las credenciales estén configuradas
      whatsappConfig.validateConfig();
      
      // Verificar estado de la cuenta de negocio
      const response = await this.getBusinessProfile();
      this.businessInfo = response.data;
      this.connected = true;
      
      return {
        success: true,
        businessInfo: this.businessInfo
      };
    } catch (error) {
      console.error('Error al inicializar la API de WhatsApp:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene la información del perfil de negocio
   */
  async getBusinessProfile() {
    try {
      return await this.axiosInstance.get(
        `/${this.phoneNumberId}/whatsapp_business_profile`
      );
    } catch (error) {
      console.error('Error al obtener perfil de negocio:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Envía un mensaje de texto
   */
  async sendTextMessage(to, text) {
    try {
      const response = await this.axiosInstance.post(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text }
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error al enviar mensaje:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Obtiene mensajes recientes (solo simulación, la API no ofrece este endpoint directamente)
   */
  async getConversations() {
    // Simulación de conversaciones ya que la API no ofrece este endpoint directamente
    // En una implementación real, esto requeriría integración con Webhooks para recibir mensajes
    return {
      success: true,
      data: {
        conversations: [
          {
            id: '1234567890',
            contact: { 
              name: 'Juan Pérez',
              phone: '5491122334455'
            },
            lastMessage: {
              text: 'Hola, ¿cómo estás?',
              timestamp: new Date().toISOString(),
              direction: 'inbound'
            }
          },
          {
            id: '0987654321',
            contact: { 
              name: 'María López',
              phone: '5491199887766'
            },
            lastMessage: {
              text: 'Gracias por la información',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              direction: 'outbound'
            }
          }
        ]
      }
    };
  }

  /**
   * Obtiene los mensajes de una conversación específica
   */
  async getMessages(conversationId) {
    // Simulación de mensajes para una conversación específica
    // En una implementación real, esto requeriría acceso a una base de datos
    return {
      success: true,
      data: {
        messages: [
          {
            id: 'msg1',
            text: 'Hola, ¿cómo puedo ayudarte?',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            direction: 'outbound'
          },
          {
            id: 'msg2',
            text: 'Necesito información sobre sus servicios',
            timestamp: new Date(Date.now() - 5400000).toISOString(),
            direction: 'inbound'
          },
          {
            id: 'msg3',
            text: 'Claro, ofrecemos los siguientes servicios...',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            direction: 'outbound'
          }
        ]
      }
    };
  }

  /**
   * Verifica el estado de conexión
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Obtiene información del negocio
   */
  getBusinessInfo() {
    return this.businessInfo;
  }
}

module.exports = new WhatsAppAPI();