const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

/**
 * Configura el cliente de WhatsApp Web
 * @param {Object} io - Instancia de Socket.io
 * @returns {Object} - Cliente de WhatsApp Web
 */
const configureWhatsAppClient = (io) => {
  console.log('Configurando cliente de WhatsApp...');
  
  // Determinar si estamos en producción o desarrollo
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionDir = './.wwebjs_auth';
  
  // Asegurar que el directorio de sesiones existe
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log('Directorio de sesiones creado');
  }
  
  // Opciones de Chrome/Puppeteer optimizadas para distintos entornos
  const puppeteerOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-web-security',
      '--disable-features=site-per-process'
    ]
  };
  
  // En producción, intentar usar un chromium instalado
  if (isProduction) {
    // Buscar Chrome/Chromium en ubicaciones comunes
    const possiblePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      process.env.CHROME_BIN
    ];
    
    for (const browserPath of possiblePaths) {
      if (browserPath && fs.existsSync(browserPath)) {
        console.log(`Usando navegador en: ${browserPath}`);
        puppeteerOptions.executablePath = browserPath;
        break;
      }
    }
  }
  
  console.log('Puppeteer configurado con opciones:', JSON.stringify(puppeteerOptions, null, 2));
  
  // Crear un nuevo cliente con autenticación local y configuración optimizada
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionDir,
      clientId: 'matechat-session'
    }),
    puppeteer: puppeteerOptions,
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://web.whatsapp.com/'
    },
    webVersion: '2.2326.10',
    qrMaxRetries: 5,
    takeoverOnConflict: true,
    restartOnAuthFail: true
  });

  // Evento para generar y mostrar el código QR
  client.on('qr', (qr) => {
    console.log('Código QR recibido, escanea con WhatsApp');
    
    // Generar una imagen del QR en la carpeta pública para acceso directo
    try {
      const qrImagePath = path.join(__dirname, '..', 'public', 'qr-image.png');
      const staticQrPath = '/qr-image.png'; // Ruta pública
      
      // Usar qrcode-terminal para mostrar en consola
      qrcode.generate(qr, { small: true });
      
      // También imprimir el QR como texto para debugging
      console.log(`\nCódigo QR: ${qr.slice(0, 20)}...${qr.slice(-20)}\n`);
      
      // Guardar el QR como string en variable global
      global.lastQrCode = qr;
      global.lastQrTime = Date.now();
      
      // Generar URL pública
      const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
      console.log(`\nVer QR en: ${baseUrl}/\n`);
      
      // Enviar a todos los clientes conectados
      if (io) {
        io.emit('qr', {
          data: qr,
          src: staticQrPath,
          timestamp: Date.now()
        });
        io.emit('status', { 
          status: 'connecting', 
          message: 'Escanea el código QR con WhatsApp',
          timestamp: Date.now()
        });
        console.log('Código QR enviado a clientes conectados');
      }
    } catch (error) {
      console.error('Error al generar o guardar QR:', error);
    }
  });

  // Evento para cuando el cliente está listo
  client.on('ready', () => {
    console.log('Cliente WhatsApp está listo y conectado!');
    
    // Limpiar el código QR global cuando ya está conectado
    global.lastQrCode = null;
    global.lastQrTime = null;
    
    // Notificar al frontend que el cliente está conectado
    if (io) {
      const info = client.info || {};
      io.emit('ready', { 
        status: 'ready', 
        message: 'Cliente WhatsApp está listo y conectado!',
        user: {
          name: info.pushname || 'Usuario',
          phone: info.wid?.user || '',
          connected: true
        },
        timestamp: Date.now()
      });
    }
  });

  // Evento para manejar la autenticación fallida
  client.on('auth_failure', (error) => {
    console.error('Error de autenticación de WhatsApp:', error);
    
    // Notificar al frontend
    if (io) {
      io.emit('status', { 
        status: 'error', 
        message: 'Error de autenticación. Intentando generar un nuevo código QR...',
        error: error.message,
        timestamp: Date.now()
      });
    }
    
    // Intentar reiniciar el cliente
    console.log('Reiniciando cliente después de error de autenticación...');
    setTimeout(() => {
      // Limpiar sesión en algunos casos
      try {
        const sessionPath = path.join(sessionDir, 'matechat-session');
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('Sesión anterior eliminada');
        }
      } catch (err) {
        console.error('Error al limpiar sesión:', err);
      }
      
      // Reiniciar el cliente
      client.initialize().catch(err => {
        console.error('Error al reiniciar cliente después de error de autenticación:', err);
      });
    }, 3000);
  });

  // Evento para manejar la desconexión
  client.on('disconnected', (reason) => {
    console.log('Cliente WhatsApp desconectado:', reason);
    
    // Limpiar el código QR almacenado
    global.lastQrCode = null;
    global.lastQrTime = null;
    
    // Notificar al frontend
    if (io) {
      io.emit('disconnected', { 
        status: 'disconnected', 
        message: 'Se ha desconectado WhatsApp', 
        reason,
        timestamp: Date.now()
      });
    }
    
    // Inicializar nuevamente el cliente después de un breve retraso
    setTimeout(() => {
      console.log('Reiniciando cliente después de desconexión...');
      client.initialize().catch(err => {
        console.error('Error al reiniciar cliente después de desconexión:', err);
      });
    }, 3000);
  });
  
  // Evento para el cambio de estado de conexión
  client.on('change_state', (state) => {
    console.log('Estado de WhatsApp cambiado a:', state);
    
    // Notificar al frontend
    if (io) {
      io.emit('status', { 
        status: state, 
        message: `Estado del cliente: ${state}`,
        timestamp: Date.now()
      });
    }
  });
  
  // Evento para mensajes recibidos
  client.on('message', async (message) => {
    console.log(`Mensaje recibido de ${message.from}: ${message.body}`);
    
    try {
      // Si es un mensaje nuevo, notificar al frontend
      if (!message.isStatus && !message.isNotification) {
        // Obtener información del chat
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        const messageData = {
          id: message.id._serialized,
          from: message.from,
          to: message.to,
          body: message.body,
          hasMedia: message.hasMedia,
          timestamp: message.timestamp,
          type: message.type,
          isForwarded: message.isForwarded,
          chat: {
            id: chat.id._serialized,
            name: chat.name || contact.pushname || '',
            isGroup: chat.isGroup
          }
        };
        
        // Emitir el mensaje al frontend
        if (io) {
          io.emit('message', messageData);
        }
      }
    } catch (error) {
      console.error('Error al procesar mensaje recibido:', error);
    }
  });

  // Evento para nuevos mensajes recibidos
  client.on('message', async (message) => {
    console.log(`Mensaje recibido de ${message.from}: ${message.body}`);
    
    // Emitir el mensaje al frontend
    if (io) {
      io.emit('message', {
        from: message.from,
        body: message.body,
        timestamp: message.timestamp
      });
    }
  });

  return client;
};

module.exports = configureWhatsAppClient;