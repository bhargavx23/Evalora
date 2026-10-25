import mongoose, { Document, Schema } from "mongoose";

export type AuthChallengePurpose =
  | "wallet_auth"
  | "wallet_link"
  | "wallet_register";

export interface IAuthChallenge extends Document {
  walletAddress?: string;
  walletType?: string;
  network?: string;
  purpose: AuthChallengePurpose;
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
        "wallet_auth",
        "wallet_link",
        "wallet_register",
      ],
      required: true,
      index: true,
    },
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
AuthChallengeSchema.index({ walletAddress: 1, purpose: 1, consumedAt: 1 });
AuthChallengeSchema.index({ walletAddress: 1, network: 1, purpose: 1, consumedAt: 1 });

export const AuthChallenge = mongoose.model<IAuthChallenge>(
  "AuthChallenge",
  AuthChallengeSchema,
);
