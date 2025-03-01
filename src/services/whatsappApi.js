const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');

class WhatsAppAPI {
  constructor() {
    this.config = {
      apiUrl: whatsappConfig.apiUrl,
      appId: whatsappConfig.appId,
      appSecret: whatsappConfig.appSecret,
      accessToken: whatsappConfig.accessToken,
      phoneNumberId: whatsappConfig.phoneNumberId,
      businessAccountId: whatsappConfig.businessAccountId
    };
    
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    });
    
    this.connected = false;
    this.businessInfo = null;
  }

  /**
   * Actualiza la configuración de la API y reconfigura el cliente axios
   */
  updateConfig(apiSettings) {
    if (!apiSettings) return;
    
    // Actualizar configuración
    this.config = {
      ...this.config,
      ...apiSettings
    };
    
    // Recrear instancia de axios con la nueva configuración
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    });
    
    console.log('Configuración de API actualizada');
    return true;
  }

  /**
   * Inicializa la conexión con la API de WhatsApp
   */
  async initialize(apiSettings) {
    try {
      // Si se proporciona configuración, actualizarla
      if (apiSettings) {
        this.updateConfig(apiSettings);
      }
      
      // Verificar que al menos el app ID y access token estén configurados
      if (!this.config.appId || !this.config.accessToken) {
        throw new Error('Las credenciales básicas (APP_ID, ACCESS_TOKEN) no están configuradas correctamente');
      }
      
      // Información simulada para pruebas iniciales
      this.businessInfo = {
        name: "MateChat Business",
        about: "Plataforma de mensajería empresarial",
        address: "Ejemplo de dirección",
        description: "Conectando empresas con sus clientes",
        vertical: "UNDEFINED",
        id: this.config.appId
      };
      
      this.connected = true;
      
      // Intentar obtener información real de la cuenta si phoneNumberId está configurado
      if (this.config.phoneNumberId) {
        try {
          const response = await this.getBusinessProfile();
          if (response && response.data) {
            this.businessInfo = response.data;
          }
        } catch (profileError) {
          console.warn('No se pudo obtener el perfil de negocio, usando información simulada:', profileError.message);
          // Continuamos con la información simulada
        }
      }
      
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
      if (!this.config.phoneNumberId) {
        throw new Error('ID de número de teléfono no configurado');
      }
      
      return await this.axiosInstance.get(
        `/${this.config.phoneNumberId}/whatsapp_business_profile`
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
      if (!this.config.phoneNumberId) {
        return {
          success: false,
          error: 'ID de número de teléfono no configurado. Configúrelo en Ajustes.'
        };
      }
      
      // En modo demostración, simular envío exitoso
      if (to.startsWith('new-') || to.startsWith('demo-')) {
        return {
          success: true,
          data: {
            messaging_product: "whatsapp",
            contacts: [{ wa_id: to }],
            messages: [{ id: `demo-${Date.now()}` }]
          }
        };
      }
      
      const response = await this.axiosInstance.post(
        `/${this.config.phoneNumberId}/messages`,
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
   * Obtiene mensajes recientes (simulación para desarrollo)
   */
  async getConversations() {
    // Simulación de conversaciones para desarrollo
    // En una implementación real, esto requeriría integración con Webhooks y una base de datos
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
          },
          {
            id: '5678901234',
            contact: { 
              name: 'Carlos Rodríguez',
              phone: '5491133445566'
            },
            lastMessage: {
              text: '¿Cuándo estará disponible el producto?',
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              direction: 'inbound'
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
    // Para conversaciones recién creadas, mostrar mensajes vacíos
    if (conversationId.startsWith('new-')) {
      return {
        success: true,
        data: {
          messages: []
        }
      };
    }
    
    // Simulación de mensajes para una conversación específica
    const conversations = {
      '1234567890': [
        {
          id: 'msg1_1',
          text: '¡Hola! Bienvenido a MateChat',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          direction: 'outbound'
        },
        {
          id: 'msg1_2',
          text: 'Hola, ¿cómo estás?',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          direction: 'inbound'
        },
        {
          id: 'msg1_3',
          text: 'Estoy muy bien, ¿en qué puedo ayudarte hoy?',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          direction: 'outbound'
        }
      ],
      '0987654321': [
        {
          id: 'msg2_1',
          text: 'Gracias por contactarnos. ¿Qué información necesitas?',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          direction: 'outbound'
        },
        {
          id: 'msg2_2',
          text: 'Quiero saber los horarios de atención',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          direction: 'inbound'
        },
        {
          id: 'msg2_3',
          text: 'Nuestros horarios son de lunes a viernes de 9am a 6pm',
          timestamp: new Date(Date.now() - 82800000).toISOString(),
          direction: 'outbound'
        },
        {
          id: 'msg2_4',
          text: 'Gracias por la información',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          direction: 'inbound'
        }
      ],
      '5678901234': [
        {
          id: 'msg3_1',
          text: 'Buenos días, estoy interesado en sus productos',
          timestamp: new Date(Date.now() - 259200000).toISOString(),
          direction: 'inbound'
        },
        {
          id: 'msg3_2',
          text: 'Hola, ¿qué producto te interesa en particular?',
          timestamp: new Date(Date.now() - 252000000).toISOString(),
          direction: 'outbound'
        },
        {
          id: 'msg3_3',
          text: 'El modelo X500, ¿está disponible?',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          direction: 'inbound'
        },
        {
          id: 'msg3_4',
          text: 'Actualmente está agotado, pero esperamos tenerlo la próxima semana',
          timestamp: new Date(Date.now() - 169200000).toISOString(),
          direction: 'outbound'
        },
        {
          id: 'msg3_5',
          text: '¿Cuándo estará disponible el producto?',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          direction: 'inbound'
        }
      ]
    };
    
    return {
      success: true,
      data: {
        messages: conversations[conversationId] || []
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
  
  /**
   * Obtiene la configuración actual
   */
  getConfig() {
    return this.config;
  }
}

module.exports = new WhatsAppAPI();