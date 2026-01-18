
import { Server as SocketIo } from 'socket.io';
import { whatsappService } from './whatsapp.service.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

class SocketService {
    constructor() {
        this.io = null;
        this.currentQr = null;
        this.clientState = 'DISCONNECTED';
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

        this.setupWhatsappListeners();

        this.io.on('connection', (socket) => {
            console.log(`New Socket connection: ${socket.id} | State: ${this.clientState}`);

            // Enviar estado actual
            this.sendState(socket);

            socket.on('client-ready', () => {
                console.log('Client UI ready signal received.');
                this.sendState(socket);
            });

            // --- FIX LOGOUT ---
            socket.on('logout', async () => {
                console.log('Logout requested from UI');
                await whatsappService.logout('default-user');
                // El servicio de whatsapp emitirá 'disconnected', actualizando el estado aquí
            });

            // Reenviar eventos de socket al servicio si fuera necesario (ej: enviar mensaje desde UI)
            socket.on('send-message', async (data) => {
                console.log('[Socket] Received send-message request:', data);
                const { chatId, content } = data;
                if (!chatId || !content) return;

                try {
                    const client = whatsappService.getClient('default-user');
                    if (client) {
                        await client.sendMessage(chatId, content);
                        console.log(`[Socket] Message sent to ${chatId}`);
                    } else {
                        console.error('[Socket] Client not ready for send-message');
                    }
                } catch (e) {
                    console.error('[Socket] Error sending message:', e);
                }
            });

            // --- SETTINGS (API & WEBHOOKS) ---
            socket.on('get-settings', () => {
                const webhooksPath = path.resolve(process.cwd(), 'server', 'data', 'webhooks.json');
                let webhooks = [];
                if (fs.existsSync(webhooksPath)) {
                    try {
                        webhooks = JSON.parse(fs.readFileSync(webhooksPath, 'utf8'));
                    } catch (e) { console.error('Error reading webhooks:', e); }
                }

                socket.emit('settings-data', {
                    apiKey: process.env.API_KEY || 'matechat-secret-local',
                    webhooks: webhooks
                });
            });

            socket.on('update-api-key', ({ apiKey }) => {
                console.log('[Settings] Updating API Key');
                process.env.API_KEY = apiKey;

                try {
                    const envPath = path.resolve(process.cwd(), '.env');
                    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

                    const apiKeyRegex = /^API_KEY=.*$/m;
                    if (apiKeyRegex.test(envContent)) {
                        envContent = envContent.replace(apiKeyRegex, `API_KEY=${apiKey}`);
                    } else {
                        envContent += `\nAPI_KEY=${apiKey}`;
                    }

                    fs.writeFileSync(envPath, envContent.trim() + '\n');
                    socket.emit('settings-updated', { success: true });

                    // Broadcast update to all clients
                    this.io.emit('settings-data', {
                        apiKey,
                        webhooks: this.getWebhooks()
                    });

                } catch (error) {
                    console.error('[Settings] Error saving API Key:', error);
                    socket.emit('settings-updated', { success: false, error: 'Failed to save API Key' });
                }
            });

            socket.on('save-webhooks', (webhooks) => {
                console.log(`[Settings] Saving ${webhooks.length} webhooks`);
                try {
                    const dataDir = path.resolve(process.cwd(), 'server', 'data');
                    const webhooksPath = path.join(dataDir, 'webhooks.json');

                    // Crear directorio si no existe
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }

                    fs.writeFileSync(webhooksPath, JSON.stringify(webhooks, null, 2));

                    socket.emit('settings-updated', { success: true });

                    this.io.emit('settings-data', {
                        apiKey: process.env.API_KEY || 'matechat-secret-local',
                        webhooks: webhooks
                    });
                } catch (error) {
                    console.error('[Settings] Error saving webhooks:', error);
                    socket.emit('settings-updated', { success: false, error: 'Failed to save webhooks' });
                }
            });


            // GET HISTORIAL (Legacy)
            socket.on('fetch-messages', async ({ chatId, limit = 50, before = null }, callback) => {
                console.log(`[Socket] Fetching messages for ${chatId} (Limit: ${limit}, Before: ${before})`);
                const messages = await whatsappService.getChatMessages('default-user', chatId, { limit, before });
                if (callback) callback(messages);
            });
        });
    }

    async sendState(socket) {
        if (this.clientState === 'QR_SENT' && this.currentQr) {
            socket.emit('qr', { qr: this.currentQr });
        } else if (this.clientState === 'AUTHENTICATED' || this.clientState === 'READY') {
            socket.emit(this.clientState.toLowerCase(), { userId: 'default-user' });

            // Si ya estamos listos, enviar datos al socket recién conectado
            if (this.clientState === 'READY') {
                this.refreshDataForSocket(socket);
            }
        }
    }

    async refreshDataForSocket(socket) {
        console.log('Refreshing data for socket:', socket.id);
        const chats = await whatsappService.getFormattedChats('default-user');
        const labels = await whatsappService.getFormattedLabels('default-user');

        socket.emit('chat-update', chats);
        socket.emit('labels-update', labels);
    }

    setupWhatsappListeners() {
        whatsappService.on('qr', ({ qr }) => {
            this.currentQr = qr;
            this.clientState = 'QR_SENT';
            this.io.emit('qr', { qr });
        });

        whatsappService.on('ready', async () => {
            this.currentQr = null;
            this.clientState = 'READY';
            this.io.emit('ready', { userId: 'default-user' });

            // Broadcast initial data to all
            console.log('Fetching initial data for broadcast...');
            const chats = await whatsappService.getFormattedChats('default-user');
            const labels = await whatsappService.getFormattedLabels('default-user');
            this.io.emit('chat-update', chats);
            this.io.emit('labels-update', labels);
        });

        whatsappService.on('authenticated', () => {
            this.currentQr = null;
            this.clientState = 'AUTHENTICATED';
            this.io.emit('authenticated', { userId: 'default-user' });
        });

        whatsappService.on('disconnected', () => {
            this.currentQr = null;
            this.clientState = 'DISCONNECTED';
            this.io.emit('disconnected', { userId: 'default-user' });
        });

        whatsappService.on('status_change', ({ status }) => {
            // Manejar estados intermedios si es necesario
        });
    }

    getWebhooks() {
        const webhooksPath = path.resolve(process.cwd(), 'server', 'data', 'webhooks.json');
        if (fs.existsSync(webhooksPath)) {
            try {
                return JSON.parse(fs.readFileSync(webhooksPath, 'utf8'));
            } catch (e) { return []; }
        }
        return [];
    }
}

export const socketService = new SocketService();
