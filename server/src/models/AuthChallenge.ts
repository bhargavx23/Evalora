import mongoose, { Document, Schema } from "mongoose";

export type AuthChallengePurpose =
  | "login"
  | "password_reset"
  | "email_verification"
  | "wallet_auth"
  | "wallet_link"
  | "wallet_register";

export interface IAuthChallenge extends Document {
  email?: string;
  walletAddress?: string;
  walletType?: string;
  network?: string;
  purpose: AuthChallengePurpose;
  codeHash?: string;
  nonce?: string;
  nonceId?: string;
  userId?: mongoose.Types.ObjectId;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  consumedAt?: Date;
}

const AuthChallengeSchema = new Schema<IAuthChallenge>(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    walletAddress: {
      type: String,
      trim: true,
      index: true,
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
    purpose: {
      type: String,
      enum: [
        "login",
        "password_reset",
        "email_verification",
        "wallet_auth",
        "wallet_link",
        "wallet_register",
      ],
      required: true,
      index: true,
    },
    codeHash: { type: String },
    nonce: { type: String },
    nonceId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, required: true }, // Index defined below with TTL
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);

AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthChallengeSchema.index({ email: 1, purpose: 1, consumedAt: 1 });
AuthChallengeSchema.index({ walletAddress: 1, purpose: 1, consumedAt: 1 });
AuthChallengeSchema.index({ walletAddress: 1, network: 1, purpose: 1, consumedAt: 1 });

export const AuthChallenge = mongoose.model<IAuthChallenge>(
  "AuthChallenge",
  AuthChallengeSchema,
);
