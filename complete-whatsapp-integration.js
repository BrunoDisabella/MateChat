// This is a complete, integrated code for a WhatsApp Web integration application
// File structure is organized by comments for clarity
// Copy all code and organize into appropriate files when implementing

//===========================================
// package.json
//===========================================
/*
{
  "name": "whatsapp-integration",
  "version": "1.0.0",
  "description": "WhatsApp integration web application with webhook support",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "ejs": "^3.1.9",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "helmet": "^7.1.0",
    "qrcode": "^1.5.3",
    "socket.io": "^4.7.2",
    "whatsapp-web.js": "^1.23.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
*/

//===========================================
// server.js - Main Application File
//===========================================
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);
const io = socketIo(server);

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
let n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || '';
let isInitializing = false;
let connectedClients = new Set();

// WhatsApp client initialization
const initWhatsAppClient = async () => {
  if (isInitializing || whatsappClient) return;
  
  isInitializing = true;
  console.log('Initializing WhatsApp client...');
  
  try {
    whatsappClient = new Client({
      authStrategy: new LocalAuth({ clientId: 'whatsapp-integration' }),
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
        ]
      }
    });

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
      whatsappClient = null;
      qrCodeDataUrl = null;
      isInitializing = false;
      io.emit('disconnected', { reason });
    });

    whatsappClient.on('message', async (message) => {
      console.log(`New message from ${message.from}: ${message.body}`);
      
      // Format the message data
      const messageData = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        hasMedia: message.hasMedia,
        type: message.type,
        isForwarded: message.isForwarded
      };
      
      // Emit to all connected sockets
      io.emit('newMessage', messageData);
      
      // Forward to webhook if configured
      if (webhookUrl) {
        try {
          await axios.post(webhookUrl, messageData);
        } catch (error) {
          console.error('Error forwarding message to webhook:', error.message);
        }
      }
      
      // Forward to n8n webhook if configured
      if (n8nWebhookUrl) {
        try {
          await axios.post(n8nWebhookUrl, messageData);
        } catch (error) {
          console.error('Error forwarding message to n8n webhook:', error.message);
        }
      }
    });

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
  
  // Send current QR code if available
  if (qrCodeDataUrl) {
    socket.emit('qrCode', { qrCode: qrCodeDataUrl });
  }
  
  // Client requests WhatsApp initialization
  socket.on('initWhatsApp', () => {
    initWhatsAppClient();
  });
  
  // Send message request
  socket.on('sendMessage', async (data) => {
    try {
      if (!whatsappClient) {
        socket.emit('error', { message: 'WhatsApp client not initialized' });
        return;
      }
      
      const { to, message, options } = data;
      
      // Format phone number
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }
      
      const result = await whatsappClient.sendMessage(formattedNumber, message, options);
      
      socket.emit('messageSent', {
        success: true,
        id: result.id._serialized,
        to: formattedNumber
      });
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Configure webhook URL
  socket.on('setWebhook', (data) => {
    webhookUrl = data.url;
    socket.emit('webhookSet', { success: true, url: webhookUrl });
  });
  
  // Configure n8n webhook URL
  socket.on('setN8nWebhook', (data) => {
    n8nWebhookUrl = data.url;
    socket.emit('n8nWebhookSet', { success: true, url: n8nWebhookUrl });
  });
  
  // Fetch chats
  socket.on('getChats', async () => {
    try {
      if (!whatsappClient) {
        socket.emit('error', { message: 'WhatsApp client not initialized' });
        return;
      }
      
      const chats = await whatsappClient.getChats();
      const formattedChats = chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        timestamp: chat.timestamp,
        unreadCount: chat.unreadCount,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp
        } : null
      }));
      
      socket.emit('chats', { chats: formattedChats });
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
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id._serialized,
        body: msg.body,
        from: msg.from,
        to: msg.to,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia,
        type: msg.type,
        isForwarded: msg.isForwarded
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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//===========================================
// views/index.ejs - QR Code Scanning Page
//===========================================
/*
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inicia sesión en WhatsApp Web</title>
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="icon" href="/images/favicon.ico">
</head>
<body class="login-page">
  <div class="container">
    <header>
      <div class="logo">
        <img src="/images/whatsapp-logo.svg" alt="WhatsApp">
        <span>WhatsApp</span>
      </div>
      <div class="download-btn">
        <a href="#" class="btn">Descargar <i class="download-icon"></i></a>
      </div>
    </header>
    
    <main>
      <div class="qr-container">
        <h1>Inicia sesión en WhatsApp Web</h1>
        <p>Envía mensajes privados a tus amigos y familiares a través de WhatsApp en tu navegador.</p>
        
        <ol class="instructions">
          <li>Abre WhatsApp en tu teléfono.</li>
          <li>Toca Menú <span class="menu-icon">⋮</span> en Android o Ajustes <span class="settings-icon">⚙️</span> en iPhone.</li>
          <li>Toca Dispositivos vinculados y, luego, Vincular un dispositivo.</li>
          <li>Apunta tu teléfono hacia esta pantalla para escanear el código QR.</li>
        </ol>
        
        <div id="qr-code" class="qr-code">
          <div class="loading">Cargando código QR...</div>
        </div>
        
        <div class="checkbox-container">
          <input type="checkbox" id="keep-session" checked>
          <label for="keep-session">Mantener la sesión iniciada en este navegador</label>
          <span class="info-icon">ⓘ</span>
        </div>
        
        <div class="alternative-login">
          <a href="#" id="phone-login">Iniciar sesión con número de teléfono</a>
        </div>
      </div>
    </main>
    
    <footer>
      <p class="encryption-notice">
        <span class="lock-icon">🔒</span>
        Tus mensajes personales están cifrados de extremo a extremo
      </p>
    </footer>
  </div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/qrcode.js"></script>
</body>
</html>
*/

//===========================================
// views/chat.ejs - Chat Interface
//===========================================
/*
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Web</title>
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="icon" href="/images/favicon.ico">
</head>
<body class="chat-page">
  <div class="container">
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="user-profile">
          <div class="avatar">
            <img src="/images/default-avatar.png" alt="Profile">
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-btn status-btn"><i class="status-icon"></i></button>
          <button class="icon-btn new-chat-btn"><i class="new-chat-icon"></i></button>
          <button class="icon-btn menu-btn"><i class="menu-icon"></i></button>
        </div>
      </div>
      
      <div class="search-container">
        <div class="search-box">
          <i class="search-icon"></i>
          <input type="text" id="search-input" placeholder="Buscar o empezar un chat nuevo">
          <i class="filter-icon"></i>
        </div>
      </div>
      
      <div class="chat-list" id="chat-list">
        <!-- Chat list items will be populated here -->
        <div class="empty-list">
          <p>Cargando chats...</p>
        </div>
      </div>
      
      <div class="sidebar-settings">
        <button class="btn settings-btn" id="open-settings">Configuración</button>
      </div>
    </div>
    
    <div class="main-content">
      <div class="welcome-screen" id="welcome-screen">
        <div class="welcome-illustration">
          <img src="/images/whatsapp-devices.svg" alt="WhatsApp Web">
        </div>
        <h1>WhatsApp Web</h1>
        <p>Envía y recibe mensajes sin necesidad de tener tu teléfono conectado.</p>
        <p class="small">Usa WhatsApp en hasta 4 dispositivos vinculados y 1 teléfono a la vez.</p>
        <p class="encryption-notice">
          <span class="lock-icon">🔒</span>
          Tus mensajes personales están cifrados de extremo a extremo.
        </p>
      </div>
      
      <div class="chat-window hidden" id="chat-window">
        <div class="chat-header">
          <div class="chat-contact">
            <div class="avatar">
              <img src="/images/default-avatar.png" alt="Contact" id="chat-contact-avatar">
            </div>
            <div class="contact-info">
              <h2 class="contact-name" id="chat-contact-name">Nombre del contacto</h2>
              <p class="contact-status" id="chat-contact-status">en línea</p>
            </div>
          </div>
          <div class="chat-actions">
            <button class="icon-btn search-chat-btn"><i class="search-icon"></i></button>
            <button class="icon-btn more-options-btn"><i class="more-icon"></i></button>
          </div>
        </div>
        
        <div class="messages-container" id="messages-container">
          <!-- Messages will be populated here -->
        </div>
        
        <div class="message-composer">
          <div class="composer-actions">
            <button class="icon-btn emoji-btn"><i class="emoji-icon"></i></button>
            <button class="icon-btn attach-btn"><i class="attach-icon"></i></button>
          </div>
          <div class="message-input">
            <input type="text" id="message-text" placeholder="Escribe un mensaje">
          </div>
          <button class="icon-btn send-btn" id="send-message"><i class="send-icon"></i></button>
        </div>
      </div>
    </div>
    
    <!-- Settings Modal -->
    <div class="modal hidden" id="settings-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Configuración</h2>
          <button class="close-btn" id="close-settings">&times;</button>
        </div>
        <div class="modal-body">
          <h3>Configuración de Webhook</h3>
          <div class="form-group">
            <label for="webhook-url">URL del Webhook:</label>
            <input type="text" id="webhook-url" placeholder="https://ejemplo.com/webhook">
            <button class="btn save-btn" id="save-webhook">Guardar</button>
          </div>
          
          <h3>Configuración de Webhook para n8n</h3>
          <div class="form-group">
            <label for="n8n-webhook-url">URL del Webhook de n8n:</label>
            <input type="text" id="n8n-webhook-url" placeholder="https://n8n.ejemplo.com/webhook">
            <button class="btn save-btn" id="save-n8n-webhook">Guardar</button>
          </div>
          
          <h3>Estado de Conexión</h3>
          <div class="connection-status">
            <p>Estado: <span id="connection-status">Conectado</span></p>
            <button class="btn" id="logout-btn">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/chat.js"></script>
</body>
</html>
*/

//===========================================
// public/css/styles.css
//===========================================
/*
:root {
  --primary-color: #00a884;
  --secondary-color: #008069;
  --light-color: #f0f2f5;
  --gray-color: #d1d7db;
  --text-color: #41525d;
  --text-secondary: #667781;
  --message-out: #d9fdd3;
  --message-in: #ffffff;
  --sidebar-bg: #ffffff;
  --chat-bg: #efeae2;
  --border-color: #d1d7db;
  --danger-color: #e74c3c;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
  background-color: var(--light-color);
  color: var(--text-color);
  height: 100vh;
  overflow: hidden;
}

.container {
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
}

/* Login Page Styles */
.login-page .container {
  display: flex;
  flex-direction: column;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
}

.logo {
  display: flex;
  align-items: center;
}

.logo img {
  height: 40px;
  margin-right: 10px;
}

.logo span {
  font-size: 20px;
  font-weight: 500;
  color: var(--secondary-color);
}

.btn {
  background-color: var(--primary-color);
  color: white;
  padding: 8px 16px;
  border-radius: 24px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.btn:hover {
  background-color: var(--secondary-color);
}

.download-icon:after {
  content: "⬇";
  margin-left: 8px;
}

main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-container {
  background-color: white;
  border-radius: 8px;
  padding: 40px;
  width: 100%;
  max-width: 880px;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.qr-container h1 {
  font-size: 28px;
  margin-bottom: 16px;
  color: var(--text-color);
}

.qr-container p {
  color: var(--text-secondary);
  margin-bottom: 24px;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.instructions {
  text-align: left;
  margin-left: 40px;
  margin-bottom: 24px;
  color: var(--text-secondary);
}

.instructions li {
  margin-bottom: 8px;
}

.menu-icon:after {
  content: "⋮";
}

.settings-icon:after {
  content: "⚙️";
}

.qr-code {
  width: 264px;
  height: 264px;
  margin: 0 auto 24px;
  border: 1px solid var(--border-color);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: white;
}

.qr-code img {
  width: 100%;
  height: 100%;
}

.loading {
  color: var(--text-secondary);
}

.checkbox-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.checkbox-container input {
  margin-right: 8px;
}

.info-icon:after {
  content: "ⓘ";
  margin-left: 4px;
  color: var(--text-secondary);
  font-size: 14px;
}

.alternative-login a {
  color: var(--primary-color);
  text-decoration: none;
}

.alternative-login a:hover {
  text-decoration: underline;
}

footer {
  text-align: center;
  padding: 20px 0;
}

.encryption-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.lock-icon:after {
  content: "🔒";
  margin-right: 8px;
}

/* Chat Page Styles */
.chat-page .container {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 400px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background-color: var(--sidebar-bg);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--light-color);
}

.user-profile {
  display: flex;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-actions {
  display: flex;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  margin-left: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.status-icon:after {
  content: "⭐";
}

.new-chat-icon:after {
  content: "💬";
}

.menu-icon:after {
  content: "⋮";
}

.search-container {
  padding: 8px 