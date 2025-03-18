import { Server as SocketIOServer, Socket } from 'socket.io';
import CommunicationSession from '../models/communication-session.model';
import mongoose from 'mongoose';

// Interface for user connection data
interface UserConnection {
  userId: string;
  socketId: string;
  groupId?: string;
}

// Interface for WebRTC signaling data
interface SignalingData {
  userId: string;
  targetUserId: string;
  type: string;
  sdp?: any;
  candidate?: any;
}

// Communication service class
class CommunicationService {
  private io: SocketIOServer;
  private userConnections: Map<string, UserConnection> = new Map();
  private groupSessions: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id);

      // Authenticate user
      socket.on('authenticate', (data: { userId: string }) => {
        this.handleAuthentication(socket, data);
      });

      // Join group
      socket.on('join-group', (data: { userId: string; groupId: string }) => {
        this.handleJoinGroup(socket, data);
      });

      // Leave group
      socket.on('leave-group', (data: { userId: string; groupId: string }) => {
        this.handleLeaveGroup(socket, data);
      });

      // WebRTC signaling
      socket.on('signal', (data: SignalingData) => {
        this.handleSignaling(socket, data);
      });

      // Mute/unmute microphone
      socket.on('toggle-microphone', (data: { userId: string; groupId: string; muted: boolean }) => {
        this.handleToggleMicrophone(socket, data);
      });

      // Start music sharing
      socket.on('start-music-sharing', (data: { userId: string; groupId: string; mediaInfo: any }) => {
        this.handleStartMusicSharing(socket, data);
      });

      // Stop music sharing
      socket.on('stop-music-sharing', (data: { userId: string; groupId: string }) => {
        this.handleStopMusicSharing(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle user authentication
   */
  private handleAuthentication(socket: Socket, data: { userId: string }): void {
    const { userId } = data;

    if (!userId) {
      socket.emit('error', { message: 'User ID is required' });
      return;
    }

    // Store user connection
    this.userConnections.set(socket.id, { userId, socketId: socket.id });

    socket.emit('authenticated', { userId });
    console.log('User authenticated:', userId);
  }

  /**
   * Handle joining a group
   */
  private async handleJoinGroup(socket: Socket, data: { userId: string; groupId: string }): Promise<void> {
    const { userId, groupId } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    try {
      // Update user connection with group ID
      userConnection.groupId = groupId;
      this.userConnections.set(socket.id, userConnection);

      // Join socket.io room for the group
      socket.join(groupId);

      // Add user to group session
      if (!this.groupSessions.has(groupId)) {
        this.groupSessions.set(groupId, new Set());
      }
      this.groupSessions.get(groupId)?.add(socket.id);

      // Find or create communication session
      let session = await CommunicationSession.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        active: true,
        type: 'audio'
      });

      if (!session) {
        session = new CommunicationSession({
          groupId: new mongoose.Types.ObjectId(groupId),
          type: 'audio',
          active: true,
          participants: {}
        });
      }

      // Add user to session participants
      const participants = session.participants || {};
      participants[userId] = {
        joinedAt: new Date(),
        active: true,
        muted: false
      };
      session.participants = participants;

      await session.save();

      // Notify other users in the group
      socket.to(groupId).emit('user-joined', {
        userId,
        timestamp: new Date()
      });

      // Send current participants to the joining user
      const currentParticipants = Array.from(this.groupSessions.get(groupId) || [])
        .filter(id => id !== socket.id)
        .map(id => {
          const conn = this.userConnections.get(id);
          return conn ? conn.userId : null;
        })
        .filter(Boolean);

      socket.emit('group-joined', {
        groupId,
        participants: currentParticipants,
        sessionId: session._id
      });

      console.log(`User ${userId} joined group ${groupId}`);
    } catch (error) {
      console.error('Error joining group:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  }

  /**
   * Handle leaving a group
   */
  private async handleLeaveGroup(socket: Socket, data: { userId: string; groupId: string }): Promise<void> {
    const { userId, groupId } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection || userConnection.groupId !== groupId) {
      return;
    }

    try {
      // Remove group ID from user connection
      userConnection.groupId = undefined;
      this.userConnections.set(socket.id, userConnection);

      // Leave socket.io room
      socket.leave(groupId);

      // Remove user from group session
      this.groupSessions.get(groupId)?.delete(socket.id);
      if (this.groupSessions.get(groupId)?.size === 0) {
        this.groupSessions.delete(groupId);
      }

      // Update communication session
      const session = await CommunicationSession.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        active: true,
        type: 'audio'
      });

      if (session) {
        const participants = session.participants || {};
        if (participants[userId]) {
          participants[userId].active = false;
          participants[userId].leftAt = new Date();
        }
        session.participants = participants;

        // If no active participants, mark session as inactive
        const hasActiveParticipants = Object.values(participants).some(p => p.active);
        if (!hasActiveParticipants) {
          session.active = false;
          session.endedAt = new Date();
        }

        await session.save();
      }

      // Notify other users in the group
      socket.to(groupId).emit('user-left', {
        userId,
        timestamp: new Date()
      });

      console.log(`User ${userId} left group ${groupId}`);
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  }

  /**
   * Handle WebRTC signaling
   */
  private handleSignaling(socket: Socket, data: SignalingData): void {
    const { userId, targetUserId, type, sdp, candidate } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    // Find target user's socket
    const targetSocketId = this.findSocketIdByUserId(targetUserId);
    if (!targetSocketId) {
      socket.emit('error', { message: 'Target user not found or not connected' });
      return;
    }

    // Forward the signaling data to the target user
    this.io.to(targetSocketId).emit('signal', {
      userId,
      type,
      sdp,
      candidate
    });
  }

  /**
   * Handle microphone mute/unmute
   */
  private async handleToggleMicrophone(socket: Socket, data: { userId: string; groupId: string; muted: boolean }): Promise<void> {
    const { userId, groupId, muted } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection || userConnection.groupId !== groupId) {
      return;
    }

    try {
      // Update communication session
      const session = await CommunicationSession.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        active: true,
        type: 'audio'
      });

      if (session) {
        const participants = session.participants || {};
        if (participants[userId]) {
          participants[userId].muted = muted;
        }
        session.participants = participants;
        await session.save();
      }

      // Notify other users in the group
      socket.to(groupId).emit('microphone-toggled', {
        userId,
        muted,
        timestamp: new Date()
      });

      console.log(`User ${userId} ${muted ? 'muted' : 'unmuted'} microphone in group ${groupId}`);
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  }

  /**
   * Handle start music sharing
   */
  private async handleStartMusicSharing(socket: Socket, data: { userId: string; groupId: string; mediaInfo: any }): Promise<void> {
    const { userId, groupId, mediaInfo } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection || userConnection.groupId !== groupId) {
      return;
    }

    try {
      // Find or create music session
      let session = await CommunicationSession.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        active: true,
        type: 'music'
      });

      if (session) {
        // Update existing session
        session.mediaInfo = mediaInfo;
      } else {
        // Create new music session
        session = new CommunicationSession({
          groupId: new mongoose.Types.ObjectId(groupId),
          type: 'music',
          active: true,
          participants: {},
          mediaInfo
        });
      }

      // Add user as participant
      const participants = session.participants || {};
      participants[userId] = {
        joinedAt: new Date(),
        active: true,
        muted: false
      };
      session.participants = participants;

      await session.save();

      // Notify all users in the group
      this.io.to(groupId).emit('music-sharing-started', {
        userId,
        mediaInfo,
        sessionId: session._id,
        timestamp: new Date()
      });

      console.log(`User ${userId} started music sharing in group ${groupId}`);
    } catch (error) {
      console.error('Error starting music sharing:', error);
      socket.emit('error', { message: 'Failed to start music sharing' });
    }
  }

  /**
   * Handle stop music sharing
   */
  private async handleStopMusicSharing(socket: Socket, data: { userId: string; groupId: string }): Promise<void> {
    const { userId, groupId } = data;
    const userConnection = this.userConnections.get(socket.id);

    if (!userConnection || userConnection.groupId !== groupId) {
      return;
    }

    try {
      // Find music session
      const session = await CommunicationSession.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        active: true,
        type: 'music'
      });

      if (session) {
        // Mark session as inactive
        session.active = false;
        session.endedAt = new Date();
        await session.save();

        // Notify all users in the group
        this.io.to(groupId).emit('music-sharing-stopped', {
          userId,
          timestamp: new Date()
        });

        console.log(`User ${userId} stopped music sharing in group ${groupId}`);
      }
    } catch (error) {
      console.error('Error stopping music sharing:', error);
    }
  }

  /**
   * Handle user disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userConnection = this.userConnections.get(socket.id);
    if (!userConnection) {
      return;
    }

    const { userId, groupId } = userConnection;

    // If user was in a group, handle leaving the group
    if (groupId) {
      this.handleLeaveGroup(socket, { userId, groupId });
    }

    // Remove user connection
    this.userConnections.delete(socket.id);

    console.log('User disconnected:', userId);
  }

  /**
   * Find socket ID by user ID
   */
  private findSocketIdByUserId(userId: string): string | undefined {
    for (const [socketId, connection] of this.userConnections.entries()) {
      if (connection.userId === userId) {
        return socketId;
      }
    }
    return undefined;
  }
}

export default CommunicationService;
