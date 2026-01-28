import { whatsappBaileysService } from '../services/whatsapp-baileys.service.js';

// TODO: Este controller necesita refactoring completo para Baileys
// Por ahora devolvemos error 501 Not Implemented

export const getLabels = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};

export const createLabel = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};

export const updateLabel = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};

export const deleteLabel = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};

export const assignLabel = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};

export const removeLabel = async (req, res) => {
    return res.status(501).json({
        error: 'Labels API temporarily disabled during Baileys migration'
    });
};
