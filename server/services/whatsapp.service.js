import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import axios from 'axios';
import { config } from '../config/index.js';
import { settingsService } from './settings.service.js';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';

/**
 * WhatsApp Service - Versión mejorada con Keep-Alive y Health Check robusto
 * 
 * Mejoras implementadas:
 * - Keep-Alive activo para mantener sesión viva
 * - Health Check robusto que detecta frames detached
 * - Manejo de evento change_state
 * - Flags de Puppeteer para estabilidad a largo plazo
 * - Logging mejorado para diagnóstico
 */
class WhatsAppService {
    constructor() {
        this.clients = new Map();
        this.eventHandlers = new Map();
        this.healthCheckIntervals = new Map();
        this.keepAliveIntervals = new Map(); // NUEVO: Intervalos de keep-alive
        this.explicitLogouts = new Set();
        this.clientStates = new Map(); // NUEVO: Track estado real de cada cliente
        this.initializingClients = new Set(); // NUEVO: Prevenir múltiples inits simultáneos
        this.initRetryCount = new Map(); // NUEVO: Contador de reintentos por usuario
        settingsService.initialize();
    }

    /**
     * NUEVO: Matar procesos zombie de Chrome/Chromium que quedaron corriendo
     */
    async killZombieProcesses() {
        const isWindows = process.platform === 'win32';

        try {
            if (isWindows) {
                // En Windows, buscar procesos chrome que usen .wwebjs_auth
                console.log('[WA Service] 🔪 Buscando procesos Chrome zombie en Windows...');
                try {
                    execSync('taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq *wwebjs*"', { stdio: 'ignore' });
                } catch (e) {
                    // Ignorar si no hay procesos para matar
                }

                // También intentar matar chromium
                try {
                    execSync('taskkill /F /IM chromium.exe', { stdio: 'ignore' });
                } catch (e) {
                    // Ignorar
                }
            } else {
                // En Linux/Mac
                console.log('[WA Service] 🔪 Buscando procesos Chrome zombie en Unix...');
                try {
                    execSync('pkill -f "chromium.*wwebjs" || true', { stdio: 'ignore' });
                    execSync('pkill -f "chrome.*wwebjs" || true', { stdio: 'ignore' });
                } catch (e) {
                    // Ignorar
                }
            }
            console.log('[WA Service] ✅ Limpieza de procesos zombie completada');
        } catch (error) {
            console.warn('[WA Service] ⚠️ Error limpiando procesos zombie:', error.message);
        }
    }

    /**
     * NUEVO: Limpieza forzada de una sesión específica
     */
    async forceCleanupSession(userId) {
        console.log(`[WA Service] 🧹 Force cleanup for session ${userId}...`);

        // 1. Detener health check y keep-alive
        this.stopHealthCheck(userId);
        this.stopKeepAlive(userId);

        // 2. Destruir cliente si existe
        const client = this.clients.get(userId);
        if (client) {
            try {
                // Intentar cerrar el navegador directamente
                if (client.pupBrowser) {
                    console.log(`[WA Service] Cerrando browser forzosamente para ${userId}...`);
                    await Promise.race([
                        client.pupBrowser.close(),
                        new Promise(r => setTimeout(r, 5000))
                    ]);
                }
            } catch (e) {
                console.warn(`[WA Service] Error cerrando browser: ${e.message}`);
            }

            try {
                await Promise.race([
                    client.destroy(),
                    new Promise(r => setTimeout(r, 5000))
                ]);
            } catch (e) {
                console.warn(`[WA Service] Error destroying client: ${e.message}`);
            }

            this.clients.delete(userId);
        }

        // 3. Matar procesos de Chrome específicos para esta sesión (UNIX only)
        if (process.platform !== 'win32') {
            try {
                const sessionPath = `session-${userId}`;
                console.log(`[WA Service] 🔪 Killing Chrome processes for ${sessionPath}...`);
                execSync(`pkill -9 -f "${sessionPath}" || true`, { stdio: 'ignore' });
            } catch (e) {
                // Ignorar errores de pkill
            }
        }

        // 4. Limpiar el lock file si existe
        const lockPath = path.resolve(process.cwd(), '.wwebjs_auth_v2', `session-${userId}`, 'SingletonLock');
        try {
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
                console.log(`[WA Service] Removed lock file for ${userId}`);
            }
        } catch (e) {
            console.warn(`[WA Service] Could not remove lock file: ${e.message}`);
        }

        // 5. Limpiar estados
        this.clientStates.set(userId, 'CLEANED');
        this.initializingClients.delete(userId);

        console.log(`[WA Service] ✅ Force cleanup completed for ${userId}`);
    }

    /**
     * Restore previous sessions from disk
     */
    async restoreSessions() {
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
                    const folderName = dirent.name;
                    const userId = folderName.replace('session-', '');

                    if (userId) {
                        console.log(`[WA Service - Restore] Restoring session for user: ${userId}`);
                        try {
                            this.initializeClient(userId);
                        } catch (err) {
                            console.error(`[WA Service - Restore] Failed to restore ${userId}:`, err);
                        }
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            } catch (error) {
                console.error('[WA Service - Restore] Error scanning auth directory:', error);
            }
        }, 1000);
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

    async initializeClient(userId) {
        if (!userId) throw new Error('UserId is required for initialization');

        // Prevenir múltiples inicializaciones simultáneas
        if (this.initializingClients.has(userId)) {
            console.log(`[WA Service] ⏳ Client ${userId} is already being initialized. Skipping.`);
            return this.clients.get(userId);
        }

        if (this.clients.has(userId)) {
            const existingClient = this.clients.get(userId);
            const state = this.clientStates.get(userId);

            // Si el cliente existe pero está en error, limpiarlo
            if (state === 'ERROR') {
                console.log(`[WA Service] Client ${userId} exists but is in ERROR state. Cleaning up...`);
                await this.forceCleanupSession(userId);
            } else {
                console.log(`[WA Service] Client ${userId} already exists with state: ${state}`);
                return existingClient;
            }
        }

        // Marcar que estamos inicializando
        this.initializingClients.add(userId);

        console.log(`[WA Service] Initializing NEW WhatsApp client for ${userId}...`);
        this.emit('status_change', { status: 'INITIALIZING', userId });
        this.clientStates.set(userId, 'INITIALIZING');

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
                    '--disable-software-rasterizer',
                    // FLAGS DE ESTABILIDAD:
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials',
                    '--single-process',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    // Evitar throttling de CPU en background
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    // Más memoria para operaciones largas
                    '--js-flags=--max-old-space-size=512'
                ]
            },
            // Fix para versiones recientes de WhatsApp Web
            // webVersionCache: {
            //     type: 'remote',
            //     remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            // }
        });

        this.setupClientListeners(client, userId);

        client.initialize().then(() => {
            console.log(`[WA Service] Client initialize promise resolved for ${userId}`);
            this.initializingClients.delete(userId);
            this.initRetryCount.delete(userId); // Reset retry count on success
        }).catch(async (err) => {
            console.error(`[WA Service] Client initialize REJECTED for ${userId}:`, err);

            // Detectar error de browser ya corriendo
            const errorMsg = err.message || String(err);
            if (errorMsg.includes('browser is already running') || errorMsg.includes('userDataDir')) {
                // Limitar reintentos para evitar loop infinito
                const retries = (this.initRetryCount.get(userId) || 0) + 1;
                this.initRetryCount.set(userId, retries);

                if (retries > 3) {
                    console.error(`[WA Service] ❌ Max retries (3) reached for ${userId}. Giving up.`);
                    this.emit('status_change', { status: 'ERROR', userId });
                    this.clientStates.set(userId, 'ERROR');
                    this.clients.delete(userId);
                    this.initializingClients.delete(userId);
                    this.initRetryCount.delete(userId);
                    return;
                }

                console.log(`[WA Service] 🔄 Detected zombie browser (attempt ${retries}/3). Forcing cleanup for ${userId}...`);
                await this.forceCleanupSession(userId);

                // Reintentar después de limpieza con delay incremental
                const delay = retries * 3000;
                console.log(`[WA Service] 🔄 Retrying initialization in ${delay / 1000} seconds...`);
                setTimeout(() => this.initializeClient(userId), delay);
                return;
            }

            this.emit('status_change', { status: 'ERROR', userId });
            this.clientStates.set(userId, 'ERROR');
            this.clients.delete(userId);
            this.initializingClients.delete(userId);
        });

        this.clients.set(userId, client);
        return client;
    }

    setupClientListeners(client, userId) {
        client.on('qr', (qr) => {
            console.log(`[WA Service] QR RECEIVED for ${userId}`);
            this.clientStates.set(userId, 'QR_RECEIVED');
            this.emit('qr', { qr, userId });
        });

        client.on('ready', () => {
            console.log(`[WA Service] ✅ Client ${userId} is READY!`);
            this.clientStates.set(userId, 'READY');
            this.emit('ready', { userId });
            this.startHealthCheck(userId);
            this.startKeepAlive(userId); // NUEVO: Iniciar keep-alive
        });

        client.on('authenticated', () => {
            console.log(`[WA Service] 🔐 Client ${userId} AUTHENTICATED`);
            this.clientStates.set(userId, 'AUTHENTICATED');
            this.emit('authenticated', { userId });
        });

        client.on('auth_failure', (msg) => {
            console.error(`[WA Service] ❌ AUTH FAILURE for ${userId}:`, msg);
            this.clientStates.set(userId, 'AUTH_FAILURE');
            this.emit('auth_failure', { msg, userId });
        });

        // NUEVO: Escuchar cambios de estado de conexión
        client.on('change_state', (state) => {
            console.log(`[WA Service] 🔄 State changed for ${userId}: ${state}`);
            this.clientStates.set(userId, state);

            // Estados que requieren reconexión
            const reconnectStates = ['CONFLICT', 'UNPAIRED', 'UNLAUNCHED', 'TIMEOUT'];
            if (reconnectStates.includes(state)) {
                console.warn(`[WA Service] ⚠️ Detected problematic state ${state} for ${userId}. Triggering restart...`);
                this.restartClient(userId);
            }
        });

        client.on('message', async (msg) => {
            this.handleWebhook(userId, msg, 'message');
            this.emit('message', { msg, userId });
        });

        client.on('message_create', async (msg) => {
            if (msg.fromMe) {
                this.handleWebhook(userId, msg, 'message_create');
            }
        });

        client.on('disconnected', async (reason) => {
            console.log(`[WA Service] ⚠️ Client ${userId} DISCONNECTED:`, reason);
            this.clientStates.set(userId, 'DISCONNECTED');
            this.emit('disconnected', { reason, userId });

            this.stopHealthCheck(userId);
            this.stopKeepAlive(userId); // NUEVO: Detener keep-alive
            this.clients.delete(userId);

            try {
                await client.destroy();
            } catch (e) {
                console.error(`[WA Service] Error destroying client ${userId} on disconnect:`, e);
            }

            // Auto-reconnect if not explicit logout
            if (!this.explicitLogouts.has(userId)) {
                console.log(`[WA Service] 🔄 Detected accidental disconnect for ${userId}. Reconnecting in 5s...`);
                setTimeout(() => {
                    this.initializeClient(userId);
                }, 5000);
            } else {
                console.log(`[WA Service] Explicit logout for ${userId}. No reconnect.`);
                this.explicitLogouts.delete(userId);
            }
        });
    }

    /**
     * NUEVO: Keep-Alive - Mantiene la sesión activa enviando presencia periódicamente
     */
    startKeepAlive(userId) {
        if (this.keepAliveIntervals.has(userId)) return;

        console.log(`[WA Service] 💓 Starting Keep-Alive for ${userId}`);

        const interval = setInterval(async () => {
            const client = this.clients.get(userId);
            if (!client) {
                this.stopKeepAlive(userId);
                return;
            }

            try {
                // Enviar presencia "disponible" - esto mantiene la conexión viva
                await client.sendPresenceAvailable();
                console.log(`[Keep-Alive] 💚 Ping sent for ${userId} at ${new Date().toLocaleTimeString()}`);
            } catch (err) {
                console.error(`[Keep-Alive] ❌ Failed for ${userId}:`, err.message);
                // Si falla el keep-alive, intentar restart
                this.restartClient(userId);
            }
        }, 3 * 60 * 1000); // Cada 3 minutos

        this.keepAliveIntervals.set(userId, interval);
    }

    stopKeepAlive(userId) {
        if (this.keepAliveIntervals.has(userId)) {
            clearInterval(this.keepAliveIntervals.get(userId));
            this.keepAliveIntervals.delete(userId);
            console.log(`[WA Service] 💔 Keep-Alive stopped for ${userId}`);
        }
    }

    /**
     * MEJORADO: Health Check robusto que detecta frames detached
     */
    startHealthCheck(userId) {
        if (this.healthCheckIntervals.has(userId)) return;

        console.log(`[WA Service] 🏥 Starting Health Check for ${userId}`);

        const interval = setInterval(async () => {
            const client = this.clients.get(userId);
            if (!client) {
                this.stopHealthCheck(userId);
                return;
            }

            try {
                // MEJORADO: Verificación en múltiples niveles

                // Nivel 1: Verificar que el cliente existe y tiene página
                if (!client.pupPage) {
                    throw new Error('Puppeteer page not available');
                }

                // Nivel 2: Verificar que el frame no está detached (CRÍTICO)
                const frameCheckPromise = client.pupPage.evaluate(() => {
                    return window.Store !== undefined;
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Frame Timeout - Possible detach')), 10000)
                );

                await Promise.race([frameCheckPromise, timeoutPromise]);

                // Nivel 3: Verificar estado real de WhatsApp
                const statePromise = client.getState();
                const stateTimeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('State Timeout')), 10000)
                );

                const state = await Promise.race([statePromise, stateTimeoutPromise]);

                if (state !== 'CONNECTED') {
                    console.warn(`[Health Check] ⚠️ User ${userId} state is ${state}. Restarting...`);
                    this.restartClient(userId);
                } else {
                    console.log(`[Health Check] ✅ ${userId} healthy at ${new Date().toLocaleTimeString()}`);
                }

            } catch (err) {
                console.error(`[Health Check] ❌ Failed for ${userId} (Err: ${err.message}). Client might be zombie. Restarting...`);
                this.restartClient(userId);
            }
        }, 5 * 60 * 1000); // Check every 5 minutes

        this.healthCheckIntervals.set(userId, interval);
    }

    stopHealthCheck(userId) {
        if (this.healthCheckIntervals.has(userId)) {
            clearInterval(this.healthCheckIntervals.get(userId));
            this.healthCheckIntervals.delete(userId);
            console.log(`[WA Service] 🏥 Health Check stopped for ${userId}`);
        }
    }

    async restartClient(userId) {
        console.log(`[WA Service] 🔄 Restarting client for ${userId}...`);
        this.stopHealthCheck(userId);
        this.stopKeepAlive(userId);

        const client = this.clients.get(userId);
        if (client) {
            this.clients.delete(userId);
            try {
                await client.destroy();
                console.log(`[WA Service] 💀 Old client destroyed for ${userId}`);
            } catch (e) {
                console.error(`[WA Service] Error destroying old client:`, e.message);
            }
        }

        // Wait and re-init
        console.log(`[WA Service] ⏳ Waiting 5s before re-initializing ${userId}...`);
        setTimeout(() => this.initializeClient(userId), 5000);
    }

    async logout(userId) {
        if (!userId) {
            console.error('[WA Service] Logout requested without userId');
            return;
        }

        console.log(`[WA Service] 🚪 Logging out client ${userId}...`);
        this.explicitLogouts.add(userId);
        this.stopHealthCheck(userId);
        this.stopKeepAlive(userId);

        const client = this.clients.get(userId);
        if (client) {
            try {
                // Intentar logout normal con timeout
                await Promise.race([
                    client.logout(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 10000))
                ]);
                console.log(`[WA Service] ✅ Logout successful for ${userId}`);
            } catch (error) {
                console.error(`[WA Service] Error logging out client ${userId}:`, error.message);
            }
        }

        // Siempre hacer limpieza forzada para asegurar que todo esté limpio
        await this.forceCleanupSession(userId);

        // Borrar la carpeta de sesión para obtener un QR nuevo
        const sessionPath = path.resolve(process.cwd(), '.wwebjs_auth_v2', `session-${userId}`);
        try {
            if (fs.existsSync(sessionPath)) {
                console.log(`[WA Service] 🗑️ Removing session folder for ${userId}...`);
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`[WA Service] ✅ Session folder removed`);
            }
        } catch (e) {
            console.warn(`[WA Service] Could not remove session folder: ${e.message}`);
        }

        this.clientStates.set(userId, 'LOGGED_OUT');

        // Esperar un poco más antes de reinicializar
        console.log(`[WA Service] ⏳ Waiting 4s before re-initializing ${userId} for new QR...`);
        setTimeout(() => {
            this.explicitLogouts.delete(userId);
            this.initializeClient(userId);
        }, 4000);
    }

    /**
     * NUEVO: Obtener estado de un cliente
     */
    getClientState(userId) {
        return this.clientStates.get(userId) || 'UNKNOWN';
    }

    /**
     * NUEVO: Obtener estadísticas de todos los clientes
     */
    getStats() {
        const stats = {
            totalClients: this.clients.size,
            states: {},
            clients: []
        };

        for (const [userId, client] of this.clients) {
            const state = this.clientStates.get(userId) || 'UNKNOWN';
            stats.states[state] = (stats.states[state] || 0) + 1;
            stats.clients.push({
                userId,
                state,
                hasHealthCheck: this.healthCheckIntervals.has(userId),
                hasKeepAlive: this.keepAliveIntervals.has(userId)
            });
        }

        return stats;
    }

    async handleWebhook(userId, msg, eventType = 'message') {
        try {
            const settings = await settingsService.getUserSettings(userId);
            let webhooks = settings?.webhooks || [];

            if (!webhooks.length) {
                return;
            }

            let legacyEvent = 'message.received';
            if (eventType === 'message_create' && msg.fromMe) {
                legacyEvent = 'message.sent';
            }

            const chat = await msg.getChat();
            const contact = await msg.getContact();

            const isoTimestamp = new Date(msg.timestamp * 1000).toISOString();

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

            const extractPhoneNumber = (waId) => {
                if (!waId) return null;
                const match = waId.match(/^(\d+)@/);
                return match ? match[1] : waId.replace(/@.*$/, '');
            };

            const senderPhone = extractPhoneNumber(msg.from);
            const recipientPhone = extractPhoneNumber(msg.to);
            const chatPhone = extractPhoneNumber(chat.id._serialized);

            let finalChatId = chat.id._serialized;
            let finalChatPhone = chatPhone;

            if (!chat.isGroup) {
                try {
                    const chatContact = await chat.getContact();
                    if (chatContact && chatContact.number) {
                        finalChatPhone = chatContact.number;
                        finalChatId = `${finalChatPhone}@c.us`;
                    }
                } catch (err) {
                    console.warn('[Webhook] Failed to resolve chat contact:', err);
                }
            }

            const finalSenderPhone = msg.fromMe ? extractPhoneNumber(msg.from) : finalChatPhone;
            const finalRecipientPhone = msg.fromMe ? finalChatPhone : extractPhoneNumber(msg.to);

            const payload = {
                event: legacyEvent,
                timestamp: isoTimestamp,
                data: {
                    id: msg.id._serialized,
                    body: msg.body,
                    from: msg.from,
                    to: msg.to,
                    phone: msg.fromMe ? finalRecipientPhone : finalSenderPhone,
                    senderPhone: finalSenderPhone,
                    recipientPhone: finalRecipientPhone,
                    fromMe: msg.fromMe,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    chatId: finalChatId,
                    chatPhone: finalChatPhone,
                    hasMedia: msg.hasMedia,
                    isGroup: chat.isGroup,
                    author: msg.author || msg.from,
                    pushname: contact?.pushname || contact?.name || contact?.number,
                    labels: labels,
                    contact: {
                        name: contact?.pushname || contact?.name || null,
                        phone: !msg.fromMe ? finalChatPhone : senderPhone,
                        number: !msg.fromMe ? finalChatPhone : (contact?.number || senderPhone),
                        hasLabels: labels.length > 0,
                        labelsCount: labels.length
                    }
                }
            };

            console.log(`[Webhook] Processing ${legacyEvent} for ${webhooks.length} hooks`);

            webhooks.forEach(async (hook) => {
                const hookEvents = hook.events || [];
                let shouldSend = false;
                if (legacyEvent === 'message.received' && hookEvents.includes('message')) shouldSend = true;
                if (legacyEvent === 'message.sent' && hookEvents.includes('message_create')) shouldSend = true;

                if (!shouldSend) return;

                try {
                    console.log(`[Webhook] Sending to ${hook.url}`);
                    await axios.post(hook.url, payload, { timeout: 10000 });
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

            return messages.map(msg => {
                return {
                    id: msg.id._serialized,
                    fromMe: msg.fromMe,
                    content: msg.body,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    hasMedia: msg.hasMedia,
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
            const allChats = await client.getChats();
            console.log(`[DEBUG] Fetched ${allChats.length} raw chats.`);

            // OPTIMIZACIÓN: Limitar a los 500 chats más recientes para evitar timeouts
            const MAX_CHATS = 500;
            const chats = allChats
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, MAX_CHATS);

            if (allChats.length > MAX_CHATS) {
                console.log(`[DEBUG] Limited to ${MAX_CHATS} most recent chats (of ${allChats.length} total)`);
            }

            // OPTIMIZACIÓN: Usar map síncrono sin llamadas adicionales a getLabels()
            // Las labels ya vienen en chat.labels si existen - NO hacer 500+ llamadas async
            const formattedChats = chats.map(chat => {
                // Usar labels existentes en el objeto chat, sin llamadas adicionales
                const labelIds = chat.labels || [];

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
                    profilePicUrl: undefined
                };
            });

            return formattedChats;
        } catch (e) {
            console.error('Error fetching chats:', e);
            return [];
        }
    }

    async getFormattedLabels(userId) {
        const LabelColorPalette = [
            '#ff9485', '#64c4ff', '#ffd429', '#dfaef0', '#99b6c1',
            '#55ccb3', '#ff9dff', '#d3a91d', '#6d7cce', '#d7e752',
            '#00d0e2', '#ffc5c7', '#93ceac', '#f74848', '#00a0f2',
            '#83e422', '#ffaf04', '#b5ebff', '#9ba6ff', '#9368cf'
        ];

        const client = this.clients.get(userId);
        if (!client) return [];

        // Verificar que el cliente esté en estado READY antes de continuar
        const state = this.clientStates.get(userId);
        if (state !== 'READY' && state !== 'CONNECTED') {
            console.log(`[Labels] Client ${userId} not ready (state: ${state}). Skipping labels fetch.`);
            return [];
        }

        try {
            // Verificar que pupPage existe antes de continuar
            if (!client.pupPage) {
                console.log(`[Labels] Client ${userId} has no pupPage. Skipping labels fetch.`);
                return [];
            }

            const labels = await client.getLabels();
            if (!Array.isArray(labels)) return [];

            // OPTIMIZACIÓN: No llamar a l.getChats() para cada label - es MUY pesado
            // En su lugar, devolver count: 0 y dejar que el frontend lo maneje
            return labels.map(l => {
                let color = '#cccccc';
                try {
                    if (l.hexColor && l.hexColor.startsWith('#')) {
                        color = l.hexColor;
                    }
                    else if (typeof l.color === 'number') {
                        const index = l.color % LabelColorPalette.length;
                        color = LabelColorPalette[index];
                    }
                    else if (l.id) {
                        const numericId = parseInt(l.id.replace(/\D/g, '')) || 0;
                        color = LabelColorPalette[numericId % LabelColorPalette.length];
                    }
                } catch (err) {
                    console.error('Error calculating label color:', l, err);
                }

                return {
                    id: l.id,
                    name: l.name,
                    color: color,
                    count: 0 // No calcular count para evitar N llamadas adicionales
                };
            });
        } catch (e) {
            console.error('Error fetching labels:', e);
            return [];
        }
    }

    async updateChatLabels(userId, chatId, labelIds, action = 'add') {
        const client = this.clients.get(userId);
        if (!client) throw new Error('Client not initialized');

        const targetChatId = chatId.includes('@') ? chatId : `${chatId.replace(/\D/g, '')}@c.us`;
        const labelsToProcess = Array.isArray(labelIds) ? labelIds : [labelIds];

        try {
            await client.pupPage.evaluate(async (chatId, labelIds, action) => {
                const chatModel = window.Store.Chat.get(chatId);
                const labelModels = labelIds.map(id => window.Store.Label.get(id)).filter(Boolean);

                if (!chatModel) return;

                if (window.Store.Label && window.Store.Label.addOrRemoveLabels) {
                    const currentLabels = chatModel.labels || [];
                    let newLabels = new Set(currentLabels);

                    labelIds.forEach(id => {
                        if (action === 'add') newLabels.add(id);
                        else newLabels.delete(id);
                    });

                    if (window.Store.Cmd && window.Store.Cmd.saveLabels) {
                        await window.Store.Cmd.saveLabels(chatId, Array.from(newLabels));
                    } else {
                        const toToggle = labelModels.filter(l => {
                            const hasLabel = newLabels.has(l.id);
                            const shouldHave = action === 'add';
                            return (currentLabels.includes(l.id) !== shouldHave);
                        });

                        if (toToggle.length > 0) {
                            await window.Store.Label.addOrRemoveLabels(toToggle, [chatModel]);
                        }
                    }
                }
            }, targetChatId, labelsToProcess, action);

            await new Promise(r => setTimeout(r, 200));

            const chat = await client.getChatById(targetChatId);
            if (!chat) {
                console.warn(`[Labels] Chat not found for ${targetChatId} after update. Returning empty.`);
                return [];
            }
            return await chat.getLabels();

        } catch (pupError) {
            console.error('[Labels] Puppeteer strategy failed:', pupError);

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
