import express from 'express';
import * as communicationController from '../controllers/communication.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get active sessions for a group
router.get('/sessions/:groupId', communicationController.getActiveSessions);

// Get session details
router.get('/sessions/:sessionId/details', communicationController.getSessionDetails);

// Get session history for a group
router.get('/history/:groupId', communicationController.getSessionHistory);

// End a communication session
router.put('/sessions/:sessionId/end', communicationController.endSession);

export default router;
