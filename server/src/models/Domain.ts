import mongoose, { Document, Schema } from 'mongoose';

export interface IDomainModule {
  moduleId: string;
  title: string;
  description: string;
  order: number;
  topics: string[];
  exerciseTypes: Array<'mcq' | 'coding' | 'project' | 'interview'>;
  estimatedHours: number;
}

export interface IProjectStarterFile {
  filename: string;
  language: string;
  content: string;
}

export interface IProjectTask {
  taskId: string;
  title: string;
  description: string;
  hint?: string;
  testCriteria?: string;
}

export interface IDomainProject {
  projectId: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  starterFiles: IProjectStarterFile[];
  tasks: IProjectTask[];
  evaluationType: 'frontend' | 'backend' | 'fullstack';
}

export interface IDomainAssessment {
  assessmentId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  topics: string[];
}

export interface IDomain extends Document {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  technologies: string[];
  overview: string;
  icon: string;
  badge: string;
  active: boolean;
  order: number;
  modules: IDomainModule[];
  projects: IDomainProject[];
  assessments: IDomainAssessment[];
  createdAt: Date;
  updatedAt: Date;
}

const DomainModuleSchema = new Schema<IDomainModule>(
  {
    moduleId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    topics: { type: [String], default: [] },
    exerciseTypes: {
      type: [String],
      enum: ['mcq', 'coding', 'project', 'interview'],
      default: ['mcq', 'coding']
    },
    estimatedHours: { type: Number, default: 10 }
  },
  { _id: false }
);

const ProjectStarterFileSchema = new Schema<IProjectStarterFile>(
  {
    filename: { type: String, required: true },
    language: { type: String, required: true },
    content: { type: String, default: '' }
  },
  { _id: false }
);

const ProjectTaskSchema = new Schema<IProjectTask>(
  {
    taskId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    hint: { type: String },
    testCriteria: { type: String }
  },
  { _id: false }
);

const DomainProjectSchema = new Schema<IDomainProject>(
  {
    projectId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    starterFiles: { type: [ProjectStarterFileSchema], default: [] },
    tasks: { type: [ProjectTaskSchema], default: [] },
    evaluationType: {
      type: String,
      enum: ['frontend', 'backend', 'fullstack'],
      default: 'frontend'
    }
  },
  { _id: false }
);

const DomainAssessmentSchema = new Schema<IDomainAssessment>(
  {
    assessmentId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    durationMinutes: { type: Number, default: 45 },
    passingScore: { type: Number, default: 70 },
    topics: { type: [String], default: [] }
  },
  { _id: false }
);

const DomainSchema = new Schema<IDomain>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    technologies: { type: [String], default: [] },
    overview: { type: String, default: '' },
    icon: { type: String, default: 'code' },
    badge: { type: String, default: 'Full Track' },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    modules: { type: [DomainModuleSchema], default: [] },
    projects: { type: [DomainProjectSchema], default: [] },
    assessments: { type: [DomainAssessmentSchema], default: [] }
  },
  {
    timestamps: true
  }
);

export const Domain = mongoose.model<IDomain>('Domain', DomainSchema);
