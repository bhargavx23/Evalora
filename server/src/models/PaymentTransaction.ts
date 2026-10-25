import mongoose, { Document, Schema } from 'mongoose';

export type PaymentTransactionStatus =
  | 'pending'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'expired'
  | 'rejected';

export type PaymentPurpose = 'PRACTICE_ATTEMPTS' | 'PLAN_PURCHASE';

export interface IPaymentTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  walletAddress: string;
  transactionId: string;
  amount: number; // ALGO
  amountMicroAlgos: number;
  currency: 'ALGO';
  purpose: PaymentPurpose;
  planId: string;
  paymentIntentId?: string;
  receiverAddress: string;
  network: string;
  blockchainRound?: number;
  attemptsUnlocked: number;
  status: PaymentTransactionStatus;
  receiptNumber?: string;
  failureReason?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    walletAddress: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    amountMicroAlgos: {
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
    purpose: {
      type: String,
      enum: ['PRACTICE_ATTEMPTS', 'PLAN_PURCHASE'],
      default: 'PRACTICE_ATTEMPTS',
      required: true
    },
    planId: {
      type: String,
      required: true,
      index: true
    },
    paymentIntentId: {
      type: String,
      trim: true,
      index: true
    },
    receiverAddress: {
      type: String,
      required: true,
      trim: true
    },
    network: {
      type: String,
      required: true,
      default: 'testnet',
      index: true
    },
    blockchainRound: {
      type: Number
    },
    attemptsUnlocked: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'verifying', 'verified', 'failed', 'expired', 'rejected'],
      default: 'pending',
      required: true,
      index: true
    },
    receiptNumber: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      index: true
    },
    failureReason: {
      type: String
    },
    verifiedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ walletAddress: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
