require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// Importar configuración y rutas
const configureWhatsAppClient = require('./config/whatsapp');
const WhatsAppService = require('./services/whatsappApi');
const configureApiRoutes = require('./routes/api');
const configureWebhookRoutes = require('./routes/webhook');

// Crear directorio para QR si no existe
const ensureDirectoriesExist = () => {
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Directorio public creado');
  }
};

ensureDirectoriesExist();

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

// Ruta para la página de chats
app.get('/chats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chats.html'));
});

// Endpoint para obtener el último código QR disponible
app.get('/api/qr', async (req, res) => {
  if (global.lastQrCode) {
    const qrAge = global.lastQrTime ? Date.now() - global.lastQrTime : 0;
    const qrExpired = qrAge > 60000; // Considera expirado después de 1 minuto
    
    // Si el QR está expirado o se solicita regenerar
    if (qrExpired || req.query.regenerate === 'true') {
      try {
        console.log('QR expirado o se solicita regeneración. Reiniciando cliente...');
        // Limpiar QR actual
        global.lastQrCode = null;
        global.lastQrTime = null;
        
        // Intentar destruir y reinicializar el cliente
        try {
          await whatsappClient.destroy();
        } catch (e) {
          console.error('Error al destruir cliente (no crítico):', e);
        }
        
        setTimeout(() => {
          whatsappClient.initialize().catch(e => {
            console.error('Error al reinicializar cliente:', e);
          });
        }, 2000);
        
        return res.json({ 
          success: true, 
          status: 'regenerating', 
          message: 'Generando nuevo QR, recarga en unos segundos',
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error al regenerar QR:', error);
      }
    }
    
    try {
      // Intentar generar una imagen PNG del QR
      const qrImageBuffer = await QRCode.toBuffer(global.lastQrCode, {
        errorCorrectionLevel: 'H',
        type: 'png',
        margin: 1,
        scale: 8,
        color: {
          dark: '#128C7E',
          light: '#FFFFFF'
        }
      });
      
      if (req.query.format === 'json') {
        res.json({ 
          success: true, 
          qr: global.lastQrCode,
          timestamp: global.lastQrTime,
          imageBase64: `data:image/png;base64,${qrImageBuffer.toString('base64')}`
        });
      } else if (req.query.format === 'image') {
        res.set('Content-Type', 'image/png');
        res.send(qrImageBuffer);
      } else {
        res.json({ 
          success: true, 
          qr: global.lastQrCode,
          timestamp: global.lastQrTime
        });
      }
    } catch (error) {
      console.error('Error al generar imagen QR:', error);
      res.json({ 
        success: true, 
        qr: global.lastQrCode,
        timestamp: global.lastQrTime,
        error: 'No se pudo generar imagen'
      });
    }
  } else {
    res.status(404).json({ 
      success: false, 
      message: 'No hay código QR disponible. Intenta generar uno nuevo.',
      timestamp: Date.now()
    });
  }
});

// Endpoint para forzar la generación de un nuevo QR
app.get('/api/generate-qr', async (req, res) => {
  try {
    console.log('Solicitando generación de nuevo QR...');
    
    // Limpiar QR actual
    global.lastQrCode = null;
    global.lastQrTime = null;
    
    // Verificar el estado actual del cliente
    const clientReady = whatsappClient && whatsappClient.info;
    
    if (clientReady && !req.query.force) {
      return res.json({
        success: false,
        message: 'El cliente ya está conectado. Use ?force=true para forzar la desconexión.',
        timestamp: Date.now()
      });
    }
    
    // Destruir el cliente actual
    try {
      await whatsappClient.destroy();
      console.log('Cliente destruido correctamente');
    } catch (err) {
      console.error('Error al destruir cliente (continuando de todos modos):', err);
    }
    
    // Pequeña pausa antes de reiniciar
    setTimeout(async () => {
      try {
        // Limpiar sesión en casos especiales
        if (req.query.clean === 'true') {
          try {
            const sessionDir = './.wwebjs_auth';
            const sessionPath = path.join(sessionDir, 'matechat-session');
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
              console.log('Sesión antigua eliminada');
            }
          } catch (err) {
            console.error('Error al limpiar sesión:', err);
          }
        }
        
        // Inicializar el cliente
        whatsappClient.initialize()
          .then(() => {
            console.log('Cliente reinicializado correctamente');
          })
          .catch(err => {
            console.error('Error al reinicializar cliente:', err);
          });
        
        res.json({ 
          success: true, 
          message: 'Generando nuevo QR, espera unos segundos y recarga la página',
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error durante la reinicialización:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Error al reinicializar', 
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, 2000);
  } catch (error) {
    console.error('Error al regenerar QR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al regenerar QR', 
      error: error.message,
      timestamp: Date.now()
    });
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