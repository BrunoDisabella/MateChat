//-------------------------------------
// Imports y configuración
//-------------------------------------
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');

//-------------------------------------
// Lista de webhooks (cada uno con su configuración)
//-------------------------------------
let webhookList = [
  // Ejemplo (inicialmente vacío)
  // {
  //   url: 'https://miwebhook1.com',
  //   onMessageReceived: true,
  //   onMessageSent: true
  // }
];

//-------------------------------------
// Función para llamar a un webhook dado
//-------------------------------------
async function callWebhook(webhookUrl, eventType, payload) {
  if (!webhookUrl) return;
  try {
    const response = await axios.post(webhookUrl, {
      event: eventType,
      data: payload
    });
    console.log(`Webhook [${eventType}] => ${webhookUrl}`, response.status, response.statusText);
  } catch (error) {
    console.error(`Error llamando al webhook [${eventType}] (${webhookUrl}):`, error.message);
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
// Para parsear JSON en requests
app.use(express.json());

//-------------------------------------
// Endpoints para administrar webhooks
//-------------------------------------
app.get('/api/webhooks', (req, res) => {
  return res.json({ success: true, webhooks: webhookList });
});

app.post('/api/webhooks', (req, res) => {
  const { url, onMessageReceived, onMessageSent } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Falta URL' });
  }
  // Evita duplicados
  if (webhookList.find(hook => hook.url === url)) {
    return res.status(400).json({ success: false, error: 'Webhook ya existe' });
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

//-------------------------------------
// Configuración de la API (para chats y envío de mensajes)
//-------------------------------------
let apiConfig = {
  enabled: false,
  apiKey: ''  // si está vacío, no exige match
};

app.get('/api/chats', async (req, res) => {
  try {
    if (!apiConfig.enabled) {
      return res.status(403).json({ success: false, error: 'API está deshabilitada' });
    }
    if (apiConfig.apiKey && req.headers['x-api-key'] !== apiConfig.apiKey) {
      return res.status(401).json({ success: false, error: 'API key inválida' });
    }

    const chats = await client.getChats();
    chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
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

    // Como ejemplo, llamamos a los webhooks configurados para onMessageSent
    webhookList.forEach(hook => {
      if (hook.onMessageSent) {
        callWebhook(hook.url, 'onMessageSent', {
          to: chatId,
          text,
          timestamp: Date.now()
        });
      }
    });
    return res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (err) {
    console.error('Error /api/send-message:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

//-------------------------------------
// Crear el cliente de WhatsApp y configurar sus eventos
//-------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'matechat' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox']
  },
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
  console.log('WhatsApp listo!');
  io.emit('connected', true);
});

client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
  io.emit('connected', false);
});

client.on('disconnected', (reason) => {
  console.log('Cliente desconectado:', reason);
  io.emit('connected', false);
});

// Evento para mensajes entrantes (de otros)
client.on('message', (message) => {
  console.log(`Mensaje de ${message.from}: ${message.body}`);

  // Llama a cada webhook que tenga onMessageReceived activado
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
  io.emit('new-message', {
    id: message.from,
    text: message.body,
    fromMe: message.fromMe
  });
});

// Evento para mensajes que tú envías (desde el script o tu celular)
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

//-------------------------------------
// Socket.IO (puedes mantener la configuración previa de chats, etiquetas, etc.)
//-------------------------------------
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado al Socket.IO');

  // Aquí puedes agregar eventos para otras funcionalidades (chats, etiquetas, etc.)
});

//-------------------------------------
// Arrancar servidor y cliente WhatsApp
//-------------------------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  client.initialize();
});
