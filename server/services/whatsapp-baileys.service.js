import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { settingsService } from './settings.service.js';
import pino from 'pino';

const logger = pino({ level: 'silent' }); // Cambiar a 'debug' para ver logs

/**
 * WhatsApp Baileys Service - Conexión directa vía WebSocket
 * 
 * Ventajas sobre whatsapp-web.js:
 * - No usa Puppeteer (sin navegador Chrome)
 * - Más liviano y rápido
 * - No es detectado como bot por WhatsApp
 * - Conexión directa WebSocket (como WhatsApp móvil)
 */
class WhatsAppBaileysService {
    constructor() {
        this.sockets = new Map(); // userId -> socket
        this.eventHandlers = new Map();
        this.qrRetries = new Map();
        this.maxQRRetries = 5;
    }

    /**
     * Inicializar cliente de WhatsApp para un usuario
     */
    async initializeClient(userId) {
        try {
            console.log(`[Baileys] 🚀 Initializing client for ${userId}...`);

            // Si ya existe, no reinicializar
            if (this.sockets.has(userId)) {
                console.log(`[Baileys] ⏳ Client ${userId} already exists`);
                return this.sockets.get(userId);
            }

            // Directorio de autenticación
            const authPath = path.resolve(process.cwd(), `.baileys_auth/${userId}`);
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            // Cargar sesión guardada
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Obtener última versión de WhatsApp
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`[Baileys] Using WA version ${version.join('.')}, isLatest: ${isLatest}`);

            // Crear socket de WhatsApp
            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                logger,
                printQRInTerminal: false,
                browser: ['MateChat', 'Chrome', '10.0'],
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false
            });

            // Guardar socket
            this.sockets.set(userId, sock);

            // === EVENTOS ===
            this.setupEventHandlers(sock, userId, saveCreds);

            return sock;

        } catch (error) {
            console.error(`[Baileys] ❌ Error initializing client for ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers(sock, userId, saveCreds) {
        // === CONEXIÓN Y QR ===
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR Code generado
            if (qr) {
                try {
                    console.log(`[Baileys] 📱 QR generated for ${userId}`);

                    // Enviar QR string directamente al frontend
                    // El frontend lo renderizará con su propia librería
                    this.emit('qr', { userId, qr });

                    // Incrementar contador de reintentos
                    const retries = (this.qrRetries.get(userId) || 0) + 1;
                    this.qrRetries.set(userId, retries);

                    if (retries >= this.maxQRRetries) {
                        console.log(`[Baileys] ⚠️ Max QR retries reached for ${userId}`);
                        this.emit('qr_max_retries', { userId });
                    }
                } catch (error) {
                    console.error(`[Baileys] Error generating QR:`, error);
                }
            }

            // Conexión cerrada
            if (connection === 'close') {
                const boomError = lastDisconnect?.error;
                const statusCode = boomError?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[Baileys] 🔌 Connection closed for ${userId}. Code: ${statusCode}, Reconnect: ${shouldReconnect}`);

                if (shouldReconnect) {
                    // Limpiar socket actual
                    this.sockets.delete(userId);

                    // Reintentar conexión después de 3 segundos
                    setTimeout(() => {
                        console.log(`[Baileys] 🔄 Reconnecting ${userId}...`);
                        this.initializeClient(userId);
                    }, 3000);
                } else {
                    // Logout - limpiar sesión completamente
                    console.log(`[Baileys] 🚪 Logged out ${userId}`);
                    this.cleanupSession(userId);
                    this.emit('logged_out', { userId });
                }
            }

            // Conexión abierta (READY)
            if (connection === 'open') {
                console.log(`[Baileys] ✅ Connected for ${userId}`);
                this.qrRetries.delete(userId); // Resetear contador de QR
                this.emit('ready', { userId });
            }

            // Conectando
            if (connection === 'connecting') {
                console.log(`[Baileys] 🔄 Connecting ${userId}...`);
                this.emit('connecting', { userId });
            }
        });

        // === CREDENCIALES ===
        sock.ev.on('creds.update', saveCreds);

        // === MENSAJES ENTRANTES Y SALIENTES ===
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    // Ignorar mensajes sin contenido
                    if (!msg.message) continue;

                    const from = msg.key.remoteJid;
                    const isGroup = from.endsWith('@g.us');
                    const fromMe = msg.key.fromMe;

                    // Extraer texto del mensaje
                    const text = this.extractMessageText(msg.message);

                    // Información del contacto
                    const contact = {
                        id: from,
                        name: msg.pushName || from.split('@')[0],
                        isGroup
                    };

                    // Determinar el tipo de evento
                    // 'message' = mensajes recibidos (Recibidos)
                    // 'message_create' = mensajes enviados (Enviados)
                    const eventType = fromMe ? 'message_create' : 'message';

                    console.log(`[Baileys] ${fromMe ? '📤' : '📨'} Message ${fromMe ? 'sent to' : 'from'} ${contact.name}: ${text?.substring(0, 50)}...`);

                    // Emitir evento de mensaje
                    this.emit(eventType, {
                        userId,
                        from,
                        contact,
                        body: text || '',
                        timestamp: msg.messageTimestamp,
                        messageId: msg.key.id,
                        isGroup,
                        fromMe,
                        raw: msg
                    });

                    // Enviar webhook si está configurado
                    // Estructura compatible con whatsapp-web.js

                    /**
                     * Extraer número real de teléfono desde JID o LID
                     * Maneja tanto @s.whatsapp.net como @lid usando campos alternativos de Baileys
                     */
                    const extractRealPhoneNumber = (msg) => {
                        const jid = msg.key.remoteJid;

                        // Debug: Log complete msg object for LID messages
                        if (jid?.includes('@lid')) {
                            console.log(`[Baileys] 🕵️ LID Detected: ${jid}`);
                            console.log(`[Baileys] 🕵️ Full Key:`, JSON.stringify(msg.key));
                            if (msg.pushName) console.log(`[Baileys] 🕵️ PushName: ${msg.pushName}`);
                        }

                        // Si es grupo, usar participant
                        const targetJid = jid?.endsWith('@g.us')
                            ? msg.key.participant
                            : jid;

                        if (!targetJid) return null;

                        // Si es @s.whatsapp.net, extraer directamente
                        if (targetJid.includes('@s.whatsapp.net')) {
                            return targetJid.split('@')[0];
                        }

                        // Si es @lid, buscar en campos alternativos (Baileys 6.8.0+)
                        if (targetJid.includes('@lid')) {
                            // 1. Intentar remoteJidAlt
                            if (msg.key.remoteJidAlt?.includes('@s.whatsapp.net')) {
                                const phone = msg.key.remoteJidAlt.split('@')[0];
                                console.log(`[Baileys] ✅ Resolved LID via remoteJidAlt: ${phone}`);
                                return phone;
                            }

                            // 2. Intentar participantAlt
                            if (msg.key.participantAlt?.includes('@s.whatsapp.net')) {
                                const phone = msg.key.participantAlt.split('@')[0];
                                console.log(`[Baileys] ✅ Resolved LID via participantAlt: ${phone}`);
                                return phone;
                            }

                            // 3. Fallback: Intentar obtener desde el objeto del socket si hay user info
                            // (Esto es tentativo, depende de si Baileys cachea el usuario)

                            // Fallback final: devolver LID pero lo logueamos como warning
                            const lidNumber = targetJid.split('@')[0];
                            console.warn(`[Baileys] ⚠️ Failed to resolve LID ${lidNumber} to Phone. Returning LID.`);
                            return lidNumber;
                        }

                        // Default: extraer lo que sea antes del @
                        return targetJid.split('@')[0];
                    };

                    const realPhoneNumber = extractRealPhoneNumber(msg);
                    const senderPhone = fromMe ? msg.key.remoteJid?.split('@')[0] : realPhoneNumber;
                    const recipientPhone = fromMe ? realPhoneNumber : msg.key.remoteJid?.split('@')[0];

                    // Normalizar JID a formato whatsapp-web.js (@c.us)
                    const normalizeJid = (jid) => {
                        if (!jid) return null;
                        const phone = jid.split('@')[0];

                        // Si es grupo, mantener @g.us
                        if (jid.includes('@g.us')) {
                            return jid;
                        }

                        // Para chats individuales, convertir a @c.us
                        return `${phone}@c.us`;
                    };

                    const normalizedFrom = normalizeJid(from);

                    await this.sendWebhook(userId, {
                        event: eventType,
                        from: normalizedFrom,
                        contact,
                        body: text || '',
                        timestamp: msg.messageTimestamp,
                        fromMe,
                        // Campos adicionales para compatibilidad con whatsapp-web.js
                        id: msg.key.id,
                        type: 'chat', // Baileys no tiene msg.type como whatsapp-web.js
                        chatId: realPhoneNumber, // Número real extraído (puede ser LID si no se pudo resolver)
                        chatPhone: realPhoneNumber, // Número real del chat
                        phone: fromMe ? recipientPhone : senderPhone,
                        senderPhone: senderPhone,
                        recipientPhone: recipientPhone,
                        hasMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage),
                        isGroup,
                        author: msg.key.participant || normalizedFrom,
                        pushname: contact.name,
                        labels: [] // TODO: Implementar labels en Baileys
                    });

                } catch (error) {
                    console.error(`[Baileys] Error processing message:`, error);
                }
            }
        });

        // === CAMBIOS DE ESTADO (typing, recording, etc) ===
        sock.ev.on('presence.update', ({ id, presences }) => {
            const presence = presences[id];
            if (presence) {
                this.emit('presence_update', { userId, contact: id, presence });
            }
        });
    }

    /**
     * Extraer texto de un mensaje (soporta diferentes tipos)
     */
    extractMessageText(message) {
        return (
            message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            message.documentMessage?.caption ||
            message.buttonsResponseMessage?.selectedButtonId ||
            message.listResponseMessage?.singleSelectReply?.selectedRowId ||
            ''
        );
    }

    /**
     * Enviar mensaje de texto
     */
    async sendMessage(userId, to, message) {
        const sock = this.sockets.get(userId);
        if (!sock) {
            throw new Error(`Client not initialized for ${userId}`);
        }

        // Formatear número (debe incluir @s.whatsapp.net para chats individuales)
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            const result = await sock.sendMessage(jid, { text: message });
            console.log(`[Baileys] ✉️ Message sent to ${to}`);
            return result;
        } catch (error) {
            console.error(`[Baileys] Error sending message:`, error);
            throw error;
        }
    }

    /**
     * Enviar imagen
     */
    async sendImage(userId, to, imageBuffer, caption = '') {
        const sock = this.sockets.get(userId);
        if (!sock) throw new Error(`Client not initialized for ${userId}`);

        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            const result = await sock.sendMessage(jid, {
                image: imageBuffer,
                caption
            });
            console.log(`[Baileys] 🖼️ Image sent to ${to}`);
            return result;
        } catch (error) {
            console.error(`[Baileys] Error sending image:`, error);
            throw error;
        }
    }

    /**
     * Enviar archivo
     */
    async sendFile(userId, to, fileBuffer, filename, mimetype) {
        const sock = this.sockets.get(userId);
        if (!sock) throw new Error(`Client not initialized for ${userId}`);

        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            const result = await sock.sendMessage(jid, {
                document: fileBuffer,
                fileName: filename,
                mimetype
            });
            console.log(`[Baileys] 📎 File sent to ${to}`);
            return result;
        } catch (error) {
            console.error(`[Baileys] Error sending file:`, error);
            throw error;
        }
    }

    /**
     * Enviar audio como nota de voz (PTT) o archivo de audio
     */
    async sendAudio(userId, to, audioBuffer, ptt = true) {
        const sock = this.sockets.get(userId);
        if (!sock) throw new Error(`Client not initialized for ${userId}`);

        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            const result = await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
                ptt: ptt
            });
            console.log(`[Baileys] 🎤 Voice note sent to ${to}`);
            return result;
        } catch (error) {
            console.error(`[Baileys] Error sending audio:`, error);
            throw error;
        }
    }

    /**
     * Marcar chat como leído
     * NOTA: Los mensajes salientes (fromMe: true) no generan notificaciones.
     * Esta función está deshabilitada temporalmente porque requiere las keys
     * específicas de los mensajes para funcionar correctamente en Baileys.
     */
    async markChatAsRead(userId, jid) {
        // Temporalmente deshabilitado - los mensajes salientes no generan notificaciones de todas formas
        console.log(`[Baileys] ℹ️ markChatAsRead called for ${jid} (currently disabled)`);
        return;

        /* 
        const sock = this.sockets.get(userId);
        if (!sock) return;

        try {
            const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
            
            // Para implementar correctamente, necesitaríamos:
            // 1. Obtener mensajes no leídos del chat
            // 2. Extraer sus keys
            // 3. Llamar a sock.readMessages(keys)
            
            console.log(`[Baileys] 👀 Chat marked as read: ${formattedJid}`);
        } catch (error) {
            console.warn(`[Baileys] Failed to mark chat as read:`, error.message);
        }
        */
    }


    /**
     * Logout y limpiar sesión
     */
    async logout(userId) {
        try {
            const sock = this.sockets.get(userId);

            if (sock) {
                await sock.logout();
            }

            this.cleanupSession(userId);
            console.log(`[Baileys] 🚪 Logged out ${userId}`);

        } catch (error) {
            console.error(`[Baileys] Error during logout:`, error);
            // Limpiar de todas formas
            this.cleanupSession(userId);
        }
    }

    /**
     * Limpiar sesión completamente
     */
    cleanupSession(userId) {
        // Eliminar socket
        this.sockets.delete(userId);
        this.qrRetries.delete(userId);

        // Eliminar archivos de autenticación
        const authPath = path.resolve(process.cwd(), `.baileys_auth/${userId}`);
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log(`[Baileys] 🗑️ Session files removed for ${userId}`);
        }
    }

    /**
     * Obtener estado del cliente
     */
    getClientState(userId) {
        const sock = this.sockets.get(userId);
        if (!sock) return 'DISCONNECTED';

        // Baileys no tiene un estado explícito, inferimos del socket
        return sock.user ? 'READY' : 'CONNECTING';
    }

    /**
     * Verificar si el cliente está listo
     */
    isClientReady(userId) {
        const sock = this.sockets.get(userId);
        return sock && sock.user ? true : false;
    }

    /**
     * Verificar si un número existe en WhatsApp
     */
    async checkOnWhatsApp(userId, jid) {
        const sock = this.sockets.get(userId);
        if (!sock) return null;

        try {
            // Verificar si existe como usuario normal (@s.whatsapp.net)
            const result = await sock.onWhatsApp(jid);
            if (result && result.length > 0) {
                return result[0];
            }
            return null;
        } catch (error) {
            console.error(`[Baileys] Error checking checkOnWhatsApp for ${jid}:`, error);
            return null;
        }
    }

    /**
     * Enviar webhook
     */
    async sendWebhook(userId, data) {
        try {
            const settings = await settingsService.getUserSettings(userId);

            if (!settings?.webhooks || settings.webhooks.length === 0) {
                console.log(`[Baileys] No webhooks configured for ${userId}`);
                return; // No hay webhooks configurados
            }

            console.log(`[Baileys] 🔍 Checking ${settings.webhooks.length} webhooks for event: ${data.event}`);

            // Estructura compatible con whatsapp-web.js
            const payload = {
                event: data.event === 'message_create' ? 'message.sent' : 'message.received',
                timestamp: new Date().toISOString(),
                data: {
                    id: data.id,
                    body: data.body,
                    from: data.from,
                    to: data.from, // En Baileys no tenemos 'to' directo
                    phone: data.phone,
                    senderPhone: data.senderPhone,
                    recipientPhone: data.recipientPhone,
                    fromMe: data.fromMe,
                    type: data.type,
                    timestamp: data.timestamp,
                    chatId: data.chatId,
                    chatPhone: data.chatPhone,
                    hasMedia: data.hasMedia,
                    isGroup: data.isGroup,
                    author: data.author,
                    pushname: data.pushname,
                    labels: data.labels || [],
                    contact: {
                        name: data.contact?.name || null,
                        phone: data.chatPhone,
                        number: data.chatPhone,
                        hasLabels: false,
                        labelsCount: 0
                    }
                }
            };

            // Enviar a todos los webhooks configurados
            for (const webhook of settings.webhooks) {
                console.log(`[Baileys] 🔍 Webhook: ${webhook.url}, Events: ${JSON.stringify(webhook.events)}`);

                if (!webhook.url) {
                    console.log(`[Baileys] ⚠️ Skipping webhook - no URL`);
                    continue;
                }

                if (!webhook.events?.includes(data.event)) {
                    console.log(`[Baileys] ⚠️ Skipping webhook - event ${data.event} not in ${JSON.stringify(webhook.events)}`);
                    continue;
                }

                console.log(`[Baileys] ✅ Webhook matched! Sending to ${webhook.url}...`);

                try {
                    await axios.post(webhook.url, payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 5000
                    });

                    console.log(`[Baileys] 🪝 Webhook sent to ${webhook.url} for ${userId}`);
                } catch (error) {
                    console.error(`[Baileys] ❌ Error sending webhook to ${webhook.url}:`, error.message);
                }
            }

        } catch (error) {
            console.error(`[Baileys] Error in sendWebhook:`, error.message);
        }
    }

    /**
     * Sistema de eventos (para comunicación con socket.io)
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`[Baileys] Error in event handler for ${event}:`, error);
            }
        });
    }

    /**
     * Restaurar sesiones existentes al iniciar el servidor
     */
    async restoreExistingSessions() {
        try {
            const authDir = path.resolve(process.cwd(), '.baileys_auth');

            if (!fs.existsSync(authDir)) {
                console.log('[Baileys] No existing sessions to restore');
                return;
            }

            const userDirs = fs.readdirSync(authDir);
            console.log(`[Baileys] 🔄 Found ${userDirs.length} sessions to restore`);

            for (const userId of userDirs) {
                // Verificar que sea un directorio antes de intentar restaurar
                const userPath = path.join(authDir, userId);
                if (!fs.lstatSync(userPath).isDirectory()) continue;

                try {
                    await this.initializeClient(userId);
                    console.log(`[Baileys] ✅ Restored session for ${userId}`);
                } catch (error) {
                    console.error(`[Baileys] ❌ Failed to restore session for ${userId}:`, error.message);
                }
            }

        } catch (error) {
            console.error('[Baileys] Error restoring sessions:', error);
        }
    }
}

export const whatsappBaileysService = new WhatsAppBaileysService();
