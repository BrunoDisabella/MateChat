const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.qrCode = null;
    this.isConnected = false;
    this.messageMemory = []; // Para almacenar mensajes en memoria si MongoDB no está disponible
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  // Método para limpiar la sesión anterior
  async cleanSession() {
    console.log('Limpiando sesión anterior...');
    if (this.client) {
      try {
        await this.client.destroy();
        console.log('Cliente cerrado correctamente');
      } catch (err) {
        console.warn('Error al cerrar el cliente:', err);
      }
    }
    this.client = null;
    this.qrCode = null;
    this.isConnected = false;
    console.log('Sesión limpiada correctamente');
    return true;
  }
  
  initialize() {
    this.connectionAttempts++;
    console.log(`Intento de conexión ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
    
    // Configuración simple y directa de puppeteer
    const puppeteerOptions = {
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-features=site-per-process'
      ]
    };
    
    // Usar ID de sesión único para evitar conflictos
    const sessionId = `session-${Date.now()}`;
    console.log(`Creando sesión: ${sessionId}`);
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId
      }),
      puppeteer: puppeteerOptions,
      qrMaxRetries: 10, // Aumentar el número de reintentos de QR
      qrRefreshIntervalMs: 10000 // Refrescar el QR cada 10 segundos
    });

    // Manejar evento QR
    this.client.on('qr', (qr) => {
      console.log('¡CÓDIGO QR GENERADO!');
      this.qrCode = qr;
      
      qrcode.toDataURL(qr, { errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
          console.error('Error al generar código QR:', err);
          return;
        }
        console.log('Enviando QR a todos los clientes conectados');
        this.io.emit('qrCode', url);
      });
    });

    // Evento de autenticación exitosa
    this.client.on('authenticated', () => {
      console.log('¡AUTENTICACIÓN EXITOSA! WhatsApp ha validado el escaneo del QR');
      
      // Notificar a todos los clientes
      this.io.emit('whatsappStatus', { 
        status: 'authenticated',
        message: 'WhatsApp autenticado correctamente'
      });
      
      // Intentar obtener estado para diagnosticar
      try {
        if (this.client && typeof this.client.getState === 'function') {
          this.client.getState()
            .then(state => console.log('Estado después de autenticación:', state))
            .catch(err => console.log('Error al obtener estado después de autenticación:', err));
        }
      } catch (error) {
        console.log('Error al verificar estado:', error);
      }
      
      console.log('Esperando evento ready...');
    });
    
    // Evento de loading screen (estado intermedio)
    this.client.on('loading_screen', (percent, message) => {
      console.log(`Cargando WhatsApp: ${percent}% - ${message}`);
    });

    // Evento de cliente listo
    this.client.on('ready', () => {
      console.log('¡CLIENTE WHATSAPP LISTO! Conexión completada con éxito');
      this.isConnected = true;
      this.qrCode = null;
      
      // Registrar manejador de mensajes ahora que estamos conectados
      this.registerMessageListener();
      
      // Intentar obtener información adicional
      try {
        this.client.getState()
          .then(state => console.log('Estado final:', state))
          .catch(err => console.log('Error al obtener estado final:', err));
          
        this.client.getInfo()
          .then(info => console.log('Información del dispositivo:', JSON.stringify(info)))
          .catch(err => console.log('Error al obtener info del dispositivo:', err));
      } catch (error) {
        console.log('Error general en verificaciones adicionales:', error);
      }
      
      // Notificar a todos los clientes
      console.log('Notificando estado CONECTADO a todos los clientes');
      this.io.emit('whatsappStatus', { 
        status: 'connected',
        message: 'WhatsApp conectado correctamente'
      });
      
      // Forzar redirección a chat después de conectar
      setTimeout(() => {
        console.log('Enviando evento de redirección forzada');
        this.io.emit('forceRedirect', { url: '/chat?force=true' });
      }, 1000);
    });

    // Evento de desconexión
    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp desconectado:', reason);
      this.isConnected = false;
      this.io.emit('whatsappStatus', { status: 'disconnected' });
      
      // Reintentar conexión si no alcanzamos el límite de intentos
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log('Intentando reconectar...');
        setTimeout(() => this.initialize(), 5000);
      } else {
        console.log('Se alcanzó el límite de intentos de reconexión');
      }
    });

    // Evento de error
    this.client.on('error', (error) => {
      console.error('Error de WhatsApp:', error);
    });

    // Evento de fallo de autenticación
    this.client.on('auth_failure', (error) => {
      console.error('ERROR DE AUTENTICACIÓN:', error);
      this.io.emit('whatsappStatus', { 
        status: 'error',
        message: 'Error de autenticación de WhatsApp'
      });
      
      // Intentar reiniciar si hay un fallo de autenticación
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log('Reintentando después de fallo de autenticación...');
        setTimeout(() => this.initialize(), 5000);
      }
    });
    
    // Registrar todos los demás eventos relevantes para diagnóstico
    this.client.on('change_state', state => {
      console.log('Estado de conexión cambiado a:', state);
    });
    
    this.client.on('change_battery', batteryInfo => {
      console.log('Información de batería actualizada:', batteryInfo);
    });
    
    // Inicializar cliente
    console.log('Inicializando cliente WhatsApp...');
    
    try {
      this.client.initialize()
        .then(() => {
          console.log('Cliente WhatsApp inicializado correctamente');
          
          // Si no recibimos el evento ready en 60 segundos, intentemos verificar el estado manualmente
          setTimeout(() => {
            if (!this.isConnected) {
              console.log('No se recibió evento ready, verificando estado manualmente...');
              if (this.client && typeof this.client.getState === 'function') {
                this.client.getState()
                  .then(state => {
                    console.log('Estado verificado manualmente:', state);
                    if (state === 'CONNECTED') {
                      console.log('Estado conectado detectado manualmente!');
                      
                      if (!this.isConnected) {
                        this.isConnected = true;
                        this.io.emit('whatsappStatus', { status: 'connected' });
                        this.registerMessageListener();
                      }
                    }
                  })
                  .catch(err => console.log('Error al verificar estado manualmente:', err));
              }
            }
          }, 60000);
        })
        .catch(err => {
          console.error('Error al inicializar cliente:', err);
          
          // Reintentar conexión si no alcanzamos el límite de intentos
          if (this.connectionAttempts < this.maxConnectionAttempts) {
            console.log('Intentando reinicializar...');
            setTimeout(() => this.initialize(), 5000);
          }
        });
    } catch (error) {
      console.error('Error general durante la inicialización:', error);
      
      // Reintentar en caso de error crítico
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log('Reintentando después de error crítico...');
        setTimeout(() => this.initialize(), 10000);
      }
    }
  }

  // Manejar mensaje recibido
  async handleIncomingMessage(message) {
    // Ignorar mensajes propios
    if (message.fromMe) return;
    
    try {
      // Crear objeto de mensaje
      const newMessage = {
        messageId: message.id._serialized,
        phoneNumber: message.from,
        content: message.body,
        timestamp: new Date(),
        responseStatus: 'Pending'
      };
      
      // Guardar en memoria
      this.messageMemory.push(newMessage);
      console.log('Mensaje guardado en memoria:', newMessage);
      
      // Emitir a clientes
      this.io.emit('newMessage', {
        id: newMessage.messageId,
        messageId: newMessage.messageId,
        phoneNumber: newMessage.phoneNumber,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        responseStatus: newMessage.responseStatus
      });
      
      // Webhooks si existen
      if (process.env.N8N_WEBHOOK_URL) {
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            messageId: newMessage.messageId,
            phoneNumber: newMessage.phoneNumber,
            content: newMessage.content,
            timestamp: newMessage.timestamp
          });
          console.log('Mensaje enviado a webhook');
        } catch (error) {
          console.error('Error al enviar mensaje a webhook:', error.message);
        }
      }
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
    }
  }
  
  // Evento de mensaje - olvidamos conectar a este evento!
  registerMessageListener() {
    if (!this.client) {
      console.warn('Cliente no disponible para registrar listener de mensajes');
      return;
    }
    
    console.log('Registrando manejador de mensajes entrantes');
    
    this.client.on('message', async (message) => {
      console.log('Nuevo mensaje recibido:', message.body);
      await this.handleIncomingMessage(message);
    });
  }

  // Enviar mensaje
  async sendMessage(to, content) {
    if (!this.isConnected) {
      throw new Error('WhatsApp no está conectado');
    }

    try {
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      const response = await this.client.sendMessage(formattedNumber, content);
      
      // Actualizar estado en memoria
      const messageIndex = this.messageMemory.findIndex(
        m => m.phoneNumber === formattedNumber && m.responseStatus === 'Pending'
      );
      
      if (messageIndex !== -1) {
        this.messageMemory[messageIndex].responseStatus = 'Responded';
      }
      
      return response;
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      throw error;
    }
  }

  // Obtener estado
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasQR: !!this.qrCode,
      connectionAttempts: this.connectionAttempts
    };
  }
}

module.exports = WhatsAppService;