import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessmentSection {
  id: string;
  name: string;
  type: 'aptitude' | 'technical' | 'coding' | 'mixed';
  questionIds: mongoose.Types.ObjectId[];
  marksPerQuestion: number;
  totalMarks: number;
}

export interface IAssessmentRules {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
  fullscreenRequired: boolean;
  tabSwitchLimit: number;
  copyPasteRestricted: boolean;
  maxAttempts: number;
}

export interface IAssessment extends Document {
  collegeId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  passPercentage: number;
  status: 'draft' | 'published' | 'archived';
  startDate: Date;
  endDate: Date;
  sections: IAssessmentSection[];
  rules: IAssessmentRules;
  assignedDepartments: mongoose.Types.ObjectId[];
  assignedStudents: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['aptitude', 'technical', 'coding', 'mixed'],
      required: true
    },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    marksPerQuestion: { type: Number, default: 1 },
    totalMarks: { type: Number, default: 0 }
  },
  { _id: false }
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },
    durationMinutes: { type: Number, required: true, default: 60 },
    totalMarks: { type: Number, required: true, default: 100 },
    passPercentage: { type: Number, default: 40 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    sections: [AssessmentSectionSchema],
    rules: {
      shuffleQuestions: { type: Boolean, default: false },
      shuffleOptions: { type: Boolean, default: false },
      negativeMarking: { type: Boolean, default: false },
      fullscreenRequired: { type: Boolean, default: true },
      tabSwitchLimit: { type: Number, default: 3 },
      copyPasteRestricted: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 1 }
    },
    assignedDepartments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    assignedStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

AssessmentSchema.index({ collegeId: 1, status: 1, startDate: 1, endDate: 1 });

export const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
