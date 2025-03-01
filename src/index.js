const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal que sirve el HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado');

  // Evento cuando el cliente solicita conectar WhatsApp
  socket.on('startConnection', () => {
    if (client.info) {
      socket.emit('alreadyConnected', {
        name: client.info.pushname,
        number: client.info.wid.user
      });
      return;
    }

    console.log('Iniciando cliente de WhatsApp...');
    client.initialize();
  });

  // Evento para desconectar
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });

  // Evento para logout
  socket.on('logout', async () => {
    if (client.info) {
      await client.logout();
      socket.emit('loggedOut');
    }
  });
});

// Eventos del cliente de WhatsApp
client.on('qr', async (qr) => {
  // Generar QR como imagen
  try {
    const qrUrl = await qrcode.toDataURL(qr);
    io.emit('qrCode', qrUrl);
    console.log('QR generado');
  } catch (err) {
    console.error('Error al generar QR:', err);
  }
});

client.on('ready', () => {
  console.log('WhatsApp está listo');
  io.emit('whatsappReady', {
    name: client.info.pushname,
    number: client.info.wid.user
  });
});

client.on('authenticated', () => {
  console.log('Autenticado en WhatsApp');
  io.emit('authenticated');
});

client.on('auth_failure', (error) => {
  console.error('Error de autenticación:', error);
  io.emit('authFailure', error.message);
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp desconectado:', reason);
  io.emit('whatsappDisconnected', reason);
});

// Puerto para Railway o valor por defecto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});