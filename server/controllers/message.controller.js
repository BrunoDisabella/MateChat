import { whatsappService } from '../services/whatsapp.service.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

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

        const client = whatsappService.getClient(userId);
        if (!client) {
            console.error('[API] WhatsApp client not initialized');
            return res.status(503).json({ error: 'WhatsApp client not initialized or ready' });
        }

        // Validate and Format Phone/ChatId
        // If it looks like a valid serialized ID (contains @c.us or @g.us), use it as is.
        // Otherwise, treat as raw number and format to @c.us
        let formattedPhone = targetPhone;
        if (!targetPhone.includes('@')) {
            formattedPhone = targetPhone.replace(/\D/g, '') + '@c.us';
        }

        // Respond IMMEDIATELY to prevent timeout
        res.json({
            success: true,
            status: 'queued',
            timestamp: Date.now(),
            note: 'Message is processing in background'
        });

        // ---------------------------------------------------------
        // BACKGROUND PROCESSING (Async - No Await needed for Response)
        // ---------------------------------------------------------
        (async () => {
            try {
                // Check if chat exists before sending
                let chat;
                try {
                    chat = await client.getChatById(formattedPhone);
                } catch (e) {
                    console.warn(`[API - BG] Check chat failed for ${formattedPhone}:`, e.message);
                }

                if (!chat) {
                    // Attempt to send blindly if checks fail (legacy behavior), but log it
                    console.warn(`[API - BG] Chat object not found for ${formattedPhone}. Trying client.sendMessage directly.`);
                }

                if (req.body.media && req.body.media.base64) {
                    let { base64, mimetype, filename } = req.body.media;

                    // Validate & Clean Base64
                    if (typeof base64 !== 'string') {
                        throw new Error('Media base64 must be a string');
                    }
                    // Remove common data URI prefixes if present
                    base64 = base64.replace(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/, '');

                    const finalMime = mimetype || 'image/jpeg';
                    console.log(`[API - BG] Processing MEDIA. Mime: ${finalMime}, Length: ${base64.length}`);

                    const media = new MessageMedia(finalMime, base64, filename);

                    console.log(`[API - BG] Sending MEDIA to ${formattedPhone}`);

                    const options = {};
                    if (req.body.caption) options.caption = req.body.caption;
                    if (targetMessage) options.caption = targetMessage; // Priority to direct message param

                    // Auto-detect voice note intent
                    if (finalMime.startsWith('audio/')) {
                        options.sendAudioAsVoice = true; // Try to send as PTT
                        console.log('[API - BG] Detected Audio: Sending as Voice Note');
                    }

                    try {
                        await client.sendMessage(formattedPhone, media, options);
                    } catch (sendError) {
                        // Fallback: Try sending without voice note flag if it failed (maybe ffmpeg missing)
                        if (options.sendAudioAsVoice) {
                            console.warn('[API - BG] Voice Note failed (likely ffmpeg missing). Retrying as document...');
                            delete options.sendAudioAsVoice;
                            await client.sendMessage(formattedPhone, media, options);
                        } else {
                            throw sendError;
                        }
                    }
                } else if (mediaUrl) {
                    // Legacy mediaUrl (URL text message)
                    const textToSend = targetMessage ? `${targetMessage}\n\n${mediaUrl}` : mediaUrl;
                    await client.sendMessage(formattedPhone, textToSend);
                } else {
                    console.log(`[API - BG] Sending text to ${formattedPhone}`);
                    // Prefer chat.sendMessage if chat object exists (more stable)
                    if (chat) {
                        await chat.sendMessage(targetMessage);
                    } else {
                        await client.sendMessage(formattedPhone, targetMessage);
                    }
                }
                console.log(`[API - BG] Message sent successfully to ${formattedPhone}`);
            } catch (bgError) {
                console.error(`[API - BG] FAILED to send message to ${formattedPhone}:`, bgError);
            }
        })();

    } catch (error) {
        console.error('API Send Message Error:', error);
        // Only valid if response hasn't been sent yet (though we send it early now)
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message });
        }
    }
};

