const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/database');
const WhatsAppService = require('./src/services/whatsappService');
const whatsappController = require('./src/controllers/whatsappController');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize WhatsApp service
const whatsappService = new WhatsAppService(io);
whatsappService.initialize();

// Set WhatsApp service in the controller
whatsappController.setWhatsAppService(whatsappService);

// Routes
app.use('/', require('./src/routes/web'));
app.use('/api', require('./src/routes/api'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send current WhatsApp status
  const status = whatsappService.getStatus();
  socket.emit('whatsappStatus', { status: status.isConnected ? 'connected' : 'disconnected' });
  
  // If QR code is available, send it
  if (whatsappService.qrCode) {
    require('qrcode').toDataURL(whatsappService.qrCode, (err, url) => {
      if (!err) {
        socket.emit('qrCode', url);
      }
    });
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to connect WhatsApp`);
});