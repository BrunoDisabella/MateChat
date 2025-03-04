# MateChat - Integración WhatsApp Web

MateChat es una aplicación web que permite conectar WhatsApp mediante un código QR (similar a WhatsApp Web) y proporciona una API para enviar mensajes y webhooks para recibir eventos en tiempo real.

## Características

- 🔗 Conexión a WhatsApp Web mediante código QR
- 📱 API RESTful para enviar mensajes a contactos y grupos
- 🔔 Webhook para recibir notificaciones de mensajes en tiempo real
- 🤖 Integración fácil con chatbots y otras aplicaciones
- 🔒 Seguridad mediante tokens de autenticación

## Requisitos

- Node.js 14 o superior
- NPM o Yarn

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/TuUsuario/matechat.git
cd matechat
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```
Editar el archivo `.env` con tus configuraciones.

4. Iniciar la aplicación:
```bash
npm start
```

Para desarrollo:
```bash
npm run dev
```

## Uso de la API

### Enviar mensaje

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_token_seguridad" \
  -d '{"to":"5491112345678", "message":"Hola desde MateChat"}'
```

### Configurar webhook

```bash
curl -X POST http://localhost:3000/webhook/config \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_token_seguridad" \
  -d '{"url":"https://tudominio.com/recibir-mensajes"}'
```

## Estructura del proyecto

```
├── src/
│   ├── config/         # Configuraciones
│   ├── public/         # Archivos estáticos
│   ├── routes/         # Rutas de la API
│   ├── services/       # Servicios
│   └── index.js        # Punto de entrada
├── .env                # Variables de entorno
├── package.json        # Dependencias
└── server.js           # Entrada para Railway
```

## Despliegue en Railway

1. Crea una cuenta en [Railway](https://railway.app/)
2. Conecta tu repositorio de GitHub
3. Configura las variables de entorno en el dashboard de Railway
4. Railway desplegará automáticamente la aplicación

## Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu característica: `git checkout -b feature/nueva-caracteristica`
3. Haz commit de tus cambios: `git commit -m 'Agrega nueva característica'`
4. Empuja a la rama: `git push origin feature/nueva-caracteristica`
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.