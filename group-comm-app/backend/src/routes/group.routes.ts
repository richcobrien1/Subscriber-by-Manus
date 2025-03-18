import express from 'express';
import * as groupController from '../controllers/group.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new group
router.post('/', groupController.createGroup);

// Get all groups for current user
router.get('/', groupController.getUserGroups);

// Get group details
router.get('/:groupId', groupController.getGroupDetails);

// Update group details
router.put('/:groupId', groupController.updateGroup);

// Join group with invite code
router.post('/join', groupController.joinGroup);

// Leave group
router.delete('/:groupId/leave', groupController.leaveGroup);

// Generate new invite code
router.post('/:groupId/invite', groupController.generateInviteCode);

// Update member role
router.put('/:groupId/members/:memberId', groupController.updateMemberRole);

// Remove member from group
router.delete('/:groupId/members/:memberId', groupController.removeMember);

export default router;
