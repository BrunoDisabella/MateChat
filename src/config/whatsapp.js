const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

/**
 * Configura el cliente de WhatsApp Web
 * @param {Object} io - Instancia de Socket.io
 * @returns {Object} - Cliente de WhatsApp Web
 */
const configureWhatsAppClient = (io) => {
  console.log('Configurando cliente de WhatsApp...');
  
  // Determinar si estamos en producción o desarrollo
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Crear un nuevo cliente con autenticación local y configuración optimizada para Railway
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth', // Ruta para almacenar la sesión
    }),
    puppeteer: {
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
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-default-apps',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--remote-debugging-port=9222'
      ],
      // Intentar usar chromium en el sistema en lugar de la versión incluida en Railway
      executablePath: isProduction ? process.env.CHROME_BIN || undefined : undefined,
    }
  });

  // Evento para generar y mostrar el código QR
  client.on('qr', (qr) => {
    console.log('Código QR recibido, escanea con WhatsApp');
    qrcode.generate(qr, { small: true });
    
    // Guardar el último código QR en una variable global
    global.lastQrCode = qr;
    
    // Emitir el código QR al frontend
    if (io) {
      io.emit('qr', qr);
      console.log('Código QR enviado al frontend');
    }
  });

  // Evento para cuando el cliente está listo
  client.on('ready', () => {
    console.log('Cliente WhatsApp está listo y conectado!');
    
    // Notificar al frontend que el cliente está conectado
    if (io) {
      io.emit('ready', { status: 'ready', message: 'Cliente WhatsApp está listo y conectado!' });
    }
  });

  // Evento para manejar la desconexión
  client.on('disconnected', (reason) => {
    console.log('Cliente WhatsApp desconectado:', reason);
    
    // Notificar al frontend
    if (io) {
      io.emit('disconnected', { status: 'disconnected', message: 'Se ha desconectado WhatsApp', reason });
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