// Importaciones y configuración
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');

// Configuración en memoria
let webhookList = [];
let allLabels = [];
let chatLabels = {};
let apiConfig = { enable: true, apiKey: 'matechat.com' };

// Función genérica para llamar a un webhook
async function callWebhook(webhookUrl, eventType, payload) {
  if (!webhookUrl) return;
  try {
    const response = await axios.post(webhookUrl, { event: eventType, data: payload });
    console.log(`Webhook [${eventType}] => ${webhookUrl}`, response.status, response.statusText);
  } catch (error) {
    console.error(`Error llamando al webhook [${eventType}] (${webhookUrl}):`, error.message);
  }
}

// Inicialización de Express y Socket.IO
const app = express();
const server = createServer(app);
const io = new Server(server);

// Servir estáticos
app.use(express.static('public'));
app.use(express.json());

// Endpoints para administrar múltiples webhooks
app.get('/api/webhooks', (req, res) => {
  return res.json({ success: true, webhooks: webhookList });
});

app.post('/api/webhooks', (req, res) => {
  const { url, onMessageReceived, onMessageSent } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Falta URL' });
  }
  if (webhookList.find(hook => hook.url === url)) {
    return res.status(400).json({ success: false, error: 'El webhook ya existe' });
  }
  webhookList.push({
    url,
    onMessageReceived: !!onMessageReceived,
    onMessageSent: !!onMessageSent
  });
  return res.json({ success: true, message: 'Webhook agregado', webhooks: webhookList });
});

app.delete('/api/webhooks', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Falta URL' });
  }
  const prevCount = webhookList.length;
  webhookList = webhookList.filter(hook => hook.url !== url);
  if (webhookList.length < prevCount) {
    return res.json({ success: true, message: 'Webhook eliminado', webhooks: webhookList });
  } else {
    return res.status(404).json({ success: false, error: 'Webhook no encontrado' });
  }
});

// Endpoints de la API (chats y envío de mensajes)
app.get('/api/chats', async (req, res) => {
  try {
    if (apiConfig.apiKey && req.headers['x-api-key'] !== apiConfig.apiKey) {
      return res.status(401).json({ success: false, error: 'API key inválida' });
    }
    const chats = await client.getChats();
    chats.sort((a, b) => {
      const tA = a.lastMessage?.timestamp || 0;
      const tB = b.lastMessage?.timestamp || 0;
      return tB - tA;
    });
    const simple = chats.map(c => ({ id: c.id._serialized, name: c.name || c.id.user }));
    return res.json({ success: true, chats: simple });
  } catch (err) {
    console.error('Error /api/chats:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

app.post('/api/send-message', async (req, res) => {
  try {
    if (apiConfig.apiKey && req.headers['x-api-key'] !== apiConfig.apiKey) {
      return res.status(401).json({ success: false, error: 'Clave API inválida' });
    }
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ success: false, error: 'Falta chatId o text' });
    }
    await client.sendMessage(chatId, text);
    webhookList.forEach(hook => {
      if (hook.onMessageSent) {
        callWebhook(hook.url, 'onMessageSent', { to: chatId, text, timestamp: Date.now() });
      }
    });
    return res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (err) {
    console.error('Error /api/send-message:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// Crear el cliente de WhatsApp y configurar sus eventos
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'matechat' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

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
  console.log('¡WhatsApp listo!');
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
  io.emit('new-message', { id: message.from, text: message.body, fromMe: message.fromMe });
  webhookList.forEach((hook) => {
    if (hook.onMessageReceived) {
      callWebhook(hook.url, 'onMessageReceived', {
        from: message.from,
        body: message.body,
        fromMe: message.fromMe,
        timestamp: message.timestamp
      });
    }
  });
});

// Mensajes generados por ti
client.on('message_create', (message) => {
  if (message.fromMe) {
    webhookList.forEach((hook) => {
      if (hook.onMessageSent) {
        callWebhook(hook.url, 'onMessageSent', {
          to: message.to,
          text: message.body,
          timestamp: message.timestamp
        });
      }
    });
  }
});

// Listener para message_ack
client.on('message_ack', (message, ack) => {
  io.emit('message-ack', { messageId: message.id._serialized, ack });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado a Socket.IO');

  // Pedir historial de chat
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

  // Enviar mensaje desde el frontend
  socket.on('send-message', async (data) => {
    const { to, text } = data;
    console.log(`Enviando mensaje a ${to}: ${text}`);
    try {
      const message = await client.sendMessage(to, text);
      io.emit('message-created', {
        id: message.id._serialized,
        to: message.to,
        text: message.body,
        fromMe: message.fromMe,
        timestamp: message.timestamp
      });
      webhookList.forEach(hook => {
        if (hook.onMessageSent) {
          callWebhook(hook.url, 'onMessageSent', {
            to,
            text,
            timestamp: message.timestamp
          });
        }
      });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
    }
  });

  // Etiquetas
  socket.on('get-all-labels', () => {
    socket.emit('all-labels', allLabels);
  });

  socket.on('create-label', (data) => {
    const newId = 'lbl-' + Date.now();
    const newLabel = { id: newId, name: data.name || 'Etiqueta sin nombre', color: data.color || '#000' };
    allLabels.push(newLabel);
    io.emit('all-labels', allLabels);
  });

  socket.on('delete-label', (labelId) => {
    allLabels = allLabels.filter(lbl => lbl.id !== labelId);
    for (const cId in chatLabels) {
      chatLabels[cId] = chatLabels[cId].filter(lid => lid !== labelId);
    }
    io.emit('all-labels', allLabels);
    io.emit('chat-labels-updated', chatLabels);
  });

  socket.on('assign-label', (data) => {
    const { chatId, labelId } = data;
    if (!chatLabels[chatId]) chatLabels[chatId] = [];
    if (!chatLabels[chatId].includes(labelId)) {
      chatLabels[chatId].push(labelId);
    }
    io.emit('chat-labels-updated', chatLabels);
  });

  socket.on('unassign-label', (data) => {
    const { chatId, labelId } = data;
    if (chatLabels[chatId]) {
      chatLabels[chatId] = chatLabels[chatId].filter(lid => lid !== labelId);
    }
    io.emit('chat-labels-updated', chatLabels);
  });
});

// Cargar Chats y arrancar
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
    console.error('Error al obtener chats:', err);
  }
}

// Puerto para Railway
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  client.initialize();
});