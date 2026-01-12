import { whatsappService } from '../services/whatsapp.service.js';

export const sendMessage = async (req, res) => {
    try {
        const { phone, message, mediaUrl, chatId, text } = req.body;
        const userId = req.userId || 'default-user'; // Viene del middleware

        // Alias mapping: Support both new (phone/message) and legacy (chatId/text) params
        let targetPhone = phone || chatId;
        const targetMessage = message || text;

        if (!targetPhone || (!targetMessage && !mediaUrl)) {
            return res.status(400).json({
                error: 'Missing required fields: phone (or chatId) AND message (or text/mediaUrl)'
            });
        }

        const client = whatsappService.getClient(userId);
        if (!client) {
            return res.status(503).json({ error: 'WhatsApp client not initialized or ready' });
        }

        // Validate and Format Phone/ChatId
        // If it looks like a valid serialized ID (contains @c.us or @g.us), use it as is.
        // Otherwise, treat as raw number and format to @c.us
        let formattedPhone = targetPhone;
        if (!targetPhone.includes('@')) {
            formattedPhone = targetPhone.replace(/\D/g, '') + '@c.us';
        }

        let response;
        if (mediaUrl) {
            // TODO: Implementar envío de medios por URL (requires whatsapp-web.js MessageMedia.fromUrl)
            // Por ahora, mensaje de texto con link
            const textToSend = targetMessage ? `${targetMessage}\n\n${mediaUrl}` : mediaUrl;
            response = await client.sendMessage(formattedPhone, textToSend);
        } else {
            response = await client.sendMessage(formattedPhone, targetMessage);
        }

        return res.json({
            success: true,
            messageId: response.id._serialized,
            timestamp: response.timestamp
        });

    } catch (error) {
        console.error('API Send Message Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
