import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import axios from 'axios';
import { config } from '../config/index.js';
import { settingsService } from './settings.service.js';
import fs from 'fs';
import path from 'path';

class WhatsAppService {
    constructor() {
        this.clients = new Map();
        this.eventHandlers = new Map(); // Para comunicar eventos al SocketService sin dependencia circular directa
        settingsService.initialize(); // Asegurar inicialización de servicio de settings
    }

    /**
     * Restore previous sessions from disk
     */
    async restoreSessions() {
        // Small delay to allow server to bind port first
        setTimeout(async () => {
            const authPath = path.resolve(process.cwd(), '.wwebjs_auth_v2');

            if (!fs.existsSync(authPath)) {
                console.log('[WA Service - Restore] Auth directory not found. No sessions to restore.');
                return;
            }

            console.log('[WA Service - Restore] Scanning for existing sessions...');
            try {
                const files = fs.readdirSync(authPath, { withFileTypes: true });
                const sessionFolders = files.filter(dirent => dirent.isDirectory() && dirent.name.startsWith('session-'));

                console.log(`[WA Service - Restore] Found ${sessionFolders.length} sessions to restore.`);

                for (const dirent of sessionFolders) {
                    // Folder name is "session-<clientId>"
                    // We need to extract <clientId> which is our userId
                    const folderName = dirent.name;
                    const userId = folderName.replace('session-', '');

                    if (userId) {
                        console.log(`[WA Service - Restore] Restoring session for user: ${userId}`);
                        try {
                            this.initializeClient(userId);
                        } catch (err) {
                            console.error(`[WA Service - Restore] Failed to restore ${userId}:`, err);
                        }
                        // Stagger restorations to avoid CPU spike
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            } catch (error) {
                console.error('[WA Service - Restore] Error scanning auth directory:', error);
            }
        }, 1000); // 1 sec delay after server boot
    }

    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
    }

    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(cb => cb(data));
        }
    }

    initializeClient(userId) {
        if (!userId) throw new Error('UserId is required for initialization');

        if (this.clients.has(userId)) {
            console.log(`[WA Service] Client ${userId} already exists.`);
            return this.clients.get(userId);
        }

        console.log(`[WA Service] Initializing NEW WhatsApp client for ${userId}...`);
        this.emit('status_change', { status: 'INITIALIZING', userId });

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: userId,
                dataPath: path.resolve(process.cwd(), '.wwebjs_auth_v2')
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ]
            },
            // Fix for 'markedUnread' error: Force a compatible WA Web version
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        this.setupClientListeners(client, userId);

        // Asynchronous processing to prevent hanging
        client.initialize().then(() => {
            console.log(`[WA Service] Client initialize promise resolved for ${userId}`);
        }).catch(err => {
            console.error(`[WA Service] Client initialize REJECTED for ${userId}:`, err);
            this.emit('status_change', { status: 'ERROR', userId });
            this.clients.delete(userId);
        });

        this.clients.set(userId, client);
        return client;
    }

    setupClientListeners(client, userId) {
        client.on('qr', (qr) => {
            console.log(`[WA Service] QR RECEIVED for ${userId}`);
            this.emit('qr', { qr, userId });
        });

        client.on('ready', () => {
            console.log(`[WA Service] Client ${userId} is READY!`);
            this.emit('ready', { userId });
        });

        client.on('authenticated', () => {
            console.log(`[WA Service] Client ${userId} AUTHENTICATED`);
            this.emit('authenticated', { userId });
        });

        client.on('auth_failure', (msg) => {
            console.error(`[WA Service] AUTH FAILURE for ${userId}:`, msg);
            this.emit('auth_failure', { msg, userId });
        });

        client.on('message', async (msg) => {
            // console.log(`[WA Service] Message for ${userId}:`, msg.body.substring(0, 50));
            this.handleWebhook(userId, msg, 'message');
            this.emit('message', { msg, userId });
        });

        client.on('message_create', async (msg) => {
            if (msg.fromMe) {
                this.handleWebhook(userId, msg, 'message_create');
            }
        });

        client.on('disconnected', async (reason) => {
            console.log(`[WA Service] Client ${userId} DISCONNECTED:`, reason);
            this.emit('disconnected', { reason, userId });

            // Limpieza y destrucción forzada para evitar zombies
            this.clients.delete(userId);
            try {
                await client.destroy();
            } catch (e) {
                console.error(`[WA Service] Error destroying client ${userId} on disconnect:`, e);
            }
        });
    }

    async logout(userId) {
        if (!userId) {
            console.error('[WA Service] Logout requested without userId');
            return;
        }

        const client = this.clients.get(userId);
        if (client) {
            console.log(`[WA Service] Logging out client ${userId}...`);
            try {
                // Logout oficial
                await client.logout();
                console.log(`[WA Service] Logout successful for ${userId}`);
            } catch (error) {
                console.error(`[WA Service] Error logging out client ${userId}:`, error);

                // Fallback: destrucción forzada si el navegador está colgado
                try {
                    console.log(`[WA Service] Forcing destroy for ${userId}...`);
                    await client.destroy();
                } catch (destroyError) {
                    console.error(`[WA Service] Failed to force destroy ${userId}:`, destroyError);
                }
            } finally {
                this.clients.delete(userId);

                // Reiniciar cliente automáticamente después de un breve delay
                // para que el usuario pueda volver a escanear inmediatamente
                setTimeout(() => {
                    console.log(`[WA Service] Restarting client for ${userId} to show QR...`);
                    this.initializeClient(userId);
                }, 2000);
            }
        } else {
            console.warn(`[WA Service] No active client found for logout ${userId}`);
            // Si no hay cliente activo, intentamos inicializar uno nuevo por si acaso quedó en el limbo
            this.initializeClient(userId);
        }
    }

    async handleWebhook(userId, msg, eventType = 'message') {
        try {
            // Recuperar configuración de usuario desde Supabase
            const settings = await settingsService.getUserSettings(userId);
            let webhooks = settings?.webhooks || [];

            if (!webhooks.length) {
                return;
            }

            // Prepare Legacy Payload
            let legacyEvent = 'message.received';
            if (eventType === 'message_create' && msg.fromMe) {
                legacyEvent = 'message.sent';
            }

            const chat = await msg.getChat();
            const contact = await msg.getContact();

            // Format Timestamp to ISO
            const isoTimestamp = new Date(msg.timestamp * 1000).toISOString();

            // Get Labels/Tags
            let labels = [];
            try {
                const fetchedLabels = await chat.getLabels();
                if (fetchedLabels && fetchedLabels.length > 0) {
                    labels = fetchedLabels.map(l => ({
                        id: l.id,
                        name: l.name,
                        color: l.hexColor
                    }));
                }
            } catch (e) {
                // Ignore label fetch errors
            }

            // Extraer número de teléfono limpio del chatId
            const extractPhoneNumber = (waId) => {
                if (!waId) return null;
                // Formato: "5491123456789@c.us" → "5491123456789"
                const match = waId.match(/^(\d+)@/);
                return match ? match[1] : waId.replace(/@.*$/, '');
            };

            const senderPhone = extractPhoneNumber(msg.from);
            const recipientPhone = extractPhoneNumber(msg.to);
            const chatPhone = extractPhoneNumber(chat.id._serialized);

            const payload = {
                event: legacyEvent,
                timestamp: isoTimestamp,
                data: {
                    id: msg.id._serialized,
                    body: msg.body,
                    from: msg.from,
                    to: msg.to,
                    // Números de teléfono limpios (sin @c.us)
                    phone: msg.fromMe ? recipientPhone : senderPhone,
                    senderPhone: senderPhone,
                    recipientPhone: recipientPhone,
                    fromMe: msg.fromMe,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    chatId: chat.id._serialized,
                    chatPhone: chatPhone,
                    hasMedia: msg.hasMedia,
                    isGroup: chat.isGroup,
                    author: msg.author || msg.from,
                    pushname: contact?.pushname || contact?.name || contact?.number,
                    labels: labels,
                    // Información de contacto enriquecida
                    contact: {
                        name: contact?.pushname || contact?.name || null,
                        phone: senderPhone,
                        number: contact?.number || senderPhone,
                        hasLabels: labels.length > 0,
                        labelsCount: labels.length
                    }
                }
            };

            // Send to compatible webhooks
            console.log(`[Webhook] Processing ${legacyEvent} for ${webhooks.length} hooks`);

            webhooks.forEach(async (hook) => {
                const hookEvents = hook.events || [];
                // Compatibility check: 'message' matches 'message.received', 'message_create' matches 'message.sent'
                let shouldSend = false;
                if (legacyEvent === 'message.received' && hookEvents.includes('message')) shouldSend = true;
                if (legacyEvent === 'message.sent' && hookEvents.includes('message_create')) shouldSend = true;

                if (!shouldSend) return;

                try {
                    console.log(`[Webhook] Sending to ${hook.url}`);
                    await axios.post(hook.url, payload);
                } catch (err) {
                    console.error(`[Webhook] Failed to send to ${hook.url}:`, err.message);
                }
            });

        } catch (error) {
            console.error('[Webhook] Error processing webhooks:', error);
        }
    }

    getClient(userId) {
        return this.clients.get(userId);
    }

    async getChatMessages(userId, chatId, { limit = 50, before = null } = {}) {
        const client = this.clients.get(userId);
        if (!client) return [];

        try {
            // Obtener objeto chat
            const chat = await client.getChatById(chatId);
            if (!chat) {
                console.warn(`[DEBUG] Chat not found for ID: ${chatId}`);
                return [];
            }

            console.log(`[DEBUG] Fetching ${limit} messages for chat ${chat.name}...`);

            const options = { limit };
            if (before) {
                options.before = before;
            }

            const messages = await chat.fetchMessages(options);

            // Mapear mensajes al formato del frontend
            return messages.map(msg => {
                // Determinar tipo de medio y datos
                let mediaUrl = null; // En producción, esto debería ser una URL pública o base64
                // Por ahora, manejamos base64 si ya viene (raro en fetchMessages histórico sin download)
                // OJO: fetchMessages histórico NO descarga medios automáticamente.
                // Habría que hacer msg.downloadMedia() bajo demanda. 
                // Para MVP, solo devolvemos metadatos de medio.

                return {
                    id: msg.id._serialized,
                    fromMe: msg.fromMe,
                    content: msg.body,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    hasMedia: msg.hasMedia,
                    // Si necesitamos media, iría aqui. Por ahora simplificado.
                    media: msg.hasMedia ? { mimetype: 'unknown' } : undefined
                };
            });

        } catch (e) {
            console.error('Error fetching chat messages:', e);
            return [];
        }
    }

    async getFormattedChats(userId) {
        const client = this.clients.get(userId);
        if (!client) return [];

        try {
            console.log('[DEBUG] Start fetching chats from WA...');
            const chats = await client.getChats();
            console.log(`[DEBUG] Fetched ${chats.length} raw chats.`);

            // Mapeo enriquecido con hidratación de etiquetas
            const formattedChats = await Promise.all(chats.map(async chat => {
                let labelIds = chat.labels || [];

                // Hidratación forzada de etiquetas
                if ((!labelIds || labelIds.length === 0)) {
                    try {
                        const fetchedLabels = await chat.getLabels();
                        if (fetchedLabels && fetchedLabels.length > 0) {
                            labelIds = fetchedLabels.map(l => l.id);
                        }
                    } catch (err) {
                        // Silenciar errores de fetching individual
                    }
                }

                return {
                    id: chat.id._serialized,
                    name: chat.name,
                    unreadCount: chat.unreadCount,
                    timestamp: chat.timestamp,
                    lastMessage: chat.lastMessage ? {
                        body: chat.lastMessage.body,
                        timestamp: chat.lastMessage.timestamp,
                        hasMedia: chat.lastMessage.hasMedia
                    } : {},
                    isGroup: chat.isGroup,
                    labels: labelIds,
                    profilePicUrl: undefined // Se llenará en la siguiente fase
                };
            }));

            // DEBUG: Hidratación de fotos de perfil explícita
            /* console.log('[DEBUG] Hydrating profile pics for top 20 chats...');
            await Promise.all(formattedChats.map(async (chat, index) => {
                if (index < 20) { // Límite para performance
                    try {
                        let picUrl = null;
                        // ... (código comentado)
                        // chat.profilePicUrl = picUrl || null;
                    } catch (err) {
                        // console.error(...)
                    }
                }
            }));
            console.log('[DEBUG] Finished hydration.'); */

            return formattedChats;
        } catch (e) {
            console.error('Error fetching chats:', e);
            return [];
        }
    }

    async getFormattedLabels(userId) {
        // Paleta oficial de colores de etiquetas de WhatsApp Web
        const LabelColorPalette = [
            '#ff9485', '#64c4ff', '#ffd429', '#dfaef0', '#99b6c1',
            '#55ccb3', '#ff9dff', '#d3a91d', '#6d7cce', '#d7e752',
            '#00d0e2', '#ffc5c7', '#93ceac', '#f74848', '#00a0f2',
            '#83e422', '#ffaf04', '#b5ebff', '#9ba6ff', '#9368cf'
        ];

        const client = this.clients.get(userId);
        if (!client) return [];

        try {
            const labels = await client.getLabels();
            if (!Array.isArray(labels)) return [];

            return await Promise.all(labels.map(async l => {
                let color = '#cccccc'; // Default
                try {
                    // Prioridad 1: HexColor directo si existe y es válido
                    if (l.hexColor && l.hexColor.startsWith('#')) {
                        color = l.hexColor;
                    }
                    // Prioridad 2: Color como índice numérico
                    else if (typeof l.color === 'number') {
                        const index = l.color % LabelColorPalette.length;
                        color = LabelColorPalette[index];
                    }
                    // Prioridad 3: ID numérico como semilla
                    else if (l.id) {
                        const numericId = parseInt(l.id.replace(/\D/g, '')) || 0;
                        color = LabelColorPalette[numericId % LabelColorPalette.length];
                    }
                } catch (err) {
                    console.error('Error calculating label color:', l, err);
                }

                // Obtener conteo real de chats usando el método de la etiqueta
                let count = 0;
                try {
                    const labelChats = await l.getChats();
                    count = labelChats.length;
                } catch (err) {
                    // Fail silently
                }

                return {
                    id: l.id,
                    name: l.name,
                    color: color,
                    count: count
                };
            }));
        } catch (e) {
            console.error('Error fetching labels:', e);
            return [];
        }
    }

    async logout(userId) {
        const client = this.clients.get(userId);
        if (client) {
            try {
                console.log(`Logging out client ${userId}...`);
                await client.logout();
                this.clients.delete(userId);
                setTimeout(() => this.initializeClient(userId), 1000);
            } catch (e) {
                console.error('Error logging out:', e);
                this.clients.delete(userId);
                this.initializeClient(userId);
            }
        } else {
            this.initializeClient(userId);
        }
    }
    async updateChatLabels(userId, chatId, labelIds, action = 'add') {
        const client = this.clients.get(userId);
        if (!client) throw new Error('Client not initialized');

        // Formato seguro de Chat ID
        const targetChatId = chatId.includes('@') ? chatId : `${chatId.replace(/\D/g, '')}@c.us`;

        // labelIds debe ser un array
        const labelsToProcess = Array.isArray(labelIds) ? labelIds : [labelIds];

        try {
            // ESTRATEGIA: Inyección Puppeteer (Directo al Store de WhatsApp)
            // Esto es lo más robusto porque se salta la abstracción de la librería.
            await client.pupPage.evaluate(async (chatId, labelIds, action) => {
                const chatModel = window.Store.Chat.get(chatId);
                const labelModels = labelIds.map(id => window.Store.Label.get(id)).filter(Boolean);

                if (!chatModel) return;

                if (window.Store.Label && window.Store.Label.addOrRemoveLabels) {
                    // Método estándar en versiones recientes
                    // addOrRemoveLabels agrega si no está, quita si está.
                    // Para ser precisos, calculamos la diferencia nosotros mismos o usamos add/remove específicos si existen.

                    // Como addOrRemoveLabels es toggle, necesitamos saber el estado actual
                    // Mejor usamos la estrategia de guardar el set completo (saveLabels)

                    const currentLabels = chatModel.labels || [];
                    let newLabels = new Set(currentLabels);

                    labelIds.forEach(id => {
                        if (action === 'add') newLabels.add(id);
                        else newLabels.delete(id);
                    });

                    // Si existe el comando para guardar etiquetas (más común en wwebjs internals)
                    if (window.Store.Cmd && window.Store.Cmd.saveLabels) {
                        await window.Store.Cmd.saveLabels(chatId, Array.from(newLabels));
                    } else {
                        // Fallback a addOrRemoveLabels intentando ser inteligente
                        // Solo pasamos los que realmente necesitan cambiar
                        const toToggle = labelModels.filter(l => {
                            const hasLabel = newLabels.has(l.id);
                            const shouldHave = action === 'add';
                            // Si lo tiene y lo queremos agregar -> no hacer nada
                            // Si no lo tiene y lo queremos agregar -> toggle
                            // Si lo tiene y lo queremos quitar -> toggle
                            // Si no lo tiene y lo queremos quitar -> no hacer nada
                            return (currentLabels.includes(l.id) !== shouldHave);
                        });

                        if (toToggle.length > 0) {
                            await window.Store.Label.addOrRemoveLabels(toToggle, [chatModel]);
                        }
                    }
                }
            }, targetChatId, labelsToProcess, action);

            // Retornar etiquetas actualizadas (simulado)
            // Damos un pequeño respiro para que WA actualice la UI interna
            await new Promise(r => setTimeout(r, 200));

            const chat = await client.getChatById(targetChatId);
            if (!chat) {
                console.warn(`[Labels] Chat not found for ${targetChatId} after update. Returning empty.`);
                return [];
            }
            return await chat.getLabels();

        } catch (pupError) {
            console.error('[Labels] Puppeteer strategy failed:', pupError);

            // Fallback a métodos legacy del objeto Chat (puede que funcionen en esta versión especifica)
            try {
                const chat = await client.getChatById(targetChatId);
                if (action === 'add') await chat.addLabels(labelsToProcess);
                else await chat.removeLabels(labelsToProcess);
                return await chat.getLabels();
            } catch (legacyError) {
                console.error('[Labels] ALL strategies failed.', legacyError);
                throw new Error('Failed to update labels via any method');
            }
        }
    }
}

export const whatsappService = new WhatsAppService();
