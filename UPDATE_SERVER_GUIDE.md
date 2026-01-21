# 🔄 GUÍA DE ACTUALIZACIÓN EN SERVIDOR - MateChat v2.0

## Fecha: 20 de Enero 2026
## Versión: Keep-Alive Edition

---

## 📋 RESUMEN DE CAMBIOS

Esta actualización resuelve el problema de **desconexión de sesiones de WhatsApp** después de varias horas de inactividad.

### Mejoras implementadas:
- ✅ **Keep-Alive** cada 3 minutos (mantiene conexión activa)
- ✅ **Health Check robusto** cada 5 minutos (detecta errores)
- ✅ **Manejo de change_state** (reconexión automática)
- ✅ **Flags de Puppeteer** optimizados para estabilidad
- ✅ **Nuevos endpoints** de monitoreo

---

## 🚀 COMANDOS PARA ACTUALIZAR EN SERVIDOR

### Paso 1: Conectarse al servidor
```bash
ssh tu_usuario@tu_servidor
```

### Paso 2: Ir al directorio del proyecto
```bash
cd /ruta/a/MateChat
```

### Paso 3: Detener el servicio actual
```bash
# Si usas PM2:
pm2 stop matechat

# Si usas systemd:
sudo systemctl stop matechat
```

### Paso 4: Actualizar código desde Git
```bash
git pull origin main
```

### Paso 5: Instalar dependencias (si hay nuevas)
```bash
npm install
```

### Paso 6: Reiniciar el servicio
```bash
# Si usas PM2:
pm2 start matechat
pm2 logs matechat

# Si usas systemd:
sudo systemctl start matechat
journalctl -u matechat -f
```

---

## 🔍 VERIFICAR QUE FUNCIONA

### 1. Ver logs del servidor
Deberías ver un banner así:
```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🚀 MateChat Server v2.0 (Keep-Alive Edition)       ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║   Improvements:                                      ║
║   ✅ Keep-Alive (every 3 min)                        ║
║   ✅ Robust Health Check (every 5 min)               ║
║   ✅ change_state event handling                     ║
║   ✅ Puppeteer stability flags                       ║
║   ✅ Detached frame detection                        ║
╚══════════════════════════════════════════════════════╝
```

### 2. Probar endpoint de status
```bash
curl -X GET "http://localhost:3001/api/status" \
  -H "x-api-key: TU_API_KEY"
```

### 3. Probar endpoint de health
```bash
curl -X GET "http://localhost:3001/api/health" \
  -H "x-api-key: TU_API_KEY"
```

### 4. Ver logs de Keep-Alive
Cada 3 minutos verás:
```
[Keep-Alive] 💚 Ping sent for <userId> at 18:45:00
```

### 5. Ver logs de Health Check
Cada 5 minutos verás:
```
[Health Check] ✅ <userId> healthy at 18:50:00
```

### 6. Ver Status Report
Cada 10 minutos verás:
```
📊 [STATUS REPORT - 20/1/2026 18:50:00]
   ⏱️  Uptime: 10 minutes
   💾 Memory: 120MB / 256MB
   📱 WhatsApp Clients: 1
      - default-user: READY (Health: ✅, KeepAlive: ✅)
```

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

### Si el cliente no se conecta:
```bash
# Forzar reinicio via API:
curl -X POST "http://localhost:3001/api/restart" \
  -H "x-api-key: TU_API_KEY"
```

### Si hay errores de Puppeteer:
```bash
# Verificar Chrome/Chromium instalado
which chromium-browser || which google-chrome

# Instalar dependencias de Puppeteer (Ubuntu/Debian)
sudo apt-get install -y libgbm-dev libasound2 libatk-bridge2.0-0 \
  libatspi2.0-0 libcups2 libdrm2 libgtk-3-0 libnss3 libxcomposite1 \
  libxdamage1 libxfixes3 libxkbcommon0 libxrandr2
```

### Si hay problemas de memoria:
```bash
# Aumentar límite de memoria en PM2
pm2 delete matechat
pm2 start server/index.js --name matechat --node-args="--max-old-space-size=512"
```

---

## 🔙 ROLLBACK (Si algo sale mal)

Los archivos de backup están en:
- `server/services/whatsapp.service.BACKUP_20260120.js`
- `server/index.BACKUP_20260120.js`

Para restaurar:
```bash
# Restaurar backup
cp server/services/whatsapp.service.BACKUP_20260120.js server/services/whatsapp.service.js
cp server/index.BACKUP_20260120.js server/index.js

# Reiniciar
pm2 restart matechat
```

---

## 📞 NUEVOS ENDPOINTS API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/status` | Estado completo del servidor |
| GET | `/api/health` | Health check rápido |
| POST | `/api/restart` | Forzar reinicio del cliente |

---

## 🎯 EXPECTATIVAS

Después de esta actualización:
- ✅ La API funcionará 24/7 sin intervención manual
- ✅ Los webhooks de n8n recibirán mensajes constantemente
- ✅ Si hay desconexión, el sistema se reconectará automáticamente
- ✅ Podrás monitorear el estado via `/api/status`

---

¡Listo! Si tienes algún problema, revisa los logs con `pm2 logs matechat` o `journalctl -u matechat -f`.
