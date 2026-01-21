import { whatsappService } from '../services/whatsapp.service.js';
import { messageQueue } from '../services/messageQueue.service.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { logApi } from '../services/logger.service.js';
import { convertToOpus } from '../utils/media.utils.js';

// Helper to convert audio to WA-compatible OGG/Opus
// Moved to ../utils/media.utils.js

export const sendMessage = async (req, res) => {
    try {
        console.log(`[API] sendMessage request received. Body size ~${JSON.stringify(req.body).length} bytes`);

        const { phone, message, mediaUrl, chatId, text } = req.body;
        const userId = req.userId || 'default-user'; // Viene del middleware

        // Alias mapping: Support both new (phone/message) and legacy (chatId/text) params
        let targetPhone = phone || chatId;
        const targetMessage = message || text;

        if (!targetPhone || (!targetMessage && !mediaUrl && !req.body.media)) {
            console.warn('[API] Missing required fields in sendMessage');
            return res.status(400).json({
                error: 'Missing required fields: phone (or chatId) AND message (or text/mediaUrl)'
            });
        }

        let client = whatsappService.getClient(userId);
        if (!client) {
            console.warn(`[API] WhatsApp client for ${userId} not found. Attempting to initialize...`);
            // Attempt to restore/initialize
            try {
                whatsappService.initializeClient(userId);
                // Return 503 Service Unavailable so the caller knows to retry
                return res.status(503).json({
                    error: 'WhatsApp client was not running. Initialization started. Please retry in 10 seconds.',
                    retryAfter: 10
                });
            } catch (initError) {
                console.error('[API] Failed to re-initialize client:', initError);
                return res.status(500).json({ error: 'WhatsApp client unreachable and failed to restart.' });
            }
        }

        // Validate and Format Phone/ChatId
        // If it looks like a valid serialized ID (contains @c.us or @g.us), use it as is.
        // Otherwise, treat as raw number and format to @c.us
        let formattedPhone = targetPhone;
        if (!targetPhone.includes('@')) {
            formattedPhone = targetPhone.replace(/\D/g, '') + '@c.us';
        }

        // Capturar datos necesarios para el job ANTES de responder
        const mediaData = req.body.media ? { ...req.body.media } : null;
        const caption = req.body.caption || targetMessage;

        logApi(`Queueing message for ${formattedPhone}.`, {
            hasMedia: !!(mediaData || mediaUrl),
            textLength: targetMessage?.length
        });

        // ENCOLAR el trabajo - NO ejecutar inmediatamente
        // La cola procesará secuencialmente para evitar saturación
        messageQueue.enqueue(userId, async () => {
            // Re-obtener cliente dentro del job por si cambió
            const currentClient = whatsappService.getClient(userId);
            if (!currentClient) {
                throw new Error(`Client ${userId} no longer available`);
            }

            logApi(`[Queue Job] Starting send to ${formattedPhone}`);

            if (mediaData && mediaData.base64) {
                let { base64, mimetype, filename } = mediaData;

                // Validate & Clean Base64
                if (typeof base64 !== 'string') {
                    throw new Error('Media base64 must be a string');
                }

                // Remove common data URI prefixes if present
                base64 = base64.replace(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/, '');

                let finalMime = mimetype || 'image/jpeg';

                const options = { sendSeen: false };
                if (caption) options.caption = caption;

                // Auto-detect voice note intent
                if (finalMime.startsWith('audio/')) {
                    options.sendAudioAsVoice = true;
                    logApi('[Queue Job] Detected Audio: Converting to Opus/OGG...');
                    try {
                        base64 = await convertToOpus(base64);
                        finalMime = 'audio/ogg; codecs=opus';
                        logApi('[Queue Job] Audio Conversion Successful');
                    } catch (conversionError) {
                        console.error('Audio conversion failed, sending original:', conversionError);
                        logApi('[Queue Job] Audio Conversion Failed', conversionError);
                    }
                }

                console.log(`[Queue Job] Processing MEDIA. Mime: ${finalMime}, Length: ${base64.length}`);

                const media = new MessageMedia(finalMime, base64, filename);

                try {
                    await currentClient.sendMessage(formattedPhone, media, options);
                    logApi(`[Queue Job] MEDIA Sent Successfully to ${formattedPhone}`);
                } catch (sendError) {
                    logApi(`[Queue Job] Primary Send Failed`, sendError);

                    // Fallback: Try sending without voice note flag
                    if (options.sendAudioAsVoice) {
                        logApi('[Queue Job] Retrying voice note as document...');
                        delete options.sendAudioAsVoice;
                        await currentClient.sendMessage(formattedPhone, media, options);
                        logApi(`[Queue Job] Fallback MEDIA Sent Successfully`);
                    } else {
                        throw sendError;
                    }
                }
            } else if (mediaUrl) {
                // Legacy mediaUrl (URL text message)
                const textToSend = targetMessage ? `${targetMessage}\n\n${mediaUrl}` : mediaUrl;
                await currentClient.sendMessage(formattedPhone, textToSend, { sendSeen: false });
                logApi(`[Queue Job] URL Message Sent to ${formattedPhone}`);
            } else {
                console.log(`[Queue Job] Sending text to ${formattedPhone}`);
                await currentClient.sendMessage(formattedPhone, targetMessage, { sendSeen: false });
                logApi(`[Queue Job] Text Message Sent to ${formattedPhone}`);
            }
        }).then(() => {
            // Éxito (el log ya se hizo dentro del job)
        }).catch((error) => {
            console.error(`[Queue] FAILED to send message to ${formattedPhone}:`, error.message);
            logApi(`[Queue] FATAL ERROR sending to ${formattedPhone}`, error);
        });

        // Respond IMMEDIATELY - el trabajo está encolado
        res.json({
            success: true,
            status: 'queued',
            timestamp: Date.now(),
            queueStats: messageQueue.getStats(),
            note: 'Message is queued for processing'
        });

    } catch (error) {
        console.error('API Send Message Error:', error);
        logApi('API Controller Error', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message });
        }
    }
};

