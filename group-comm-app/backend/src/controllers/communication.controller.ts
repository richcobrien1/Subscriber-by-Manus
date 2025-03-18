import { Request, Response } from 'express';
import CommunicationSession from '../models/communication-session.model';
import mongoose from 'mongoose';

/**
 * Get active communication sessions for a group
 * GET /api/communication/sessions/:groupId
 */
export const getActiveSessions = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required' });
    }
    
    // Find active sessions for the group
    const sessions = await CommunicationSession.find({
      groupId: new mongoose.Types.ObjectId(groupId),
      active: true
    });
    
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({ message: 'Server error while fetching sessions' });
  }
};

/**
 * Get session details
 * GET /api/communication/sessions/:sessionId/details
 */
export const getSessionDetails = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Find session by ID
    const session = await CommunicationSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    res.json({ session });
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ message: 'Server error while fetching session details' });
  }
};

/**
 * Get session history for a group
 * GET /api/communication/history/:groupId
 */
export const getSessionHistory = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required' });
    }
    
    // Find all sessions for the group, sorted by start time
    const sessions = await CommunicationSession.find({
      groupId: new mongoose.Types.ObjectId(groupId)
    }).sort({ startedAt: -1 });
    
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting session history:', error);
    res.status(500).json({ message: 'Server error while fetching session history' });
  }
};

/**
 * End a communication session
 * PUT /api/communication/sessions/:sessionId/end
 */
export const endSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Find session by ID
    const session = await CommunicationSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Update session
    session.active = false;
    session.endedAt = new Date();
    
    await session.save();
    
    res.json({ message: 'Session ended successfully', session });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Server error while ending session' });
  }
};
