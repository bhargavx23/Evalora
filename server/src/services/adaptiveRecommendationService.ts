import mongoose from 'mongoose';
import { AdaptiveProfile, IAdaptiveProfile, ITopicPerformanceSnapshot } from '../models/AdaptiveProfile.js';
import { PracticeSession, IPracticeSession } from '../models/PracticeSession.js';
import { PracticeQuestionHistory } from '../models/PracticeQuestionHistory.js';
import { StudentSkill } from '../models/StudentSkill.js';
import { Question, IQuestion } from '../models/Question.js';
import { User } from '../models/User.js';
import { DifficultyLevel } from '../shared/types.js';
import { logger } from '../utils/logger.js';

export interface RecommendedQuestionItem {
  questionId: string;
  title: string;
  topic: string;
  subtopic: string;
  category: string;
  difficulty: DifficultyLevel;
  type: string;
  reason: string;
  isFresh: boolean;
  marks: number;
}

export interface AdaptiveRecommendationResult {
  adaptiveProfile: {
    currentDifficulty: DifficultyLevel;
    performanceTrend: 'improving' | 'stable' | 'declining';
    statusLabel: 'Improving' | 'Keep Practising' | 'Review Weak Topics';
    statusReason: string;
    recentAccuracy: number;
    totalSessionsEvaluated: number;
    selectedDomains: string[];
    preferredDifficulty: string;
    strictDifficulty: boolean;
  };
  recommendations: RecommendedQuestionItem[];
  weakTopics: ITopicPerformanceSnapshot[];
  strongTopics: ITopicPerformanceSnapshot[];
  activeSession: {
    sessionId: string;
    topic: string;
    totalQuestions: number;
    resumable: boolean;
  } | null;
  hasFreshQuestions: boolean;
}

export class AdaptiveRecommendationService {
  /**
   * Retrieves or creates an AdaptiveProfile for the given user.
   */
  async getOrCreateProfile(userId: string): Promise<IAdaptiveProfile> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let profile = await AdaptiveProfile.findOne({ userId: userObjectId });

    if (!profile) {
      profile = await AdaptiveProfile.create({
        userId: userObjectId,
        selectedDomains: ['dsa', 'web-development', 'mern-stack', 'aptitude'],
        selectedTopics: [],
        preferredDifficulty: 'adaptive',
        strictDifficulty: false,
        currentAdaptiveDifficulty: 'medium',
        performanceTrend: 'stable',
        statusLabel: 'Keep Practising',
        statusReason: 'Initial baseline set. Complete sessions to adapt difficulty.',
        recentAccuracy: 0,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
        totalSessionsEvaluated: 0,
        weakTopics: [],
        strongTopics: [],
        lastAdaptedAt: new Date()
      });
    }

    return profile;
  }

  /**
   * Computes the adaptive difficulty and updates the user's profile based on recent performance.
   */
  async evaluateAndAdaptUser(userId: string): Promise<IAdaptiveProfile> {
    const profile = await this.getOrCreateProfile(userId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Fetch recent completed sessions (last 5)
    const recentSessions = await PracticeSession.find({
      studentId: userObjectId,
      status: 'completed'
    })
      .sort({ completedAt: -1, updatedAt: -1 })
      .limit(5)
      .lean();

    profile.totalSessionsEvaluated = recentSessions.length;

    // 2. Fetch StudentSkill records for topic mastery
    const skills = await StudentSkill.find({ studentId: userObjectId }).lean();
    const weakTopics: ITopicPerformanceSnapshot[] = [];
    const strongTopics: ITopicPerformanceSnapshot[] = [];

    skills.forEach(skill => {
      const snapshot: ITopicPerformanceSnapshot = {
        topic: skill.topic,
        accuracy: skill.scorePercentage,
        totalAttempted: skill.totalAttempted,
        totalCorrect: skill.totalCorrect,
        consecutiveSuccessCount: skill.consecutiveSuccessCount,
        lastAttemptedAt: skill.lastPracticedAt
      };

      if (skill.scorePercentage < 50 || skill.status === 'needs_improvement') {
        weakTopics.push(snapshot);
      } else if (skill.scorePercentage >= 75 || skill.status === 'strong') {
        strongTopics.push(snapshot);
      }
    });

    profile.weakTopics = weakTopics.sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
    profile.strongTopics = strongTopics.sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);

    // 3. If user has locked difficulty (strictDifficulty === true), respect their choice!
    if (profile.strictDifficulty && profile.preferredDifficulty !== 'adaptive') {
      profile.currentAdaptiveDifficulty = profile.preferredDifficulty as DifficultyLevel;
      if (recentSessions.length > 0) {
        const avgAcc = Math.round(
          recentSessions.reduce((sum, s) => sum + (s.accuracyPercentage || 0), 0) / recentSessions.length
        );
        profile.recentAccuracy = avgAcc;
      }
      profile.statusReason = `Difficulty locked at ${profile.currentAdaptiveDifficulty.toUpperCase()} by preference.`;
      profile.lastAdaptedAt = new Date();
      await profile.save();
      return profile;
    }

    // 4. Case: Insufficient performance data (< 2 completed sessions)
    if (recentSessions.length < 2) {
      profile.recentAccuracy = recentSessions.length === 1 ? (recentSessions[0].accuracyPercentage || 0) : 0;
      profile.performanceTrend = 'stable';
      profile.statusLabel = 'Keep Practising';
      profile.statusReason = 'Complete at least 2 sessions to begin adaptive difficulty scaling.';
      if (profile.preferredDifficulty !== 'adaptive') {
        profile.currentAdaptiveDifficulty = profile.preferredDifficulty as DifficultyLevel;
      } else {
        profile.currentAdaptiveDifficulty = 'medium';
      }
      profile.lastAdaptedAt = new Date();
      await profile.save();
      return profile;
    }

    // 5. Calculate recent accuracy across recent sessions
    const totalAccuracy = recentSessions.reduce((sum, s) => sum + (s.accuracyPercentage || 0), 0);
    const avgAccuracy = Math.round(totalAccuracy / recentSessions.length);
    profile.recentAccuracy = avgAccuracy;

    // Track consecutive streaks
    let consecutiveHigh = 0;
    let consecutiveLow = 0;
    for (const s of recentSessions) {
      const acc = s.accuracyPercentage || 0;
      if (acc >= 80) consecutiveHigh++;
      else break;
    }
    for (const s of recentSessions) {
      const acc = s.accuracyPercentage || 0;
      if (acc < 50) consecutiveLow++;
      else break;
    }
    profile.consecutiveHighScores = consecutiveHigh;
    profile.consecutiveLowScores = consecutiveLow;

    const currentDiff = profile.currentAdaptiveDifficulty;

    // 6. Adaptive Difficulty Transitions (Gradual 1-step at a time)
    // Rule A: Consistently Strong Performance (Avg >= 80% or >= 2 consecutive high scores)
    if (avgAccuracy >= 80 || consecutiveHigh >= 2) {
      profile.performanceTrend = 'improving';
      profile.statusLabel = 'Improving';

      if (currentDiff === 'easy') {
        profile.currentAdaptiveDifficulty = 'medium';
        profile.statusReason = `Strong performance (${avgAccuracy}% accuracy)! Advanced from Easy to Medium questions.`;
      } else if (currentDiff === 'medium') {
        profile.currentAdaptiveDifficulty = 'hard';
        profile.statusReason = `Consistently high accuracy (${avgAccuracy}%)! Stepping up to Hard tier challenges.`;
      } else {
        profile.currentAdaptiveDifficulty = 'hard';
        profile.statusReason = `Peak mastery (${avgAccuracy}% accuracy)! Maintaining Hard tier with advanced edge cases.`;
      }
    }
    // Rule B: Declining Performance or Repeated Mistakes (Avg < 50% or >= 2 consecutive low scores)
    else if (avgAccuracy < 50 || consecutiveLow >= 2) {
      profile.performanceTrend = 'declining';
      profile.statusLabel = 'Review Weak Topics';

      if (currentDiff === 'hard') {
        profile.currentAdaptiveDifficulty = 'medium';
        profile.statusReason = `Accuracy dipped to ${avgAccuracy}%. Eased to Medium tier to reinforce core patterns.`;
      } else if (currentDiff === 'medium') {
        profile.currentAdaptiveDifficulty = 'easy';
        profile.statusReason = `Recent accuracy was ${avgAccuracy}%. Stepping to Easy tier to rebuild fundamentals.`;
      } else {
        profile.currentAdaptiveDifficulty = 'easy';
        profile.statusReason = `Focusing on foundational review and error resolution (${avgAccuracy}% accuracy).`;
      }
    }
    // Rule C: Average / Stable Performance (50% - 79%)
    else {
      profile.performanceTrend = 'stable';
      profile.statusLabel = 'Keep Practising';
      profile.statusReason = `Consistent progress at ${avgAccuracy}% accuracy. Reinforcing concepts at ${currentDiff.toUpperCase()} level.`;
    }

    profile.lastAdaptedAt = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Generates personalized question recommendations based on adaptive profile, weak topics, and 48h fresh drops.
   * Filters out already attempted questions to prevent unnecessary repetition.
   */
  async getPersonalizedRecommendations(userId: string): Promise<AdaptiveRecommendationResult> {
    const profile = await this.evaluateAndAdaptUser(userId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Check for an active / in_progress practice session (Session Resumption)
    const activeSessionDoc = await PracticeSession.findOne({
      studentId: userObjectId,
      status: { $in: ['active', 'in_progress'] }
    }).sort({ updatedAt: -1 }).lean();

    const activeSession = activeSessionDoc
      ? {
          sessionId: activeSessionDoc._id.toString(),
          topic: activeSessionDoc.topic,
          totalQuestions: activeSessionDoc.totalQuestions || activeSessionDoc.questionIds?.length || 0,
          resumable: true
        }
      : null;

    // 2. Fetch all attempted question IDs to exclude
    const history = await PracticeQuestionHistory.find({ studentId: userObjectId })
      .select('questionId')
      .lean();
    const attemptedIds = new Set(history.map(h => h.questionId.toString()));

    // 3. Build domain & topic filters based on user selections
    const selectedDomains = profile.selectedDomains?.length > 0
      ? profile.selectedDomains
      : ['dsa', 'web-development', 'mern-stack', 'aptitude'];

    const targetDifficulty = profile.currentAdaptiveDifficulty;

    // Build category regexes matching selected domains
    const categoryKeywords: string[] = [];
    selectedDomains.forEach(domain => {
      if (domain === 'dsa') categoryKeywords.push('DSA', 'Data Structures', 'Algorithms', 'Arrays', 'Trees', 'DP');
      else if (domain === 'mern-stack') categoryKeywords.push('MERN', 'React', 'Node', 'Express', 'MongoDB');
      else if (domain === 'web-development' || domain === 'frontend') categoryKeywords.push('Frontend', 'Web Development', 'JavaScript', 'CSS', 'HTML');
      else if (domain === 'ai-machine-learning') categoryKeywords.push('Artificial Intelligence', 'Machine Learning', 'Python');
      else if (domain === 'aptitude') categoryKeywords.push('Aptitude', 'Quantitative Aptitude');
      else if (domain === 'reasoning') categoryKeywords.push('Reasoning', 'Logical Reasoning');
      else categoryKeywords.push(domain);
    });

    const categoryRegex = new RegExp(categoryKeywords.join('|'), 'i');

    // 4. Query candidate questions from shared question bank matching target difficulty & scope
    const candidateQuery: any = {
      validationStatus: { $in: ['validated', undefined] },
      status: { $ne: 'archived' },
      difficulty: targetDifficulty,
      $or: [
        { category: categoryRegex },
        { topic: categoryRegex },
        { tags: { $in: selectedDomains } }
      ]
    };

    if (profile.selectedTopics && profile.selectedTopics.length > 0) {
      candidateQuery.topic = { $in: profile.selectedTopics.map(t => new RegExp(t, 'i')) };
    }

    const candidates = await Question.find(candidateQuery)
      .limit(60)
      .lean();

    // Filter out already attempted questions
    const unattempted = candidates.filter(q => !attemptedIds.has(q._id.toString()));

    // If unattempted questions are low, relax difficulty to ensure user always has practice items
    let pool = unattempted;
    if (pool.length < 5) {
      const relaxed = await Question.find({
        validationStatus: { $in: ['validated', undefined] },
        status: { $ne: 'archived' },
        $or: [
          { category: categoryRegex },
          { topic: categoryRegex },
          { tags: { $in: selectedDomains } }
        ]
      })
        .limit(40)
        .lean();

      const freshRelaxed = relaxed.filter(q => !attemptedIds.has(q._id.toString()));
      pool = freshRelaxed.length > 0 ? freshRelaxed : relaxed;
    }

    // 5. Structure recommendations with reasons and fresh badges
    const weakTopicNames = new Set(profile.weakTopics.map(w => w.topic.toLowerCase()));
    let hasFresh = false;

    const recommendedItems: RecommendedQuestionItem[] = pool.slice(0, 10).map(q => {
      const isWeak = weakTopicNames.has((q.topic || '').toLowerCase());
      const isFresh = (q.tags || []).includes('adaptive-48h') ||
        (q.generatedAt && Date.now() - new Date(q.generatedAt).getTime() < 48 * 3600 * 1000);

      if (isFresh) hasFresh = true;

      let reason = `Recommended for ${profile.statusLabel} progression`;
      if (isWeak) {
        reason = `Review Weak Topic: Targeted reinforcement in ${q.topic}`;
      } else if (isFresh) {
        reason = `48h Fresh Drop: Newly validated question in ${q.topic}`;
      } else if (profile.performanceTrend === 'improving') {
        reason = `Level-Up Challenge: Matching your ${profile.currentAdaptiveDifficulty.toUpperCase()} tier`;
      } else {
        reason = `Core Concept Reinforcement in ${q.topic}`;
      }

      return {
        questionId: q._id.toString(),
        title: q.title,
        topic: q.topic,
        subtopic: q.subtopic || q.category || 'General',
        category: q.category || 'General',
        difficulty: q.difficulty,
        type: q.type,
        reason,
        isFresh: Boolean(isFresh),
        marks: q.marks || 2
      };
    });

    return {
      adaptiveProfile: {
        currentDifficulty: profile.currentAdaptiveDifficulty,
        performanceTrend: profile.performanceTrend,
        statusLabel: profile.statusLabel,
        statusReason: profile.statusReason,
        recentAccuracy: profile.recentAccuracy,
        totalSessionsEvaluated: profile.totalSessionsEvaluated,
        selectedDomains: profile.selectedDomains,
        preferredDifficulty: profile.preferredDifficulty,
        strictDifficulty: profile.strictDifficulty
      },
      recommendations: recommendedItems,
      weakTopics: profile.weakTopics,
      strongTopics: profile.strongTopics,
      activeSession,
      hasFreshQuestions: hasFresh
    };
  }

  /**
   * Starts an adaptive practice session based on recommendations, or resumes an active session.
   */
  async startOrResumeAdaptiveSession(userId: string, count: number = 5): Promise<{
    session: any;
    resumed: boolean;
    questions: any[];
  }> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Check for an existing active session to resume (NO QUESTION DUPLICATION ON REFRESH)
    const existingActive = await PracticeSession.findOne({
      studentId: userObjectId,
      status: { $in: ['active', 'in_progress'] }
    });

    if (existingActive) {
      const questions = await Question.find({ _id: { $in: existingActive.questionIds } }).lean();
      return {
        session: existingActive,
        resumed: true,
        questions: questions.map(q => ({
          _id: q._id,
          title: q.title,
          description: q.description,
          type: q.type,
          difficulty: q.difficulty,
          topic: q.topic,
          subtopic: q.subtopic,
          category: q.category,
          options: (q.options || []).map(o => ({ id: o.id, text: o.text })),
          codingDetails: q.codingDetails ? {
            supportedLanguages: q.codingDetails.supportedLanguages,
            starterCode: q.codingDetails.starterCode,
            inputFormat: q.codingDetails.inputFormat,
            outputFormat: q.codingDetails.outputFormat,
            constraints: q.codingDetails.constraints,
            examples: q.codingDetails.examples,
            visibleTestCases: q.codingDetails.visibleTestCases,
            timeLimitMs: q.codingDetails.timeLimitMs,
            memoryLimitMb: q.codingDetails.memoryLimitMb
          } : undefined
        }))
      };
    }

    // 2. Deduct attempt quota from user
    const user = await User.findById(userObjectId);
    if (!user) throw new Error('User not found.');

    const freeRemaining = Math.max(0, (user.freeAttempts?.total ?? 10) - (user.freeAttempts?.used ?? 0));
    const paidRemaining = Math.max(0, (user.paidAttempts?.total ?? 0) - (user.paidAttempts?.used ?? 0));

    if (freeRemaining <= 0 && paidRemaining <= 0) {
      const err: any = new Error('You have exhausted all available practice attempts.');
      err.code = 'QUOTA_EXHAUSTED';
      err.statusCode = 403;
      throw err;
    }

    if (freeRemaining > 0) {
      user.freeAttempts.used += 1;
    } else {
      user.paidAttempts.used += 1;
    }
    await user.save();

    // 3. Get personalized recommendations for session questions
    const recResult = await this.getPersonalizedRecommendations(userId);
    const targetCount = Math.min(Math.max(1, count), 15);
    const chosenQuestions = recResult.recommendations.slice(0, targetCount);

    const questionIds = chosenQuestions.map(q => new mongoose.Types.ObjectId(q.questionId));

    // 4. Create new adaptive practice session
    const primaryTopic = chosenQuestions[0]?.topic || 'Adaptive Mix';
    const session = await PracticeSession.create({
      studentId: userObjectId,
      collegeId: user.collegeId || null,
      topic: `Adaptive Practice: ${primaryTopic}`,
      subtopic: `${recResult.adaptiveProfile.statusLabel} (${recResult.adaptiveProfile.currentDifficulty.toUpperCase()})`,
      difficulty: recResult.adaptiveProfile.currentDifficulty,
      questionCount: chosenQuestions.length,
      type: 'mixed',
      questionIds,
      answers: [],
      score: 0,
      accuracyPercentage: 0,
      totalQuestions: chosenQuestions.length,
      correctCount: 0,
      timeTakenSeconds: 0,
      startedAt: new Date(),
      status: 'active'
    });

    const fullQuestions = await Question.find({ _id: { $in: questionIds } }).lean();

    return {
      session,
      resumed: false,
      questions: fullQuestions.map(q => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic,
        subtopic: q.subtopic,
        category: q.category,
        options: (q.options || []).map(o => ({ id: o.id, text: o.text })),
        codingDetails: q.codingDetails ? {
          supportedLanguages: q.codingDetails.supportedLanguages,
          starterCode: q.codingDetails.starterCode,
          inputFormat: q.codingDetails.inputFormat,
          outputFormat: q.codingDetails.outputFormat,
          constraints: q.codingDetails.constraints,
          examples: q.codingDetails.examples,
          visibleTestCases: q.codingDetails.visibleTestCases,
          timeLimitMs: q.codingDetails.timeLimitMs,
          memoryLimitMb: q.codingDetails.memoryLimitMb
        } : undefined
      }))
    };
  }

  /**
   * Updates user adaptive preferences (selected domains, topics, difficulty preference, strict lock).
   */
  async updatePreferences(userId: string, preferences: {
    selectedDomains?: string[];
    selectedTopics?: string[];
    preferredDifficulty?: DifficultyLevel | 'adaptive';
    strictDifficulty?: boolean;
  }): Promise<IAdaptiveProfile> {
    const profile = await this.getOrCreateProfile(userId);

    if (preferences.selectedDomains !== undefined) {
      profile.selectedDomains = preferences.selectedDomains;
    }
    if (preferences.selectedTopics !== undefined) {
      profile.selectedTopics = preferences.selectedTopics;
    }
    if (preferences.preferredDifficulty !== undefined) {
      profile.preferredDifficulty = preferences.preferredDifficulty;
      if (preferences.preferredDifficulty !== 'adaptive') {
        profile.currentAdaptiveDifficulty = preferences.preferredDifficulty;
      }
    }
    if (preferences.strictDifficulty !== undefined) {
      profile.strictDifficulty = preferences.strictDifficulty;
    }

    profile.lastAdaptedAt = new Date();
    await profile.save();
    return profile;
  }
}

export const adaptiveRecommendationService = new AdaptiveRecommendationService();
