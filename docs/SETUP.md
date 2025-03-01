# Configuración de la API de WhatsApp Business

Este documento explica cómo configurar correctamente la integración con la API de WhatsApp Business.

## Requisitos previos

Para usar la API de WhatsApp Business, necesitas:

1. Una cuenta de Meta for Developers
2. Una aplicación creada en Meta for Developers
3. Un número de teléfono verificado para WhatsApp Business

## Pasos para la configuración

### 1. Obtener credenciales de la API

Para la integración de WhatsApp API necesitas los siguientes datos:

- **App ID**: El identificador de tu aplicación en Meta for Developers (ya configurado: `1157968849126039`)
- **App Secret**: La clave secreta de tu aplicación (ya configurado: `e173f3786a59318a4239dfa265d39bff`)
- **Client Token**: Token de cliente para la autenticación (ya configurado: `5af85ca86531c3d789f8b5c0bfa41f47`)
- **Access Token**: Token de acceso para la API de WhatsApp (usado temporalmente el Client Token)

### 2. Configurar el número de teléfono

Para completar la integración, necesitas:

1. Acceder al [Panel de Meta for Developers](https://developers.facebook.com/)
2. Ir a tu aplicación > WhatsApp > Getting Started
3. Seguir el proceso para agregar un número de teléfono
4. Una vez agregado, obtener el Phone Number ID y actualizar en el archivo .env:

```
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
```

### 3. Configurar Webhooks

Para recibir mensajes entrantes, necesitas configurar un webhook:

1. En el panel de WhatsApp, ve a la sección "Webhooks"
2. Configura la URL del webhook a: `https://tu-dominio.com/webhook/whatsapp`
3. El token de verificación debe ser el mismo que está en tu archivo .env:
```
WEBHOOK_VERIFY_TOKEN=matechat_verify_token
```
4. Selecciona los campos de suscripción: `messages`

### 4. Obtener un token permanente

Para uso en producción, debes obtener un token permanente:

1. Ve a System User en Business Settings
2. Crea un nuevo usuario del sistema
3. Asigna los permisos necesarios para WhatsApp Business
4. Genera un token de acceso y actualiza en el archivo .env:
```
WHATSAPP_ACCESS_TOKEN=tu_token_permanente
```

## Configuración para Railway

Cuando despliegues la aplicación en Railway, debes configurar las variables de entorno en el panel de Railway con los mismos valores que tienes en tu archivo .env local.

## Solución de problemas

Si encuentras problemas de conexión:

1. Verifica que todas las credenciales estén correctamente configuradas
2. Asegúrate de que el número de teléfono esté verificado y activo
3. Revisa los logs de la aplicación para identificar errores específicos
4. Para errores de webhook, verifica que la URL sea accesible públicamente

## Recursos adicionales

- [Documentación oficial de WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Guía de inicio rápido](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Referencia de la API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/)