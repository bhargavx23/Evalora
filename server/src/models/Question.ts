import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'coding';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type CodingLanguage = 'c' | 'cpp' | 'python' | 'java';

export interface ITestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  weight?: number;
  explanation?: string;
}

export interface IExampleCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface ICodingDetails {
  supportedLanguages: CodingLanguage[];
  starterCode: {
    c?: string;
    cpp?: string;
    python?: string;
    java?: string;
  };
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: IExampleCase[];
  visibleTestCases: ITestCase[];
  hiddenTestCases: ITestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  expectedComplexity?: {
    time?: string;
    space?: string;
  };
  referenceSolution?: {
    language: CodingLanguage;
    code: string;
  };
}

export type QuestionSource = 'manual' | 'ai' | 'imported' | 'seed' | 'domain_curriculum';
export type QuestionValidationStatus =
  | 'generated'
  | 'validating'
  | 'validated'
  | 'rejected'
  | 'disabled'
  | 'pending_execution';

export interface IQuestion extends Document {
  collegeId?: mongoose.Types.ObjectId | null; // null = Global question
  creatorId?: mongoose.Types.ObjectId | null;
  createdBy?: 'human' | 'ai';
  source?: QuestionSource;
  generationProvider?: 'openai' | 'gemini' | null;
  generationModel?: string;
  validationStatus?: QuestionValidationStatus;
  normalizedHash?: string;
  generatedAt?: Date;
  validatedAt?: Date;
  rejectionReason?: string;
  title: string;
  description: string;
  type: QuestionType;
  category?: string;
  topic: string;
  subtopic: string;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  estimatedTimeMinutes: number;
  tags: string[];
  options?: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  codingDetails?: ICodingDetails;
  explanation?: string;
  status: 'draft' | 'verified' | 'archived';
  conceptId?: string;
  variantName?: string;
  usageCount: number;
  attemptCount: number;
  correctCount: number;
  avgTimeSeconds: number;
  discriminationIndex?: number;
  failureRate?: number;
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TestCaseSchema = new Schema(
  {
    id: { type: String },
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    weight: { type: Number, default: 1 },
    explanation: { type: String }
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', default: null, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: {
      type: String,
      enum: ['human', 'ai'],
      default: 'human',
      index: true
    },
    source: {
      type: String,
      enum: ['manual', 'ai', 'imported', 'seed', 'domain_curriculum'],
      default: 'manual',
      index: true
    },
    generationProvider: {
      type: String,
      enum: ['openai', 'gemini', null],
      default: null,
      index: true
    },
    generationModel: { type: String, trim: true },
    validationStatus: {
      type: String,
      enum: ['generated', 'validating', 'validated', 'rejected', 'disabled', 'pending_execution'],
      default: 'validated',
      index: true
    },
    normalizedHash: { type: String, index: true },
    generatedAt: { type: Date },
    validatedAt: { type: Date },
    rejectionReason: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['mcq', 'multiple_select', 'true_false', 'coding'],
      required: true
    },
    category: { type: String, trim: true, index: true },
    topic: { type: String, required: true, index: true },
    subtopic: { type: String, required: true, index: true },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true
    },
    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    estimatedTimeMinutes: { type: Number, default: 2 },
    tags: [{ type: String, trim: true }],
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, required: true }
      }
    ],
    codingDetails: {
      supportedLanguages: [{ type: String, enum: ['c', 'cpp', 'python', 'java'] }],
      starterCode: {
        c: { type: String },
        cpp: { type: String },
        python: { type: String },
        java: { type: String }
      },
      inputFormat: { type: String },
      outputFormat: { type: String },
      constraints: { type: String },
      examples: [
        {
          input: { type: String },
          output: { type: String },
          explanation: { type: String }
        }
      ],
      visibleTestCases: [TestCaseSchema],
      hiddenTestCases: [TestCaseSchema],
      timeLimitMs: { type: Number, default: 3000 },
      memoryLimitMb: { type: Number, default: 256 },
      expectedComplexity: {
        time: { type: String },
        space: { type: String }
      },
      referenceSolution: {
        language: { type: String, enum: ['c', 'cpp', 'python', 'java'] },
        code: { type: String }
      }
    },
    explanation: { type: String },
    status: {
      type: String,
      enum: ['draft', 'verified', 'archived'],
      default: 'verified',
      index: true
    },
    conceptId: { type: String, index: true },
    variantName: { type: String },
    usageCount: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    avgTimeSeconds: { type: Number, default: 0 },
    discriminationIndex: { type: Number, default: 0 },
    failureRate: { type: Number, default: 0 },
    flagReason: { type: String }
  },
  { timestamps: true }
);

QuestionSchema.index({ collegeId: 1, topic: 1, difficulty: 1, status: 1 });
QuestionSchema.index({ collegeId: 1, type: 1, status: 1 });
QuestionSchema.index({ source: 1, generationProvider: 1, validationStatus: 1 });
QuestionSchema.index({ topic: 1, normalizedHash: 1 });

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
