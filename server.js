const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { default: makeWASocket, DisconnectReason } = require('@adiwajshing/baileys');
const QRCode = require('qrcode');
const logger = require('./utils/logger');
const config = require('./config/config');
const { state, saveState } = require('./auth/sessionManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

async function startSock() {
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    logger.info('Actualización de conexión:', update);

    if (qr) {
      QRCode.toDataURL(qr, (err, url) => {
        if (err) {
          logger.error('Error generando el QR:', err);
        } else {
          io.emit('qr', url);
        }
      });
    }

    if (connection === 'open') {
      logger.info('Conectado a WhatsApp');
      io.emit('status', 'Conectado a WhatsApp');
    } else if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.info('Conexión cerrada. Reconexion:', shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
      io.emit('status', 'Desconectado de WhatsApp');
    }
  });
}

startSock();

server.listen(config.port, () => {
  logger.info(`Servidor ejecutándose en el puerto ${config.port}`);
});