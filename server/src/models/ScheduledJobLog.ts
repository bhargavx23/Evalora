import mongoose, { Document, Schema } from 'mongoose';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface IScheduledJobLog extends Document {
  jobType: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  lockUntil: Date;
  triggerType: 'scheduled_48h' | 'manual_admin' | 'bootstrap';
  domainsCovered: string[];
  questionsGenerated: number;
  questionsValidated: number;
  questionsRejected: number;
  questionsDuplicated: number;
  errorLogs: string[];
  summary?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledJobLogSchema = new Schema<IScheduledJobLog>(
  {
    jobType: {
      type: String,
      required: true,
      default: '48h_adaptive_question_generation',
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'running',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    completedAt: {
      type: Date
    },
    lockUntil: {
      type: Date,
      required: true,
      index: true
    },
    triggerType: {
      type: String,
      enum: ['scheduled_48h', 'manual_admin', 'bootstrap'],
      default: 'scheduled_48h'
    },
    domainsCovered: {
      type: [String],
      default: []
    },
    questionsGenerated: {
      type: Number,
      default: 0
    },
    questionsValidated: {
      type: Number,
      default: 0
    },
    questionsRejected: {
      type: Number,
      default: 0
    },
    questionsDuplicated: {
      type: Number,
      default: 0
    },
    errorLogs: {
      type: [String],
      default: []
    },
    summary: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

ScheduledJobLogSchema.index({ jobType: 1, startedAt: -1 });
ScheduledJobLogSchema.index({ status: 1, lockUntil: 1 });

export const ScheduledJobLog = mongoose.model<IScheduledJobLog>(
  'ScheduledJobLog',
  ScheduledJobLogSchema
);
