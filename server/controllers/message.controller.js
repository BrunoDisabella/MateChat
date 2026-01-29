import { whatsappBaileysService } from '../services/whatsapp-baileys.service.js';
import { messageQueue } from '../services/messageQueue.service.js';
import { logApi } from '../services/logger.service.js';
import { convertToOpus } from '../utils/media.utils.js';

/**
 * Enviar mensaje de texto, imagen o audio
 * Compatible con la API anterior de whatsapp-web.js
 */
export const sendMessage = async (req, res) => {
    try {
        const userId = req.userId; // Set by auth middleware
        const body = req.body;

        // Compatibilidad: aceptar 'chatId' como alias de 'to'
        const to = body.to || body.chatId;

        // Compatibilidad: aceptar objeto 'media' (n8n legacy structure)
        let { text, audioBase64, audioMime, imageBase64, imageMime, caption, ptt } = body;

        // Log completo para depuración
        logApi(userId, 'debug-payload', {
            keys: Object.keys(body),
            mediaKeys: body.media ? Object.keys(body.media) : null,
            hasAudio: !!(body.audioBase64 || (body.media && body.media.mimetype?.startsWith('audio'))),
            mimetype: body.audioMime || body.media?.mimetype
        });

        if (body.media) {
            if (body.media.mimetype && body.media.mimetype.startsWith('audio')) {
                audioBase64 = body.media.base64 || body.media.data;
                audioMime = body.media.mimetype;
                audioMime = body.media.mimetype;
                // FORCE PTT: Siempre enviar como nota de voz
                ptt = true;
            } else if (body.media.mimetype && body.media.mimetype.startsWith('image')) {
                imageBase64 = body.media.base64 || body.media.data;
                imageMime = body.media.mimetype;
                caption = body.caption || body.media.caption || caption;
            }
        }

        // FORCE PTT: Asegurar que siempre sea true incluso si no viene en media
        ptt = true;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: to (or chatId)'
            });
        }

        // Normalizar número de teléfono a formato Baileys
        // Si viene en formato @c.us, convertir a @s.whatsapp.net
        // Si parece un LID (15 dígitos aprox), convertir a @lid
        let jid = to;
        if (to.includes('@c.us')) {
            jid = to.replace('@c.us', '@s.whatsapp.net');
        } else if (to.includes('@lid') || to.includes('@s.whatsapp.net') || to.includes('@g.us')) {
            jid = to; // Ya está correcto
        } else {
            // No tiene sufijo, determinar automáticamente
            const potentialJid = `${to}@s.whatsapp.net`;

            // Si es corto, seguro es teléfono
            if (to.length < 15) {
                jid = potentialJid;
            } else {
                // Si es largo, podría ser LID o teléfono
                // Verificar si existe como teléfono
                console.log(`[API] Verifying if ${to} is a valid phone number...`);
                const onWa = await whatsappBaileysService.checkOnWhatsApp(userId, potentialJid);

                if (onWa && onWa.exists) {
                    jid = potentialJid;
                    console.log(`[API] ✅ Resolved ${to} to phone number (verified): ${jid}`);
                } else {
                    jid = `${to}@lid`;
                    logApi(userId, 'detect-lid-recipient', { to, jid });
                    console.log(`[API] ⚠️ Resolved ${to} to LID (fallback): ${jid}`);
                }
            }
        }

        let result;

        // Caso 1: Audio (Nota de voz ENFORCED)
        if (audioBase64 && audioMime) {
            logApi(userId, 'send-voice-note', { to: jid, forced_ptt: true });

            const audioBuffer = Buffer.from(audioBase64, 'base64');

            // Siempre convertir a Opus para nota de voz
            try {
                const opusBase64 = await convertToOpus(audioBase64);
                const opusBuffer = Buffer.from(opusBase64, 'base64');
                result = await whatsappBaileysService.sendAudio(userId, jid, opusBuffer, true); // ptt=true
            } catch (error) {
                console.error('[API] FFmpeg conversion failed:', error);
                return res.status(500).json({
                    success: false,
                    error: `Audio conversion failed: ${error.message}. Ensure ffmpeg is installed.`
                });
            }

            return res.json({
                success: true,
                messageId: result.key.id,
                timestamp: result.messageTimestamp
            });
        }

        // Caso 2: Imagen
        if (imageBase64 && imageMime) {
            logApi(userId, 'send-image', { to: jid, size: imageBase64.length, mime: imageMime });
            console.log(`[API] Sending Image to ${jid}. Size: ${imageBase64.length} chars. Mime: ${imageMime}`);

            const imageBuffer = Buffer.from(imageBase64, 'base64');
            result = await whatsappBaileysService.sendImage(
                userId,
                jid,
                imageBuffer,
                caption || ''
            );

            return res.json({
                success: true,
                messageId: result.key.id,
                timestamp: result.messageTimestamp
            });
        }

        // Caso 3: Mensaje de texto
        if (text) {
            logApi(userId, 'send-message', { to: jid });

            result = await whatsappBaileysService.sendMessage(userId, jid, text);

            console.log('[API] Message sent successfully. ID:', result?.key?.id);

            return res.json({
                success: true,
                messageId: result.key?.id || 'unknown',
                timestamp: result.messageTimestamp || Date.now()
            });
        }

        // Sin contenido
        return res.status(400).json({
            success: false,
            error: 'No message content provided (text, image, or audio required)'
        });

    } catch (error) {
        console.error('[API] Error sending message:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const sendBulkMessages = async (req, res) => {
    try {
        const userId = req.userId;
        const { messages } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'messages array is required'
            });
        }

        logApi(userId, 'send-bulk-messages', { count: messages.length });

        const results = [];
        for (const msg of messages) {
            try {
                let jid = msg.to;
                if (jid.includes('@c.us')) {
                    jid = jid.replace('@c.us', '@s.whatsapp.net');
                } else if (!jid.includes('@')) {
                    jid = `${jid}@s.whatsapp.net`;
                }

                const result = await whatsappBaileysService.sendMessage(userId, jid, msg.text);
                results.push({
                    to: msg.to,
                    success: true,
                    messageId: result.key.id
                });

                // Delay entre mensajes para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                results.push({
                    to: msg.to,
                    success: false,
                    error: error.message
                });
            }
        }

        return res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('[API] Error sending bulk messages:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getMessages = async (req, res) => {
    return res.status(501).json({
        error: 'getMessages API endpoint not yet implemented for Baileys'
    });
};

