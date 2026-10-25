import mongoose, { Document, Schema } from 'mongoose';

export interface ICompletedProjectRecord {
  projectId: string;
  completedAt: Date;
  score: number;
  feedback: string;
  filesSubmitted?: Array<{ filename: string; content: string }>;
}

export interface IAssessmentScoreRecord {
  assessmentId: string;
  score: number;
  passed: boolean;
  takenAt: Date;
}

export interface ICompletedExerciseRecord {
  exerciseId: string;
  moduleId: string;
  topic: string;
  completedAt: Date;
  score?: number;
}

export interface IAssignmentAttemptRecord {
  assignmentId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  feedback: string;
  submittedAt: Date;
  filesSubmitted?: Array<{ filename: string; content: string }>;
}

export interface ISavedWorkspaceRecord {
  workspaceKey: string;
  files: Array<{ filename: string; language: string; content: string }>;
  updatedAt: Date;
}

export interface IDomainProgress extends Document {
  userId: mongoose.Types.ObjectId;
  domainSlug: string;
  completedModules: string[];
  unlockedModules: string[];
  completedTopics: string[];
  completedExercises: ICompletedExerciseRecord[];
  completedProjects: ICompletedProjectRecord[];
  assignmentAttempts: IAssignmentAttemptRecord[];
  savedWorkspaces: ISavedWorkspaceRecord[];
  questionsAttempted: number;
  questionsCorrect: number;
  codingTasksCompleted: number;
  currentStage: string;
  recommendedNextTopic: string;
  lastActiveAt: Date;
  assessmentScores: IAssessmentScoreRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const CompletedProjectSchema = new Schema<ICompletedProjectRecord>(
  {
    projectId: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
    score: { type: Number, required: true },
    feedback: { type: String, default: '' },
    filesSubmitted: [
      {
        filename: { type: String },
        content: { type: String }
      }
    ]
  },
  { _id: false }
);

const AssessmentScoreRecordSchema = new Schema<IAssessmentScoreRecord>(
  {
    assessmentId: { type: String, required: true },
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    takenAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const CompletedExerciseRecordSchema = new Schema<ICompletedExerciseRecord>(
  {
    exerciseId: { type: String, required: true },
    moduleId: { type: String, required: true },
    topic: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
    score: { type: Number, default: 100 }
  },
  { _id: false }
);

const AssignmentAttemptRecordSchema = new Schema<IAssignmentAttemptRecord>(
  {
    assignmentId: { type: String, required: true },
    moduleId: { type: String, required: true },
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    feedback: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    filesSubmitted: [
      {
        filename: { type: String },
        content: { type: String }
      }
    ]
  },
  { _id: false }
);

const SavedWorkspaceRecordSchema = new Schema<ISavedWorkspaceRecord>(
  {
    workspaceKey: { type: String, required: true },
    files: [
      {
        filename: { type: String, required: true },
        language: { type: String, default: 'javascript' },
        content: { type: String, default: '' }
      }
    ],
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const DomainProgressSchema = new Schema<IDomainProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    domainSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    completedModules: { type: [String], default: [] },
    unlockedModules: { type: [String], default: [] },
    completedTopics: { type: [String], default: [] },
    completedExercises: { type: [CompletedExerciseRecordSchema], default: [] },
    completedProjects: { type: [CompletedProjectSchema], default: [] },
    assignmentAttempts: { type: [AssignmentAttemptRecordSchema], default: [] },
    savedWorkspaces: { type: [SavedWorkspaceRecordSchema], default: [] },
    questionsAttempted: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    codingTasksCompleted: { type: Number, default: 0 },
    currentStage: { type: String, default: 'Getting Started' },
    recommendedNextTopic: { type: String, default: '' },
    lastActiveAt: { type: Date, default: Date.now },
    assessmentScores: { type: [AssessmentScoreRecordSchema], default: [] }
  },
  {
    timestamps: true
  }
);

DomainProgressSchema.index({ userId: 1, domainSlug: 1 }, { unique: true });

export const DomainProgress = mongoose.model<IDomainProgress>(
  'DomainProgress',
  DomainProgressSchema
);
