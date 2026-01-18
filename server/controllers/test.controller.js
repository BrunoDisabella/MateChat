import { whatsappService } from '../services/whatsapp.service.js';

export const triggerTestWebhook = async (req, res) => {
    try {
        const testMsg = {
            id: { _serialized: 'TEST_MSG_ID_' + Date.now() },
            body: 'This is a test message from /api/debug/test-webhook',
            from: '1234567890@c.us',
            to: '0987654321@c.us',
            fromMe: true,
            type: 'chat',
            timestamp: Math.floor(Date.now() / 1000),
            hasMedia: false,
            getChat: async () => ({
                id: { _serialized: '0987654321@c.us' },
                isGroup: false,
                getLabels: async () => []
            }),
            getContact: async () => ({
                pushname: 'TestUser'
            })
        };

        // Simulate 'message_create' event (sent message)
        await whatsappService.handleWebhook(testMsg, 'message_create');

        res.json({ success: true, message: 'Test webhook triggered', target: testMsg });
    } catch (error) {
        console.error('Test webhook failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
