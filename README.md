# MateChat - Integración WhatsApp

Esta aplicación permite integrar WhatsApp mediante escaneo QR y ofrece una interfaz web responsive optimizada para dispositivos móviles para enviar/recibir mensajes.

## Características

- Interfaz responsive adaptada tanto para escritorio como para dispositivos móviles
- Sistema de etiquetado para organizar conversaciones
- Integración con webhooks para recibir y enviar mensajes
- API para integración con aplicaciones externas
- Soporte para enviar y recibir diferentes tipos de medios (imágenes, audio, video)
- Publicación de estados desde la interfaz

## Requisitos previos

- Node.js instalado (versión 14 o superior)
- Google Chrome instalado (para entorno de desarrollo)
- Una cuenta de WhatsApp activa en tu teléfono

## Instalación local

1. Clona o descarga este repositorio
2. Ejecuta `npm install` para instalar dependencias
3. Configura la ruta a Chrome ejecutando: `node setup-chrome-path.js`
4. Inicia el servidor: `node server.js`
5. Abre tu navegador en: http://localhost:3000

## ⚠️ Importante para Windows: Ejecutar en Windows Nativo ⚠️

Para que el código QR funcione correctamente en Windows, **debes ejecutar la aplicación en Windows nativo**, no en WSL:

1. Abre la carpeta donde está instalada la aplicación
2. Ejecuta el archivo `matechat-windows.bat` haciendo doble clic
3. Sigue las instrucciones en pantalla para escanear el código QR

## Despliegue en Railway

Este proyecto está preparado para ser desplegado fácilmente en [Railway](https://railway.app/):

1. Crear un nuevo proyecto en Railway
2. Conectar tu repositorio de GitHub
3. Configurar las variables de entorno necesarias:
   - `PORT` (opcional, Railway lo asigna automáticamente)
   - `NODE_ENV=production`
   - `WEBHOOK_URL` (opcional, tu URL de webhook)
   - `WEBHOOK_METHOD` (opcional, por defecto POST)
   - `API_KEY` (opcional, para autenticación de API)
4. Railway detectará automáticamente el proyecto Node.js y lo desplegará

## API

MateChat ofrece una API REST para integración con aplicaciones externas:

- `POST /api/messages`: Envía un mensaje
  - Requiere: `to` (número con código de país), `message` (texto)
  - Opcional: `media` (objeto con URL del archivo)

- `GET /api/chats`: Obtiene la lista de conversaciones
- `GET /api/chats/:chatId/messages`: Obtiene mensajes de una conversación

## Solución de problemas

### Error: "Failed to launch the browser process!"

Este error ocurre cuando la aplicación no puede encontrar o iniciar Google Chrome. Soluciones:

1. Asegúrate de que Google Chrome esté instalado en tu sistema
2. Ejecuta `matechat-windows.bat` para detectar automáticamente la ruta de Chrome
3. Edita manualmente el archivo `chrome-config.js` para apuntar a la ubicación correcta de chrome.exe

### No aparece el código QR

1. Verifica que Chrome se esté ejecutando correctamente
2. Reinicia la aplicación completamente
3. Verifica que no haya otro proceso de la aplicación ejecutándose

## Notas importantes

- No cierres la ventana de Chrome mientras la aplicación esté en uso localmente
- Solo se puede tener una sesión de WhatsApp Web activa por número de teléfono
- La primera vez que escanees el código QR, es posible que debas confirmar el inicio de sesión en tu teléfono