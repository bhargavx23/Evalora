import { Plan } from '../models/Plan.js';
import { logger } from '../utils/logger.js';

export interface IPracticePlan {
  id: string;
  planId?: string;
  name: string;
  description: string;
  priceAlgo: number;
  price?: number;
  priceMicroAlgos: number; // 1 ALGO = 1,000,000 microAlgos
  paidAttempts: number;
  attempts?: number;
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
}

export const PRACTICE_PLANS: Record<string, IPracticePlan> = {
  trial: {
    id: "trial",
    planId: "trial",
    name: "Testnet Practice Pass",
    description: "Instant access for Algorand Testnet with 1 ALGO.",
    priceAlgo: 1,
    price: 1,
    priceMicroAlgos: 1_000_000,
    paidAttempts: 15,
    attempts: 15,
    active: true,
    popular: false,
    features: [
      "15 Unlocked Practice Attempts",
      "All Categories (DSA, Aptitude, Reasoning, Coding)",
      "Instant Testnet Verification (1 ALGO)",
      "Downloadable Performance Reports (PDF)",
      "AI Adaptive Question Selection"
    ],
    exclusions: [
      "No multi-domain technology tracks",
      "No multi-tab web development workspaces",
      "No interactive code execution visualization"
    ],
    entitlements: {
      domainPreparation: false,
      allowedDomains: [],
      subscriptionDurationDays: 0,
      unlimitedDomainPractice: false,
      aiAdaptivePractice: true,
      codeWorkspacesEnabled: false,
      codeVisualization: false,
      performanceReportsPdf: true,
      priorityExecution: false
    }
  },
  starter: {
    id: "starter",
    planId: "starter",
    name: "Starter Practice Pack",
    description: "Ideal for short interview preparation or targeted skill review.",
    priceAlgo: 3,
    price: 3,
    priceMicroAlgos: 3_000_000,
    paidAttempts: 35,
    attempts: 35,
    active: true,
    popular: false,
    features: [
      "35 Unlocked Practice Attempts",
      "All Categories (DSA, Aptitude, Reasoning, Coding)",
      "Adaptive Fresh-Question Selection",
      "Instant Test-Case Verification",
      "Official Verified Payment Receipt (PDF)"
    ],
    exclusions: [
      "No multi-domain technology tracks",
      "No interactive web project workspaces",
      "No interactive code execution visualization"
    ],
    entitlements: {
      domainPreparation: false,
      allowedDomains: [],
      subscriptionDurationDays: 0,
      unlimitedDomainPractice: false,
      aiAdaptivePractice: true,
      codeWorkspacesEnabled: false,
      codeVisualization: false,
      performanceReportsPdf: true,
      priorityExecution: false
    }
  },
  domain_pass: {
    id: "domain_pass",
    planId: "domain_pass",
    name: "Domain Preparation Pass",
    description: "Full access to Multi-Domain Learning Paths (MERN, AI/ML, Frontend, Backend, etc.).",
    priceAlgo: 4,
    price: 4,
    priceMicroAlgos: 4_000_000,
    paidAttempts: 25,
    attempts: 25,
    active: true,
    popular: false,
    features: [
      "Full Access to all Tech Domains (MERN, AI/ML, Frontend, Backend)",
      "Interactive Multi-tab Web Coding & Live Preview Workspaces",
      "Interactive Step-by-Step Code Execution Visualizer",
      "7-Module MERN Curriculum with Real Practical Projects",
      "25 Unlocked General Practice Attempts",
      "Valid for 30 Days (Practice attempts never expire)"
    ],
    exclusions: [
      "Domain preparation access expires after 30 days (attempts retained)"
    ],
    entitlements: {
      domainPreparation: true,
      allowedDomains: ["*"],
      subscriptionDurationDays: 30,
      unlimitedDomainPractice: true,
      aiAdaptivePractice: true,
      codeWorkspacesEnabled: true,
      codeVisualization: true,
      performanceReportsPdf: true,
      priorityExecution: false
    }
  },
  pro: {
    id: "pro",
    planId: "pro",
    name: "Pro Interview Bundle",
    description: "Most popular for intensive campus placement prep, domain learning, and coding practice.",
    priceAlgo: 5,
    price: 5,
    priceMicroAlgos: 5_000_000,
    paidAttempts: 75,
    attempts: 75,
    active: true,
    popular: true,
    features: [
      "75 Unlocked Practice Attempts",
      "Full Multi-Domain Preparation Access (MERN, AI/ML, etc.)",
      "Interactive Step-by-Step Code Execution Visualizer",
      "All Categories & Multi-Category Mixed Sessions",
      "AI Question Pool Replenishment",
      "Interactive Web Code Workspaces & 30-Day Domain Access"
    ],
    exclusions: [
      "Domain preparation access expires after 30 days (attempts retained)"
    ],
    entitlements: {
      domainPreparation: true,
      allowedDomains: ["*"],
      subscriptionDurationDays: 30,
      unlimitedDomainPractice: true,
      aiAdaptivePractice: true,
      codeWorkspacesEnabled: true,
      codeVisualization: true,
      performanceReportsPdf: true,
      priorityExecution: true
    }
  },
  master: {
    id: "master",
    planId: "master",
    name: "Master Placement Mastery",
    description: "Comprehensive package for semester-long assessment and full domain mastery.",
    priceAlgo: 8,
    price: 8,
    priceMicroAlgos: 8_000_000,
    paidAttempts: 150,
    attempts: 150,
    active: true,
    popular: false,
    features: [
      "150 Unlocked Practice Attempts",
      "90-Day All-Access Pass to all Tech Domains",
      "Interactive Step-by-Step Code Execution Visualizer",
      "Unlimited Multi-Category Custom Sets",
      "Priority Code Runner Execution & Project Workspaces",
      "Full Skill Diagnostic Breakdown & Domain Certification"
    ],
    exclusions: [
      "Domain preparation access expires after 90 days (attempts retained)"
    ],
    entitlements: {
      domainPreparation: true,
      allowedDomains: ["*"],
      subscriptionDurationDays: 90,
      unlimitedDomainPractice: true,
      aiAdaptivePractice: true,
      codeWorkspacesEnabled: true,
      codeVisualization: true,
      performanceReportsPdf: true,
      priorityExecution: true
    }
  }
};

export function getActivePlans(): IPracticePlan[] {
  return Object.values(PRACTICE_PLANS).filter(plan => plan.active);
}

export function getPlanById(planId: string): IPracticePlan | undefined {
  return PRACTICE_PLANS[planId];
}

/**
 * Seeds or updates default plans in MongoDB, ensuring all stored plans strictly satisfy 0 < price < 9 ALGO.
 */
export async function seedDefaultPlans(): Promise<void> {
  try {
    for (const [key, plan] of Object.entries(PRACTICE_PLANS)) {
      await Plan.findOneAndUpdate(
        { planId: key },
        {
          $set: {
            planId: key,
            name: plan.name,
            description: plan.description,
            price: plan.priceAlgo,
            currency: 'ALGO',
            attempts: plan.paidAttempts,
            active: plan.active,
            popular: plan.popular || false,
            features: plan.features,
            exclusions: plan.exclusions || [],
            entitlements: plan.entitlements || {
              domainPreparation: false,
              allowedDomains: [],
              subscriptionDurationDays: 0,
              unlimitedDomainPractice: false
            }
          }
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
    // Also deactivate or adjust any existing legacy plans with price >= 9 ALGO
    await Plan.updateMany(
      { price: { $gte: 9 } },
      { $set: { active: false, price: 8.5 } }
    );
    logger.info('DEFAULT_PLANS_SEEDED', {
      details: { count: Object.keys(PRACTICE_PLANS).length, maxPrice: 8 }
    });
  } catch (error: any) {
    logger.error('DEFAULT_PLANS_SEED_ERROR', { details: { message: error.message } });
  }
}
