# MateChat

Aplicación web para conectar WhatsApp personal mediante código QR, diseñada para ser desplegada en Railway.

## Características

- Generación de código QR para escanear desde el teléfono
- Conexión con WhatsApp Web mediante la librería whatsapp-web.js
- Interfaz sencilla y amigable
- Mantiene la sesión iniciada
- Posibilidad de desconexión

## Requisitos

- Node.js 14 o superior
- NPM

## Instalación local

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abre tu navegador en `http://localhost:3000`

## Despliegue en Railway

1. Crea una cuenta en [Railway](https://railway.app/) si aún no tienes una
2. Conecta tu repositorio de GitHub
3. Configura las variables de entorno si es necesario
4. Railway detectará automáticamente el Procfile y desplegará la aplicación

## Tecnologías utilizadas

- Node.js
- Express
- Socket.IO
- whatsapp-web.js
- QRCode

## Estructura del proyecto

```
/
├── src/
│   ├── public/
│   │   └── index.html
│   └── index.js
├── package.json
├── Procfile
└── README.md
```

## Notas importantes

- La aplicación requiere que el usuario escanee un código QR con su WhatsApp para establecer la conexión
- Railway proporcionará una URL pública para acceder a la aplicación
- No almacena mensajes ni información sensible de WhatsApp