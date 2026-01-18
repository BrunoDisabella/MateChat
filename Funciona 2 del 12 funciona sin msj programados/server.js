import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
// FIX: Handle both CommonJS and ESM default export behaviors for whatsapp-web.js
const { Client, LocalAuth, MessageMedia } = pkg.default || pkg;
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import compression from 'compression';
import axios from 'axios';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
const ffmpegPath = ffmpegInstaller.path;
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.resolve(__filename));

// Set the path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// --- FFmpeg Installation Check ---
exec('ffmpeg -version', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ FFmpeg is not installed or not in PATH:', error);
        return;
    }
    console.log('✅ FFmpeg is available:');
    console.log(stdout.split('\n')[0]); // Primera línea con la versión
});

// --- Supabase Setup ---
const supabaseUrl = 'https://oheapcbdvgmrmecgktak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZWFwY2Jkdmdtcm1lY2drdGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDY1MjMsImV4cCI6MjA3NzE4MjUyM30.h2I4EVQDTp9sXK7TkAmbDRXLi4Ar5Z_1zVeeTlBSpwI';
const supabase = createClient(supabaseUrl, supabaseKey);

const hardcodedServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZWFwY2Jkdmdtcm1lY2drdGFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNjUyMywiZXhwIjoyMDc3MTgyNTIzfQ.bIQB5abAp8WCOtVTNHkxqLfPJHRzSABreoKMKBmV5A8';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || hardcodedServiceRoleKey;
const supabaseService = createClient(supabaseUrl, serviceRoleKey);

if (!serviceRoleKey || serviceRoleKey === supabaseKey) {
     console.error('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured correctly. Server-side operations like webhooks will fail.');
} else if (serviceRoleKey === hardcodedServiceRoleKey) {
     console.warn('SECURITY WARNING: Using a hardcoded SUPABASE_SERVICE_ROLE_KEY. It is highly recommended to use an environment variable for better security in production environments.');
}

// --- In-Memory Stores for Multi-Tenancy ---
const clients = new Map();
const userSockets = new Map();
const clientLastActivity = new Map(); 

// --- Express & Socket.IO Setup ---
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(compression());
app.use(cors());

app.use('/api', (req, res, next) => {
    console.log(`[API Request] ${new Date().toISOString()} - ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});

// --- Servir la carpeta 'dist' (Vite Build) ---
app.use(express.static(path.join(__dirname, 'dist')));

// --- Socket.IO Authentication Middleware ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided.'));
    }
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return next(new Error('Authentication error: Invalid token.'));
        }
        socket.userId = user.id;
        socket.supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        next();
    } catch (e) {
        return next(new Error('Authentication error: Server failed to validate token.'));
    }
});

/**
 * Converts audio data from a Base64 string to the OGG Opus format required by WhatsApp for voice notes.
 */
async function convertAudioToOggOpus(base64Data, inputMimeType) {
    const tempDir = path.join(__dirname, 'temp_audio');
    await fs.mkdir(tempDir, { recursive: true });

    const randomId = crypto.randomUUID();
    
    let inputExtension = inputMimeType.split('/')[1].split(';')[0];
    const mimeToExtMap = {
        'webm': 'webm',
        'ogg': 'ogg',
        'wav': 'wav',
        'mpeg': 'mp3',
        'mp3': 'mp3',
        'x-m4a': 'm4a',
        'm4a': 'm4a'
    };
    inputExtension = mimeToExtMap[inputExtension] || 'webm';
    
    const inputPath = path.join(tempDir, `${randomId}.${inputExtension}`);
    const outputPath = path.join(tempDir, `${randomId}.ogg`);

    try {
        const estimatedSize = (base64Data.length * 3) / 4;
        const MAX_SIZE = 16 * 1024 * 1024; // 16MB
        
        if (estimatedSize > MAX_SIZE) {
            throw new Error(`Audio too large: ${(estimatedSize/1024/1024).toFixed(2)}MB (max: 16MB)`);
        }

        const audioBuffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(inputPath, audioBuffer);

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioCodec('libopus')
                .audioBitrate('16k')
                .audioChannels(1)
                .audioFrequency(16000)
                .toFormat('ogg')
                .addOption('-vn')
                .addOption('-application', 'voip')
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(new Error(`FFmpeg failed: ${err.message}`)))
                .save(outputPath);
        });

        const stats = await fs.stat(outputPath);
        if (stats.size === 0) throw new Error('Converted file is empty');
        await fs.unlink(inputPath);
        return outputPath;

    } catch (error) {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        throw error;
    }
}

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User ${userId} connected with socket ${socket.id}`);
    clientLastActivity.set(userId, new Date());

    const existingSocketId = userSockets.get(userId);
    if (existingSocketId && io.sockets.sockets.get(existingSocketId)) {
        io.sockets.sockets.get(existingSocketId).disconnect(true);
    }
    userSockets.set(userId, socket.id);

    socket.on('client-ready', () => {
        initializeClientForUser(userId, socket.id);
    });

    socket.on('disconnect', () => {
        if (userSockets.get(userId) === socket.id) {
            userSockets.delete(userId);
        }
    });

    socket.on('select-chat', async (chatId) => {
        try {
            // Usar supabaseService para lectura robusta
            const { data: dbMessages, error } = await supabaseService
                .from('messages')
                .select('id, body, from_me, timestamp, type, has_media')
                .eq('user_id', userId)
                .eq('chat_id', chatId)
                .order('timestamp', { ascending: false })
                .limit(20);
            if (error) throw error;
           
            const formattedMessages = (dbMessages || []).reverse().map(m => ({
                id: m.id,
                body: m.body,
                fromMe: m.from_me,
                timestamp: new Date(m.timestamp).getTime() / 1000,
                type: m.type,
                hasMedia: m.has_media,
                media: undefined
            }));
            socket.emit('chat-history', { chatId, messages: formattedMessages });
        } catch (err) {
            console.error(`[Initial Load] Error fetching history from DB for user ${userId}:`, err);
        }
    });

    socket.on('send-message', async (data) => {
        let convertedAudioPath = null;
        try {
            const client = clients.get(userId);
            if (!client) throw new Error(`No active WhatsApp client found for user ${userId}.`);
            
            const clientState = await client.getState();
            if (clientState !== 'CONNECTED') throw new Error(`WhatsApp client is not connected.`);
        
            const { to, text, audioBase64, audioMime, isVoiceMessage } = data;
    
            let content;
            let options = {};
            
            if (audioBase64 && audioMime && isVoiceMessage) {
                convertedAudioPath = await convertAudioToOggOpus(audioBase64, audioMime);
                content = MessageMedia.fromFilePath(convertedAudioPath);
                
                // CRITICAL FOR PTT: Explicitly set mimetype required by WhatsApp
                content.mimetype = 'audio/ogg; codecs=opus';
                
                options.sendAudioAsVoice = true;
                // Note: Do NOT set options.caption for voice notes, or it becomes a file.
            } else if (text) {
                content = text;
            } else {
                throw new Error("Message content is empty.");
            }
            
            const sentMessage = await client.sendMessage(to, content, options);
            
            socket.emit('message-sent-confirmation', {
                messageId: sentMessage.id._serialized,
                timestamp: sentMessage.timestamp
            });
    
        } catch (error) {
            socket.emit('send-message-error', { 
                error: `Failed to send message: ${error.message}`,
                details: error.stack
            });
        } finally {
            if (convertedAudioPath) {
                await fs.unlink(convertedAudioPath).catch(() => {});
            }
        }
    });

    // --- Label Management Handlers ---
    const refetchLabels = async () => {
        try {
            const { data: labels } = await supabaseService.from('labels').select('*').eq('user_id', userId);
            const { data: chatLabelsData } = await supabaseService.from('chat_labels').select('chat_id, label_id').eq('user_id', userId);
           
            const chatLabels = (chatLabelsData || []).reduce((acc, { chat_id, label_id }) => {
                if (!acc[chat_id]) acc[chat_id] = [];
                acc[chat_id].push(label_id);
                return acc;
            }, {});
           
            socket.emit('all-labels', labels || []);
            socket.emit('chat-labels-updated', chatLabels);
        } catch (err) {
            console.error(`Error refetching labels for user ${userId}:`, err.message);
        }
    };
    socket.on('get-all-labels', refetchLabels);
    socket.on('create-label', async ({ name, color }) => {
        await supabaseService.from('labels').insert({ user_id: userId, name, color });
        await refetchLabels();
    });
    socket.on('delete-label', async (labelId) => {
        await supabaseService.from('chat_labels').delete().eq('label_id', labelId).eq('user_id', userId);
        await supabaseService.from('labels').delete().eq('id', labelId).eq('user_id', userId);
        await refetchLabels();
    });
    socket.on('assign-label', async ({ chatId, labelId }) => {
        await supabaseService.from('chat_labels').upsert({ chat_id: chatId, label_id: labelId, user_id: userId });
        await refetchLabels();
    });
    socket.on('unassign-label', async ({ chatId, labelId }) => {
        await supabaseService.from('chat_labels').delete().match({ chat_id: chatId, label_id: labelId, user_id: userId });
        await refetchLabels();
    });
});

async function syncAndEmitChats(userId, client) {
    const socketId = userSockets.get(userId);
    if (!socketId) return;

    try {
        const { data: dbChats } = await supabaseService
            .from('chats')
            .select('id, name, is_group, last_message_body, last_message_timestamp')
            .eq('user_id', userId)
            .order('last_message_timestamp', { ascending: false });

        if (dbChats && dbChats.length > 0) {
            const initialChatList = dbChats.map(c => ({
                id: c.id,
                name: c.name,
                isGroup: c.is_group,
                lastMessage: c.last_message_body ? {
                    body: c.last_message_body,
                    timestamp: new Date(c.last_message_timestamp).getTime() / 1000,
                    fromMe: false 
                } : null,
                profilePicUrl: null
            }));
            io.to(socketId).emit('chats', initialChatList);
        }
    } catch (e) {}
   
    try {
        const liveChats = await client.getChats();
        
        const chatRecords = liveChats.map(c => ({
            id: c.id._serialized,
            user_id: userId,
            name: c.name || c.id.user,
            is_group: c.isGroup,
        }));
        await supabaseService.from('chats').upsert(chatRecords, { onConflict: 'id', ignoreDuplicates: false });
        
        let finalChatList = liveChats.map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user,
            isGroup: c.isGroup,
            lastMessage: c.lastMessage || null,
            profilePicUrl: null
        }));
        
        finalChatList.sort((a, b) => {
            const aTime = a.lastMessage ? a.lastMessage.timestamp : 0;
            const bTime = b.lastMessage ? b.lastMessage.timestamp : 0;
            return bTime - aTime;
        });
        
        io.to(socketId).emit('chats', finalChatList);

        (async () => {
            const CHUNK_SIZE = 10;
            for (let i = 0; i < liveChats.length; i += CHUNK_SIZE) {
                const chunk = liveChats.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(async (c) => {
                    try {
                        const profilePicUrl = await c.getProfilePicUrl();
                        if (profilePicUrl) {
                            const userSocketId = userSockets.get(userId);
                            if (userSocketId) {
                                io.to(userSocketId).emit('chat-profile-pic-update', {
                                    chatId: c.id._serialized,
                                    profilePicUrl: profilePicUrl
                                });
                            }
                        }
                    } catch (e) {}
                }));
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        })();
    } catch(e) {}
}

async function initializeClientForUser(userId, socketId) {
    if (clients.has(userId)) {
        const client = clients.get(userId);
        try {
            const state = await client.getState();
            if (state === 'CONNECTED') {
                io.to(socketId).emit('connected', true);
                syncAndEmitChats(userId, client);
            } else {
                io.to(socketId).emit('connected', false);
            }
        } catch (e) {
            clients.delete(userId);
        }
        if (clients.has(userId)) return;
    }
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--single-process'
            ]
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1028964986.html',
        },
    });
    client.on('qr', async (qr) => {
        const qrImageUrl = await qrcode.toDataURL(qr);
        const userSocketId = userSockets.get(userId);
        if (userSocketId) io.to(userSocketId).emit('qr', qrImageUrl);
    });
    client.on('ready', async () => {
        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
            io.to(userSocketId).emit('connected', true);
            syncAndEmitChats(userId, client);
        }
    });
    
    // --- Webhook Trigger Logic ---
    const triggerWebhook = async (message, eventType, userId) => {
        try {
            const { data: webhooks } = await supabaseService
                .from('webhooks')
                .select('url')
                .eq('user_id', userId)
                .eq(eventType === 'message.sent' ? 'on_message_sent' : 'on_message_received', true);
            
            if (webhooks && webhooks.length > 0) {
                const payload = { event: eventType, timestamp: new Date().toISOString(), data: message };
                webhooks.forEach(hook => axios.post(hook.url, payload).catch(e => console.error(`Webhook fail: ${e.message}`)));
            }
        } catch (e) {
            console.error("Webhook trigger error:", e.message);
        }
    };

    client.on('message_create', async (message) => {
        clientLastActivity.set(userId, new Date());
        
        // Save to DB
        const chatId = message.fromMe ? message.to : message.from;
        try {
            await supabaseService.from('messages').insert({
                id: message.id._serialized,
                chat_id: chatId,
                user_id: userId,
                body: message.body,
                from_me: message.fromMe,
                timestamp: new Date(message.timestamp * 1000).toISOString(),
                type: message.type,
                has_media: message.hasMedia,
            });
            await supabaseService.from('chats').upsert({
                id: chatId,
                user_id: userId,
                last_message_body: message.body || (message.hasMedia ? '📷 Media' : `[${message.type}]`),
                last_message_timestamp: new Date(message.timestamp * 1000).toISOString(),
            }, { onConflict: 'id' });
        } catch (e) {}

        // Trigger Webhooks
        const eventType = message.fromMe ? 'message.sent' : 'message.received';
        triggerWebhook({
            id: message.id._serialized,
            body: message.body,
            from: message.from,
            to: message.to,
            hasMedia: message.hasMedia,
            timestamp: message.timestamp
        }, eventType, userId);

        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
            let profilePicUrl = null;
            let chatName = chatId.split('@')[0];
            let isGroup = false;
            try {
                const chat = await message.getChat();
                isGroup = chat.isGroup;
                chatName = chat.name || chat.id.user;
                profilePicUrl = await chat.getProfilePicUrl();
            } catch(e) {}

            io.to(userSocketId).emit('new-message', {
                id: message.id._serialized,
                body: message.body,
                type: message.type,
                timestamp: message.timestamp,
                from: message.from,
                to: message.to,
                fromMe: message.fromMe,
                hasMedia: message.hasMedia,
                media: undefined,
                isVoiceMessage: message.isVoiceMessage,
                chatId: chatId,
                profilePicUrl: profilePicUrl,
                chatName: chatName,
                isGroup: isGroup,
            });
        
            if (message.hasMedia) {
                message.downloadMedia().then(media => {
                    if (media) {
                        io.to(userSocketId).emit('message-media-update', {
                            chatId: chatId,
                            messageId: message.id._serialized,
                            media: media,
                        });
                    }
                }).catch(e => {});
            }
        }
    });
   
    client.on('disconnected', (reason) => {
        const userSocketId = userSockets.get(userId);
        if (userSocketId) io.to(userSocketId).emit('connected', false);
    });
    clients.set(userId, client);
    try {
        await client.initialize();
    } catch (error) {
        clients.delete(userId);
    }
}

async function destroyClientForUser(userId) {
    const client = clients.get(userId);
    if (!client) return;
    try { await client.destroy(); } catch(e) {}
    clients.delete(userId);
    const sessionPath = path.join('.wwebjs_auth', `session-${userId}`);
    try { await fs.rm(sessionPath, { recursive: true, force: true }); } catch (error) {}
}

// --- API Endpoints con Corrección de Mapeo de Campos y Uso de Service Role ---

const authenticateApi = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Token missing' });
    const token = authHeader.split(' ')[1];
    
    // Validar token con cliente anónimo
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return res.status(401).json({ success: false, error: 'Invalid token' });
    
    req.userId = user.id;
    next();
};

// Middleware para API Key (X-API-KEY header)
const authenticateApiKeyOnly = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'x-api-key header is required.' });
    }
   
    try {
        // Consultar directamente la tabla api_config usando Service Role
        const { data, error } = await supabaseService
            .from('api_config')
            .select('user_id')
            .eq('api_key', apiKey)
            .eq('enabled', true)
            .single();

        if (error || !data) {
            return res.status(403).json({ success: false, error: 'Invalid API Key.' });
        }
        
        req.userId = data.user_id;
        next();
    } catch (error) {
        console.error('API Key Authentication Error:', error.message);
        return res.status(500).json({ success: false, error: 'Server error during API key validation.' });
    }
};

// --- Endpoints para la Web App (React) ---

// API Key (Map camelCase to snake_case)
app.get('/api/api-key', authenticateApi, async (req, res) => {
    // Lectura usa Service Role para asegurar acceso
    const { data, error } = await supabaseService.from('api_config').select('enabled, api_key').eq('user_id', req.userId).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ success: false, error: error.message });
    
    // Map snake_case to camelCase for frontend
    res.json({ success: true, apiConfig: data ? { enabled: data.enabled, apiKey: data.api_key } : { enabled: false, apiKey: '' } });
});

app.post('/api/api-key', authenticateApi, async (req, res) => {
    const { enabled, apiKey } = req.body;
    // Usar Service Role para bypass RLS
    const { error } = await supabaseService.from('api_config').upsert({ 
        user_id: req.userId, 
        enabled: enabled,
        api_key: apiKey // Map correct column name
    }, { onConflict: 'user_id' });
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

// Quick Replies
app.get('/api/quick-replies', authenticateApi, async (req, res) => {
    const { data, error } = await supabaseService.from('quick_replies').select('*').eq('user_id', req.userId);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, quickReplies: data || [] });
});

app.post('/api/quick-replies', authenticateApi, async (req, res) => {
    // Campos coinciden, pero usamos Service Role y check de error
    const { error } = await supabaseService.from('quick_replies').insert({ user_id: req.userId, ...req.body });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

app.delete('/api/quick-replies/:id', authenticateApi, async (req, res) => {
    const { error } = await supabaseService.from('quick_replies').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

// Webhooks (Map camelCase to snake_case)
app.get('/api/webhooks', authenticateApi, async (req, res) => {
    const { data, error } = await supabaseService.from('webhooks').select('*').eq('user_id', req.userId);
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    // Map to frontend expected format
    const mapped = (data || []).map(w => ({
        url: w.url,
        onMessageReceived: w.on_message_received,
        onMessageSent: w.on_message_sent
    }));
    
    res.json({ success: true, webhooks: mapped });
});

app.post('/api/webhooks', authenticateApi, async (req, res) => {
    const { url, onMessageReceived, onMessageSent } = req.body;
    
    const { error } = await supabaseService.from('webhooks').insert({ 
        user_id: req.userId,
        url: url,
        on_message_received: onMessageReceived, // Map Correctly
        on_message_sent: onMessageSent        // Map Correctly
    });
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

app.delete('/api/webhooks', authenticateApi, async (req, res) => {
    const { error } = await supabaseService.from('webhooks').delete().eq('url', req.body.url).eq('user_id', req.userId);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

app.get('/api/webhooks/status', authenticateApi, (req, res) => {
    res.json({ success: true, configured: !!serviceRoleKey });
});

// --- Endpoints Externos (n8n/API) ---

// RESTORED: Endpoint para enviar mensajes desde n8n
app.post('/api/send-message', authenticateApiKeyOnly, async (req, res) => {
    const userId = req.userId;
    const { chatId, text, media, isVoiceMessage } = req.body;
    console.log(`[API /send-message] Request for user ${userId} -> ${chatId}`);

    if (!chatId) return res.status(400).json({ success: false, error: 'Recipient "chatId" is required.' });
    if (!text && !media) return res.status(400).json({ success: false, error: 'Either "text" or "media" is required.' });
    
    let convertedAudioPath = null;
    try {
        const client = clients.get(userId);
        const clientState = client ? await client.getState() : 'NOT_FOUND';
        if (!client || clientState !== 'CONNECTED') {
            return res.status(409).json({ success: false, error: `WhatsApp client is not connected.` });
        }

        let messageContent;
        let options = {};
       
        if (media && media.base64 && media.mimetype && isVoiceMessage) {
            convertedAudioPath = await convertAudioToOggOpus(media.base64, media.mimetype);
            messageContent = MessageMedia.fromFilePath(convertedAudioPath);
            
            // CRITICAL FIX FOR PTT: Force correct mimetype
            messageContent.mimetype = 'audio/ogg; codecs=opus';
            
            options.sendAudioAsVoice = true;
            
            // NOTE: Do not set options.caption if it's a voice message, or WA treats it as a file.
            // if (text) options.caption = text; 
        } else if (media && media.base64 && media.mimetype) {
             messageContent = new MessageMedia(media.mimetype, media.base64, media.filename);
             if (text) options.caption = text;
        } else {
            messageContent = text;
        }

        const sentMessage = await client.sendMessage(chatId, messageContent, options);
        res.json({ success: true, messageId: sentMessage.id._serialized });
    } catch (error) {
        console.error(`[API /send-message] Error:`, error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (convertedAudioPath) {
            await fs.unlink(convertedAudioPath).catch(() => {});
        }
    }
});

// --- SPA Fallback ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Server Start ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Multi-tenant server started on port ${PORT}`);
});