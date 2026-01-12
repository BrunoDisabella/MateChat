
import { whatsappService } from '../services/whatsapp.service.js';

export const getLabels = async (req, res) => {
    try {
        const client = whatsappService.getClient(req.userId);
        if (!client) {
            // Si el cliente se está inicializando, retornamos vacío en lugar de error 503 para no romper UI
            return res.json({ success: true, labels: [] });
        }

        let nativeLabels = [];
        try {
            nativeLabels = await client.getLabels();
        } catch (err) {
            console.warn("Client not ready yet or labels fetch failed", err);
            return res.json({ success: true, labels: [] });
        }

        const formattedLabels = nativeLabels.map(l => ({
            id: l.id,
            name: l.name,
            color: l.color ? `#${l.color.toString(16)}` : null
        }));

        res.json({ success: true, labels: formattedLabels });
    } catch (e) {
        console.error('API List Labels Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const assignLabel = async (req, res) => {
    try {
        const { chatId, phone, label } = req.body;
        const targetId = chatId || phone;

        if (!targetId || !label) return res.status(400).json({ success: false, error: 'Faltan datos: (chatId o phone) y label.' });

        const client = whatsappService.getClient(req.userId);
        if (!client) return res.status(503).json({ success: false, error: 'WhatsApp no está conectado.' });

        const allLabels = await client.getLabels();
        const targetLabel = allLabels.find(l =>
            l.id === label || l.name.trim().toLowerCase() === label.trim().toLowerCase()
        );

        let labelIdToAssign = targetLabel ? targetLabel.id : null;
        if (!labelIdToAssign && !isNaN(label)) labelIdToAssign = label;

        if (!labelIdToAssign) return res.status(404).json({ success: false, error: `No se encontró la etiqueta: '${label}'` });

        // DELEGATE TO SERVICE
        await whatsappService.updateChatLabels(req.userId ? req.userId : 'default-user', targetId, [labelIdToAssign], 'add');

        res.json({ success: true, message: `Etiqueta asignada.` });
    } catch (e) {
        console.error('API Assign Label Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const removeLabel = async (req, res) => {
    try {
        const { chatId, phone, label } = req.body;
        const targetId = chatId || phone;

        if (!targetId || !label) return res.status(400).json({ success: false, error: 'Faltan datos: (chatId o phone) y label.' });

        const client = whatsappService.getClient(req.userId);
        if (!client) return res.status(503).json({ success: false, error: 'WhatsApp no está conectado.' });

        const allLabels = await client.getLabels();
        const targetLabel = allLabels.find(l =>
            l.id === label || l.name.trim().toLowerCase() === label.trim().toLowerCase()
        );

        let labelIdToRemove = targetLabel ? targetLabel.id : null;
        if (!labelIdToRemove && !isNaN(label)) labelIdToRemove = label;

        if (!labelIdToRemove) return res.status(404).json({ success: false, error: `Etiqueta no encontrada.` });

        // DELEGATE TO SERVICE
        await whatsappService.updateChatLabels(req.userId ? req.userId : 'default-user', targetId, [labelIdToRemove], 'remove');

        res.json({ success: true, message: 'Etiqueta eliminada.' });
    } catch (e) {
        console.error('API Remove Label Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};
