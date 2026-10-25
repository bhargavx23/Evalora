import mongoose, { Schema, Document } from 'mongoose';

export interface ICodeSimilarityResult extends Document {
  assessmentId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  studentAId: mongoose.Types.ObjectId;
  studentBId: mongoose.Types.ObjectId;
  submissionAId: mongoose.Types.ObjectId;
  submissionBId: mongoose.Types.ObjectId;
  similarityPercentage: number;
  matchedTokensCount: number;
  flagged: boolean;
  comparedAt: Date;
}

const CodeSimilarityResultSchema = new Schema<ICodeSimilarityResult>(
  {
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    studentAId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentBId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionAId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    submissionBId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    similarityPercentage: { type: Number, required: true },
    matchedTokensCount: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false }
  },
  { timestamps: true }
);

CodeSimilarityResultSchema.index({ assessmentId: 1, questionId: 1, flagged: 1 });

export const CodeSimilarityResult = mongoose.model<ICodeSimilarityResult>(
  'CodeSimilarityResult',
  CodeSimilarityResultSchema
);
