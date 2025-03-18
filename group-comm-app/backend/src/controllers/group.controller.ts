import { Request, Response } from 'express';
import Group from '../models/group.model';
import User from '../models/user.model';
import mongoose from 'mongoose';

/**
 * Create a new group
 * POST /api/groups
 */
export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, settings } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Create new group
    const group = new Group({
      name,
      description: description || '',
      createdBy: userId,
      settings: settings || {},
      members: {}
    });

    // Add creator as admin
    const members = {};
    members[userId] = {
      role: 'admin',
      joinedAt: new Date()
    };
    group.members = members;

    // Save group
    await group.save();

    res.status(201).json({
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt,
        settings: group.settings
      }
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Server error while creating group' });
  }
};

/**
 * Get all groups for current user
 * GET /api/groups
 */
export const getUserGroups = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;

    // Find groups where user is a member
    const groups = await Group.find({
      [`members.${userId}`]: { $exists: true }
    });

    // Format response
    const formattedGroups = groups.map(group => ({
      id: group._id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt,
      memberCount: Object.keys(group.members).length,
      role: group.members[userId.toString()].role,
      settings: group.settings
    }));

    res.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Error getting user groups:', error);
    res.status(500).json({ message: 'Server error while fetching groups' });
  }
};

/**
 * Get group details
 * GET /api/groups/:groupId
 */
export const getGroupDetails = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members[userId.toString()]) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    // Get member details
    const memberIds = Object.keys(group.members);
    const members = await User.find({
      _id: { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).select('_id displayName email photoURL');

    // Format members
    const formattedMembers = members.map(member => ({
      id: member._id,
      displayName: member.displayName,
      email: member.email,
      photoURL: member.photoURL,
      role: group.members[member._id.toString()].role,
      joinedAt: group.members[member._id.toString()].joinedAt
    }));

    res.json({
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt,
        createdBy: group.createdBy,
        settings: group.settings,
        members: formattedMembers
      }
    });
  } catch (error) {
    console.error('Error getting group details:', error);
    res.status(500).json({ message: 'Server error while fetching group details' });
  }
};

/**
 * Update group details
 * PUT /api/groups/:groupId
 */
export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description, settings } = req.body;
    const userId = req.user._id;

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is an admin
    if (!group.members[userId.toString()] || group.members[userId.toString()].role !== 'admin') {
      return res.status(403).json({ message: 'Only group admins can update group details' });
    }

    // Update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (settings) {
      group.settings = {
        ...group.settings,
        ...settings
      };
    }

    // Save changes
    await group.save();

    res.json({
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        settings: group.settings
      }
    });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Server error while updating group' });
  }
};

/**
 * Join group with invite code
 * POST /api/groups/join
 */
export const joinGroup = async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user._id;

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    // Find group by invite code
    const group = await Group.findOne({ inviteCode });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    // Check if user is already a member
    if (group.members[userId.toString()]) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Check join permission
    if (group.settings.joinPermission === 'invite_only' && group.settings.privacyLevel === 'private') {
      // For private groups, we could implement additional checks here
      // For now, we'll allow joining with the invite code
    }

    // Add user to group members
    const members = { ...group.members };
    members[userId] = {
      role: 'member',
      joinedAt: new Date()
    };
    group.members = members;

    // Save changes
    await group.save();

    res.json({
      message: 'Successfully joined group',
      group: {
        id: group._id,
        name: group.name,
        description: group.description
      }
    });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: 'Server error while joining group' });
  }
};

/**
 * Leave group
 * DELETE /api/groups/:groupId/leave
 */
export const leaveGroup = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members[userId.toString()]) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    // Check if user is the only admin
    const isAdmin = group.members[userId.toString()].role === 'admin';
    if (isAdmin) {
      const adminCount = Object.values(group.members).filter(
        (member: any) => member.role === 'admin'
      ).length;

      if (adminCount === 1) {
        // Find another member to promote to admin
        const memberIds = Object.keys(group.members).filter(id => id !== userId.toString());
        
        if (memberIds.length === 0) {
          // If no other members, delete the group
          await Group.findByIdAndDelete(groupId);
          return res.json({ message: 'Group deleted as you were the last member' });
        }
        
        // Promote the first member to admin
        const members = { ...group.members };
        members[memberIds[0]].role = 'admin';
        group.members = members;
      }
    }

    // Remove user from members
    const members = { ...group.members };
    delete members[userId.toString()];
    group.members = members;

    // Save changes
    await group.save();

    res.json({ message: 'Successfully left group' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ message: 'Server error while leaving group' });
  }
};

/**
 * Generate new invite code
 * POST /api/groups/:groupId/invite
 */
export const generateInviteCode = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is an admin
    if (!group.members[userId.toString()] || group.members[userId.toString()].role !== 'admin') {
      return res.status(403).json({ message: 'Only group admins can generate new invite codes' });
    }

    // Generate new invite code
    group.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Save changes
    await group.save();

    res.json({
      inviteCode: group.inviteCode
    });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ message: 'Server error while generating invite code' });
  }
};

/**
 * Update member role
 * PUT /api/groups/:groupId/members/:memberId
 */
export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const { groupId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user._id;

    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Valid role (admin or member) is required' });
    }

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is an admin
    if (!group.members[userId.toString()] || group.members[userId.toString()].role !== 'admin') {
      return res.status(403).json({ message: 'Only group admins can update member roles' });
    }

    // Check if target user is a member
    if (!group.members[memberId]) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    // Update role
    const members = { ...group.members };
    members[memberId] = {
      ...members[memberId],
      role
    };
    group.members = members;

    // Save changes
    await group.save();

    res.json({
      message: 'Member role updated successfully',
      memberId,
      role
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ message: 'Server error while updating member role' });
  }
};

/**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:memberId
 */
export const removeMember = async (req: Request, res: Response) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    // Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is an admin
    if (!group.members[userId.toString()] || group.members[userId.toString()].role !== 'admin') {
      return res.status(403).json({ message: 'Only group admins can remove members' });
    }

    // Check if target user is a member
    if (!group.members[memberId]) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    // Prevent removing yourself through this endpoint
    if (memberId === userId.toString()) {
      return res.status(400).json({ message: 'Cannot remove yourself. Use the leave group endpoint instead.' });
    }

    // Remove member
    const members = { ...group.members };
    delete members[memberId];
    group.members = members;

    // Save changes
    await group.save();

    res.json({
      message: 'Member removed successfully',
      memberId
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: 'Server error while removing member' });
  }
};
