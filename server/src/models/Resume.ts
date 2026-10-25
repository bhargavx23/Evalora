import mongoose, { Document, Schema } from 'mongoose';

export interface IResumeAnalysis {
  score: number;
  scoreBreakdown: Record<string, number>;
  detectedSections: string[];
  detectedSkills: string[];
  recommendations: Array<{ category: string; problem: string; whyItMatters: string; recommendation: string; priority: 'high' | 'medium' | 'low' }>;
  jobTitle?: string;
  jobMatchScore?: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  analyzedAt: Date;
}

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId | null;
  originalName: string;
  storageKey: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  sizeBytes: number;
  extractedText: string;
  analysis?: IResumeAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = new Schema({
  category: String,
  problem: String,
  whyItMatters: String,
  recommendation: String,
  priority: { type: String, enum: ['high', 'medium', 'low'] }
}, { _id: false });

const ResumeSchema = new Schema<IResume>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  collegeId: { type: Schema.Types.ObjectId, ref: 'College', default: null, index: true },
  originalName: { type: String, required: true },
  storageKey: { type: String, required: true, unique: true },
  mimeType: { type: String, enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], required: true },
  sizeBytes: { type: Number, required: true },
  extractedText: { type: String, required: true, select: false },
  analysis: {
    score: Number,
    scoreBreakdown: { type: Schema.Types.Mixed },
    detectedSections: [String],
    detectedSkills: [String],
    recommendations: [RecommendationSchema],
    jobTitle: String,
    jobMatchScore: Number,
    matchedKeywords: [String],
    missingKeywords: [String],
    analyzedAt: Date
  }
}, { timestamps: true });

ResumeSchema.index({ userId: 1, createdAt: -1 });

export const Resume = mongoose.model<IResume>('Resume', ResumeSchema);
