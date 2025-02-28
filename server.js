const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);
// Configurar CORS para Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'whatsapp-integration-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables
let whatsappClient = null;
let qrCodeDataUrl = null;
let webhookUrl = process.env.WEBHOOK_URL || '';
let webhookMethod = process.env.WEBHOOK_METHOD || 'POST';
let apiKey = process.env.API_KEY || '';
let isInitializing = false;
let connectedClients = new Set();

// WhatsApp client initialization - configuración para integración con webhooks
const initWhatsAppClient = async () => {
  try {
    // Limpiar cliente anterior si existe
    if (whatsappClient) {
      await whatsappClient.destroy().catch(err => {
        console.log('Error al destruir cliente anterior:', err);
      });
      whatsappClient = null;
    }
    
    // Verificar si ya hay una inicialización en proceso
    if (isInitializing) {
      console.log('Ya hay una inicialización en proceso, evitando inicialización doble');
      return;
    }
    
    isInitializing = true;
    console.log('Inicializando cliente de WhatsApp para integración con webhook...');
    
    // Eliminar carpetas de sesión anteriores si hay problemas persistentes
    // Comentar esta sección si no es necesario
    /*
    try {
      const fs = require('fs');
      const path = require('path');
      const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session-whatsapp-integration');
      if (fs.existsSync(sessionDir)) {
        console.log('Eliminando carpeta de sesión anterior para reinicio limpio...');
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log('Carpeta de sesión eliminada correctamente');
      }
    } catch (err) {
      console.error('Error al eliminar carpeta de sesión:', err);
    }
    */
    // Importar la configuración de Chrome
    let chromePath;
    let chromeConfig = null;
    
    // Si estamos en Railway/producción, usamos un enfoque diferente
    if (process.env.RAILWAY_STATIC_URL || process.env.NODE_ENV === 'production') {
      // En Railway, Puppeteer se encargará de usar Chrome instalado en el sistema
      console.log('Ejecutando en entorno de producción, usando Chrome del sistema');
      chromePath = undefined;
      
      // Intentar cargar la configuración de chrome para los argumentos de puppeteer
      try {
        chromeConfig = require('./chrome-config.js');
        console.log('Configuración de Chrome cargada exitosamente en modo producción');
      } catch (err) {
        console.warn('No se pudo cargar la configuración de Chrome en producción');
        chromeConfig = null;
      }
    } else {
      // En desarrollo local, usamos la configuración específica
      try {
        chromeConfig = require('./chrome-config.js');
        chromePath = chromeConfig.chromePath;
        
        // Verificar si la ruta a Chrome existe
        const fs = require('fs');
        if (!fs.existsSync(chromePath)) {
          console.warn(`⚠️ Advertencia: No se encontró Chrome en la ruta: ${chromePath}.`);
          console.warn(`Intentando continuar sin especificar una ruta...`);
          chromePath = undefined;
        } else {
          console.log('Usando Chrome en:', chromePath);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo cargar la configuración de Chrome, usando detección automática');
        chromePath = undefined;
        chromeConfig = null;
      }
    }
    
    // Configuración para modo headless y webhook integration
    const clientOptions = {
      authStrategy: new LocalAuth({ clientId: 'whatsapp-integration' }),
      puppeteer: {
        headless: true, // Modo headless para no mostrar ventana de Chrome
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-extensions',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      },
    };
    
    // Solo agregar executablePath si tenemos una ruta válida
    if (chromePath) {
      clientOptions.puppeteer.executablePath = chromePath;
    }
    
    // Usar puppeteerArgs de chrome-config.js si están disponibles
    if (chromeConfig && chromeConfig.puppeteerArgs && Array.isArray(chromeConfig.puppeteerArgs)) {
      console.log('Usando argumentos de puppeteer desde chrome-config.js');
      console.log(chromeConfig.puppeteerArgs);
      clientOptions.puppeteer.args = chromeConfig.puppeteerArgs;
    }
    
    // Agregar las opciones adicionales para mejorar estabilidad
    clientOptions.webVersionCache = {
      type: 'none'
    };
    clientOptions.restartOnAuthFail = true;
    clientOptions.qrMaxRetries = 5;
    clientOptions.takeoverOnConflict = false;
    clientOptions.bypassCSP = true;
    
    whatsappClient = new Client(clientOptions);

    whatsappClient.on('qr', async (qr) => {
      console.log('QR Code received');
      
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        // Notify all connected clients about new QR code
        io.emit('qrCode', { qrCode: qrCodeDataUrl });
      } catch (err) {
        console.error('QR Code generation error:', err);
      }
    });

    whatsappClient.on('ready', () => {
      console.log('WhatsApp client is ready');
      qrCodeDataUrl = null;
      io.emit('clientReady');
    });

    whatsappClient.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
      io.emit('authenticated');
    });

    whatsappClient.on('auth_failure', (err) => {
      console.error('Authentication failure:', err);
      io.emit('authFailure', { error: err.message });
    });

    whatsappClient.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      
      // Limpieza con manejo de recursos
      try {
        // Cerrar cualquier sesión de navegador pendiente
        if (whatsappClient.pupBrowser) {
          console.log('Cerrando navegador correctamente...');
          try {
            whatsappClient.pupBrowser.close().catch((e) => console.error('Error al cerrar navegador:', e));
          } catch (e) {
            console.error('Error en el cierre del navegador:', e);
          }
        }
      } catch (e) {
        console.error('Error en limpieza de recursos:', e);
      }
      
      // Limpiar inmediatamente para reinicializar
      whatsappClient = null;
      qrCodeDataUrl = null;
      isInitializing = false;
      io.emit('disconnected', { reason });
      
      // Intentar reconectar automáticamente después de 8 segundos
      setTimeout(() => {
        console.log('Intentando reconexión automática...');
        initWhatsAppClient();
      }, 8000);
    });

    whatsappClient.on('message', async (message) => {
      console.log(`New message from ${message.from}: ${message.body}`);
      
      // Procesar medio si existe
      let mediaUrl = null;
      let mediaData = null;
      
      if (message.hasMedia) {
        try {
          console.log('Descargando medio de mensaje entrante...');
          // Esperar un momento para que el medio esté disponible
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          mediaData = await message.downloadMedia().catch(err => {
            console.error('Error específico al descargar medio del mensaje nuevo:', err.message);
            return null;
          });
          
          if (mediaData) {
            console.log(`Medio descargado: ${mediaData.mimetype}`);
            mediaUrl = `data:${mediaData.mimetype};base64,${mediaData.data}`;
          } else {
            console.log('No se pudo descargar el medio del mensaje nuevo');
          }
        } catch (err) {
          console.error('Error al descargar medio del mensaje nuevo:', err);
        }
      }
      
      // Agregar pequeña espera para asegurar que toda la información esté lista
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Format the message data
      const messageData = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        hasMedia: message.hasMedia,
        type: message.type,
        isForwarded: message.isForwarded,
        mediaUrl: mediaUrl,
        mimetype: mediaData ? mediaData.mimetype : null,
        direction: 'incoming' // Indicar que es un mensaje entrante
      };
      
      // Emit to all connected sockets
      io.emit('newMessage', messageData);
      
      // Forward to webhook if configured
      console.log('Procesando mensaje entrante para webhook...');
      if (webhookUrl) {
        try {
          console.log(`Enviando datos a webhook: ${webhookMethod} ${webhookUrl}`);
          
          // Convertir messageData a un formato que funcione tanto para params como para body
          const formattedMessageData = {
            id: messageData.id,
            from: messageData.from,
            to: messageData.to,
            body: messageData.body,
            timestamp: messageData.timestamp,
            hasMedia: messageData.hasMedia ? true : false,
            type: messageData.type || 'chat',
          };
          
          // Para métodos que necesitan query params
          const queryParams = new URLSearchParams();
          Object.entries(formattedMessageData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              queryParams.append(key, String(value));
            }
          });
          
          try {
            switch(webhookMethod) {
              case 'GET':
                await axios.get(`${webhookUrl}?${queryParams.toString()}`);
                break;
              case 'POST':
                await axios.post(webhookUrl, formattedMessageData);
                break;
              case 'PUT':
                await axios.put(webhookUrl, formattedMessageData);
                break;
              case 'PATCH':
                await axios.patch(webhookUrl, formattedMessageData);
                break;
              case 'DELETE':
                await axios.delete(`${webhookUrl}?${queryParams.toString()}`);
                break;
              case 'HEAD':
                await axios.head(`${webhookUrl}?${queryParams.toString()}`);
                break;
              default:
                await axios.post(webhookUrl, formattedMessageData);
            }
            console.log('✅ Mensaje enviado al webhook correctamente');
          } catch (error) {
            if (error.response) {
              console.error(`❌ Error del webhook (${error.response.status}): ${error.response.data ? JSON.stringify(error.response.data) : error.message}`);
            } else if (error.request) {
              console.error(`❌ No se recibió respuesta del webhook: ${error.message}`);
            } else {
              console.error(`❌ Error enviando al webhook: ${error.message}`);
            }
            throw error; // Re-throw para el manejo en el catch externo
          }
        } catch (error) {
          console.error('Error forwarding message to webhook:', error.message);
        }
      }
      
      // Eventualmente también podemos enviar a un webhook n8n si se configura
    });

    console.log('Starting WhatsApp Web client initialization...');
    await whatsappClient.initialize();
    
  } catch (error) {
    console.error('WhatsApp client initialization error:', error);
    isInitializing = false;
    io.emit('initError', { error: error.message });
  }
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  connectedClients.add(socket.id);
  
  // Solo iniciar el cliente si no hay uno existente y no está en proceso de inicialización
  let clientStatus = 'none';
  
  // Send status of WhatsApp client
  if (whatsappClient) {
    if (whatsappClient.info) {
      clientStatus = 'ready';
      socket.emit('clientReady');
    } else {
      clientStatus = 'authenticating';
      socket.emit('authenticated');
    }
  }
  
  // Send current QR code if available and not in a ready state
  if (qrCodeDataUrl && clientStatus !== 'ready') {
    socket.emit('qrCode', { qrCode: qrCodeDataUrl });
  }
  
  // Client requests WhatsApp initialization
  socket.on('initWhatsApp', () => {
    // Solo inicializar si no hay un cliente existente y funcionando
    if (!whatsappClient || whatsappClient.disconnected) {
      initWhatsAppClient();
    } else {
      console.log('Cliente WhatsApp ya está inicializado, no es necesario reiniciar');
      // Si el cliente ya está funcionando, enviar estado actual
      if (whatsappClient.info) {
        socket.emit('clientReady');
      } else if (qrCodeDataUrl) {
        socket.emit('qrCode', { qrCode: qrCodeDataUrl });
      }
    }
  });
  
  // Nuevo: Desconectar el cliente de WhatsApp Web
  socket.on('disconnectWhatsApp', async () => {
    try {
      if (whatsappClient) {
        console.log('Desconectando WhatsApp por solicitud del usuario');
        await whatsappClient.destroy();
        whatsappClient = null;
        qrCodeDataUrl = null;
        isInitializing = false;
        io.emit('disconnected', { reason: 'Desconectado manualmente por el usuario' });
        socket.emit('disconnectSuccess', { message: 'Cliente desconectado exitosamente' });
      } else {
        socket.emit('disconnectSuccess', { message: 'El cliente ya estaba desconectado' });
      }
    } catch (error) {
      console.error('Error al desconectar el cliente:', error);
      socket.emit('error', { message: 'Error al desconectar: ' + error.message });
    }
  });
  
  // Send message request
  socket.on('sendMessage', async (data) => {
    try {
      if (!whatsappClient) {
        socket.emit('messageSent', { success: false, error: 'WhatsApp client not initialized' });
        return;
      }
      
      const { to, message, options } = data;
      
      // Format phone number
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }
      
      console.log(`Enviando mensaje a ${formattedNumber}: ${message}`);
      const result = await whatsappClient.sendMessage(formattedNumber, message, options);
      console.log('Mensaje enviado correctamente, ID:', result.id._serialized);
      
      // Crear objeto de mensaje enviado
      const sentMessageData = {
        success: true,
        id: result.id._serialized,
        to: formattedNumber,
        from: whatsappClient.info.wid._serialized,
        body: message,
        timestamp: Math.floor(Date.now() / 1000),
        direction: 'outgoing',
        hasMedia: options && options.media ? true : false,
        type: options && options.media ? 
              (options.media.mimetype.startsWith('image/') ? 'image' : 
               options.media.mimetype.startsWith('audio/') ? 'audio' : 
               options.media.mimetype.startsWith('video/') ? 'video' : 'document') : 'chat'
      };
      
      // Activar webhook para mensaje saliente
      if (webhookUrl) {
        try {
          console.log('Procesando mensaje saliente para webhook...');
          console.log(`Enviando datos a webhook: ${webhookMethod} ${webhookUrl}`);
          
          // Convertir messageData a un formato que funcione tanto para params como para body
          const formattedMessageData = {
            id: sentMessageData.id,
            from: sentMessageData.from,
            to: sentMessageData.to,
            body: sentMessageData.body,
            timestamp: sentMessageData.timestamp,
            hasMedia: sentMessageData.hasMedia,
            type: sentMessageData.type,
            direction: 'outgoing'
          };
          
          // Para métodos que necesitan query params
          const queryParams = new URLSearchParams();
          Object.entries(formattedMessageData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              queryParams.append(key, String(value));
            }
          });
          
          try {
            switch(webhookMethod) {
              case 'GET':
                await axios.get(`${webhookUrl}?${queryParams.toString()}`);
                break;
              case 'POST':
                await axios.post(webhookUrl, formattedMessageData);
                break;
              case 'PUT':
                await axios.put(webhookUrl, formattedMessageData);
                break;
              case 'PATCH':
                await axios.patch(webhookUrl, formattedMessageData);
                break;
              case 'DELETE':
                await axios.delete(`${webhookUrl}?${queryParams.toString()}`);
                break;
              case 'HEAD':
                await axios.head(`${webhookUrl}?${queryParams.toString()}`);
                break;
              default:
                await axios.post(webhookUrl, formattedMessageData);
            }
            console.log('✅ Mensaje saliente enviado al webhook correctamente');
          } catch (error) {
            if (error.response) {
              console.error(`❌ Error del webhook (${error.response.status}): ${error.response.data ? JSON.stringify(error.response.data) : error.message}`);
            } else if (error.request) {
              console.error(`❌ No se recibió respuesta del webhook: ${error.message}`);
            } else {
              console.error(`❌ Error enviando al webhook: ${error.message}`);
            }
          }
        } catch (error) {
          console.error('Error al procesar webhook para mensaje saliente:', error);
        }
      }
      
      // Enviar respuesta al cliente
      socket.emit('messageSent', sentMessageData);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('messageSent', { 
        success: false, 
        error: error.message
      });
    }
  });
  
  // Configure webhook URL with method
  socket.on('setWebhook', (data) => {
    webhookUrl = data.url;
    webhookMethod = data.method || 'POST';
    console.log(`Webhook configurado: ${webhookMethod} ${webhookUrl}`);
    socket.emit('webhookSet', { 
      success: true, 
      url: webhookUrl,
      method: webhookMethod 
    });
  });
  
  // Configure n8n webhook URL with method
  // Configurar clave API
  socket.on('setApiKey', (data) => {
    apiKey = data.key || '';
    console.log(`API Key ${apiKey ? 'configurada' : 'desactivada'}`);
    socket.emit('apiKeySet', { 
      success: true,
      enabled: !!apiKey
    });
  });
  
  // Fetch chats
  socket.on('getChats', async () => {
    try {
      if (!whatsappClient) {
        socket.emit('error', { message: 'WhatsApp client not initialized' });
        return;
      }
      
      // Verificar si ya hemos cargado perfiles en esta sesión
      const profilesCached = whatsappClient._profilePicsCache || {};
      whatsappClient._profilePicsCache = profilesCached;
      
      const chats = await whatsappClient.getChats();
      // Primero enviar los chats básicos sin fotos de perfil para que cargue rápido
      const basicChats = chats.map(chat => {
        // Usar foto de perfil cacheada si existe
        const cachedProfile = profilesCached[chat.id._serialized];
        
        return {
          id: chat.id._serialized,
          name: chat.name,
          isGroup: chat.isGroup,
          timestamp: chat.timestamp,
          unreadCount: chat.unreadCount,
          profilePicUrl: cachedProfile || null,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body,
            timestamp: chat.lastMessage.timestamp,
            hasMedia: chat.lastMessage.hasMedia || false,
            type: chat.lastMessage.type || 'chat'
          } : null
        };
      });
      
      // Enviar los chats básicos inmediatamente
      socket.emit('chats', { chats: basicChats });
      
      // Ahora cargar las fotos de perfil en segundo plano (todos los chats)
      try {
        console.log('Cargando fotos de perfil para los chats...');
        
        // Primero, obtener mi propio perfil
        try {
          console.log('Obteniendo información de mi propio perfil...');
          const myInfo = await whatsappClient.getWid();
          const myProfilePicUrl = await whatsappClient.getProfilePicUrl(myInfo._serialized).catch(err => {
            console.error(`Error al obtener mi foto de perfil: ${err.message}`);
            return null;
          });
          
          if (myProfilePicUrl) {
            console.log('Mi foto de perfil obtenida exitosamente');
            
            try {
              // Verificar si ya tenemos la imagen en caché
              if (!whatsappClient._myProfilePic) {
                // Convertir a base64
                const axios = require('axios');
                const imageResponse = await axios.get(myProfilePicUrl, { responseType: 'arraybuffer' })
                  .catch(err => {
                    console.log(`Error descargando mi imagen de perfil: ${err.message}`);
                    return null;
                  });
                
                if (imageResponse && imageResponse.data) {
                  const base64Image = Buffer.from(imageResponse.data).toString('base64');
                  const mime = imageResponse.headers['content-type'] || 'image/jpeg';
                  myProfilePicUrl = `data:${mime};base64,${base64Image}`;
                  console.log(`Mi imagen convertida a base64`);
                  
                  // Guardar en caché global para esta instancia
                  whatsappClient._myProfilePic = myProfilePicUrl;
                }
              } else {
                // Usar la versión cacheada
                myProfilePicUrl = whatsappClient._myProfilePic;
                console.log('Usando mi foto de perfil desde caché');
              }
            } catch (err) {
              console.log(`Error en conversión de mi foto: ${err.message}`);
            }
            
            // Enviar mi foto de perfil
            socket.emit('myProfilePic', { profilePicUrl: whatsappClient._myProfilePic || myProfilePicUrl });
          }
        } catch (error) {
          console.error('Error al obtener mi información de perfil:', error);
        }
        
        // Procesamos cada chat de manera secuencial para evitar problemas de rate limiting
        const chatsWithProfiles = [];
        const processedChats = new Set(); // Para evitar procesar el mismo chat más de una vez en una sesión
        
        // Verificar si procesamos todos los chats en la última actualización
        const lastProcessTime = whatsappClient._lastProfileUpdate || 0;
        const now = Date.now();
        const timeSinceLastUpdate = now - lastProcessTime;
        const forceFullUpdate = timeSinceLastUpdate > 5 * 60 * 1000; // 5 minutos
        
        console.log(`Tiempo desde última actualización completa: ${Math.floor(timeSinceLastUpdate/1000)} segundos`);
        if (forceFullUpdate) {
          console.log('Realizando actualización completa de fotos de perfil');
          whatsappClient._processedProfiles = new Set(); // Reiniciar caché si ha pasado suficiente tiempo
        }
        
        whatsappClient._processedProfiles = whatsappClient._processedProfiles || new Set();
        
        // Mantener una cola de actualizaciones pendientes para no bloquear la interfaz
        const updateQueue = [];
        
        for (let i = 0; i < chats.length; i++) {
          const chat = chats[i];
          
          // Verificar si este chat ya fue procesado en esta sesión
          if (whatsappClient._processedProfiles.has(chat.id._serialized) && !forceFullUpdate) {
            // Usar foto de perfil desde caché si existe
            const profilePicUrl = (whatsappClient._profilePicsCache || {})[chat.id._serialized];
            
            if (profilePicUrl) {
              console.log(`Usando foto en caché para ${chat.name}`);
              
              const chatWithProfile = {
                id: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup,
                timestamp: chat.timestamp,
                unreadCount: chat.unreadCount,
                profilePicUrl: profilePicUrl,
                lastMessage: chat.lastMessage ? {
                  body: chat.lastMessage.body,
                  timestamp: chat.lastMessage.timestamp,
                  hasMedia: chat.lastMessage.hasMedia || false,
                  type: chat.lastMessage.type || 'chat'
                } : null
              };
              
              chatsWithProfiles.push(chatWithProfile);
              socket.emit('chatUpdate', { chat: chatWithProfile });
              continue;
            }
          }
          
          // Agregar a la cola para procesamiento en segundo plano
          if (!chat.isGroup) {
            updateQueue.push(chat);
          }
        }
        
        // Procesar la cola de manera eficiente (máximo 5 a la vez)
        if (updateQueue.length > 0) {
          console.log(`Procesando ${updateQueue.length} fotos de perfil en cola`);
          
          // Procesar chats en lotes para evitar bloquear
          const processNext = async (index) => {
            if (index >= updateQueue.length) {
              whatsappClient._lastProfileUpdate = Date.now();
              return;
            }
            
            const chat = updateQueue[index];
            let profilePicUrl = null;
            
            try {
              console.log(`Procesando foto para: ${chat.name}`);
              whatsappClient._processedProfiles.add(chat.id._serialized);
              
              // Verificar si ya tenemos esta imagen en caché
              if ((whatsappClient._profilePicsCache || {})[chat.id._serialized]) {
                profilePicUrl = whatsappClient._profilePicsCache[chat.id._serialized];
                console.log(`Usando foto en caché para ${chat.name}`);
              } else {
                // Intentar obtener foto directamente
                try {
                  profilePicUrl = await whatsappClient.getProfilePicUrl(chat.id._serialized).catch(err => {
                    console.log(`Error al obtener foto directamente: ${err.message}`);
                    return null;
                  });
                } catch (err) {
                  console.log(`Error al obtener foto directamente para ${chat.name}: ${err.message}`);
                }
                
                // Si no funcionó, intentar a través del contacto
                if (!profilePicUrl) {
                  const contact = await whatsappClient.getContactById(chat.id._serialized).catch(err => {
                    console.error(`Error al obtener contacto: ${err.message}`);
                    return null;
                  });
                  
                  if (contact) {
                    profilePicUrl = await contact.getProfilePicUrl().catch(err => {
                      console.error(`Error al obtener foto: ${err.message}`);
                      return null;
                    });
                  }
                }
                
                console.log(`¿Foto obtenida para ${chat.name}?: ${profilePicUrl ? 'Sí' : 'No'}`);
                
                // Intento adicional con transformación de URL
                if (profilePicUrl) {
                  try {
                    // Descargar la imagen como buffer
                    const axios = require('axios');
                    const imageResponse = await axios.get(profilePicUrl, { responseType: 'arraybuffer' })
                      .catch(err => {
                        console.log(`Error descargando imagen de perfil: ${err.message}`);
                        return null;
                      });
                    
                    if (imageResponse && imageResponse.data) {
                      // Convertir a base64
                      const base64Image = Buffer.from(imageResponse.data).toString('base64');
                      const mime = imageResponse.headers['content-type'] || 'image/jpeg';
                      profilePicUrl = `data:${mime};base64,${base64Image}`;
                      console.log(`Imagen convertida a base64 para ${chat.name}`);
                      
                      // Guardar en caché
                      whatsappClient._profilePicsCache = whatsappClient._profilePicsCache || {};
                      whatsappClient._profilePicsCache[chat.id._serialized] = profilePicUrl;
                    }
                  } catch (err) {
                    console.log(`Error en conversión: ${err.message}`);
                  }
                }
              }
            } catch (error) {
              console.log(`No se pudo obtener imagen para ${chat.name}:`, error.message);
            }
            
            // Crear objeto de chat con perfil
            const chatWithProfile = {
              id: chat.id._serialized,
              name: chat.name,
              isGroup: chat.isGroup,
              timestamp: chat.timestamp,
              unreadCount: chat.unreadCount,
              profilePicUrl: profilePicUrl,
              lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp,
                hasMedia: chat.lastMessage.hasMedia || false,
                type: chat.lastMessage.type || 'chat'
              } : null
            };
            
            chatsWithProfiles.push(chatWithProfile);
            
            // Actualizar inmediatamente en la interfaz
            socket.emit('chatUpdate', { chat: chatWithProfile });
            
            // Procesar el siguiente después de un pequeño retraso
            setTimeout(() => processNext(index + 1), 300);
          };
          
          // Comenzar el procesamiento del primer elemento
          processNext(0);
        }
            
      } catch (error) {
        console.error('Error al cargar fotos de perfil:', error);
      }
      
      // La línea socket.emit('chats') ya se ejecutó anteriormente
    } catch (error) {
      console.error('Get chats error:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Fetch messages for a specific chat
  socket.on('getChatMessages', async (data) => {
    try {
      if (!whatsappClient) {
        socket.emit('error', { message: 'WhatsApp client not initialized' });
        return;
      }
      
      const { chatId, limit = 50 } = data;
      const chat = await whatsappClient.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      const formattedMessages = await Promise.all(messages.map(async msg => {
        let mediaUrl = null;
        let mediaData = null;
        
        // Procesar medios si están presentes
        if (msg.hasMedia) {
          try {
            console.log(`Descargando medio para mensaje ${msg.id._serialized}...`);
            mediaData = await msg.downloadMedia().catch(err => {
              console.error(`Error específico al descargar medio: ${err.message}`);
              return null;
            });
            
            if (mediaData) {
              console.log(`Medio descargado: ${mediaData.mimetype}`);
              mediaUrl = `data:${mediaData.mimetype};base64,${mediaData.data}`;
            } else {
              console.log('No se pudo descargar el medio');
            }
          } catch (err) {
            console.error('Error al descargar medio:', err);
          }
        }
        
        return {
          id: msg.id._serialized,
          body: msg.body,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp,
          hasMedia: msg.hasMedia,
          type: msg.type,
          isForwarded: msg.isForwarded,
          mediaUrl: mediaUrl,
          mimetype: mediaData ? mediaData.mimetype : null
        };
      }));
      
      socket.emit('chatMessages', { chatId, messages: formattedMessages });
    } catch (error) {
      console.error('Get chat messages error:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Disconnect event
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    connectedClients.delete(socket.id);
  });
});

// Routes

// Home page - QR code scanning
app.get('/', (req, res) => {
  res.render('index');
});

// Chat interface
app.get('/chat', (req, res) => {
  res.render('chat');
});

// API Endpoints

// Get QR code
app.get('/api/qr', (req, res) => {
  if (qrCodeDataUrl) {
    res.json({ qrCode: qrCodeDataUrl });
  } else {
    res.status(404).json({ error: 'QR code not available yet' });
  }
});

// Initialize WhatsApp client
app.post('/api/init', (req, res) => {
  initWhatsAppClient();
  res.json({ success: true, message: 'WhatsApp client initialization started' });
});

// API para enviar mensajes desde aplicaciones externas
app.post('/api/messages', async (req, res) => {
  try {
    // Verificar API key si está configurada
    if (apiKey && req.headers['x-api-key'] !== apiKey) {
      return res.status(401).json({ error: 'API key inválida o faltante' });
    }
    
    // Verificar que el cliente de WhatsApp esté inicializado
    if (!whatsappClient) {
      return res.status(503).json({ 
        error: 'Servicio no disponible', 
        message: 'El cliente de WhatsApp no está inicializado' 
      });
    }
    
    // Validar los datos de entrada
    const { to, message, media } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'El número de destino es obligatorio' });
    }
    
    if (!message && !media) {
      return res.status(400).json({ error: 'Debe proporcionar un mensaje o un archivo multimedia' });
    }
    
    // Formatear el número de teléfono
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@')) {
      formattedNumber = `${formattedNumber}@c.us`;
    }
    
    let result;
    
    // Si hay medio, procesarlo
    if (media && media.url) {
      try {
        // Descargar el medio desde la URL
        const mediaResponse = await axios.get(media.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data);
        const base64Data = buffer.toString('base64');
        
        // Determinar el tipo MIME
        let mimetype = mediaResponse.headers['content-type'];
        if (!mimetype) {
          // Intentar adivinar basado en la extensión
          const extension = media.url.split('.').pop().toLowerCase();
          if (['jpg', 'jpeg', 'png'].includes(extension)) {
            mimetype = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
          } else if (['mp4', 'avi', 'mov'].includes(extension)) {
            mimetype = `video/${extension}`;
          } else if (['mp3', 'ogg', 'wav'].includes(extension)) {
            mimetype = `audio/${extension}`;
          } else {
            mimetype = 'application/octet-stream';
          }
        }
        
        // Crear objeto de medio para WhatsApp
        const mediaData = {
          mimetype,
          data: base64Data,
          filename: media.filename || `file.${mimetype.split('/')[1]}`
        };
        
        // Enviar mensaje con medio
        result = await whatsappClient.sendMessage(formattedNumber, message || '', {
          media: mediaData
        });
        
      } catch (error) {
        console.error('Error al procesar medio:', error);
        return res.status(400).json({ 
          error: 'Error al procesar el archivo multimedia',
          details: error.message 
        });
      }
    } else {
      // Enviar mensaje de texto normal
      result = await whatsappClient.sendMessage(formattedNumber, message);
    }
    
    // Responder con éxito
    res.status(200).json({
      success: true,
      messageId: result.id._serialized,
      to: formattedNumber
    });
    
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// Send a message
app.post('/api/send', async (req, res) => {
  try {
    if (!whatsappClient) {
      return res.status(400).json({ error: 'WhatsApp client not initialized' });
    }
    
    const { to, message, options } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    // Format phone number
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@')) {
      formattedNumber = `${formattedNumber}@c.us`;
    }
    
    const result = await whatsappClient.sendMessage(formattedNumber, message, options);
    
    // Creamos un objeto messageData similar al que se crea para mensajes entrantes
    const messageData = {
      id: result.id._serialized,
      from: whatsappClient.info.wid._serialized,
      to: formattedNumber,
      body: message,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'chat',
      hasMedia: options && options.media ? true : false
    };
    
    // Activar el webhook para mensajes salientes también
    if (webhookUrl) {
      try {
        console.log(`Enviando mensaje saliente a webhook: ${webhookMethod} ${webhookUrl}`);
        
        // Convertir messageData a un formato simplificado
        const formattedMessageData = {
          id: messageData.id,
          from: messageData.from,
          to: messageData.to,
          body: messageData.body,
          timestamp: messageData.timestamp,
          hasMedia: messageData.hasMedia,
          type: messageData.type,
          direction: 'outgoing' // Indicar que es un mensaje saliente
        };
        
        // Para métodos que necesitan query params
        const queryParams = new URLSearchParams();
        Object.entries(formattedMessageData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        
        switch(webhookMethod) {
          case 'GET':
            await axios.get(`${webhookUrl}?${queryParams.toString()}`);
            break;
          case 'POST':
            await axios.post(webhookUrl, formattedMessageData);
            break;
          case 'PUT':
            await axios.put(webhookUrl, formattedMessageData);
            break;
          case 'PATCH':
            await axios.patch(webhookUrl, formattedMessageData);
            break;
          case 'DELETE':
            await axios.delete(`${webhookUrl}?${queryParams.toString()}`);
            break;
          case 'HEAD':
            await axios.head(`${webhookUrl}?${queryParams.toString()}`);
            break;
          default:
            await axios.post(webhookUrl, formattedMessageData);
        }
        console.log('✅ Mensaje saliente enviado al webhook correctamente');
      } catch (error) {
        console.error('❌ Error al enviar mensaje saliente al webhook:', error.message);
      }
    }
    
    res.json({
      success: true,
      id: result.id._serialized,
      to: formattedNumber
    });
  } catch (error) {
    console.error('Send message API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all chats
app.get('/api/chats', async (req, res) => {
  try {
    if (!whatsappClient) {
      return res.status(400).json({ error: 'WhatsApp client not initialized' });
    }
    
    const chats = await whatsappClient.getChats();
    const formattedChats = chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      timestamp: chat.timestamp,
      unreadCount: chat.unreadCount
    }));
    
    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Get chats API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific chat
app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    if (!whatsappClient) {
      return res.status(400).json({ error: 'WhatsApp client not initialized' });
    }
    
    const { chatId } = req.params;
    const { limit = 50 } = req.query;
    
    const chat = await whatsappClient.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: parseInt(limit) });
    
    const formattedMessages = messages.map(msg => ({
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      to: msg.to,
      timestamp: msg.timestamp,
      hasMedia: msg.hasMedia,
      type: msg.type
    }));
    
    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Get chat messages API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configure webhook URL
app.post('/api/webhook', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }
  
  webhookUrl = url;
  res.json({ success: true, url: webhookUrl });
});

// Configure n8n webhook URL
app.post('/api/n8n-webhook', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'n8n webhook URL is required' });
  }
  
  n8nWebhookUrl = url;
  res.json({ success: true, url: n8nWebhookUrl });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
  
  // Muestra las interfaces de red disponibles
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  
  console.log('\nInterfaces de red disponibles:');
  for (const ifaceName in networkInterfaces) {
    const interfaces = networkInterfaces[ifaceName];
    for (const iface of interfaces) {
      // Sólo mostramos direcciones IPv4 que no sean localhost
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  • Acceso por red local: http://${iface.address}:${PORT}`);
      }
    }
  }
});