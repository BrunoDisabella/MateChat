const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
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
  }

  // Método para limpiar la sesión anterior (útil para reinicializar)
  async cleanSession() {
    try {
      console.log('Limpiando sesión anterior...');
      
      // Si hay un cliente existente, intentar cerrarlo correctamente
      if (this.client) {
        try {
          console.log('Intentando cerrar el cliente actual...');
          await this.client.destroy();
          console.log('Cliente cerrado correctamente');
        } catch (err) {
          console.warn('Error al cerrar el cliente, continuando con la limpieza:', err);
        }
      }

      // Restablecer estados
      this.client = null;
      this.qrCode = null;
      this.isConnected = false;
      
      console.log('Sesión limpiada correctamente');
      return true;
    } catch (error) {
      console.error('Error al limpiar sesión:', error);
      return false;
    }
  }
  
  initialize() {
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`Inicializando WhatsApp en modo: ${isProduction ? 'producción' : 'desarrollo'}`);
    
    // Configuración de Chrome para Railway
    const puppeteerOptions = {
      headless: true,
      // Usar la versión de Chrome estable instalada en el sistema
      executablePath: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-features=site-per-process',
        '--window-size=1280,720',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--user-data-dir=/tmp/puppeteer_chrome_profile',
        '--aggressive-cache-discard',
        '--disable-session-crashed-bubble',
        '--disable-application-cache'
      ]
    };
    
    if (process.env.RAILWAY_STATIC_URL) {
      console.log('Detectado entorno Railway, usando configuración optimizada');
    }
    
    // Generar un ID de sesión único para evitar conflictos
    const sessionId = 'session-' + Date.now();
    console.log(`Creando nueva sesión con ID: ${sessionId}`);
    
    this.client = new Client({
      // Usar autenticación local con ruta específica y ID único
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth',
        clientId: sessionId
      }),
      puppeteer: puppeteerOptions,
      // Usar una versión específica de WhatsApp Web
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      qrMaxRetries: 5,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    this.client.on('qr', (qr) => {
      console.log('Código QR generado. Listo para escanear.');
      this.qrCode = qr;
      
      // Emitir el código QR a todos los clientes conectados
      qrcode.toDataURL(qr, { errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
          console.error('Error al generar código QR:', err);
          return;
        }
        console.log('Código QR generado correctamente');
        this.io.emit('qrCode', url);
        console.log('Código QR enviado al cliente');
      });
    });

    // Evento authenticated - se dispara cuando el usuario escanea el QR exitosamente
    this.client.on('authenticated', () => {
      console.log('¡Usuario autenticado en WhatsApp!');
      this.io.emit('whatsappStatus', { status: 'authenticated' });
    });
    
    // Evento ready - se dispara cuando el cliente está completamente listo
    this.client.on('ready', () => {
      console.log('¡Cliente de WhatsApp listo! CONEXIÓN EXITOSA');
      this.isConnected = true;
      this.qrCode = null; // Eliminar el código QR cuando ya está conectado
      
      // Emitir evento con más detalles para confirmar la conexión
      this.client.getState()
        .then(state => {
          console.log('Estado de WhatsApp:', state);
          return this.client.getInfo();
        })
        .then(info => {
          console.log('Información del teléfono conectado:', info);
          
          // Enviar información detallada al cliente
          const connectionData = { 
            status: 'connected',
            timestamp: new Date().toISOString(),
            info: {
              platform: info?.platform || 'unknown',
              phone: info?.wid?.user || 'unknown',
              name: info?.pushname || 'unknown'
            }
          };
          
          console.log('Enviando evento de conexión a todos los clientes:', connectionData);
          this.io.emit('whatsappStatus', connectionData);
          
          // Enviar evento adicional para garantizar que todos reciban la notificación
          setTimeout(() => {
            console.log('Enviando evento de conexión de respaldo...');
            this.io.emit('forceRedirect', { url: '/chat' });
          }, 2000);
        })
        .catch(err => {
          console.error('Error al obtener información del cliente de WhatsApp:', err);
          // Enviar evento de conexión incluso si falla obtener la info
          console.log('Enviando evento de conexión básico debido a error');
          this.io.emit('whatsappStatus', { status: 'connected' });
          
          // Evento de respaldo
          setTimeout(() => {
            this.io.emit('forceRedirect', { url: '/chat' });
          }, 2000);
        });
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.io.emit('whatsappStatus', { status: 'disconnected' });
      console.log('Cliente de WhatsApp desconectado');
    });

    this.client.on('message', async (message) => {
      // Ignorar mensajes enviados por el usuario actual
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
        
        // Almacenar en memoria
        this.messageMemory.push(newMessage);
        console.log('Mensaje guardado en memoria:', newMessage);
        
        // Emitir mensaje a los clientes conectados
        this.io.emit('newMessage', {
          id: newMessage.messageId,
          messageId: newMessage.messageId,
          phoneNumber: newMessage.phoneNumber,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          responseStatus: newMessage.responseStatus
        });

        // Enviar mensaje al webhook de N8N
        if (process.env.N8N_WEBHOOK_URL) {
          try {
            await axios.post(process.env.N8N_WEBHOOK_URL, {
              messageId: newMessage.messageId,
              phoneNumber: newMessage.phoneNumber,
              content: newMessage.content,
              timestamp: newMessage.timestamp
            });
            console.log('Mensaje enviado a N8N');
          } catch (error) {
            console.error('Error al enviar mensaje a N8N:', error.message);
          }
        } else {
          console.log('No hay URL de webhook de N8N configurada');
        }
      } catch (error) {
        console.error('Error al procesar mensaje entrante:', error);
      }
    });

    console.log('Inicializando cliente WhatsApp...');
    
    // Agregar un manejador para errores de autenticación
    this.client.on('auth_failure', (error) => {
      console.error('Error de autenticación de WhatsApp:', error);
      this.qrCode = null;
      this.isConnected = false;
      this.io.emit('whatsappStatus', { status: 'disconnected' });
    });
    
    // Agregar un manejador para otros errores del cliente
    this.client.on('error', (error) => {
      console.error('Error de WhatsApp client:', error);
    });
    
    // Inicializar con mejor manejo de errores
    this.client.initialize()
      .then(() => {
        console.log('Cliente WhatsApp inicializado correctamente');
      })
      .catch(err => {
        console.error('Error al inicializar WhatsApp client:', err);
        
        // Intentar reinicializar después de un tiempo
        setTimeout(() => {
          console.log('Intentando reinicializar cliente WhatsApp...');
          this.client.initialize().catch(e => {
            console.error('Error al reinicializar WhatsApp client:', e);
          });
        }, 15000);
      });
  }

  async sendMessage(to, content) {
    if (!this.isConnected) {
      throw new Error('El cliente de WhatsApp no está conectado');
    }

    try {
      // Formatear el número para asegurar que está en el formato correcto
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      // Enviar el mensaje
      const response = await this.client.sendMessage(formattedNumber, content);
      
      // Actualizar el estado del mensaje en memoria
      if (response) {
        // Actualizar en la memoria
        const messageIndex = this.messageMemory.findIndex(
          m => m.phoneNumber === formattedNumber && m.responseStatus === 'Pending'
        );
        if (messageIndex !== -1) {
          this.messageMemory[messageIndex].responseStatus = 'Responded';
          console.log('Estado del mensaje actualizado en memoria');
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected
    };
  }
}

module.exports = WhatsAppService;