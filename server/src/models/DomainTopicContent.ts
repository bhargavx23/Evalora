import mongoose, { Document, Schema } from 'mongoose';
import { IWorkspaceConfig } from './DomainAssignment.js';

export interface ITopicLesson {
  lessonId: string;
  title: string;
  concept: string;
  whatIsIt?: string;
  whyNeeded?: string;
  realWorldAnalogy?: string;
  syntaxBreakdown?: Array<{
    element: string;
    explanation: string;
  }>;
  codeExamples: Array<{
    title: string;
    language: string;
    code: string;
    explanation: string;
    expectedResult?: string;
    lineByLineExplanation?: Array<{
      line: string | number;
      explanation: string;
    }>;
  }>;
  keyTakeaways: string[];
}

export interface ITopicExercise {
  exerciseId: string;
  title: string;
  instruction: string;
  type: 'coding' | 'debugging' | 'output_prediction' | 'knowledge_check';
  difficulty: 'easy' | 'medium' | 'hard';
  starterCode?: string;
  solutionSnippet?: string;
  language?: string;
  hints?: string[];
  testCriteria?: string;
  workspaceConfig?: IWorkspaceConfig;
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  explanation?: string;
}

export interface IDomainTopicContent extends Document {
  domainSlug: string;
  moduleId: string;
  topic: string;
  overview: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  lessons: ITopicLesson[];
  exercises: ITopicExercise[];
  status: 'draft' | 'validated' | 'published';
  source: 'ai_generated' | 'curriculum_curated';
  createdAt: Date;
  updatedAt: Date;
}

const TopicLessonSchema = new Schema<ITopicLesson>(
  {
    lessonId: { type: String, required: true },
    title: { type: String, required: true },
    concept: { type: String, required: true },
    whatIsIt: { type: String },
    whyNeeded: { type: String },
    realWorldAnalogy: { type: String },
    syntaxBreakdown: [
      {
        element: { type: String },
        explanation: { type: String }
      }
    ],
    codeExamples: [
      {
        title: { type: String, required: true },
        language: { type: String, required: true, default: 'javascript' },
        code: { type: String, required: true },
        explanation: { type: String, required: true },
        expectedResult: { type: String },
        lineByLineExplanation: [
          {
            line: { type: Schema.Types.Mixed },
            explanation: { type: String }
          }
        ]
      }
    ],
    keyTakeaways: { type: [String], default: [] }
  },
  { _id: false }
);

const TopicExerciseSchema = new Schema<ITopicExercise>(
  {
    exerciseId: { type: String, required: true },
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    type: {
      type: String,
      enum: ['coding', 'debugging', 'output_prediction', 'knowledge_check'],
      required: true
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    starterCode: { type: String },
    solutionSnippet: { type: String },
    language: { type: String, default: 'javascript' },
    hints: { type: [String], default: [] },
    testCriteria: { type: String },
    workspaceConfig: { type: Schema.Types.Mixed },
    options: [
      {
        id: { type: String },
        text: { type: String },
        isCorrect: { type: Boolean }
      }
    ],
    explanation: { type: String }
  },
  { _id: false }
);

const DomainTopicContentSchema = new Schema<IDomainTopicContent>(
  {
    domainSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    moduleId: {
      type: String,
      required: true,
      index: true
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    overview: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    estimatedMinutes: { type: Number, default: 25 },
    lessons: { type: [TopicLessonSchema], default: [] },
    exercises: { type: [TopicExerciseSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'validated', 'published'],
      default: 'published'
    },
    source: {
      type: String,
      enum: ['ai_generated', 'curriculum_curated'],
      default: 'ai_generated'
    }
  },
  {
    timestamps: true
  }
);

DomainTopicContentSchema.index(
  { domainSlug: 1, moduleId: 1, topic: 1 },
  { unique: true }
);

export const DomainTopicContent = mongoose.model<IDomainTopicContent>(
  'DomainTopicContent',
  DomainTopicContentSchema
);
