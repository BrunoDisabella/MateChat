
export const authenticateApiKeyOnly = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY || 'matechat-secret-local'; // Fallback para dev

    console.log(`[Auth] Received Key: '${apiKey}' | Expected: '${validApiKey}'`);
    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }

    req.userId = 'default-user'; // Hardcoded para MVP single-user
    next();
};
