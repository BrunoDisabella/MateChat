import { whatsappBaileysService } from '../services/whatsapp-baileys.service.js';

// TODO: Este controller necesita refactoring completo para Baileys
// Por ahora devolvemos error 501 Not Implemented

export const testConnection = async (req, res) => {
    const userId = req.userId || 'default-user';
    const isReady = whatsappBaileysService.isClientReady(userId);

    res.json({
        connected: isReady,
        userId,
        service: 'Baileys WebSocket',
        message: isReady ? 'WhatsApp client is connected' : 'WhatsApp client is not connected'
    });
};

export const getQR = async (req, res) => {
    return res.status(501).json({
        error: 'getQR API temporarily disabled - use frontend UI for QR scanning'
    });
};
