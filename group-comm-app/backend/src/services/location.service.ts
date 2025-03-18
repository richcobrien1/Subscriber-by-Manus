import { Server as SocketIOServer, Socket } from 'socket.io';
import Location from '../models/location.model';
import mongoose from 'mongoose';

// Interface for user location data
interface UserLocation {
  userId: string;
  groupId: string;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  };
  timestamp: Date;
}

// Interface for proximity alert settings
interface ProximitySettings {
  enabled: boolean;
  threshold: number; // in meters
}

// Location service class
class LocationService {
  private io: SocketIOServer;
  private userLocations: Map<string, UserLocation> = new Map();
  private proximitySettings: Map<string, ProximitySettings> = new Map(); // userId -> settings
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('Location service: User connected:', socket.id);

      // Start tracking location
      socket.on('start-tracking', (data: { userId: string; groupId: string }) => {
        this.handleStartTracking(socket, data);
      });

      // Update location
      socket.on('update-location', (data: { 
        userId: string; 
        groupId: string; 
        coordinates: {
          latitude: number;
          longitude: number;
          accuracy?: number;
          altitude?: number;
          heading?: number;
          speed?: number;
        }
      }) => {
        this.handleLocationUpdate(socket, data);
      });

      // Stop tracking location
      socket.on('stop-tracking', (data: { userId: string; groupId: string }) => {
        this.handleStopTracking(socket, data);
      });

      // Set proximity alert settings
      socket.on('set-proximity-settings', (data: { 
        userId: string; 
        enabled: boolean; 
        threshold?: number 
      }) => {
        this.handleSetProximitySettings(socket, data);
      });

      // Request group locations
      socket.on('get-group-locations', (data: { userId: string; groupId: string }) => {
        this.handleGetGroupLocations(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle start tracking
   */
  private handleStartTracking(socket: Socket, data: { userId: string; groupId: string }): void {
    const { userId, groupId } = data;

    if (!userId || !groupId) {
      socket.emit('error', { message: 'User ID and Group ID are required' });
      return;
    }

    // Store user socket mapping
    this.userSockets.set(userId, socket.id);

    // Set default proximity settings if not already set
    if (!this.proximitySettings.has(userId)) {
      this.proximitySettings.set(userId, {
        enabled: true,
        threshold: 100 // Default 100 meters
      });
    }

    // Join socket.io room for the group
    socket.join(`location:${groupId}`);

    socket.emit('tracking-started', {
      userId,
      groupId,
      timestamp: new Date(),
      proximitySettings: this.proximitySettings.get(userId)
    });

    console.log(`Location tracking started for user ${userId} in group ${groupId}`);
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(socket: Socket, data: { 
    userId: string; 
    groupId: string; 
    coordinates: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      altitude?: number;
      heading?: number;
      speed?: number;
    }
  }): Promise<void> {
    const { userId, groupId, coordinates } = data;

    if (!userId || !groupId || !coordinates || !coordinates.latitude || !coordinates.longitude) {
      socket.emit('error', { message: 'Invalid location data' });
      return;
    }

    try {
      const timestamp = new Date();

      // Store location in memory
      this.userLocations.set(userId, {
        userId,
        groupId,
        coordinates,
        timestamp
      });

      // Store location in database
      const location = new Location({
        userId: new mongoose.Types.ObjectId(userId),
        groupId: new mongoose.Types.ObjectId(groupId),
        coordinates,
        timestamp
      });

      await location.save();

      // Broadcast location to group members
      socket.to(`location:${groupId}`).emit('location-updated', {
        userId,
        coordinates,
        timestamp
      });

      // Check proximity with other users in the group
      this.checkProximity(userId, groupId);

      console.log(`Location updated for user ${userId} in group ${groupId}`);
    } catch (error) {
      console.error('Error updating location:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  /**
   * Handle stop tracking
   */
  private handleStopTracking(socket: Socket, data: { userId: string; groupId: string }): void {
    const { userId, groupId } = data;

    if (!userId || !groupId) {
      return;
    }

    // Remove user location from memory
    this.userLocations.delete(userId);

    // Leave socket.io room
    socket.leave(`location:${groupId}`);

    // Notify group members
    socket.to(`location:${groupId}`).emit('user-stopped-tracking', {
      userId,
      timestamp: new Date()
    });

    console.log(`Location tracking stopped for user ${userId} in group ${groupId}`);
  }

  /**
   * Handle set proximity settings
   */
  private handleSetProximitySettings(socket: Socket, data: { 
    userId: string; 
    enabled: boolean; 
    threshold?: number 
  }): void {
    const { userId, enabled, threshold } = data;

    if (!userId) {
      socket.emit('error', { message: 'User ID is required' });
      return;
    }

    // Update proximity settings
    this.proximitySettings.set(userId, {
      enabled,
      threshold: threshold || 100 // Default to 100 meters if not specified
    });

    socket.emit('proximity-settings-updated', {
      userId,
      enabled,
      threshold: threshold || 100,
      timestamp: new Date()
    });

    console.log(`Proximity settings updated for user ${userId}: enabled=${enabled}, threshold=${threshold || 100}m`);
  }

  /**
   * Handle get group locations
   */
  private handleGetGroupLocations(socket: Socket, data: { userId: string; groupId: string }): void {
    const { userId, groupId } = data;

    if (!userId || !groupId) {
      socket.emit('error', { message: 'User ID and Group ID are required' });
      return;
    }

    // Get all locations for the group
    const groupLocations = Array.from(this.userLocations.values())
      .filter(location => location.groupId === groupId)
      .map(location => ({
        userId: location.userId,
        coordinates: location.coordinates,
        timestamp: location.timestamp
      }));

    socket.emit('group-locations', {
      groupId,
      locations: groupLocations,
      timestamp: new Date()
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    // Find userId by socketId
    let disconnectedUserId: string | undefined;
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      // Get user location to find groupId
      const userLocation = this.userLocations.get(disconnectedUserId);
      if (userLocation) {
        const { groupId } = userLocation;

        // Notify group members
        socket.to(`location:${groupId}`).emit('user-disconnected', {
          userId: disconnectedUserId,
          timestamp: new Date()
        });

        // Remove user location from memory
        this.userLocations.delete(disconnectedUserId);
      }

      // Remove user socket mapping
      this.userSockets.delete(disconnectedUserId);

      console.log(`User disconnected from location service: ${disconnectedUserId}`);
    }
  }

  /**
   * Check proximity with other users in the group
   */
  private checkProximity(userId: string, groupId: string): void {
    const userLocation = this.userLocations.get(userId);
    if (!userLocation) return;

    const userSettings = this.proximitySettings.get(userId);
    if (!userSettings || !userSettings.enabled) return;

    // Get all other users in the group
    const otherUsers = Array.from(this.userLocations.values())
      .filter(location => location.groupId === groupId && location.userId !== userId);

    for (const otherUser of otherUsers) {
      // Calculate distance between users
      const distance = this.calculateDistance(
        userLocation.coordinates.latitude,
        userLocation.coordinates.longitude,
        otherUser.coordinates.latitude,
        otherUser.coordinates.longitude
      );

      // Check if distance is below threshold
      if (distance <= userSettings.threshold) {
        // Get socket IDs for both users
        const userSocketId = this.userSockets.get(userId);
        const otherSocketId = this.userSockets.get(otherUser.userId);

        if (userSocketId) {
          // Send proximity alert to user
          this.io.to(userSocketId).emit('proximity-alert', {
            userId: otherUser.userId,
            distance,
            coordinates: otherUser.coordinates,
            timestamp: new Date()
          });
        }

        // Check if other user has proximity alerts enabled
        const otherSettings = this.proximitySettings.get(otherUser.userId);
        if (otherSettings && otherSettings.enabled && distance <= otherSettings.threshold && otherSocketId) {
          // Send proximity alert to other user
          this.io.to(otherSocketId).emit('proximity-alert', {
            userId,
            distance,
            coordinates: userLocation.coordinates,
            timestamp: new Date()
          });
        }
      }
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
}

export default LocationService;
