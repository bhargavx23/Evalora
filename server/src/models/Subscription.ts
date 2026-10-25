import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended';

export interface ISubscriptionEntitlements {
  domainPreparation: boolean;
  allowedDomains: string[]; // ['*'] for all domains, or specific slugs ['mern-stack', 'ai-machine-learning']
  practiceAttempts?: number;
  unlimitedDomainPractice?: boolean;
  codeWorkspacesEnabled?: boolean;
  codeVisualization?: boolean;
  maxProjects?: number;
}

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: string;
  planName: string;
  transactionId: string;
  paymentIntentId?: string;
  status: SubscriptionStatus;
  startDate: Date;
  expiresAt: Date;
  pricePaidAlgo: number;
  currency: 'ALGO';
  walletAddress: string;
  entitlements: ISubscriptionEntitlements;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Helpers
  isActive(): boolean;
  hasDomainAccess(domainSlug: string): boolean;
  hasCodeVisualizationAccess(): boolean;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    planId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    planName: {
      type: String,
      required: true,
      trim: true
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    paymentIntentId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active',
      index: true
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    pricePaidAlgo: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      enum: ['ALGO'],
      default: 'ALGO'
    },
    walletAddress: {
      type: String,
      required: true,
      trim: true
    },
    entitlements: {
      domainPreparation: {
        type: Boolean,
        default: true
      },
      allowedDomains: {
        type: [String],
        default: ['*']
      },
      practiceAttempts: {
        type: Number,
        default: 0
      },
      unlimitedDomainPractice: {
        type: Boolean,
        default: true
      },
      codeWorkspacesEnabled: {
        type: Boolean,
        default: true
      },
      codeVisualization: {
        type: Boolean,
        default: false
      },
      maxProjects: {
        type: Number,
        default: 20
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

SubscriptionSchema.index({ userId: 1, status: 1, expiresAt: 1 });

SubscriptionSchema.methods.isActive = function (): boolean {
  if (this.status !== 'active') return false;
  return new Date(this.expiresAt).getTime() > Date.now();
};

SubscriptionSchema.methods.hasDomainAccess = function (domainSlug: string): boolean {
  if (!this.isActive()) return false;
  if (!this.entitlements?.domainPreparation) return false;
  const allowed = this.entitlements.allowedDomains || [];
  if (allowed.includes('*')) return true;
  return allowed.includes(domainSlug.toLowerCase());
};

SubscriptionSchema.methods.hasCodeVisualizationAccess = function (): boolean {
  if (!this.isActive()) return false;
  return Boolean(this.entitlements?.codeVisualization);
};

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
