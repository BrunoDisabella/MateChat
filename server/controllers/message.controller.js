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

        // Check if chat exists before sending
        let chat;
        try {
            chat = await client.getChatById(formattedPhone);
        } catch (e) {
            console.warn(`[API] Check chat failed for ${formattedPhone}:`, e.message);
        }

        if (!chat) {
            // Attempt to send blindly if checks fail (legacy behavior), but log it
            console.warn(`[API] Chat object not found for ${formattedPhone}. Trying client.sendMessage directly.`);
            // NOTE: If this fails with 'getChat' error, it means the number is invalid or not registered.
        }

        let response;
        if (mediaUrl) {
            const textToSend = targetMessage ? `${targetMessage}\n\n${mediaUrl}` : mediaUrl;
            response = await client.sendMessage(formattedPhone, textToSend);
        } else {
            console.log(`[API] Sending text to ${formattedPhone}`);
            // Prefer chat.sendMessage if chat object exists (more stable)
            if (chat) {
                response = await chat.sendMessage(targetMessage);
            } else {
                response = await client.sendMessage(formattedPhone, targetMessage);
            }
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
