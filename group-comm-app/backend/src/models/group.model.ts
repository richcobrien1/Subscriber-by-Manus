import mongoose, { Document, Schema } from 'mongoose';

// Group interface
export interface IGroup extends Document {
  name: string;
  description?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  inviteCode: string;
  members: {
    [key: string]: {
      role: 'admin' | 'member';
      joinedAt: Date;
    }
  };
  settings: {
    privacyLevel: 'public' | 'private';
    joinPermission: 'anyone' | 'invite_only';
    locationSharing: boolean;
    musicSharing: boolean;
  };
}

// Group schema
const GroupSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
  },
  members: {
    type: Map,
    of: new Schema({
      role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    }),
    default: {},
  },
  settings: {
    privacyLevel: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
    },
    joinPermission: {
      type: String,
      enum: ['anyone', 'invite_only'],
      default: 'invite_only',
    },
    locationSharing: {
      type: Boolean,
      default: true,
    },
    musicSharing: {
      type: Boolean,
      default: true,
    },
  },
});

// Generate a random invite code
GroupSchema.pre<IGroup>('save', function (next) {
  // Only generate invite code if it's a new group
  if (this.isNew && !this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

// Create and export Group model
export default mongoose.model<IGroup>('Group', GroupSchema);
