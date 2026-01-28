import { whatsappBaileysService } from '../services/whatsapp-baileys.service.js';
import { messageQueue } from '../services/messageQueue.service.js';
import { logApi } from '../services/logger.service.js';
import { convertToOpus } from '../utils/media.utils.js';

// TODO: Este controller necesita refactoring completo para Baileys
// Por ahora devolvemos error 501 Not Implemented

export const sendMessage = async (req, res) => {
    return res.status(501).json({
        error: 'sendMessage API endpoint temporarily disabled during Baileys migration',
        message: 'Use the frontend UI to send messages for now'
    });
};

export const sendBulkMessages = async (req, res) => {
    return res.status(501).json({
        error: 'sendBulkMessages API endpoint temporarily disabled during Baileys migration'
    });
};

export const getMessages = async (req, res) => {
    return res.status(501).json({
        error: 'getMessages API endpoint temporarily disabled during Baileys migration'
    });
};
