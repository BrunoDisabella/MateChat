
import { settingsService } from '../services/settings.service.js';

export const authenticateApiKeyOnly = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
    }

    try {
        const userSettings = await settingsService.getByApiKey(apiKey);

        if (!userSettings) {
            // Fallback para desarrollo local simplificado si no hay DB
            const localKey = process.env.API_KEY || 'matechat-secret-local';
            if (apiKey === localKey) {
                console.log('[Auth] Using fallback local key');
                req.userId = 'default-user';
                return next();
            }
            return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
        }

        req.userId = userSettings.user_id;
        next();
    } catch (error) {
        console.error('[Auth] Error validating API key:', error);
        res.status(500).json({ error: 'Internal Server Error during authentication' });
    }
};
