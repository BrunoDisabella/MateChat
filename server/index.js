
import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { config } from './config/index.js';
import { socketService } from './services/socket.service.js';
import { whatsappBaileysService } from './services/whatsapp-baileys.service.js';
import { settingsService } from './services/settings.service.js';
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

// Initialize Services (Order matters)
settingsService.initialize(); // Initialize DB connection first
socketService.initialize(server);
whatsappBaileysService.restoreExistingSessions(); // Restore persisted Baileys sessions on boot

// Initialize and start Scheduler Service
schedulerService.initialize();
schedulerService.start();

// NUEVO: Status logging periódico para monitoreo
// TODO: Implementar getStats() en Baileys service
// const STATUS_LOG_INTERVAL = 10 * 60 * 1000; // Cada 10 minutos
// setInterval(() => {
//     const stats = whatsappBaileysService.getStats();
//     const memUsage = process.memoryUsage();
//     const uptime = Math.floor(process.uptime() / 60);
//     console.log(`\n📊 [STATUS REPORT - ${new Date().toLocaleString()}]`);
//     console.log(`   ⏱️  Uptime: ${uptime} minutes`);
//     console.log(`   💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
//     console.log(`   📱 WhatsApp Clients: ${stats.totalClients}`);
//     console.log('');
// }, STATUS_LOG_INTERVAL);

// Start Server
server.listen(config.port, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║                                                      ║
    ║   🚀 MateChat Server v3.0 (Baileys Edition)          ║
    ║                                                      ║
    ╠══════════════════════════════════════════════════════╣
    ║   Port: ${config.port}                                        ║
    ║   API:  /api                                         ║
    ║   Health: /api/health                                ║
    ║   Status: /api/status                                ║
    ╠══════════════════════════════════════════════════════╣
    ║   Improvements:                                      ║
    ║   ✅ Baileys WebSocket (No Puppeteer!)               ║
    ║   ✅ Lightweight & Fast                              ║
    ║   ✅ WhatsApp Anti-Bot Bypass                        ║
    ║   ✅ Multi-Device Support                            ║
    ║   ✅ Auto Session Restore                            ║
    ╚══════════════════════════════════════════════════════╝
    `);
});

// Tuning Timeouts
server.keepAliveTimeout = 65000; // Ensure it's larger than load balancer timeout
server.headersTimeout = 66000;
server.requestTimeout = 0; // Disable default timeout for testing

// NUEVO: Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');

    // Stop scheduler
    schedulerService.stop();

    // Logout all Baileys clients
    const userIds = Array.from(whatsappBaileysService.sockets.keys());
    for (const userId of userIds) {
        console.log(`   Logging out client ${userId}...`);
        try {
            await whatsappBaileysService.logout(userId);
        } catch (e) {
            console.error(`   Failed to logout ${userId}:`, e.message);
        }
    }

    server.close(() => {
        console.log('✅ Server closed. Goodbye!');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Force exit after timeout');
        process.exit(1);
    }, 10000);
});

process.on('SIGTERM', () => {
    process.emit('SIGINT');
});
