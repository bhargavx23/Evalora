import mongoose, { Schema, Document } from 'mongoose';

export interface IAttemptAnswer {
  questionId: mongoose.Types.ObjectId;
  sectionId: string;
  selectedOptionIds: string[];
  codeSubmission?: {
    language: string;
    code: string;
    testCasesPassed: number;
    totalTestCases: number;
    score: number;
    verdict: string;
    executionTimeMs?: number;
    memoryKb?: number;
  };
  isMarkedForReview: boolean;
  isAttempted: boolean;
  savedAt: Date;
  marksObtained: number;
}

export interface IAssessmentAttempt extends Document {
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  status: 'in_progress' | 'submitted' | 'evaluated' | 'auto_submitted' | 'terminated';
  startedAt: Date;
  submittedAt?: Date;
  expiresAt: Date;
  answers: IAttemptAnswer[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  integrityScore: number;
  suspiciousEventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptAnswerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    sectionId: { type: String, required: true },
    selectedOptionIds: [{ type: String }],
    codeSubmission: {
      language: { type: String },
      code: { type: String },
      testCasesPassed: { type: Number, default: 0 },
      totalTestCases: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      verdict: { type: String },
      executionTimeMs: { type: Number },
      memoryKb: { type: Number }
    },
    isMarkedForReview: { type: Boolean, default: false },
    isAttempted: { type: Boolean, default: false },
    savedAt: { type: Date, default: Date.now },
    marksObtained: { type: Number, default: 0 }
  },
  { _id: false }
);

const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'evaluated', 'auto_submitted', 'terminated'],
      default: 'in_progress',
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    answers: [AttemptAnswerSchema],
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    integrityScore: { type: Number, default: 100 },
    suspiciousEventCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

AssessmentAttemptSchema.index({ assessmentId: 1, studentId: 1 });
AssessmentAttemptSchema.index({ collegeId: 1, createdAt: -1 });

export const AssessmentAttempt = mongoose.model<IAssessmentAttempt>('AssessmentAttempt', AssessmentAttemptSchema);
