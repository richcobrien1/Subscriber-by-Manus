import { Request, Response } from 'express';
import Location from '../models/location.model';
import mongoose from 'mongoose';

/**
 * Get latest locations for a group
 * GET /api/location/group/:groupId
 */
export const getGroupLocations = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required' });
    }
    
    // Find latest location for each user in the group
    const locations = await Location.aggregate([
      {
        $match: {
          groupId: new mongoose.Types.ObjectId(groupId)
        }
      },
      {
        $sort: {
          timestamp: -1
        }
      },
      {
        $group: {
          _id: '$userId',
          userId: { $first: '$userId' },
          coordinates: { $first: '$coordinates' },
          timestamp: { $first: '$timestamp' }
        }
      }
    ]);
    
    res.json({ locations });
  } catch (error) {
    console.error('Error getting group locations:', error);
    res.status(500).json({ message: 'Server error while fetching locations' });
  }
};

/**
 * Get location history for a user in a group
 * GET /api/location/history/:groupId/:userId
 */
export const getUserLocationHistory = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { limit = '20', startTime, endTime } = req.query;
    
    if (!groupId || !userId) {
      return res.status(400).json({ message: 'Group ID and User ID are required' });
    }
    
    // Build query
    const query: any = {
      groupId: new mongoose.Types.ObjectId(groupId),
      userId: new mongoose.Types.ObjectId(userId)
    };
    
    // Add time range if provided
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) {
        query.timestamp.$gte = new Date(startTime as string);
      }
      if (endTime) {
        query.timestamp.$lte = new Date(endTime as string);
      }
    }
    
    // Find location history
    const locations = await Location.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string, 10));
    
    res.json({ locations });
  } catch (error) {
    console.error('Error getting location history:', error);
    res.status(500).json({ message: 'Server error while fetching location history' });
  }
};

/**
 * Get nearby users in a group
 * GET /api/location/nearby/:groupId/:userId
 */
export const getNearbyUsers = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { radius = '1000' } = req.query; // Default radius: 1000 meters
    
    if (!groupId || !userId) {
      return res.status(400).json({ message: 'Group ID and User ID are required' });
    }
    
    // Get user's latest location
    const userLocation = await Location.findOne({
      groupId: new mongoose.Types.ObjectId(groupId),
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({ timestamp: -1 });
    
    if (!userLocation) {
      return res.status(404).json({ message: 'User location not found' });
    }
    
    // Find latest location for each user in the group
    const latestLocations = await Location.aggregate([
      {
        $match: {
          groupId: new mongoose.Types.ObjectId(groupId),
          userId: { $ne: new mongoose.Types.ObjectId(userId) }
        }
      },
      {
        $sort: {
          timestamp: -1
        }
      },
      {
        $group: {
          _id: '$userId',
          userId: { $first: '$userId' },
          coordinates: { $first: '$coordinates' },
          timestamp: { $first: '$timestamp' }
        }
      }
    ]);
    
    // Calculate distance for each user
    const nearbyUsers = latestLocations
      .map(location => {
        const distance = calculateDistance(
          userLocation.coordinates.latitude,
          userLocation.coordinates.longitude,
          location.coordinates.latitude,
          location.coordinates.longitude
        );
        
        return {
          userId: location.userId,
          coordinates: location.coordinates,
          timestamp: location.timestamp,
          distance
        };
      })
      .filter(user => user.distance <= parseInt(radius as string, 10))
      .sort((a, b) => a.distance - b.distance);
    
    res.json({ nearbyUsers });
  } catch (error) {
    console.error('Error getting nearby users:', error);
    res.status(500).json({ message: 'Server error while fetching nearby users' });
  }
};

/**
 * Calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * Math.PI / 180;
};
