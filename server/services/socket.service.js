
import { Server as SocketIo } from 'socket.io';
import { whatsappBaileysService } from './whatsapp-baileys.service.js';
import { settingsService } from './settings.service.js';
import { config } from '../config/index.js';

class SocketService {
    constructor() {
        this.io = null;
        // Almacenar estado por usuario: { [userId]: { state: 'DISCONNECTED', qr: null } }
        this.userStates = new Map();
        // Lock para evitar múltiples cargas simultáneas de datos
        this.refreshLocks = new Map();
    }

    initialize(server) {
        this.io = new SocketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        // Middleware de autenticación
        this.io.use((socket, next) => {
            const userId = socket.handshake.auth.userId;
            if (!userId) {
                return next(new Error("authentication error: userId required"));
            }
            socket.userId = userId;
            next();
        });

        this.setupWhatsappListeners();

        this.io.on('connection', async (socket) => {
            const userId = socket.userId;
            console.log(`Socket connected: ${socket.id} for User: ${userId}`);

            // Unir a sala privada del usuario
            socket.join(`user:${userId}`);

            // Inicializar estado si no existe
            if (!this.userStates.has(userId)) {
                this.userStates.set(userId, { state: 'DISCONNECTED', qr: null });
            }

            // Inicializar cliente de WhatsApp para este usuario si no existe
            // Esto asegura que el proceso se inicie al conectar el frontend
            try {
                whatsappBaileysService.initializeClient(userId);
            } catch (e) {
                console.error(`Error initializing WA client for ${userId}:`, e);
            }

            // Si tenemos un QR almacenado, reenviarlo al nuevo socket
            const userState = this.userStates.get(userId);
            if (userState && userState.qr && userState.state !== 'READY') {
                console.log(`[Socket] Resending stored QR to new socket for ${userId}`);
                socket.emit('qr', { qr: userState.qr });
            } else if (whatsappBaileysService.isClientReady(userId)) {
                // Si el cliente ya está listo, notificar
                socket.emit('ready', { userId });
            }

            socket.on('client-ready', () => {
                console.log(`Client UI ready signal received for ${userId}`);
                this.sendState(socket, userId);
            });

            socket.on('logout', async () => {
                console.log(`Logout requested for ${userId}`);
                await whatsappBaileysService.logout(userId);
                this.updateUserState(userId, { state: 'DISCONNECTED', qr: null });
            });

            socket.on('send-message', async (data) => {
                const { chatId, content } = data;
                if (!chatId || !content) return;

                try {
                    await whatsappBaileysService.sendMessage(userId, chatId, content);
                } catch (e) {
                    console.error(`[Socket] Error sending message for ${userId}:`, e);
                }
            });

            // --- SETTINGS (API & WEBHOOKS) ---
            socket.on('get-settings', async () => {
                console.log(`[Socket] Fetching settings for ${userId}`);
                const settings = await settingsService.getUserSettings(userId);

                socket.emit('settings-data', {
                    apiKey: settings?.api_key || '',
                    webhooks: settings?.webhooks || []
                });
            });

            socket.on('update-api-key', async ({ apiKey }) => {
                console.log(`[Settings] User ${userId} is updating API Key manually`);

                if (!apiKey || apiKey.trim().length < 5) {
                    socket.emit('settings-updated', { success: false, error: "API Key too short" });
                    return;
                }

                const success = await settingsService.updateApiKey(userId, apiKey);

                if (success) {
                    socket.emit('settings-updated', { success: true });
                    // Broadcast to other tabs
                    this.io.to(`user:${userId}`).emit('settings-data', {
                        apiKey: apiKey,
                        webhooks: (await settingsService.getUserSettings(userId))?.webhooks || []
                    });
                } else {
                    socket.emit('settings-updated', { success: false, error: "Failed to update API Key" });
                }
            });

            socket.on('save-webhooks', async (webhooks) => {
                console.log(`[Settings] Saving webhooks for ${userId}`);
                const success = await settingsService.saveWebhooks(userId, webhooks);

                if (success) {
                    socket.emit('settings-updated', { success: true });
                    // Broadcast to user's other tabs
                    const settings = await settingsService.getUserSettings(userId);
                    this.io.to(`user:${userId}`).emit('settings-data', {
                        apiKey: settings?.api_key,
                        webhooks: settings?.webhooks
                    });
                } else {
                    socket.emit('settings-updated', { success: false, error: 'Failed to save webhooks' });
                }
            });

            // GET HISTORIAL
            // TODO: Implementar getChatMessages en Baileys service
            socket.on('fetch-messages', async ({ chatId, limit = 50, before = null }, callback) => {
                // const messages = await whatsappBaileysService.getChatMessages(userId, chatId, { limit, before });
                if (callback) callback([]);
            });
        });
    }

    updateUserState(userId, update) {
        const current = this.userStates.get(userId) || { state: 'DISCONNECTED', qr: null };
        this.userStates.set(userId, { ...current, ...update });
    }

    async sendState(socket, userId) {
        const state = this.userStates.get(userId) || { state: 'DISCONNECTED', qr: null };

        if (state.state === 'QR_SENT' && state.qr) {
            socket.emit('qr', { qr: state.qr });
        } else if (state.state === 'AUTHENTICATED' || state.state === 'READY') {
            socket.emit(state.state.toLowerCase(), { userId });

            if (state.state === 'READY') {
                this.refreshDataForSocket(socket, userId);
            }
        } else {
            socket.emit('disconnected', { userId });
        }
    }

    async refreshDataForSocket(socket, userId) {
        // Evitar múltiples cargas simultáneas para el mismo usuario
        if (this.refreshLocks.get(userId)) {
            console.log(`[Socket] Refresh already in progress for ${userId}. Skipping.`);
            return;
        }

        this.refreshLocks.set(userId, true);
        console.log(`[Socket] Refreshing data for ${userId}`);

        try {
            // TODO: Implementar getFormattedChats y getFormattedLabels en Baileys
            // const chats = await whatsappBaileysService.getFormattedChats(userId);
            // const labels = await whatsappBaileysService.getFormattedLabels(userId);
            // socket.emit('chat-update', chats);
            // socket.emit('labels-update', labels);
            console.log(`[Socket] Data refresh skipped for ${userId} (Baileys migration in progress)`);
        } catch (err) {
            console.error(`[Socket] Error refreshing data for ${userId}:`, err.message);
        } finally {
            // Liberar lock después de un pequeño delay para evitar múltiples cargas inmediatas
            setTimeout(() => {
                this.refreshLocks.delete(userId);
            }, 3000);
        }
    }

    setupWhatsappListeners() {
        // QR Code event
        whatsappBaileysService.on('qr', ({ qr, userId }) => {
            console.log(`[Socket] QR event received for ${userId}, emitting to room user:${userId}`);
            this.updateUserState(userId, { state: 'QR_SENT', qr });
            this.io.to(`user:${userId}`).emit('qr', { qr });
            console.log(`[Socket] QR emitted successfully`);
        });

        // Ready event (connection established)
        whatsappBaileysService.on('ready', async ({ userId }) => {
            this.updateUserState(userId, { state: 'READY', qr: null });
            this.io.to(`user:${userId}`).emit('ready', { userId });
            console.log(`[Socket] Client ready for ${userId}`);
        });

        // Connecting event
        whatsappBaileysService.on('connecting', ({ userId }) => {
            this.updateUserState(userId, { state: 'CONNECTING', qr: null });
            this.io.to(`user:${userId}`).emit('connecting', { userId });
        });

        // Logged out event
        whatsappBaileysService.on('logged_out', ({ userId }) => {
            this.updateUserState(userId, { state: 'DISCONNECTED', qr: null });
            this.io.to(`user:${userId}`).emit('disconnected', { userId });
        });

        // Message received event
        whatsappBaileysService.on('message', ({ userId, from, contact, body, timestamp }) => {
            this.io.to(`user:${userId}`).emit('message', {
                from,
                contact,
                body,
                timestamp
            });
        });
    }
}

export const socketService = new SocketService();
