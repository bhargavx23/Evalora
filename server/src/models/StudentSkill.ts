import mongoose, { Schema, Document } from 'mongoose';

export interface IStudentSkill extends Document {
  studentId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId;
  topic: string;
  subtopic?: string;
  scorePercentage: number;
  totalAttempted: number;
  totalCorrect: number;
  consecutiveSuccessCount: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  lastPracticedAt: Date;
  status: 'strong' | 'needs_improvement' | 'moderate';
  createdAt: Date;
  updatedAt: Date;
}

const StudentSkillSchema = new Schema<IStudentSkill>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: false, index: true },
    topic: { type: String, required: true },
    subtopic: { type: String },
    scorePercentage: { type: Number, default: 0 },
    totalAttempted: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    consecutiveSuccessCount: { type: Number, default: 0 },
    difficultyLevel: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    lastPracticedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['strong', 'needs_improvement', 'moderate'],
      default: 'moderate'
    }
  },
  { timestamps: true }
);

StudentSkillSchema.index({ studentId: 1, topic: 1 }, { unique: true });

export const StudentSkill = mongoose.model<IStudentSkill>('StudentSkill', StudentSkillSchema);
