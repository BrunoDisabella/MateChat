# MateChat

Aplicación para conectar WhatsApp mediante la API oficial de WhatsApp Business.

## Descripción

MateChat es una aplicación web que permite gestionar conversaciones de WhatsApp mediante la API oficial de WhatsApp Business. La aplicación permite:

- Conectarse a la API de WhatsApp Business
- Enviar y recibir mensajes
- Gestionar conversaciones
- Visualizar historial de mensajes

## Requisitos

- Node.js v14 o superior
- Cuenta de WhatsApp Business API (Meta for Developers)
- Credenciales de acceso a la API de WhatsApp

## Instalación

1. Clonar el repositorio:
```
git clone https://github.com/tuusuario/matechat.git
cd matechat
```

2. Instalar dependencias:
```
npm install
```

3. Configurar variables de entorno:
Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
```
# WhatsApp Business API credentials
WHATSAPP_API_URL=https://graph.facebook.com/v19.0
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_business_account_id
WHATSAPP_ACCESS_TOKEN=tu_access_token

# Server configuration
PORT=3000
NODE_ENV=development
```

4. Iniciar la aplicación:
```
npm start
```

## Configuración para Railway

La aplicación está configurada para ser desplegada en Railway. Se incluye un archivo `Procfile` para este propósito. Solo es necesario configurar las variables de entorno en el panel de Railway.

## Uso

1. Abre la aplicación en tu navegador: `http://localhost:3000` (o la URL de tu despliegue)
2. Haz clic en el botón "Conectar" para inicializar la conexión con WhatsApp Business API
3. Una vez conectado, podrás ver tus conversaciones y enviar/recibir mensajes

## Estructura del proyecto

- `/src`: Código fuente de la aplicación
  - `/config`: Configuración de la aplicación
  - `/public`: Archivos estáticos (HTML, CSS, JS)
  - `/routes`: Rutas de la API
  - `/services`: Servicios de la aplicación
- `.env`: Variables de entorno (no incluido en el repositorio)
- `package.json`: Dependencias y scripts
- `Procfile`: Configuración para Railway

## Tecnologías utilizadas

- Node.js + Express: Backend
- WhatsApp Business API: Integración con WhatsApp
- JavaScript + HTML + CSS: Frontend

## Licencia

ISC