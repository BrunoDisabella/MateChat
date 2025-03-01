const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Importar servicios y rutas
const whatsappApi = require('./services/whatsappApi');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');

// Inicializar express y servidor
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api', apiRoutes);
app.use('/webhook', webhookRoutes);

// Ruta principal que sirve el HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Intentar inicializar la conexión a WhatsApp al arrancar
(async () => {
  try {
    console.log('Iniciando conexión a WhatsApp Business API...');
    const result = await whatsappApi.initialize();
    if (result.success) {
      console.log('Conexión a WhatsApp Business API establecida correctamente');
      console.log('Información de negocio:', result.businessInfo);
    } else {
      console.error('Error al conectar con WhatsApp Business API:', result.error);
    }
  } catch (error) {
    console.error('Error al inicializar WhatsApp API:', error.message);
  }
})();

// Puerto para Railway o valor por defecto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});