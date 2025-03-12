//-------------------------------------
// Imports y configuración
//-------------------------------------
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios'); // Para webhooks y requests

//-------------------------------------
// Configuración en memoria
//-------------------------------------

// Webhook
let webhookConfig = {
  url: '',
  onMessageReceived: false,
  onMessageSent: false
};

// Etiquetas globales
let allLabels = [];
// Relación chat -> array de label IDs
let chatLabels = {};

// API config (para habilitar la API y exigir apiKey)
let apiConfig = {
  enabled: false,
  apiKey: ''  // si está vacío, no exige match
};

//-------------------------------------
// Función genérica para llamar al webhook
//-------------------------------------
async function callWebhook(eventType, payload) {
  if (!webhookConfig.url) return;
  try {
    const response = await axios.post(webhookConfig.url, {
      event: eventType,
      data: payload
    });
    console.log(`Webhook [${eventType}] =>`, response.status, response.statusText);
  } catch (error) {
    console.error('Error llamando al webhook:', error.message);
  }
}

//-------------------------------------
// Inicialización de Express y Socket.IO
//-------------------------------------
const app = express();
const server = createServer(app);
const io = new Server(server);

// Servir estáticos
app.use(express.static('public'));
// Para parsear JSON (API)
app.use(express.json());

//-------------------------------------
// Crear el cliente de WhatsApp
//-------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'matechat' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox']
  },
});

//-------------------------------------
// Eventos de WhatsApp
//-------------------------------------
client.on('qr', async (qr) => {
  try {
    const qrImageUrl = await qrcode.toDataURL(qr);
    io.emit('qr', qrImageUrl);
    console.log('QR enviado al cliente');
  } catch (err) {
    console.error('Error generando QR:', err);
    io.emit('qr-error', 'No se pudo generar el código QR');
  }
});

client.on('ready', () => {
  console.log('WhatsApp listo!');
  io.emit('connected', true);
  fetchChats();
});

client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
  io.emit('connected', false);
});

client.on('disconnected', (reason) => {
  console.log('Cliente desconectado:', reason);
  io.emit('connected', false);
});

// Mensaje entrante
client.on('message', (message) => {
  console.log(`Mensaje de ${message.from}: ${message.body}`);
  // Emitimos al frontend
  io.emit('new-message', {
    id: message.from,
    text: message.body,
    fromMe: message.fromMe
  });
  // Webhook onMessageReceived
  if (webhookConfig.onMessageReceived) {
    callWebhook('onMessageReceived', {
      from: message.from,
      body: message.body,
      fromMe: message.fromMe,
      timestamp: message.timestamp
    });
  }
});

//-------------------------------------
// Socket.IO
//-------------------------------------
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado al Socket.IO');

  // Pedir historial de un chat
  socket.on('select-chat', async (chatId) => {
    try {
      const chat = await client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit: 20 });
      const mapped = messages.map(msg => ({
        id: msg.id._serialized,
        fromMe: msg.fromMe,
        body: msg.body
      }));
      socket.emit('chat-history', { chatId, messages: mapped });
    } catch (err) {
      console.error('Error al obtener historial:', err);
      socket.emit('chat-history-error', 'No se pudo cargar historial');
    }
  });

  // Enviar mensaje desde frontend
  socket.on('send-message', async (data) => {
    const { to, text } = data;
    console.log(`Enviando mensaje a ${to}: ${text}`);
    try {
      await client.sendMessage(to, text);
      io.emit('message-sent', { to, text });
      // Webhook onMessageSent
      if (webhookConfig.onMessageSent) {
        callWebhook('onMessageSent', {
          to,
          text,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  });

  // Configurar Webhook
  socket.on('update-webhook-config', (newConfig) => {
    webhookConfig = {
      url: newConfig.url || '',
      onMessageReceived: !!newConfig.onMessageReceived,
      onMessageSent: !!newConfig.onMessageSent
    };
    console.log('Nueva config de webhook:', webhookConfig);
    socket.emit('webhook-config-updated', webhookConfig);
  });
  // Al conectar
  socket.emit('webhook-config-updated', webhookConfig);

  // Etiquetas: leer lista global
  socket.on('get-all-labels', () => {
    socket.emit('all-labels', allLabels);
  });
  // Crear etiqueta global
  socket.on('create-label', (data) => {
    const newId = 'lbl-' + Date.now();
    const newLabel = {
      id: newId,
      name: data.name || 'Etiqueta sin nombre',
      color: data.color || '#000'
    };
    allLabels.push(newLabel);
    io.emit('all-labels', allLabels);
  });
  // Eliminar etiqueta global
  socket.on('delete-label', (labelId) => {
    allLabels = allLabels.filter(lbl => lbl.id !== labelId);
    // Quitarla de todos los chats
    for (const cId in chatLabels) {
      chatLabels[cId] = chatLabels[cId].filter(lid => lid !== labelId);
    }
    io.emit('all-labels', allLabels);
    io.emit('chat-labels-updated', chatLabels);
  });
  // Asignar etiqueta a chat
  socket.on('assign-label', (data) => {
    const { chatId, labelId } = data;
    if (!chatLabels[chatId]) chatLabels[chatId] = [];
    if (!chatLabels[chatId].includes(labelId)) {
      chatLabels[chatId].push(labelId);
    }
    io.emit('chat-labels-updated', chatLabels);
  });
  // Quitar etiqueta de chat
  socket.on('unassign-label', (data) => {
    const { chatId, labelId } = data;
    if (!chatLabels[chatId]) chatLabels[chatId] = [];
    chatLabels[chatId] = chatLabels[chatId].filter(lid => lid !== labelId);
    io.emit('chat-labels-updated', chatLabels);
  });
  // Al conectar, mandamos la relación chat-etiquetas
  socket.emit('chat-labels-updated', chatLabels);

  // ---------------------------------------------------
  //  Configuración de la API (apiConfig)
  // ---------------------------------------------------
  socket.on('update-api-config', (newCfg) => {
    apiConfig.enabled = !!newCfg.enabled;
    apiConfig.apiKey = newCfg.apiKey || '';
    console.log('Nueva config de API:', apiConfig);
    socket.emit('api-config-updated', apiConfig);
  });
  // Al conectar
  socket.emit('api-config-updated', apiConfig);
});

//-------------------------------------
// GET de chats y POST de send-message (vía API)
//-------------------------------------
app.get('/api/chats', async (req, res) => {
  try {
    if (!apiConfig.enabled) {
      return res.status(403).json({ success: false, error: 'API está deshabilitada' });
    }
    if (apiConfig.apiKey && req.headers['x-api-key'] !== apiConfig.apiKey) {
      return res.status(401).json({ success: false, error: 'API key inválida' });
    }

    const chats = await client.getChats();
    chats.sort((a, b) => {
      const tA = a.lastMessage?.timestamp || 0;
      const tB = b.lastMessage?.timestamp || 0;
      return tB - tA;
    });
    const simple = chats.map(c => ({
      id: c.id._serialized,
      name: c.name || c.id.user
    }));
    return res.json({ success: true, chats: simple });
  } catch (err) {
    console.error('Error /api/chats:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

app.post('/api/send-message', async (req, res) => {
  try {
    if (!apiConfig.enabled) {
      return res.status(403).json({ success: false, error: 'API está deshabilitada' });
    }
    if (apiConfig.apiKey && req.headers['x-api-key'] !== apiConfig.apiKey) {
      return res.status(401).json({ success: false, error: 'API key inválida' });
    }

    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ success: false, error: 'Falta chatId o text' });
    }
    await client.sendMessage(chatId, text);

    // Webhook onMessageSent si corresponde
    if (webhookConfig.onMessageSent) {
      callWebhook('onMessageSent', {
        to: chatId,
        text,
        timestamp: Date.now()
      });
    }
    return res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (err) {
    console.error('Error /api/send-message:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

//-------------------------------------
// Cargar Chats y arrancar
//-------------------------------------
async function fetchChats() {
  try {
    let chats = await client.getChats();
    chats.sort((a, b) => {
      const tA = a.lastMessage?.timestamp || 0;
      const tB = b.lastMessage?.timestamp || 0;
      return tB - tA;
    });
    const simpleChats = chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name || chat.id.user
    }));
    io.emit('chats', simpleChats);
    console.log(`Se enviaron ${simpleChats.length} chats al frontend.`);
  } catch (err) {
    console.error('Error obteniendo chats:', err);
  }
}

// Puerto para Railway
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  client.initialize();
});
