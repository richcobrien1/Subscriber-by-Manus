import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // MongoDB configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/group-comm-app',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  
  // WebRTC configuration
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};

export default config;
