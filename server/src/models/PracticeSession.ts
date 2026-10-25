import mongoose, { Schema, Document } from 'mongoose';

export interface IPracticeAnswer {
  questionId: mongoose.Types.ObjectId;
  selectedOptionIds?: string[];
  codeSubmission?: {
    language: string;
    code: string;
    verdict: string;
    testCasesPassed: number;
    totalTestCases: number;
  };
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface IPracticeSectionConfig {
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  requestedCount?: number;
  count: number;
  type?: 'mcq' | 'coding' | 'mixed';
  questionIds?: mongoose.Types.ObjectId[];
  solvedCount?: number;
  correctCount?: number;
}

export type PracticeSessionStatus =
  | 'created'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'expired';

export interface IPracticeSession extends Document {
  studentId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId | null;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionCount: number;
  type: 'mcq' | 'coding' | 'mixed';
  language?: string;
  sections?: IPracticeSectionConfig[];
  questionIds: mongoose.Types.ObjectId[];
  answers: IPracticeAnswer[];
  score: number;
  accuracyPercentage: number;
  totalQuestions: number;
  correctCount: number;
  timeTakenSeconds: number;
  startedAt?: Date;
  completedAt?: Date;
  status: PracticeSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAnswerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOptionIds: [{ type: String }],
    codeSubmission: {
      language: { type: String },
      code: { type: String },
      verdict: { type: String },
      testCasesPassed: { type: Number, default: 0 },
      totalTestCases: { type: Number, default: 0 }
    },
    isCorrect: { type: Boolean, default: false },
    timeSpentSeconds: { type: Number, default: 0 }
  },
  { _id: false }
);

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', default: null, index: true },
    topic: { type: String, required: true },
    subtopic: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], required: true },
    questionCount: { type: Number, required: true },
    type: { type: String, enum: ['mcq', 'coding', 'mixed'], required: true },
    language: { type: String },
    sections: [
      {
        category: { type: String },
        topic: { type: String, required: true },
        subtopic: { type: String },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'medium' },
        requestedCount: { type: Number },
        count: { type: Number, required: true },
        type: { type: String, enum: ['mcq', 'coding', 'mixed'] },
        questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
        solvedCount: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 }
      }
    ],
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    answers: [PracticeAnswerSchema],
    score: { type: Number, default: 0 },
    accuracyPercentage: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['created', 'active', 'in_progress', 'completed', 'abandoned', 'expired'],
      default: 'active'
    }
  },
  { timestamps: true }
);

PracticeSessionSchema.index({ studentId: 1, status: 1, createdAt: -1 });

export const PracticeSession = mongoose.model<IPracticeSession>('PracticeSession', PracticeSessionSchema);
