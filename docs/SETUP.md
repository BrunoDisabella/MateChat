# Configuraci�n de la API de WhatsApp Business

Este documento explica c�mo configurar correctamente la integraci�n con la API de WhatsApp Business.

## Requisitos previos

Para usar la API de WhatsApp Business, necesitas:

1. Una cuenta de Meta for Developers
2. Una aplicaci�n creada en Meta for Developers
3. Un n�mero de tel�fono verificado para WhatsApp Business

## Pasos para la configuraci�n

### 1. Obtener credenciales de la API

Para la integraci�n de WhatsApp API necesitas los siguientes datos:

- **App ID**: El identificador de tu aplicaci�n en Meta for Developers (ya configurado: `1157968849126039`)
- **App Secret**: La clave secreta de tu aplicaci�n (ya configurado: `e173f3786a59318a4239dfa265d39bff`)
- **Client Token**: Token de cliente para la autenticaci�n (ya configurado: `5af85ca86531c3d789f8b5c0bfa41f47`)
- **Access Token**: Token de acceso para la API de WhatsApp (usado temporalmente el Client Token)

### 2. Configurar el n�mero de tel�fono

Para completar la integraci�n, necesitas:

1. Acceder al [Panel de Meta for Developers](https://developers.facebook.com/)
2. Ir a tu aplicaci�n > WhatsApp > Getting Started
3. Seguir el proceso para agregar un n�mero de tel�fono
4. Una vez agregado, obtener el Phone Number ID y actualizar en el archivo .env:

```
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
```

### 3. Configurar Webhooks

Para recibir mensajes entrantes, necesitas configurar un webhook:

1. En el panel de WhatsApp, ve a la secci�n "Webhooks"
2. Configura la URL del webhook a: `https://tu-dominio.com/webhook/whatsapp`
3. El token de verificaci�n debe ser el mismo que est� en tu archivo .env:
```
WEBHOOK_VERIFY_TOKEN=matechat_verify_token
```
4. Selecciona los campos de suscripci�n: `messages`

### 4. Obtener un token permanente

Para uso en producci�n, debes obtener un token permanente:

1. Ve a System User en Business Settings
2. Crea un nuevo usuario del sistema
3. Asigna los permisos necesarios para WhatsApp Business
4. Genera un token de acceso y actualiza en el archivo .env:
```
WHATSAPP_ACCESS_TOKEN=tu_token_permanente
```

## Configuraci�n para Railway

Cuando despliegues la aplicaci�n en Railway, debes configurar las variables de entorno en el panel de Railway con los mismos valores que tienes en tu archivo .env local.

## Soluci�n de problemas

Si encuentras problemas de conexi�n:

1. Verifica que todas las credenciales est�n correctamente configuradas
2. Aseg�rate de que el n�mero de tel�fono est� verificado y activo
3. Revisa los logs de la aplicaci�n para identificar errores espec�ficos
4. Para errores de webhook, verifica que la URL sea accesible p�blicamente

## Recursos adicionales

- [Documentaci�n oficial de WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Gu�a de inicio r�pido](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Referencia de la API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/)