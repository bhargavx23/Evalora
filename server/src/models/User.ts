import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole =
  | "admin"
  | "platform_admin"
  | "college_admin"
  | "faculty"
  | "student";

export type UserPlan = "free" | "pro" | "enterprise";

export interface IAttemptQuota {
  total: number;
  used: number;
}

export interface IUserWallet {
  address: string;
  walletType: string;
  network: string;
  verified: boolean;
  linkedAt: Date;
  lastUsedAt?: Date;
  publicKey?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  role: UserRole;
  collegeId?: mongoose.Types.ObjectId | null;
  departmentId?: mongoose.Types.ObjectId | null;
  studentId?: string; // Roll number or student registration ID
  employeeId?: string; // Faculty or admin employee ID
  walletAddress?: string; // Primary verified Algorand wallet address (backward compatible)
  wallets: IUserWallet[];
  googleId?: string;
  authProviders?: Array<"password" | "google" | "otp" | "wallet">;
  emailVerified: boolean;
  authTokenVersion: number;
  status: "active" | "suspended";
  avatar?: string;
  freeAttempts: IAttemptQuota;
  paidAttempts: IAttemptQuota;
  plan: UserPlan;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const AttemptQuotaSchema = new Schema<IAttemptQuota>(
  {
    total: { type: Number, default: 10, min: 0 },
    used: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const UserWalletSchema = new Schema<IUserWallet>(
  {
    address: { type: String, required: true, trim: true },
    walletType: { type: String, required: true, lowercase: true, trim: true, default: "pera" },
    network: { type: String, required: true, lowercase: true, trim: true, default: "algorand" },
    verified: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
    publicKey: { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ["admin", "platform_admin", "college_admin", "faculty", "student"],
      default: "student",
    },
    collegeId: {
      type: Schema.Types.ObjectId,
      ref: "College",
      default: null,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    studentId: { type: String, trim: true },
    employeeId: { type: String, trim: true },
    walletAddress: {
      type: String,
      trim: true,
      unique: true,
      index: true,
      sparse: true,
    },
    wallets: {
      type: [UserWalletSchema],
      default: [],
    },
    googleId: { type: String, trim: true, index: true, sparse: true },
    authProviders: {
      type: [String],
      enum: ["password", "google", "otp", "wallet"],
      default: ["password"],
    },
    emailVerified: { type: Boolean, default: true },
    authTokenVersion: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    avatar: { type: String, trim: true },
    freeAttempts: {
      type: AttemptQuotaSchema,
      default: () => ({ total: 10, used: 0 }),
    },
    paidAttempts: {
      type: AttemptQuotaSchema,
      default: () => ({ total: 0, used: 0 }),
    },
    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },
  },
  { timestamps: true },
);

UserSchema.index({ collegeId: 1, role: 1 });
UserSchema.index({ collegeId: 1, email: 1 });
UserSchema.index({ studentId: 1, collegeId: 1 }, { sparse: true });
UserSchema.index({ "wallets.address": 1, "wallets.network": 1 });
UserSchema.index({ "wallets.address": 1, "wallets.verified": 1 });

UserSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
