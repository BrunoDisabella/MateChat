
import express from 'express';
import { authenticateApiKeyOnly } from '../middleware/auth.middleware.js';
import * as labelsController from '../controllers/labels.controller.js';
import * as messageController from '../controllers/message.controller.js';

const router = express.Router();

router.use(authenticateApiKeyOnly);

// Labels
router.get('/labels', labelsController.getLabels);
router.post('/labels/assign', labelsController.assignLabel);
router.post('/labels/remove', labelsController.removeLabel);

// Messages
router.post('/messages/send', messageController.sendMessage);


export default router;
