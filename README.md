# MateChat - Integración con WhatsApp

MateChat es una aplicación web que se conecta a WhatsApp Web mediante código QR, captura mensajes en tiempo real, los almacena en MongoDB, y permite respuestas automatizadas a través de la integración con N8N.

## Características

- Conexión a WhatsApp Web mediante escaneo de código QR
- Captura de mensajes en tiempo real
- Comunicación mediante WebSockets para actualizaciones en vivo
- Integración con MongoDB para almacenamiento de mensajes
- Integración con N8N para automatización de chatbot
- Fácil despliegue en Railway

## Modos de operación

MateChat puede funcionar en dos modos:

1. **Modo completo**: Con conexión a MongoDB y N8N (configuración recomendada)
2. **Modo básico**: Sin base de datos externa, con almacenamiento en memoria (se pierde al reiniciar)

## Requisitos previos

- Node.js 16 o superior
- Cuenta de MongoDB Atlas o instalación local de MongoDB (opcional, pero recomendado)
- Instancia de N8N para automatización del chatbot (opcional)
- Cuenta de Railway para despliegue (opcional)

## Configuración local

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
   Crear un archivo `.env` en el directorio raíz con las siguientes variables:
   ```
   PORT=3000
   MONGODB_URI=tu_cadena_de_conexion_mongodb
   N8N_WEBHOOK_URL=tu_url_webhook_n8n
   ```

4. Iniciar la aplicación:
   ```
   npm start
   ```

5. Acceder a la aplicación:
   Abrir el navegador y navegar a `http://localhost:3000`

## Conectar WhatsApp

1. Abrir la aplicación MateChat en tu navegador
2. Escanear el código QR con tu app de WhatsApp en el móvil:
   - Abrir WhatsApp en tu teléfono
   - Ir a Configuración/Menú > WhatsApp Web
   - Escanear el código QR mostrado en la pantalla
3. Una vez conectado, podrás comenzar a recibir mensajes en la interfaz de chat

## Integración con N8N

1. Configurar un nuevo flujo de trabajo en N8N
2. Añadir un nodo webhook como disparador:
   - Método: POST
   - Ruta: `/whatsapp`
   - Guardar la URL del webhook

3. Añadir tu lógica de automatización en N8N:
   - Procesar mensajes entrantes
   - Generar respuestas basadas en el contenido del mensaje
   - Enviar respuestas de vuelta a MateChat

4. Añadir un nodo de Solicitud HTTP para enviar respuestas:
   - Método: POST
   - URL: `http://tu-url-matechat/api/send-message`
   - Cuerpo:
     ```json
     {
       "phoneNumber": "{{$node[\"Webhook\"].json[\"phoneNumber\"]}}",
       "content": "Tu respuesta automatizada aquí"
     }
     ```

5. Actualizar tu archivo `.env` con la URL del webhook de N8N:
   ```
   N8N_WEBHOOK_URL=tu_url_webhook_n8n
   ```

## Despliegue en Railway

1. Crear un nuevo proyecto en Railway
2. Conectar tu repositorio de GitHub
3. Configurar las variables de entorno:
   - `MONGODB_URI`: Tu cadena de conexión a MongoDB (opcional)
   - `N8N_WEBHOOK_URL`: Tu URL de webhook de N8N (opcional)
4. Desplegar la aplicación

Railway construirá y desplegará automáticamente tu aplicación utilizando el Dockerfile.

### Solución de problemas en Railway

Si encuentras problemas al desplegar en Railway:

1. **Error de MongoDB**: MateChat puede funcionar sin MongoDB, almacenando datos en memoria.
2. **Error de conexión a WhatsApp**: Asegúrate de que los puertos necesarios estén abiertos.
3. **Error de paquetes npm**: Si hay problemas con `npm ci`, Railway usará `npm install`.

## Arquitectura

```
┌─────────────┐      ┌──────────────┐      ┌───────────┐
│  WhatsApp   │◄────►│   MateChat   │◄────►│  MongoDB  │
│   Móvil     │      │   Servidor   │      │           │
└─────────────┘      └──────┬───────┘      └───────────┘
                            │
                            │
                            ▼
                     ┌──────────────┐
                     │     N8N      │
                     │ Automatización│
                     └──────────────┘
```

## Tecnologías utilizadas

- Node.js y Express para el backend
- whatsapp-web.js para integración con WhatsApp
- Socket.IO para comunicación en tiempo real
- MongoDB para almacenamiento de mensajes
- EJS para renderizado del lado del servidor
- Docker para containerización
- Railway para despliegue

## Licencia

Este proyecto está licenciado bajo la Licencia MIT.