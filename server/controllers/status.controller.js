/**
 * Status Controller - Endpoints para monitoreo de salud del sistema
 */

import { whatsappService } from '../services/whatsapp.service.js';

/**
 * GET /api/status - Estado general del servidor y clientes WhatsApp
 */
export const getStatus = async (req, res) => {
    try {
        const stats = whatsappService.getStats();
        const userId = req.userId || 'default-user';
        const clientState = whatsappService.getClientState(userId);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version
            },
            whatsapp: {
                currentUser: userId,
                currentUserState: clientState,
                ...stats
            }
        });
    } catch (error) {
        console.error('[Status] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/health - Verificación rápida de salud (para load balancers)
 */
export const healthCheck = async (req, res) => {
    try {
        const userId = req.userId;
        const client = whatsappService.getClient(userId);

        if (!client) {
            return res.status(503).json({
                healthy: false,
                reason: 'WhatsApp client not initialized',
                userId
            });
        }

        // Intentar obtener estado
        let state = 'UNKNOWN';
        try {
            state = await Promise.race([
                client.getState(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5000))
            ]);
        } catch (e) {
            return res.status(503).json({
                healthy: false,
                reason: `Failed to get state: ${e.message}`,
                userId
            });
        }

        if (state === 'CONNECTED') {
            return res.json({
                healthy: true,
                state,
                userId,
                timestamp: new Date().toISOString()
            });
        } else {
            return res.status(503).json({
                healthy: false,
                state,
                reason: `State is not CONNECTED`,
                userId
            });
        }
    } catch (error) {
        res.status(500).json({
            healthy: false,
            error: error.message
        });
    }
};

/**
 * POST /api/restart - Forzar reinicio del cliente WhatsApp
 */
export const forceRestart = async (req, res) => {
    try {
        const userId = req.userId || 'default-user';

        console.log(`[Status] Force restart requested for ${userId}`);
        await whatsappService.restartClient(userId);

        res.json({
            success: true,
            message: `Restart initiated for ${userId}`,
            note: 'Client will be ready in approximately 10-15 seconds'
        });
    } catch (error) {
        console.error('[Status] Force restart failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/force-cleanup - Limpieza forzada de sesión (para resolver procesos zombie)
 */
export const forceCleanup = async (req, res) => {
    try {
        const userId = req.userId || 'default-user';

        console.log(`[Status] Force cleanup requested for ${userId}`);

        // Primero matar procesos zombie
        await whatsappService.killZombieProcesses();

        // Luego limpiar la sesión específica
        await whatsappService.forceCleanupSession(userId);

        // Esperar un poco y reinicializar
        setTimeout(() => {
            whatsappService.initializeClient(userId);
        }, 2000);

        res.json({
            success: true,
            message: `Force cleanup completed for ${userId}`,
            note: 'Client will be re-initialized in 2 seconds'
        });
    } catch (error) {
        console.error('[Status] Force cleanup failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/kill-zombies - Matar todos los procesos Chrome zombie
 */
export const killZombies = async (req, res) => {
    try {
        console.log(`[Status] Kill zombies requested`);
        await whatsappService.killZombieProcesses();

        res.json({
            success: true,
            message: 'Zombie Chrome processes have been killed'
        });
    } catch (error) {
        console.error('[Status] Kill zombies failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
