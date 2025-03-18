import request from 'supertest';
import mongoose from 'mongoose';
import { app, server } from '../server';
import User from '../models/user.model';
import Group from '../models/group.model';
import Location from '../models/location.model';
import CommunicationSession from '../models/communication-session.model';

// Mock data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  displayName: 'Test User'
};

const testGroup = {
  name: 'Test Group',
  description: 'A group for testing',
  settings: {
    privacyLevel: 'private',
    joinPermission: 'invite_only',
    locationSharing: true,
    musicSharing: true
  }
};

// Test suite
describe('Backend Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let groupId: string;
  let inviteCode: string;

  // Before all tests, connect to test database
  beforeAll(async () => {
    // Use a test database
    const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/group-comm-app-test';
    await mongoose.connect(mongoUri);
    
    // Clear test database
    await User.deleteMany({});
    await Group.deleteMany({});
    await Location.deleteMany({});
    await CommunicationSession.deleteMany({});
  });

  // After all tests, disconnect and close server
  afterAll(async () => {
    await mongoose.connection.close();
    server.close();
  });

  // Authentication tests
  describe('Authentication', () => {
    test('Should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe(testUser.email);
      
      // Save token and user ID for later tests
      authToken = res.body.token;
      userId = res.body.user.id;
    });

    test('Should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
      
      // Update token
      authToken = res.body.token;
    });

    test('Should get current user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
    });
  });

  // Group management tests
  describe('Group Management', () => {
    test('Should create a new group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testGroup);
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('group');
      expect(res.body.group.name).toBe(testGroup.name);
      expect(res.body.group).toHaveProperty('inviteCode');
      
      // Save group ID and invite code for later tests
      groupId = res.body.group.id;
      inviteCode = res.body.group.inviteCode;
    });

    test('Should get user groups', async () => {
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('groups');
      expect(Array.isArray(res.body.groups)).toBe(true);
      expect(res.body.groups.length).toBeGreaterThan(0);
      expect(res.body.groups[0].name).toBe(testGroup.name);
    });

    test('Should get group details', async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('group');
      expect(res.body.group.name).toBe(testGroup.name);
      expect(res.body.group).toHaveProperty('members');
      expect(Array.isArray(res.body.group.members)).toBe(true);
      expect(res.body.group.members.length).toBe(1);
      expect(res.body.group.members[0].role).toBe('admin');
    });

    test('Should update group details', async () => {
      const updatedGroup = {
        name: 'Updated Test Group',
        description: 'An updated group for testing'
      };
      
      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedGroup);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('group');
      expect(res.body.group.name).toBe(updatedGroup.name);
      expect(res.body.group.description).toBe(updatedGroup.description);
    });

    test('Should generate new invite code', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inviteCode');
      expect(res.body.inviteCode).not.toBe(inviteCode);
      
      // Update invite code
      inviteCode = res.body.inviteCode;
    });
  });

  // Communication tests
  describe('Communication', () => {
    test('Should get active communication sessions', async () => {
      const res = await request(app)
        .get(`/api/communication/sessions/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });

    // Note: Real-time communication would be tested with Socket.IO client
    // This is a simplified test for the REST API endpoints
  });

  // Location tests
  describe('Location', () => {
    test('Should get group locations', async () => {
      const res = await request(app)
        .get(`/api/location/group/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('locations');
      expect(Array.isArray(res.body.locations)).toBe(true);
    });

    // Create a test location
    test('Should store location data', async () => {
      // Create a location directly in the database
      const location = new Location({
        userId: new mongoose.Types.ObjectId(userId),
        groupId: new mongoose.Types.ObjectId(groupId),
        coordinates: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10
        },
        timestamp: new Date()
      });
      
      await location.save();
      
      // Verify it can be retrieved
      const res = await request(app)
        .get(`/api/location/history/${groupId}/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('locations');
      expect(Array.isArray(res.body.locations)).toBe(true);
      expect(res.body.locations.length).toBeGreaterThan(0);
    });
  });

  // Integration tests
  describe('Integration', () => {
    test('Should create a communication session for a group', async () => {
      // Create a session directly in the database
      const session = new CommunicationSession({
        groupId: new mongoose.Types.ObjectId(groupId),
        type: 'audio',
        active: true,
        participants: {
          [userId]: {
            joinedAt: new Date(),
            active: true,
            muted: false
          }
        }
      });
      
      await session.save();
      
      // Verify it can be retrieved
      const res = await request(app)
        .get(`/api/communication/sessions/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBeGreaterThan(0);
      expect(res.body.sessions[0].type).toBe('audio');
    });
  });
});
