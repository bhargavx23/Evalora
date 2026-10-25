import mongoose, { Schema, Document } from 'mongoose';
import { SubmissionVerdict, CodingLanguage } from '../shared/types.js';

export interface ISubmission extends Document {
  studentId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  assessmentId?: mongoose.Types.ObjectId;
  practiceSessionId?: mongoose.Types.ObjectId;
  language: CodingLanguage;
  code: string;
  normalizedCode?: string; // Tokenized / AST simplified string for similarity comparisons
  verdict: SubmissionVerdict;
  testCasesPassed: number;
  totalTestCases: number;
  executionTimeMs: number;
  memoryKb: number;
  errorOutput?: string;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: false, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', default: null, index: true },
    practiceSessionId: { type: Schema.Types.ObjectId, ref: 'PracticeSession', default: null, index: true },
    language: { type: String, enum: ['c', 'cpp', 'python', 'java'], required: true },
    code: { type: String, required: true },
    normalizedCode: { type: String },
    verdict: {
      type: String,
      enum: ['ACCEPTED', 'WRONG_ANSWER', 'COMPILATION_ERROR', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED'],
      required: true
    },
    testCasesPassed: { type: Number, default: 0 },
    totalTestCases: { type: Number, default: 0 },
    executionTimeMs: { type: Number, default: 0 },
    memoryKb: { type: Number, default: 0 },
    errorOutput: { type: String },
    score: { type: Number, default: 0 }
  },
  { timestamps: true }
);

SubmissionSchema.index({ studentId: 1, questionId: 1, createdAt: -1 });

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);
