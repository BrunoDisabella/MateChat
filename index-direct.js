/**
 * Servidor simple para mostrar las instrucciones para conectar directamente con WhatsApp Web
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

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
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp Web Directo</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f0f2f5;
          color: #41525d;
          margin: 0;
          padding: 20px;
          line-height: 1.6;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #00a884;
          text-align: center;
          margin-bottom: 20px;
        }
        h2 {
          color: #41525d;
          margin-top: 30px;
        }
        ol {
          padding-left: 20px;
        }
        li {
          margin-bottom: 15px;
        }
        .qr-placeholder {
          border: 2px dashed #00a884;
          padding: 20px;
          text-align: center;
          margin: 30px auto;
          width: 300px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .note {
          background-color: #f2f8ff;
          padding: 15px;
          border-left: 4px solid #00a884;
          margin: 20px 0;
        }
        .btn {
          background-color: #00a884;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 25px;
          cursor: pointer;
          font-size: 16px;
          display: block;
          margin: 30px auto;
          text-align: center;
          text-decoration: none;
          width: 200px;
        }
        .btn:hover {
          background-color: #008069;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Conexión Directa a WhatsApp Web</h1>
        
        <div class="note">
          <p>Debido a limitaciones técnicas, no podemos mostrar el código QR directamente en esta página. Sin embargo, puedes seguir estas instrucciones para conectar tu WhatsApp:</p>
        </div>
        
        <h2>Instrucciones:</h2>
        <ol>
          <li>Abre WhatsApp Web oficial en tu navegador:
            <a href="https://web.whatsapp.com" target="_blank" class="btn">Abrir WhatsApp Web</a>
          </li>
          <li>En tu teléfono, abre la aplicación WhatsApp</li>
          <li>Toca el menú ⋮ (Android) o Ajustes ⚙️ (iPhone)</li>
          <li>Selecciona "Dispositivos vinculados" → "Vincular un dispositivo"</li>
          <li>Escanea el código QR que aparece en la página de WhatsApp Web</li>
          <li>Una vez conectado, regresa a esta ventana para continuar con la aplicación</li>
        </ol>
        
        <h2>Después de conectar:</h2>
        <p>Una vez que hayas vinculado tu WhatsApp, cierra esta página y ejecuta la aplicación principal que instalaste, utilizando los siguientes comandos:</p>
        <pre>cd /ruta/a/tu/proyecto
node server.js</pre>

        <div class="note">
          <p><strong>Nota importante:</strong> Para que esta solución funcione correctamente, debes tener instalado Chrome o Chromium en tu sistema. La aplicación utilizará tu sesión de WhatsApp Web para interactuar con tus contactos.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor simple ejecutándose en puerto ${PORT}`);
  console.log(`Abre la aplicación en http://localhost:${PORT}`);
});