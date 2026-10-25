import mongoose, { Schema, Document } from 'mongoose';
import { IntegrityEventType } from '../shared/types.js';

export interface ISuspiciousActivity extends Document {
  attemptId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  type: IntegrityEventType;
  details?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const SuspiciousActivitySchema = new Schema<ISuspiciousActivity>(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'AssessmentAttempt', required: true, index: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    type: {
      type: String,
      enum: ['tab_switch', 'fullscreen_exit', 'copy_attempt', 'paste_attempt', 'window_blur'],
      required: true
    },
    details: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const SuspiciousActivity = mongoose.model<ISuspiciousActivity>(
  'SuspiciousActivity',
  SuspiciousActivitySchema
);
