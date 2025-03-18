import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// User interface
export interface IUser extends Document {
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// User schema
const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  photoURL: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create and export User model
export default mongoose.model<IUser>('User', UserSchema);
