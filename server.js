const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/database');
const WhatsAppService = require('./src/services/whatsappService');
const whatsappController = require('./src/controllers/whatsappController');
require('dotenv').config();

// Inicializar Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conectar a MongoDB (no bloquea si falla)
connectDB().catch(err => {
  console.warn('Advertencia: No se pudo conectar a MongoDB. La aplicación continuará pero sin almacenamiento persistente.');
  console.error('Error de conexión:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar el motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inicializar servicio de WhatsApp
console.log('Iniciando servicio de WhatsApp...');
const whatsappService = new WhatsAppService(io);

// Inicializar con manejo de errores
try {
  whatsappService.initialize();
  console.log('Servicio de WhatsApp inicializado correctamente');
} catch (error) {
  console.error('Error al inicializar servicio de WhatsApp:', error);
}

// Establecer servicio de WhatsApp en el controlador
whatsappController.setWhatsAppService(whatsappService);

// Hacer disponible el servicio de WhatsApp para los controladores
app.set('whatsappService', whatsappService);

// Rutas
app.use('/', require('./src/routes/web'));
app.use('/api', require('./src/routes/api'));

// Conexión Socket.io
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  
  // Enviar estado actual de WhatsApp
  const status = whatsappService.getStatus();
  socket.emit('whatsappStatus', { status: status.isConnected ? 'connected' : 'disconnected' });
  
  // Si el código QR está disponible, enviarlo
  if (whatsappService.qrCode && !status.isConnected) {
    console.log('Enviando código QR al nuevo cliente');
    require('qrcode').toDataURL(whatsappService.qrCode, { errorCorrectionLevel: 'H' }, (err, url) => {
      if (!err) {
        console.log('Código QR enviado al cliente recién conectado');
        socket.emit('qrCode', url);
      } else {
        console.error('Error al generar código QR para cliente:', err);
      }
    });
  }
  
  // Manejar solicitudes de nuevo código QR
  socket.on('requestQR', () => {
    console.log('Cliente solicitó un nuevo código QR');
    
    // Reiniciar cliente WhatsApp para generar nuevo QR
    if (!whatsappService.isConnected) {
      console.log('Reiniciando cliente WhatsApp para generar nuevo QR');
      
      try {
        // Reinicializar solo si no está conectado
        whatsappService.client.initialize()
          .then(() => {
            console.log('WhatsApp reinicializado correctamente');
          })
          .catch(err => {
            console.error('Error al reinicializar WhatsApp:', err);
          });
      } catch (error) {
        console.error('Error al solicitar nuevo QR:', error);
      }
    } else {
      console.log('WhatsApp ya está conectado, no se generará nuevo QR');
      socket.emit('whatsappStatus', { status: 'connected' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor en ejecución en el puerto ${PORT}`);
  console.log(`Visita http://localhost:${PORT} para conectar WhatsApp`);
});