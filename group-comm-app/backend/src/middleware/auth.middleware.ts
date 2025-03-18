import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import User from '../models/user.model';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded: any = jwt.verify(token, config.jwt.secret);
    
    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found or token is invalid.' });
    }
    
    // Attach user to request
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired.' });
    }
    
    return res.status(500).json({ message: 'Server error during authentication.' });
  }
};

/**
 * Admin authorization middleware
 * Checks if authenticated user has admin role
 */
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  
  next();
};
