import mongoose, { Document, Schema } from "mongoose";

export type QrSessionStatus =
  | "PENDING"
  | "SCANNED"
  | "AWAITING_APPROVAL"
  | "SIGNING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface IQrAuthSession extends Document {
  sessionId: string;
  nonce: string;
  challenge: string;
  status: QrSessionStatus;
  purpose: "LOGIN" | "wallet_login";
  walletProvider?: string;
  walletType?: string;
  network?: string;
  walletAddress?: string;
  verifiedUserId?: mongoose.Types.ObjectId;
  onboardingToken?: string;
  isNewUser?: boolean;
  requiresProfileSetup?: boolean;
  verifiedAt?: Date;
  consumedAt?: Date;
  claimedAt?: Date;
  failureReason?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const QrAuthSessionSchema = new Schema<IQrAuthSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
    },
    challenge: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "SCANNED",
        "AWAITING_APPROVAL",
        "SIGNING",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },
    purpose: {
      type: String,
      enum: ["LOGIN", "wallet_login"],
      default: "LOGIN",
      required: true,
    },
    walletProvider: {
      type: String,
      lowercase: true,
      trim: true,
    },
    walletType: {
      type: String,
      lowercase: true,
      trim: true,
    },
    network: {
      type: String,
      lowercase: true,
      trim: true,
    },
    walletAddress: {
      type: String,
      trim: true,
      index: true,
    },
    verifiedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    onboardingToken: {
      type: String,
    },
    isNewUser: {
      type: Boolean,
      default: false,
    },
    requiresProfileSetup: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    consumedAt: {
      type: Date,
    },
    claimedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Automatically clean up old QR sessions 1 hour after expiration
QrAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
QrAuthSessionSchema.index({ sessionId: 1, status: 1 });

export const QrAuthSession = mongoose.model<IQrAuthSession>(
  "QrAuthSession",
  QrAuthSessionSchema
);
