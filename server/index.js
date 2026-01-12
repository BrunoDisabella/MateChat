
import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { config } from './config/index.js';
import { socketService } from './services/socket.service.js';
import { whatsappService } from './services/whatsapp.service.js';
import apiRoutes from './routes/api.routes.js';

const app = express();
const server = http.createServer(app);

// Config basic
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Static files (Frontend Build)
app.use(express.static(config.paths.dist));

// Catch-all for SPA
app.get(/.*/, (req, res) => {
    const indexPath = path.join(config.paths.dist, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback dev msg
        res.send('MateChat API Server Running. Frontend not built in dist/.');
    }
});

// Initialize Services
socketService.initialize(server);
whatsappService.initializeClient(); // Default user

// Start Server
server.listen(config.port, () => {
    console.log(`
    🚀 Server running on port ${config.port}
    - API: /api
    - Webhook Target: ${config.n8nWebhookUrl || 'Not configured'}
    `);
});
