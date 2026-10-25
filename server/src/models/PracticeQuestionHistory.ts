import mongoose, { Schema, Document } from 'mongoose';

export interface IPracticeQuestionHistory extends Document {
  studentId: mongoose.Types.ObjectId;
  collegeId?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  wasCorrect: boolean;
  timeSpentSeconds: number;
  attemptedAt: Date;
}

const PracticeQuestionHistorySchema = new Schema<IPracticeQuestionHistory>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: false, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    topic: { type: String, required: true, index: true },
    subtopic: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    wasCorrect: { type: Boolean, required: true },
    timeSpentSeconds: { type: Number, default: 0 },
    attemptedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

PracticeQuestionHistorySchema.index({ studentId: 1, questionId: 1, attemptedAt: -1 });

export const PracticeQuestionHistory = mongoose.model<IPracticeQuestionHistory>(
  'PracticeQuestionHistory',
  PracticeQuestionHistorySchema
);
