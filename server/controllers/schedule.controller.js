/**
 * Schedule Controller - Endpoints para mensajes y estados programados
 */

import { schedulerService } from '../services/scheduler.service.js';

// POST /api/schedule/message - Crear mensaje programado
export const createScheduledMessage = async (req, res) => {
    try {
        const { chatId, phone, body, mediaUrl, mediaType, scheduledTime } = req.body;

        if (!body || !scheduledTime) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: body, scheduledTime'
            });
        }

        if (!chatId && !phone) {
            return res.status(400).json({
                success: false,
                error: 'Falta chatId o phone'
            });
        }

        const targetChatId = chatId || phone;

        const result = await schedulerService.createScheduledMessage({
            userId: req.userId || 'default-user',
            chatId: targetChatId,
            body,
            mediaUrl,
            mediaType,
            scheduledTime
        });

        res.json({
            success: true,
            message: 'Mensaje programado correctamente',
            data: result
        });

    } catch (error) {
        console.error('[Schedule] Create message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/schedule/messages - Listar mensajes programados
export const listScheduledMessages = async (req, res) => {
    try {
        const messages = await schedulerService.listScheduledMessages(req.userId);
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('[Schedule] List messages error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// DELETE /api/schedule/message/:id - Eliminar mensaje programado
export const deleteScheduledMessage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Falta el ID del mensaje' });
        }

        await schedulerService.deleteScheduledMessage(id, req.userId);
        res.json({ success: true, message: 'Mensaje eliminado' });

    } catch (error) {
        console.error('[Schedule] Delete message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/schedule/status - Crear estado programado
export const createScheduledStatus = async (req, res) => {
    try {
        const { content, mediaUrl, mediaType, scheduledTime } = req.body;

        if (!scheduledTime) {
            return res.status(400).json({
                success: false,
                error: 'Falta scheduledTime'
            });
        }

        if (!content && !mediaUrl) {
            return res.status(400).json({
                success: false,
                error: 'Falta content o mediaUrl'
            });
        }

        const result = await schedulerService.createScheduledStatus({
            userId: req.userId || 'default-user',
            content,
            mediaUrl,
            mediaType,
            scheduledTime
        });

        res.json({
            success: true,
            message: 'Estado programado correctamente',
            data: result
        });

    } catch (error) {
        console.error('[Schedule] Create status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/schedule/statuses - Listar estados programados
export const listScheduledStatuses = async (req, res) => {
    try {
        const statuses = await schedulerService.listScheduledStatuses(req.userId);
        res.json({ success: true, data: statuses });
    } catch (error) {
        console.error('[Schedule] List statuses error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// DELETE /api/schedule/status/:id - Eliminar estado programado
export const deleteScheduledStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Falta el ID del estado' });
        }

        await schedulerService.deleteScheduledStatus(id, req.userId);
        res.json({ success: true, message: 'Estado eliminado' });

    } catch (error) {
        console.error('[Schedule] Delete status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
