import express from 'express';
import * as locationController from '../controllers/location.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get latest locations for a group
router.get('/group/:groupId', locationController.getGroupLocations);

// Get location history for a user in a group
router.get('/history/:groupId/:userId', locationController.getUserLocationHistory);

// Get nearby users in a group
router.get('/nearby/:groupId/:userId', locationController.getNearbyUsers);

export default router;
