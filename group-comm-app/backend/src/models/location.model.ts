import mongoose, { Document, Schema } from 'mongoose';

// Location interface
export interface ILocation extends Document {
  userId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  timestamp: Date;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  };
}

// Location schema
const LocationSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  coordinates: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
    },
    altitude: {
      type: Number,
    },
    heading: {
      type: Number,
    },
    speed: {
      type: Number,
    },
  },
});

// Create index for efficient queries
LocationSchema.index({ userId: 1, groupId: 1 });
LocationSchema.index({ groupId: 1, timestamp: -1 });

// Create and export Location model
export default mongoose.model<ILocation>('Location', LocationSchema);
