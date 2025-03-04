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

// Iniciar el cliente de WhatsApp
whatsappClient.initialize()
  .then(() => {
    console.log('Inicialización del cliente WhatsApp completada');
  })
  .catch(err => {
    console.error('Error al inicializar el cliente WhatsApp:', err);
  });

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`URL del servidor: ${process.env.SERVER_URL || `http://localhost:${PORT}`}`);
  console.log(`Modo: ${process.env.NODE_ENV}`);
});