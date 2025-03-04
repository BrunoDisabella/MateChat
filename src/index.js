require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const path = require('path');

// Importar configuración y rutas
const configureWhatsAppClient = require('./config/whatsapp');
const WhatsAppService = require('./services/whatsappApi');
const configureApiRoutes = require('./routes/api');
const configureWebhookRoutes = require('./routes/webhook');

// Inicializar Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar el cliente de WhatsApp
const whatsappClient = configureWhatsAppClient(io);
const whatsappService = new WhatsAppService(whatsappClient);

// Configurar rutas
app.use('/api', configureApiRoutes(whatsappService));
app.use('/webhook', configureWebhookRoutes(whatsappClient));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta específica para visualización del código QR
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

// Endpoint para obtener el último código QR disponible
app.get('/api/qr', (req, res) => {
  if (global.lastQrCode) {
    res.json({ success: true, qr: global.lastQrCode });
  } else {
    res.status(404).json({ success: false, message: 'No hay código QR disponible' });
  }
});

// Socket.io eventos
io.on('connection', (socket) => {
  console.log('Cliente conectado');
  
  // Enviar el último código QR si está disponible
  if (global.lastQrCode) {
    socket.emit('qr', global.lastQrCode);
    socket.emit('status', { status: 'connecting', message: 'Escanea el código QR con WhatsApp' });
    console.log('Enviando último código QR al cliente conectado');
  } else {
    // Si no hay QR pero el cliente está ya inicializado, enviar estado conectado
    if (whatsappClient.info) {
      socket.emit('ready', { status: 'ready', message: 'Cliente WhatsApp está listo y conectado!' });
      console.log('Enviando estado conectado al cliente');
    } else {
      // Inicializando, esperando QR
      socket.emit('status', { status: 'connecting', message: 'Esperando código QR...' });
    }
  }
  
  socket.on('requestQR', () => {
    console.log('Cliente solicitó un nuevo código QR');
    if (global.lastQrCode) {
      socket.emit('qr', global.lastQrCode);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Variable para rastrear si necesitamos reintentar generar QR
let needQrRetry = false;

// Función para reintentar generar QR si es necesario
const checkAndRetryQR = () => {
  if (needQrRetry && !global.lastQrCode) {
    console.log('Reintentando inicialización del cliente para generar QR...');
    try {
      // Reinicializar el cliente para intentar obtener un nuevo QR
      whatsappClient.initialize()
        .then(() => {
          console.log('Re-inicialización del cliente WhatsApp completada');
          needQrRetry = false;
        })
        .catch(err => {
          console.error('Error al re-inicializar el cliente WhatsApp:', err);
          // Programar otro intento en 5 segundos
          setTimeout(checkAndRetryQR, 5000);
        });
    } catch (error) {
      console.error('Error al reintentar inicialización:', error);
    }
  } else {
    // Si hay un QR, no necesitamos reintentar
    needQrRetry = false;
  }
};

// Iniciar el cliente de WhatsApp
whatsappClient.initialize()
  .then(() => {
    console.log('Inicialización del cliente WhatsApp completada');
    
    // Verificar si tenemos QR después de 3 segundos
    setTimeout(() => {
      if (!global.lastQrCode && !whatsappClient.info) {
        console.log('No se detectó código QR después de inicialización, programando reintento...');
        needQrRetry = true;
        checkAndRetryQR();
      }
    }, 3000);
  })
  .catch(err => {
    console.error('Error al inicializar el cliente WhatsApp:', err);
    
    // Programar reintento en caso de error
    console.log('Programando reintento de inicialización en 5 segundos...');
    needQrRetry = true;
    setTimeout(checkAndRetryQR, 5000);
  });

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`URL del servidor: ${process.env.SERVER_URL || `http://localhost:${PORT}`}`);
  console.log(`Modo: ${process.env.NODE_ENV}`);
});