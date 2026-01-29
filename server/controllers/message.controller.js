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
        let { text, audioBase64, audioMime, imageBase64, imageMime, caption } = body;

        if (body.media) {
            if (body.media.mimetype && body.media.mimetype.startsWith('audio')) {
                audioBase64 = body.media.base64 || body.media.data;
                audioMime = body.media.mimetype;
            } else if (body.media.mimetype && body.media.mimetype.startsWith('image')) {
                imageBase64 = body.media.base64 || body.media.data;
                imageMime = body.media.mimetype;
                caption = body.caption || body.media.caption || caption;
            }
        }

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: to (or chatId)'
            });
        }

        // Normalizar número de teléfono a formato Baileys
        // Si viene en formato @c.us, convertir a @s.whatsapp.net
        let jid = to;
        if (to.includes('@c.us')) {
            jid = to.replace('@c.us', '@s.whatsapp.net');
        } else if (!to.includes('@')) {
            jid = `${to}@s.whatsapp.net`;
        }

        let result;

        // Caso 1: Nota de voz (audio)
        if (audioBase64 && audioMime) {
            logApi(userId, 'send-voice-note', { to: jid });

            // Convertir audio a formato Opus (requerido por WhatsApp)
            // convertToOpus espera string base64, no Buffer
            const opusBase64 = await convertToOpus(audioBase64);
            const opusBuffer = Buffer.from(opusBase64, 'base64');

            // Enviar como nota de voz (PTT)
            result = await whatsappBaileysService.sendAudio(userId, jid, opusBuffer);

            return res.json({
                success: true,
                messageId: result.key.id,
                timestamp: result.messageTimestamp
            });
        }

        // Caso 2: Imagen
        if (imageBase64 && imageMime) {
            logApi(userId, 'send-image', { to: jid });

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

