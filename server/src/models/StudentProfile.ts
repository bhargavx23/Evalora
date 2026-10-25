import mongoose, { Document, Schema } from 'mongoose';

export interface IProfileLink {
  label: string;
  url: string;
}

export interface IStudentProfile extends Document {
  userId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId | null;
  phone?: string;
  location?: string;
  dateOfBirth?: Date;
  bio?: string;
  headline?: string;
  degree?: string;
  branch?: string;
  graduationYear?: number;
  cgpa?: number;
  academicAchievements: string[];
  skills: string[];
  programmingLanguages: string[];
  frameworks: string[];
  tools: string[];
  certifications: string[];
  projects: Array<{ name: string; description: string; url?: string; technologies: string[] }>;
  experience: Array<{ company: string; role: string; description: string; startDate?: Date; endDate?: Date }>;
  achievements: string[];
  extracurricularActivities: string[];
  links: IProfileLink[];
  privacy: { profileVisible: boolean; resumeVisible: boolean; careerVisible: boolean };
  notificationPreferences: { assessment: boolean; practice: boolean; results: boolean; resume: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileSchema = new Schema<IStudentProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  collegeId: { type: Schema.Types.ObjectId, ref: 'College', default: null, index: true },
  phone: { type: String, trim: true, maxlength: 30 },
  location: { type: String, trim: true, maxlength: 120 },
  dateOfBirth: { type: Date },
  bio: { type: String, trim: true, maxlength: 1000 },
  headline: { type: String, trim: true, maxlength: 160 },
  degree: { type: String, trim: true, maxlength: 120 },
  branch: { type: String, trim: true, maxlength: 120 },
  graduationYear: { type: Number, min: 1900, max: 2200 },
  cgpa: { type: Number, min: 0, max: 100 },
  academicAchievements: [{ type: String, trim: true, maxlength: 300 }],
  skills: [{ type: String, trim: true, maxlength: 80 }],
  programmingLanguages: [{ type: String, trim: true, maxlength: 80 }],
  frameworks: [{ type: String, trim: true, maxlength: 80 }],
  tools: [{ type: String, trim: true, maxlength: 80 }],
  certifications: [{ type: String, trim: true, maxlength: 160 }],
  projects: [{ name: String, description: String, url: String, technologies: [String] }],
  experience: [{ company: String, role: String, description: String, startDate: Date, endDate: Date }],
  achievements: [{ type: String, trim: true, maxlength: 300 }],
  extracurricularActivities: [{ type: String, trim: true, maxlength: 300 }],
  links: [{ label: { type: String, trim: true }, url: { type: String, trim: true } }],
  privacy: {
    profileVisible: { type: Boolean, default: false },
    resumeVisible: { type: Boolean, default: false },
    careerVisible: { type: Boolean, default: false }
  },
  notificationPreferences: {
    assessment: { type: Boolean, default: true },
    practice: { type: Boolean, default: true },
    results: { type: Boolean, default: true },
    resume: { type: Boolean, default: true }
  }
}, { timestamps: true });

export const StudentProfile = mongoose.model<IStudentProfile>('StudentProfile', StudentProfileSchema);
