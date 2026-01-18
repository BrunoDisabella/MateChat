
import { Server as SocketIo } from 'socket.io';
import { whatsappService } from './whatsapp.service.js';
import { settingsService } from './settings.service.js';
import { config } from '../config/index.js';

class SocketService {
    constructor() {
        this.io = null;
        // Almacenar estado por usuario: { [userId]: { state: 'DISCONNECTED', qr: null } }
        this.userStates = new Map();
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
                whatsappService.initializeClient(userId);
            } catch (e) {
                console.error(`Error initializing WA client for ${userId}:`, e);
            }

            // Enviar estado actual
            this.sendState(socket, userId);

            socket.on('client-ready', () => {
                console.log(`Client UI ready signal received for ${userId}`);
                this.sendState(socket, userId);
            });

            socket.on('logout', async () => {
                console.log(`Logout requested for ${userId}`);
                await whatsappService.logout(userId);
                this.updateUserState(userId, { state: 'DISCONNECTED', qr: null });
            });

            socket.on('send-message', async (data) => {
                const { chatId, content } = data;
                if (!chatId || !content) return;

                try {
                    const client = whatsappService.getClient(userId);
                    if (client) {
                        await client.sendMessage(chatId, content);
                    } else {
                        console.error(`[Socket] Client not ready for ${userId}`);
                    }
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
            socket.on('fetch-messages', async ({ chatId, limit = 50, before = null }, callback) => {
                const messages = await whatsappService.getChatMessages(userId, chatId, { limit, before });
                if (callback) callback(messages);
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
        // console.log(`Refreshing data for ${userId}`);
        const chats = await whatsappService.getFormattedChats(userId);
        const labels = await whatsappService.getFormattedLabels(userId);

        socket.emit('chat-update', chats);
        socket.emit('labels-update', labels);
    }

    setupWhatsappListeners() {
        whatsappService.on('qr', ({ qr, userId }) => {
            this.updateUserState(userId, { state: 'QR_SENT', qr });
            this.io.to(`user:${userId}`).emit('qr', { qr });
        });

        whatsappService.on('ready', async ({ userId }) => {
            this.updateUserState(userId, { state: 'READY', qr: null });
            this.io.to(`user:${userId}`).emit('ready', { userId });

            const chats = await whatsappService.getFormattedChats(userId);
            const labels = await whatsappService.getFormattedLabels(userId);
            this.io.to(`user:${userId}`).emit('chat-update', chats);
            this.io.to(`user:${userId}`).emit('labels-update', labels);
        });

        whatsappService.on('authenticated', ({ userId }) => {
            this.updateUserState(userId, { state: 'AUTHENTICATED', qr: null });
            this.io.to(`user:${userId}`).emit('authenticated', { userId });
        });

        whatsappService.on('disconnected', ({ userId }) => {
            this.updateUserState(userId, { state: 'DISCONNECTED', qr: null });
            this.io.to(`user:${userId}`).emit('disconnected', { userId });
        });

        // Forward labels update specifically
        whatsappService.on('labels_update', async ({ userId }) => {
            const labels = await whatsappService.getFormattedLabels(userId);
            this.io.to(`user:${userId}`).emit('labels-update', labels);
        });
    }
}

export const socketService = new SocketService();
