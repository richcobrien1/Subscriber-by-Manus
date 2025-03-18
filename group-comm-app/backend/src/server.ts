import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import config from './config';
import CommunicationService from './services/communication.service';
import LocationService from './services/location.service';

// Import routes
import authRoutes from './routes/auth.routes';
import communicationRoutes from './routes/communication.routes';
import locationRoutes from './routes/location.routes';
import groupRoutes from './routes/group.routes';

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  },
});

// Initialize services
const communicationService = new CommunicationService(io);
const locationService = new LocationService(io);

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Group Communication App API' });
});

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/groups', groupRoutes);

// Connect to MongoDB
mongoose
  .connect(config.database.uri)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    server.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  console.error('Unhandled Rejection:', error);
  server.close(() => process.exit(1));
});

export { app, server, io };
