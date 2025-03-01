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
        // Cerrar adecuadamente el cliente actual
        await this.client.destroy();
        console.log('Cliente cerrado correctamente');
      } catch (err) {
        console.warn('Error al cerrar el cliente:', err);
      }
    }
    
    // Resetear estado
    this.client = null;
    this.qrCode = null;
    this.isConnected = false;
    
    console.log('Sesión limpiada correctamente');
    return true;
  }
  
  // Verificar si hay una sesión existente antes de crear una nueva
  async checkExistingSession() {
    try {
      // Verificar si existen archivos de sesión
      console.log('Verificando sesión existente en: /wwebjs_data/.wwebjs_auth/matechat-primary');
      
      // Esto no lo podemos hacer de forma confiable en Railway, así que solo reportamos
      console.log('Asumiendo que hay datos de sesión persistentes');
      
      return true;
    } catch (error) {
      console.log('Error al verificar sesión existente:', error);
      return false;
    }
  }
  
  async initialize(pairing = false) {
    this.connectionAttempts++;
    console.log(`Intento de conexión ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
    
    // Verificar si hay una sesión existente
    await this.checkExistingSession();
    
    // Activar modo de emparejamiento si se solicita
    this.usePairing = pairing;
    if (pairing) {
      console.log('Activando modo de emparejamiento por número de teléfono');
    }
    
    // Configuración simple y directa de puppeteer
    const puppeteerOptions = {
      headless: true, // Usar 'true' en lugar de 'new' para compatibilidad con versiones anteriores
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-features=site-per-process',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ],
      executablePath: '/usr/bin/google-chrome-stable' // Especificar ruta a Chrome
    };
    
    // Usar siempre el mismo ID de sesión para mantener la persistencia
    const sessionId = 'matechat-primary';
    console.log(`Usando sesión persistente: ${sessionId}`);
    
    const clientOptions = {
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: '/wwebjs_data/.wwebjs_auth' // Ruta de volumen persistente en Railway
      }),
      puppeteer: puppeteerOptions, // Sin userDataDir personalizado, ya que no es compatible con LocalAuth
      qrMaxRetries: 5, // Reducir para evitar múltiples intentos si hay problemas
      qrRefreshIntervalMs: 30000, // Aumentar intervalo para dar más tiempo
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      disableSpins: true // Desactivar spinners que pueden causar problemas en algunos entornos
    };
    
    // Si estamos en modo de emparejamiento, activar la opción correspondiente
    if (this.usePairing) {
      console.log('Configurando cliente para emparejamiento por número de teléfono');
      clientOptions.pairingCode = true;
      clientOptions.pairingCodeRegex = true;
    }
    
    this.client = new Client(clientOptions);

    // Manejar evento QR
    this.client.on('qr', (qr) => {
      console.log('¡CÓDIGO QR GENERADO!');
      this.qrCode = qr;
      
      // Si estamos en modo de emparejamiento, intentar extraer el código numérico
      if (this.usePairing) {
        try {
          // El código de emparejamiento se muestra en el texto de la consola
          // Formato típico: Please enter the following code on your WhatsApp: 123-456
          console.log('Código QR completo:', qr);
          
          // Intentar extraer el código numérico
          let pairingCode = '';
          
          // Usar el código QR para obtener los 8 dígitos del código de emparejamiento
          if (qr && qr.length > 0) {
            // A veces el código está al final, intentamos extraerlo
            const codeMatch = qr.match(/(\d{3})-(\d{3})/);
            if (codeMatch) {
              pairingCode = codeMatch[1] + codeMatch[2];
              console.log('Código de emparejamiento detectado:', pairingCode);
              
              // Enviar el código de emparejamiento a los clientes
              this.io.emit('pairingCode', { pairingCode });
            } else {
              console.log('No se pudo extraer código de emparejamiento');
            }
          }
        } catch (error) {
          console.error('Error al procesar código de emparejamiento:', error);
        }
      }
      
      // Siempre generamos el QR también para compatibilidad
      qrcode.toDataURL(qr, { errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
          console.error('Error al generar código QR:', err);
          return;
        }
        console.log('Enviando QR a todos los clientes conectados');
        this.io.emit('qrCode', url);
      });
    });
    
    // Evento específico de código de emparejamiento
    this.client.on('code', (code) => {
      console.log('Código de emparejamiento generado:', code);
      this.io.emit('pairingCode', { pairingCode: code });
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
          
          // Establecer intervalo para verificar el estado periódicamente
          const statusCheckInterval = setInterval(() => {
            if (!this.isConnected) {
              console.log('Verificando estado periódicamente...');
              if (this.client && typeof this.client.getState === 'function') {
                this.client.getState()
                  .then(state => {
                    console.log('Estado actual:', state);
                    if (state === 'CONNECTED') {
                      console.log('¡ESTADO CONECTADO DETECTADO MANUALMENTE!');
                      
                      if (!this.isConnected) {
                        this.isConnected = true;
                        console.log('Actualizando estado de conexión a CONECTADO');
                        this.io.emit('whatsappStatus', { 
                          status: 'connected',
                          message: 'WhatsApp conectado correctamente (detección manual)'
                        });
                        
                        // Enviar evento de redirección directamente
                        setTimeout(() => {
                          console.log('Enviando evento de redirección directa');
                          this.io.emit('forceRedirect', { url: '/chat?force=true' });
                        }, 1000);
                        
                        this.registerMessageListener();
                        clearInterval(statusCheckInterval); // Detener el intervalo una vez conectado
                      }
                    }
                  })
                  .catch(err => console.log('Error al verificar estado:', err));
              }
            } else {
              clearInterval(statusCheckInterval); // Detener el intervalo si ya estamos conectados
            }
          }, 10000); // Verificar cada 10 segundos
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