import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore
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
        this.stores = new Map(); // userId -> store (para mensajes)
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

            // Crear store para mensajes (opcional pero útil)
            const store = makeInMemoryStore({ logger });
            this.stores.set(userId, store);

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
                syncFullHistory: false,
                getMessage: async (key) => {
                    // Recuperar mensaje del store si existe
                    const store = this.stores.get(userId);
                    if (store) {
                        const msg = await store.loadMessage(key.remoteJid, key.id);
                        return msg?.message || undefined;
                    }
                    return undefined;
                }
            });

            // Vincular store al socket
            store.bind(sock.ev);

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
                    const qrImage = await qrcode.toDataURL(qr);
                    console.log(`[Baileys] 📱 QR generated for ${userId}`);

                    // Emitir QR al frontend
                    this.emit('qr', { userId, qr: qrImage });

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
                    this.stores.delete(userId);

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

        // === MENSAJES ENTRANTES ===
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    // Ignorar mensajes sin contenido
                    if (!msg.message) continue;

                    // Ignorar mensajes propios (enviados por el bot)
                    if (msg.key.fromMe) continue;

                    const from = msg.key.remoteJid;
                    const isGroup = from.endsWith('@g.us');

                    // Extraer texto del mensaje
                    const text = this.extractMessageText(msg.message);

                    // Información del contacto
                    const contact = {
                        id: from,
                        name: msg.pushName || from.split('@')[0],
                        isGroup
                    };

                    console.log(`[Baileys] 📨 Message from ${contact.name}: ${text?.substring(0, 50)}...`);

                    // Emitir evento de mensaje
                    this.emit('message', {
                        userId,
                        from,
                        contact,
                        body: text || '',
                        timestamp: msg.messageTimestamp,
                        messageId: msg.key.id,
                        isGroup,
                        raw: msg
                    });

                    // Enviar webhook si está configurado
                    await this.sendWebhook(userId, {
                        event: 'message',
                        from,
                        contact,
                        body: text || '',
                        timestamp: msg.messageTimestamp
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
        // Eliminar socket y store
        this.sockets.delete(userId);
        this.stores.delete(userId);
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
     * Enviar webhook
     */
    async sendWebhook(userId, data) {
        try {
            const settings = await settingsService.getSettings(userId);

            if (!settings?.webhook_url) {
                return; // No hay webhook configurado
            }

            const webhookData = {
                ...data,
                userId,
                timestamp: new Date().toISOString()
            };

            await axios.post(settings.webhook_url, webhookData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            console.log(`[Baileys] 🪝 Webhook sent for ${userId}`);

        } catch (error) {
            console.error(`[Baileys] Error sending webhook:`, error.message);
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
