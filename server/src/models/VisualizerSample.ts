import mongoose, { Schema, Document } from 'mongoose';

export interface IVisualizerSample extends Document {
  sampleId: string;
  title: string;
  language: 'javascript' | 'python';
  category: 'basics' | 'arrays' | 'recursion' | 'searching' | 'sorting';
  difficulty: 'beginner' | 'intermediate';
  description: string;
  code: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const VisualizerSampleSchema = new Schema<IVisualizerSample>(
  {
    sampleId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    language: { type: String, required: true, enum: ['javascript', 'python'] },
    category: {
      type: String,
      required: true,
      enum: ['basics', 'arrays', 'recursion', 'searching', 'sorting'],
      default: 'basics'
    },
    difficulty: { type: String, required: true, enum: ['beginner', 'intermediate'], default: 'beginner' },
    description: { type: String, required: true },
    code: { type: String, required: true },
    sortOrder: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

export const VisualizerSample = mongoose.model<IVisualizerSample>(
  'VisualizerSample',
  VisualizerSampleSchema
);
