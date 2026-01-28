import { whatsappBaileysService } from '../services/whatsapp-baileys.service.js';

// TODO: Este controller necesita refactoring completo para Baileys
// Por ahora devolvemos error 501 Not Implemented

export const postStatus = async (req, res) => {
    return res.status(501).json({
        error: 'Status API temporarily disabled during Baileys migration'
    });
};

export const getStatuses = async (req, res) => {
    return res.status(501).json({
        error: 'Status API temporarily disabled during Baileys migration'
    });
};
