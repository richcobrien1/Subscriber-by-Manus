import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import config from '../config';

/**
 * Generate JWT token for user
 */
const generateToken = (user: IUser): string => {
  return jwt.sign(
    { id: user._id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    // Validate input
    if (!email || !password || !displayName) {
      return res.status(400).json({ message: 'Please provide email, password, and display name' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      displayName,
    });

    // Save user to database
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user data and token
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user data and token
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // User is attached to request by auth middleware
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error while fetching user profile' });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { displayName, photoURL } = req.body;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (displayName) user.displayName = displayName;
    if (photoURL) user.photoURL = photoURL;

    // Save updated user
    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    // Find user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error while changing password' });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 * Note: In a real app, this would send an email with a reset link
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Please provide email' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that the user doesn't exist
      return res.json({ message: 'If a user with that email exists, a password reset link has been sent' });
    }

    // In a real app, generate a reset token and send email
    // For this prototype, we'll just return a success message

    res.json({ message: 'If a user with that email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
};
