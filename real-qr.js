/**
 * Generador de QR para WhatsApp - Formato más cercano al real
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const qrcode = require('qrcode');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = require('socket.io')(server);

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
app.use(express.static(path.join(__dirname, 'public')));

// Variables globales
let qrCodeData = null;
let isGenerating = false;

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp QR</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #222e35;
          color: #e9edef;
          margin: 0;
          padding: 20px;
          line-height: 1.6;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: #111b21;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          text-align: center;
        }
        h1 {
          color: #00a884;
          margin-bottom: 30px;
          font-size: 24px;
        }
        .qr-container {
          margin: 40px auto;
          padding: 20px;
          width: 264px;
          height: 264px;
          background-color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        #qr-code {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #qr-code img {
          max-width: 100%;
          max-height: 100%;
        }
        .btn {
          background-color: #00a884;
          color: white;
          padding: 12px 25px;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-size: 16px;
          margin: 30px 0;
          transition: background-color 0.3s;
        }
        .btn:hover {
          background-color: #008069;
        }
        .instructions {
          max-width: 450px;
          margin: 0 auto;
          text-align: left;
          background-color: #2a3942;
          padding: 20px;
          border-radius: 8px;
          margin-top: 40px;
          border-left: 4px solid #00a884;
        }
        ol {
          padding-left: 20px;
          margin-top: 20px;
        }
        li {
          margin-bottom: 15px;
        }
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border-left-color: #00a884;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .message {
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          text-align: center;
        }
        .loading {
          background-color: #2a3942;
          color: #e9edef;
        }
        .error {
          background-color: #4a232b;
          color: #f6a2a2;
        }
        .success {
          background-color: #1d3229;
          color: #a3f2c9;
        }
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Vincular WhatsApp</h1>
        
        <div id="qr-container" class="qr-container">
          <div id="loading-spinner" class="spinner"></div>
          <div id="qr-code"></div>
        </div>
        
        <div id="message" class="message loading">Generando código QR...</div>
        
        <button id="generate-btn" class="btn">Generar nuevo código QR</button>
        
        <div class="instructions">
          <h2>Para vincular tu WhatsApp:</h2>
          <ol>
            <li>Abre WhatsApp en tu teléfono</li>
            <li>Toca Menú ⋮ o Ajustes ⚙️</li>
            <li>Selecciona <strong>Dispositivos vinculados</strong></li>
            <li>Toca <strong>Vincular un dispositivo</strong></li>
            <li>Apunta tu cámara hacia esta pantalla para escanear el código QR</li>
          </ol>
        </div>
      </div>
      
      <script src="/socket.io/socket.io.js"></script>
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const socket = io();
          const qrCode = document.getElementById('qr-code');
          const loadingSpinner = document.getElementById('loading-spinner');
          const generateBtn = document.getElementById('generate-btn');
          const message = document.getElementById('message');
          
          function showLoading() {
            loadingSpinner.style.display = 'block';
            qrCode.innerHTML = '';
            message.className = 'message loading';
            message.textContent = 'Generando código QR...';
          }
          
          function showError(errorMsg) {
            loadingSpinner.style.display = 'none';
            qrCode.innerHTML = '';
            message.className = 'message error';
            message.textContent = errorMsg;
          }
          
          function showSuccess(msg) {
            loadingSpinner.style.display = 'none';
            qrCode.innerHTML = '';
            message.className = 'message success';
            message.textContent = msg;
          }
          
          // Manejar la generación de un nuevo código QR
          generateBtn.addEventListener('click', function() {
            showLoading();
            socket.emit('generateQR');
          });
          
          // Automáticamente generar un código QR al cargar la página
          showLoading();
          socket.emit('generateQR');
          
          // Recibir el código QR
          socket.on('qrCode', function(data) {
            loadingSpinner.style.display = 'none';
            qrCode.innerHTML = \`<img src="\${data.qrCode}" alt="WhatsApp QR Code">\`;
            message.className = 'message loading';
            message.textContent = 'Escanea este código con la app de WhatsApp';
            
            // Actualizar cada 20 segundos automáticamente
            setTimeout(function() {
              if (message.className !== 'message success') {
                showLoading();
                socket.emit('generateQR');
              }
            }, 20000);
          });
          
          // Manejar errores
          socket.on('error', function(data) {
            showError('Error: ' + data.message);
          });
          
          // Simular éxito para demostración
          socket.on('authenticated', function() {
            showSuccess('¡Dispositivo autenticado con éxito!');
          });
        });
      </script>
    </body>
    </html>
  `);
});

// Función para generar un código QR más realista
async function generateRealWhatsAppQR(socket) {
  if (isGenerating) return;
  
  isGenerating = true;
  console.log('Generando código QR en formato WhatsApp...');
  
  try {
    // Generar componentes del código QR
    // Referencia al formato de códigos QR de WhatsApp
    const ref = '2';
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // Generar ID de cliente y claves aleatorias
    const clientId = crypto.randomBytes(16).toString('base64');
    const serverRef = crypto.randomBytes(8).toString('hex');
    const epoch = Math.floor(Date.now() / 1000).toString();
    
    // Simular el formato del código QR de WhatsApp (aproximación al formato real)
    // Formato: [ref,clientId,serverRef,e2eEphemeral,epoch]
    const qrComponents = [
      ref,
      clientId,
      serverRef,
      keyPair.publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '').substring(0, 32),
      epoch
    ];
    
    const qrData = qrComponents.join(',');
    
    // Generar código QR con alta calidad
    qrCodeData = await qrcode.toDataURL(qrData, {
      errorCorrectionLevel: 'L',  // WhatsApp usa nivel L
      type: 'image/png',
      margin: 4,
      scale: 10,
      color: {
        dark: '#122e31',  // Color de los módulos QR (cercano al de WhatsApp)
        light: '#ffffff'  // Color de fondo
      }
    });
    
    if (socket) {
      socket.emit('qrCode', { qrCode: qrCodeData });
    } else {
      io.emit('qrCode', { qrCode: qrCodeData });
    }
    
    console.log('Código QR generado en formato WhatsApp');
    
    // Después de 15 segundos, simular autenticación (solo para demostración)
    setTimeout(() => {
      console.log('Simulando autenticación exitosa...');
      io.emit('authenticated');
    }, 45000);  // 45 segundos
    
  } catch (error) {
    console.error('Error al generar código QR:', error);
    if (socket) {
      socket.emit('error', { message: error.message });
    } else {
      io.emit('error', { message: error.message });
    }
  } finally {
    isGenerating = false;
  }
}

// Socket.io - Manejar conexiones
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado', socket.id);
  
  // Enviar código QR si ya está disponible
  if (qrCodeData) {
    socket.emit('qrCode', { qrCode: qrCodeData });
  }
  
  // Generar nuevo código QR
  socket.on('generateQR', () => {
    generateRealWhatsAppQR(socket);
  });
  
  // Desconexión
  socket.on('disconnect', () => {
    console.log('Cliente desconectado', socket.id);
  });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor QR mejorado ejecutándose en puerto ${PORT}`);
  console.log(`Accede a http://localhost:${PORT} para ver el código QR`);
});