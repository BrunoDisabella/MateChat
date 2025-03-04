# Guía de Configuración de MateChat

Este documento proporciona instrucciones detalladas para configurar y personalizar la aplicación MateChat.

## Configuración del Entorno

### Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
PORT=3000
NODE_ENV=development
SERVER_URL=http://localhost:3000

# Configuración del webhook
WEBHOOK_URL=

# Tokens de seguridad
SECURITY_TOKEN=tu_token_seguridad_aqui
```

Para producción, actualiza los valores:

```
PORT=3000
NODE_ENV=production
SERVER_URL=https://tu-dominio.railway.app

# Configuración del webhook
WEBHOOK_URL=https://tu-webhook.com/recibir

# Tokens de seguridad
SECURITY_TOKEN=tu_token_seguridad_muy_seguro
```

## Configuración de WhatsApp Web

El cliente de WhatsApp Web se configura en `src/config/whatsapp.js`. Puedes personalizar las opciones del cliente:

```javascript
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    // Configuración personalizada de Puppeteer aquí
  }
});
```

### Almacenamiento de sesión

Por defecto, la sesión se almacena localmente con `LocalAuth()`, lo que permite mantener la sesión activa tras reiniciar la aplicación. Para entornos de producción, considera estas opciones:

1. Usar `RemoteAuth` para almacenar la sesión en una base de datos externa.
2. Configurar un volumen persistente en Railway para mantener la carpeta `.wwebjs_auth`.

## Endpoints de la API

### API RESTful

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/status` | GET | Obtiene el estado de la conexión |
| `/api/send` | POST | Envía un mensaje a un contacto |
| `/api/check/:number` | GET | Verifica si un número está registrado |
| `/api/send-group` | POST | Envía un mensaje a un grupo |

### Webhook

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/webhook/config` | GET | Obtiene la configuración actual del webhook |
| `/webhook/config` | POST | Configura la URL del webhook |

## Seguridad

### Autenticación

Todas las rutas están protegidas con un token de seguridad. Este token debe enviarse en cada solicitud mediante:

1. Header: `x-api-key: tu_token_seguridad`
2. Query parameter: `?token=tu_token_seguridad`

### Mejores prácticas

- Usa un token de seguridad fuerte en producción
- Nunca expones el token en el código del cliente
- Usa HTTPS en producción
- Limita las direcciones IP que pueden acceder a la API

## Personalización del Frontend

El frontend se encuentra en la carpeta `src/public`. Puedes personalizar:

- `index.html`: Estructura principal
- `css/styles.css`: Estilos y apariencia
- `js/app.js`: Lógica del cliente

### Plantilla personalizada

Para usar una plantilla personalizada, simplemente reemplaza los archivos en la carpeta `public` con tu diseño.

## Integración con servicios externos

### Chatbots

Para integrar con un chatbot, configura un webhook y procesa los mensajes entrantes:

1. Configura la URL del webhook en MateChat
2. Recibe los mensajes en tu servicio de chatbot
3. Responde usando el endpoint `/api/send`

### CRM y otros sistemas

Puedes integrar MateChat con sistemas CRM y otros servicios:

1. Utiliza los webhooks para recibir mensajes
2. Usa la API para enviar mensajes desde tu sistema
3. Implementa un middleware para transformar el formato de los mensajes si es necesario