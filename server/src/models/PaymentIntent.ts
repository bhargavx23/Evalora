import mongoose, { Document, Schema } from 'mongoose';

export type PaymentIntentStatus = 'pending' | 'verifying' | 'completed' | 'expired' | 'failed';

export interface IPaymentIntent extends Document {
  intentId: string;
  userId: mongoose.Types.ObjectId;
  planId: string;
  planName: string;
  expectedAmountAlgo: number;
  expectedAmountMicroAlgos: number;
  currency: 'ALGO';
  expectedReceiver: string;
  paidAttemptsToUnlock: number;
  status: PaymentIntentStatus;
  transactionId?: string;
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentIntentSchema = new Schema<IPaymentIntent>(
  {
    intentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    planId: {
      type: String,
      required: true,
      index: true
    },
    planName: {
      type: String,
      required: true
    },
    expectedAmountAlgo: {
      type: Number,
      required: true,
      min: 0
    },
    expectedAmountMicroAlgos: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ['ALGO'],
      default: 'ALGO',
      required: true
    },
    expectedReceiver: {
      type: String,
      required: true,
      trim: true
    },
    paidAttemptsToUnlock: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ['pending', 'verifying', 'completed', 'expired', 'failed'],
      default: 'pending',
      index: true
    },
    transactionId: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

PaymentIntentSchema.index({ userId: 1, status: 1 });
PaymentIntentSchema.index({ intentId: 1, userId: 1 });

export const PaymentIntent = mongoose.model<IPaymentIntent>('PaymentIntent', PaymentIntentSchema);
