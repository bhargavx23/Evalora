import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  collegeId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, trim: true }
  },
  { timestamps: true }
);

DepartmentSchema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);
