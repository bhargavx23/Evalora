import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  planId: string;
  name: string;
  description: string;
  price: number; // in ALGO, strictly 0 < price < 9
  currency: 'ALGO';
  attempts: number; // number of practice attempts unlocked
  active: boolean;
  popular?: boolean;
  features: string[];
  exclusions?: string[];
  entitlements?: {
    domainPreparation?: boolean;
    allowedDomains?: string[];
    subscriptionDurationDays?: number;
    unlimitedDomainPractice?: boolean;
    aiAdaptivePractice?: boolean;
    codeWorkspacesEnabled?: boolean;
    codeVisualization?: boolean;
    performanceReportsPdf?: boolean;
    priorityExecution?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;

  // Compatibility virtuals
  id: string;
  priceAlgo: number;
  priceMicroAlgos: number;
  paidAttempts: number;
}

const PlanSchema = new Schema<IPlan>(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    price: {
      type: Number,
      required: true,
      validate: {
        validator: function (val: number) {
          return typeof val === 'number' && !isNaN(val) && val > 0 && val < 9;
        },
        message: 'Plan price must be strictly greater than 0 and less than 9 ALGO (0 < price < 9 ALGO).'
      }
    },
    currency: {
      type: String,
      enum: ['ALGO'],
      default: 'ALGO',
      required: true
    },
    attempts: {
      type: Number,
      required: true,
      min: [1, 'Attempts must be at least 1']
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    popular: {
      type: Boolean,
      default: false
    },
    features: {
      type: [String],
      default: []
    },
    exclusions: {
      type: [String],
      default: []
    },
    entitlements: {
      domainPreparation: { type: Boolean, default: false },
      allowedDomains: { type: [String], default: ['*'] },
      subscriptionDurationDays: { type: Number, default: 30 },
      unlimitedDomainPractice: { type: Boolean, default: true },
      aiAdaptivePractice: { type: Boolean, default: true },
      codeWorkspacesEnabled: { type: Boolean, default: false },
      codeVisualization: { type: Boolean, default: false },
      performanceReportsPdf: { type: Boolean, default: true },
      priorityExecution: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual properties for backwards compatibility
PlanSchema.virtual('id').get(function () {
  return this.planId;
});

PlanSchema.virtual('priceAlgo').get(function () {
  return this.price;
});

PlanSchema.virtual('paidAttempts').get(function () {
  return this.attempts;
});

PlanSchema.virtual('priceMicroAlgos').get(function () {
  return Math.round(this.price * 1_000_000);
});

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
