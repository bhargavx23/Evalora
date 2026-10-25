import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionBank extends Document {
  collegeId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  departmentId?: mongoose.Types.ObjectId;
  questionIds: mongoose.Types.ObjectId[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const QuestionBankSchema = new Schema<IQuestionBank>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    tags: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

export const QuestionBank = mongoose.model<IQuestionBank>('QuestionBank', QuestionBankSchema);
