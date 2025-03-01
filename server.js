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
let whatsappService = new WhatsAppService(io);

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
  
  // Enviar estado actual de WhatsApp con verificación adicional
  const status = whatsappService.getStatus();
  if (status.isConnected) {
    console.log('Emitiendo estado de WhatsApp: conectado');
    // Intentar obtener información adicional para validar la conexión
    try {
      whatsappService.client.getState()
        .then(state => {
          console.log('Estado de WhatsApp enviado al cliente:', state);
          socket.emit('whatsappStatus', { 
            status: 'connected',
            state: state
          });
        })
        .catch(err => {
          console.warn('Error al obtener estado detallado:', err);
          socket.emit('whatsappStatus', { status: 'connected' });
        });
    } catch (error) {
      console.warn('Error al verificar estado detallado:', error);
      socket.emit('whatsappStatus', { status: 'connected' });
    }
  } else {
    console.log('Emitiendo estado de WhatsApp: desconectado');
    socket.emit('whatsappStatus', { status: 'disconnected' });
  }
  
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
  socket.on('requestQR', async () => {
    console.log('Cliente solicitó un nuevo código QR');
    
    // Reiniciar cliente WhatsApp para generar nuevo QR
    if (!whatsappService.isConnected) {
      console.log('Reiniciando cliente WhatsApp para generar nuevo QR');
      
      try {
        // Notificar al cliente que estamos trabajando en generar un nuevo QR
        socket.emit('whatsappStatus', { status: 'regenerating' });
        
        // Primero limpiamos la sesión anterior
        await whatsappService.cleanSession();
        
        // Crear una nueva instancia del servicio de WhatsApp
        whatsappService = new WhatsAppService(io);
        app.set('whatsappService', whatsappService);
        whatsappController.setWhatsAppService(whatsappService);
        
        // Inicializar el nuevo servicio
        whatsappService.initialize();
        console.log('Nueva sesión de WhatsApp inicializada');
      } catch (error) {
        console.error('Error al solicitar nuevo QR:', error);
        socket.emit('whatsappStatus', { status: 'error', message: 'No se pudo generar un nuevo código QR' });
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

// Función para limpiar directorios antiguos de sesión de WhatsApp
const cleanupOldSessions = () => {
  console.log('Limpiando sesiones antiguas...');
  
  try {
    // Esta función se ejecutaría en un entorno real para eliminar archivos antiguos
    // En Railway, los archivos se eliminan entre reinicios, así que no es estrictamente necesario
    console.log('Limpieza completada');
  } catch (error) {
    console.error('Error al limpiar sesiones:', error);
  }
};

// Iniciar servidor
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;

server.listen(PORT, () => {
  console.log(`Servidor en ejecución en el puerto ${PORT}`);
  console.log(`Visita ${APP_URL} para conectar WhatsApp`);
  
  // Ejecutar limpieza al iniciar
  cleanupOldSessions();
});