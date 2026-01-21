
import express from 'express';
import { authenticateApiKeyOnly } from '../middleware/auth.middleware.js';
import * as labelsController from '../controllers/labels.controller.js';
import * as messageController from '../controllers/message.controller.js';
import * as testController from '../controllers/test.controller.js';
import * as scheduleController from '../controllers/schedule.controller.js';
import * as statusController from '../controllers/status.controller.js';

const router = express.Router();

router.use(authenticateApiKeyOnly);

// Status & Health (NUEVO)
router.get('/status', statusController.getStatus);
router.get('/health', statusController.healthCheck);
router.post('/restart', statusController.forceRestart);
router.post('/force-cleanup', statusController.forceCleanup);
router.post('/kill-zombies', statusController.killZombies);

// Debug
router.post('/debug/test-webhook', testController.triggerTestWebhook);

// Labels
router.get('/labels', labelsController.getLabels);
router.post('/labels/assign', labelsController.assignLabel);
router.post('/labels/remove', labelsController.removeLabel);

// Messages
router.post('/send-message', messageController.sendMessage);

// Scheduling
router.post('/schedule/message', scheduleController.createScheduledMessage);
router.get('/schedule/messages', scheduleController.listScheduledMessages);
router.delete('/schedule/message/:id', scheduleController.deleteScheduledMessage);
router.post('/schedule/status', scheduleController.createScheduledStatus);
router.get('/schedule/statuses', scheduleController.listScheduledStatuses);
router.delete('/schedule/status/:id', scheduleController.deleteScheduledStatus);

export default router;
