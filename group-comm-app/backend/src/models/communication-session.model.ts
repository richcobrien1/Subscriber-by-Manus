import mongoose, { Document, Schema } from 'mongoose';

// Communication Session interface
export interface ICommunicationSession extends Document {
  groupId: mongoose.Types.ObjectId;
  type: 'audio' | 'music';
  startedAt: Date;
  endedAt?: Date;
  active: boolean;
  participants: {
    [key: string]: {
      joinedAt: Date;
      leftAt?: Date;
      active: boolean;
      muted: boolean;
    }
  };
  mediaInfo?: {
    source?: string;
    trackId?: string;
    position?: number;
  };
}

// Communication Session schema
const CommunicationSessionSchema: Schema = new Schema({
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  type: {
    type: String,
    enum: ['audio', 'music'],
    default: 'audio',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
  active: {
    type: Boolean,
    default: true,
  },
  participants: {
    type: Map,
    of: new Schema({
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      leftAt: {
        type: Date,
      },
      active: {
        type: Boolean,
        default: true,
      },
      muted: {
        type: Boolean,
        default: false,
      },
    }),
    default: {},
  },
  mediaInfo: {
    source: String,
    trackId: String,
    position: Number,
  },
});

// Create index for efficient queries
CommunicationSessionSchema.index({ groupId: 1, active: 1 });
CommunicationSessionSchema.index({ 'participants.active': 1 });

// Create and export Communication Session model
export default mongoose.model<ICommunicationSession>('CommunicationSession', CommunicationSessionSchema);
