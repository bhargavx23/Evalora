import mongoose, { Schema, Document } from 'mongoose';

export interface ICollege extends Document {
  name: string;
  code: string;
  domain?: string;
  status: 'active' | 'suspended';
  contactEmail: string;
  phone?: string;
  address?: string;
  settings: {
    allowRegistration: boolean;
    requireDepartment: boolean;
    defaultDurationMinutes: number;
    antiCheatDefaults: {
      tabSwitchLimit: number;
      fullscreenRequired: boolean;
      copyPasteRestricted: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const CollegeSchema = new Schema<ICollege>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    domain: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    settings: {
      allowRegistration: { type: Boolean, default: true },
      requireDepartment: { type: Boolean, default: true },
      defaultDurationMinutes: { type: Number, default: 60 },
      antiCheatDefaults: {
        tabSwitchLimit: { type: Number, default: 3 },
        fullscreenRequired: { type: Boolean, default: true },
        copyPasteRestricted: { type: Boolean, default: true }
      }
    }
  },
  { timestamps: true }
);

export const College = mongoose.model<ICollege>('College', CollegeSchema);
