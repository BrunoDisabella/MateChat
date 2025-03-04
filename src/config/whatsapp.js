const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

/**
 * Configura el cliente de WhatsApp Web
 * @param {Object} io - Instancia de Socket.io
 * @returns {Object} - Cliente de WhatsApp Web
 */
const configureWhatsAppClient = (io) => {
  // Crear un nuevo cliente con autenticación local
  const client = new Client({
    authStrategy: new LocalAuth(),
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
        '--disable-gpu'
      ],
    }
  });

  // Evento para generar y mostrar el código QR
  client.on('qr', (qr) => {
    console.log('Código QR recibido, escanea con WhatsApp');
    qrcode.generate(qr, { small: true });
    
    // Emitir el código QR al frontend
    if (io) {
      io.emit('qr', qr);
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