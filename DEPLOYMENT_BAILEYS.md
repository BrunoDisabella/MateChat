# 🚀 Deployment Instructions - Baileys Migration

## ⚠️ IMPORTANTE: Cambios Críticos

Esta actualización **migra completamente de whatsapp-web.js a Baileys**. Esto significa:

- ✅ **NO necesitas Xvfb** (ya no usamos navegador)
- ✅ **NO necesitas Puppeteer** (conexión directa WebSocket)
- ✅ **Mucho más liviano** (menos RAM, menos CPU)
- ⚠️ **Las sesiones anteriores NO son compatibles** (tendrás que escanear QR de nuevo)

---

## 📋 Pasos de Deployment

### 1. Conectar al Servidor

```bash
ssh administrator@tu-servidor
cd ~/MateChat
```

### 2. Detener PM2

```bash
pm2 stop MATECHAT3001
```

### 3. Hacer Pull de los Cambios

```bash
git pull origin main
```

### 4. Instalar Nuevas Dependencias

```bash
npm install
```

Esto instalará:
- `@whiskeysockets/baileys` (nueva librería de WhatsApp)
- `@hapi/boom` (manejo de errores)
- `pino` (logger)

Y **desinstalará automáticamente**:
- `whatsapp-web.js`
- `puppeteer-extra`
- `puppeteer-extra-plugin-stealth`

### 5. Limpiar Sesiones Antiguas (IMPORTANTE)

Las sesiones de whatsapp-web.js NO son compatibles con Baileys. Debes eliminarlas:

```bash
# Eliminar sesiones viejas de whatsapp-web.js
rm -rf .wwebjs_auth/

# Eliminar caché de Puppeteer (ya no se usa)
rm -rf .wwebjs_cache/
```

### 6. Reiniciar PM2 (SIN Xvfb)

**Ya NO necesitas `DISPLAY=:99`** porque Baileys no usa navegador:

```bash
# Eliminar variable DISPLAY del entorno
pm2 delete MATECHAT3001

# Iniciar normalmente (sin DISPLAY)
pm2 start server/index.js --name MATECHAT3001

# Guardar configuración
pm2 save
```

### 7. Verificar Logs

```bash
pm2 logs MATECHAT3001
```

Deberías ver:

```
🚀 MateChat Server v3.0 (Baileys Edition)
✅ Baileys WebSocket (No Puppeteer!)
✅ Lightweight & Fast
✅ WhatsApp Anti-Bot Bypass
```

### 8. Probar Conexión

1. Abre la aplicación en el navegador
2. Escanea el QR (será generado por Baileys)
3. Verifica que llegue a "READY" (debería ser instantáneo)
4. Envía un mensaje de prueba

---

## 🔍 Troubleshooting

### Error: "Cannot find module '@whiskeysockets/baileys'"

```bash
# Limpiar node_modules e instalar de nuevo
rm -rf node_modules package-lock.json
npm install
```

### Error: "ENOENT: no such file or directory, scandir '.baileys_auth'"

Esto es normal en la primera ejecución. Baileys creará el directorio automáticamente.

### El QR no aparece

1. Verifica logs: `pm2 logs MATECHAT3001`
2. Asegúrate de que el frontend esté conectado al WebSocket
3. Intenta hacer logout y volver a conectar

### "Client not initialized"

Espera unos segundos. Baileys tarda ~2-3 segundos en inicializar la primera vez.

---

## 📊 Diferencias con la Versión Anterior

| Característica | whatsapp-web.js (v2.0) | Baileys (v3.0) |
|----------------|------------------------|----------------|
| Navegador | Puppeteer (Chrome) | ❌ Ninguno |
| Conexión | WhatsApp Web | WhatsApp Mobile (WebSocket) |
| RAM | ~300-500MB | ~50-100MB |
| CPU | Alto (Chrome) | Bajo |
| Xvfb necesario | ✅ Sí | ❌ No |
| Detección de bot | ⚠️ Alta | ✅ Baja |
| Velocidad | Lenta | Rápida |

---

## ✅ Checklist Post-Deployment

- [ ] Servidor arrancó sin errores
- [ ] QR se genera correctamente
- [ ] Conexión llega a "READY"
- [ ] Puedes enviar mensajes
- [ ] Puedes recibir mensajes
- [ ] Webhooks funcionan (si los tienes configurados)
- [ ] No hay errores en `pm2 logs`

---

## 🆘 Si Algo Sale Mal

### Rollback a la Versión Anterior

```bash
# Detener PM2
pm2 stop MATECHAT3001

# Volver al commit anterior
git log --oneline  # Ver commits
git checkout <commit-hash-anterior>

# Reinstalar dependencias viejas
npm install

# Restaurar sesiones viejas (si las guardaste)
# cp -r .wwebjs_auth_backup .wwebjs_auth

# Reiniciar con Xvfb
DISPLAY=:99 pm2 start server/index.js --name MATECHAT3001 --update-env
pm2 save
```

---

## 📝 Notas Adicionales

- **Sesiones**: Baileys guarda las sesiones en `.baileys_auth/<userId>/`
- **Logs**: Baileys usa `pino` para logs (puedes cambiar el nivel en `whatsapp-baileys.service.js`)
- **Multi-dispositivo**: Funciona igual que antes (hasta 4 dispositivos)
- **Celular**: Puedes seguir usando WhatsApp en tu celular normalmente

---

## 🎉 Ventajas de Baileys

1. **No más bloqueos de WhatsApp** - Usa WebSocket como la app móvil
2. **Más rápido** - Sin overhead de navegador
3. **Menos recursos** - ~80% menos RAM
4. **Más estable** - Menos puntos de falla
5. **Gratis** - No necesitas API oficial de WhatsApp
