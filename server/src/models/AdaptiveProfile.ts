import mongoose, { Document, Schema } from 'mongoose';
import { DifficultyLevel } from '../shared/types.js';

export type AdaptiveStatusLabel = 'Improving' | 'Keep Practising' | 'Review Weak Topics';
export type AdaptivePerformanceTrend = 'improving' | 'stable' | 'declining';

export interface ITopicPerformanceSnapshot {
  topic: string;
  category?: string;
  domain?: string;
  accuracy: number;
  totalAttempted: number;
  totalCorrect: number;
  consecutiveSuccessCount?: number;
  lastAttemptedAt?: Date;
}

export interface IAdaptiveProfile extends Document {
  userId: mongoose.Types.ObjectId;
  selectedDomains: string[];
  selectedTopics: string[];
  preferredDifficulty: DifficultyLevel | 'adaptive';
  strictDifficulty: boolean;
  currentAdaptiveDifficulty: DifficultyLevel;
  performanceTrend: AdaptivePerformanceTrend;
  statusLabel: AdaptiveStatusLabel;
  statusReason: string;
  recentAccuracy: number;
  consecutiveHighScores: number;
  consecutiveLowScores: number;
  totalSessionsEvaluated: number;
  weakTopics: ITopicPerformanceSnapshot[];
  strongTopics: ITopicPerformanceSnapshot[];
  lastAdaptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TopicPerformanceSnapshotSchema = new Schema<ITopicPerformanceSnapshot>(
  {
    topic: { type: String, required: true },
    category: { type: String },
    domain: { type: String },
    accuracy: { type: Number, default: 0 },
    totalAttempted: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    consecutiveSuccessCount: { type: Number, default: 0 },
    lastAttemptedAt: { type: Date }
  },
  { _id: false }
);

const AdaptiveProfileSchema = new Schema<IAdaptiveProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    selectedDomains: {
      type: [String],
      default: ['dsa', 'web-development', 'mern-stack', 'aptitude']
    },
    selectedTopics: {
      type: [String],
      default: []
    },
    preferredDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'adaptive'],
      default: 'adaptive'
    },
    strictDifficulty: {
      type: Boolean,
      default: false
    },
    currentAdaptiveDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    performanceTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    statusLabel: {
      type: String,
      enum: ['Improving', 'Keep Practising', 'Review Weak Topics'],
      default: 'Keep Practising'
    },
    statusReason: {
      type: String,
      default: 'Ready to practice with personalized difficulty.'
    },
    recentAccuracy: {
      type: Number,
      default: 0
    },
    consecutiveHighScores: {
      type: Number,
      default: 0
    },
    consecutiveLowScores: {
      type: Number,
      default: 0
    },
    totalSessionsEvaluated: {
      type: Number,
      default: 0
    },
    weakTopics: {
      type: [TopicPerformanceSnapshotSchema],
      default: []
    },
    strongTopics: {
      type: [TopicPerformanceSnapshotSchema],
      default: []
    },
    lastAdaptedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const AdaptiveProfile = mongoose.model<IAdaptiveProfile>(
  'AdaptiveProfile',
  AdaptiveProfileSchema
);
