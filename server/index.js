
import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { config } from './config/index.js';
import { socketService } from './services/socket.service.js';
import { whatsappService } from './services/whatsapp.service.js';
import { schedulerService } from './services/scheduler.service.js';
import apiRoutes from './routes/api.routes.js';

const app = express();
const server = http.createServer(app);

// Debug: Log early request
app.use((req, res, next) => {
    console.log(`[Server] Incoming request: ${req.method} ${req.url} from ${req.ip}`);
    next();
});

// Config basic
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
// whatsappService.initializeClient() removed for multi-tenancy. Clients are initialized on socket connection.
whatsappService.restoreSessions(); // Restore persisted sessions on boot

// Initialize and start Scheduler Service
schedulerService.initialize();
schedulerService.start();

// Start Server
server.listen(config.port, () => {
    console.log(`
    🚀 Server running on port ${config.port}
    - API: /api
    - Webhook Target: ${config.n8nWebhookUrl || 'Not configured'}
    `);
});

// Tuning Timeouts
server.keepAliveTimeout = 65000; // Ensure it's larger than load balancer timeout
server.headersTimeout = 66000;
server.requestTimeout = 0; // Disable default timeout for testing
