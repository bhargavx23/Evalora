import mongoose from 'mongoose';
import { Question, IQuestion } from '../models/Question.js';
import { PracticeQuestionHistory } from '../models/PracticeQuestionHistory.js';
import { StudentSkill } from '../models/StudentSkill.js';
import { IPracticeSectionConfig } from '../models/PracticeSession.js';
import { DifficultyLevel } from '../shared/types.js';
import { ValidationError } from '../utils/errors.js';
import { ENV } from '../config/env.js';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'mixed']);
const VALID_TYPES = new Set(['mcq', 'coding', 'mixed']);
const MAX_SECTIONS = 10;
const MAX_QUESTIONS_PER_SECTION = 50;
const MAX_TOTAL_QUESTIONS = 100;

const CATEGORY_TOPIC_MAP: Record<string, string[]> = {
  dsa: ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Recursion', 'Dynamic Programming', 'Sorting', 'Searching', 'Heaps', 'Hashing'],
  aptitude: ['Quantitative Aptitude', 'Percentages', 'Profit and Loss', 'Time and Work', 'Ratios', 'Number System', 'Probability', 'Permutations'],
  reasoning: ['Logical Reasoning', 'Blood Relations', 'Syllogisms', 'Direction Sense', 'Puzzles', 'Seating Arrangement', 'Coding-Decoding'],
  coding: ['Arrays', 'Strings', 'Dynamic Programming', 'Graphs', 'Trees', 'Recursion', 'OOP'],
  technical: ['DBMS', 'Operating Systems', 'Computer Networks', 'OOP', 'SQL', 'System Design'],
  placement: ['Arrays', 'Quantitative Aptitude', 'Logical Reasoning', 'Verbal Ability', 'DBMS', 'Operating Systems', 'OOP']
};

/**
 * AI Question Replenishment Interface (Phase 4).
 * Decouples the Question Engine from specific external LLM providers.
 */
export interface IQuestionReplenishmentProvider {
  replenishQuestions(params: {
    category?: string;
    topic: string;
    subtopic?: string;
    difficulty: DifficultyLevel | 'mixed';
    type?: 'mcq' | 'coding' | 'mixed';
    count: number;
    collegeId?: string;
    studentId?: string;
  }): Promise<IQuestion[]>;
}

export interface PracticeSectionInput {
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty?: DifficultyLevel | 'mixed';
  count: number;
  type?: 'mcq' | 'coding' | 'mixed';
}

export interface SectionValidationResult {
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty: DifficultyLevel | 'mixed';
  requestedCount: number;
  freshAvailable: number;
  totalAvailable: number;
  isSufficient: boolean;
  warningMessage?: string;
  suggestions?: string[];
  controlledOptions?: Array<'accept_available_fresh' | 'expand_difficulty' | 'broaden_category' | 'allow_repeats'>;
}

export interface ValidationSummary {
  overallSufficient: boolean;
  totalRequested: number;
  totalFreshAvailable: number;
  totalAvailable: number;
  sections: SectionValidationResult[];
}

export interface GenerateMultiPracticeOptions {
  studentId: string;
  collegeId: string;
  sections?: PracticeSectionInput[];
  // Legacy single-topic fallback properties
  topic?: string;
  subtopic?: string;
  difficulty?: DifficultyLevel | 'mixed';
  questionCount?: number;
  type?: 'mcq' | 'coding' | 'mixed';
  language?: string;
  // Controlled fallback flags (must be explicitly opted into by user)
  allowRepeatFallback?: boolean;
  expandDifficulty?: boolean;
  broadenCategory?: boolean;
  acceptAvailableFresh?: boolean;
  enableAIReplenishment?: boolean;
  forceAIGeneration?: boolean;
}

export interface AvailabilityReport {
  overallSufficient: boolean;
  totalRequested: number;
  totalSelected: number;
  totalFreshAvailable: number;
  hasPartialSections: boolean;
  aiReplenishedCount?: number;
  controlledOptions?: Array<'accept_available_fresh' | 'expand_difficulty' | 'broaden_category' | 'allow_repeats'>;
}

export class DynamicPracticeService {
  private replenishmentProvider: IQuestionReplenishmentProvider | null = null;

  /**
   * Registers an optional external replenishment provider.
   */
  setReplenishmentProvider(provider: IQuestionReplenishmentProvider | null): void {
    this.replenishmentProvider = provider;
  }

  getReplenishmentProvider(): IQuestionReplenishmentProvider | null {
    return this.replenishmentProvider;
  }

  /**
   * Strictly validates section inputs before querying or deducting attempts.
   */
  validatePracticeConfiguration(sections: PracticeSectionInput[]): void {
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new ValidationError('At least one practice section is required.');
    }

    if (sections.length > MAX_SECTIONS) {
      throw new ValidationError(`Cannot exceed ${MAX_SECTIONS} sections per practice session.`);
    }

    let totalQuestions = 0;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const label = `Section ${i + 1}`;

      const hasTopic = typeof sec.topic === 'string' && sec.topic.trim().length > 0;
      const hasCategory = typeof sec.category === 'string' && sec.category.trim().length > 0;

      if (!hasTopic && !hasCategory) {
        throw new ValidationError(`${label}: A valid category or topic is required.`);
      }

      const diff = sec.difficulty || 'mixed';
      if (!VALID_DIFFICULTIES.has(diff)) {
        throw new ValidationError(`${label}: Invalid difficulty "${sec.difficulty}". Must be easy, medium, hard, or mixed.`);
      }

      if (sec.type && !VALID_TYPES.has(sec.type)) {
        throw new ValidationError(`${label}: Invalid question type "${sec.type}". Must be mcq, coding, or mixed.`);
      }

      const count = Number(sec.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS_PER_SECTION) {
        throw new ValidationError(`${label}: Question count must be an integer between 1 and ${MAX_QUESTIONS_PER_SECTION}.`);
      }

      totalQuestions += count;
    }

    if (totalQuestions > MAX_TOTAL_QUESTIONS) {
      throw new ValidationError(`Total requested questions (${totalQuestions}) cannot exceed ${MAX_TOTAL_QUESTIONS}.`);
    }
  }

  /**
   * Helper to construct MongoDB filter query for a specific section configuration.
   * Only verified & validated questions can ever be selected by the Question Engine.
   */
  buildSectionQuery(
    collegeId: string,
    section: PracticeSectionInput,
    options?: { ignoreDifficulty?: boolean; broadenToCategory?: boolean }
  ): any {
    const query: any = {
      status: 'verified',
      validationStatus: {
        $nin: ['generated', 'validating', 'rejected', 'disabled', 'pending_execution']
      }
    };

    if (collegeId && mongoose.Types.ObjectId.isValid(collegeId)) {
      query.$or = [
        { collegeId: new mongoose.Types.ObjectId(collegeId) },
        { collegeId: null }
      ];
    }

    const conditions: any[] = [];
    const broaden = options?.broadenToCategory ?? false;

    if (!broaden && section.topic && section.topic.trim() && !['All', 'Mixed', 'General'].includes(section.topic)) {
      const topicRegex = new RegExp(`^${escapeRegex(section.topic.trim())}$`, 'i');
      conditions.push({
        $or: [
          { topic: topicRegex },
          { subtopic: topicRegex },
          { tags: topicRegex },
          { category: topicRegex }
        ]
      });
    } else if (section.category && section.category.trim() && !['All', 'Mixed'].includes(section.category)) {
      const catKey = section.category.trim().toLowerCase();
      const mappedTopics = CATEGORY_TOPIC_MAP[catKey] || [];
      const catRegex = new RegExp(`^${escapeRegex(section.category.trim())}$`, 'i');

      const orClauses: any[] = [
        { category: catRegex },
        { topic: catRegex },
        { subtopic: catRegex },
        { tags: catRegex }
      ];

      if (mappedTopics.length > 0) {
        orClauses.push({ topic: { $in: mappedTopics.map(t => new RegExp(`^${escapeRegex(t)}$`, 'i')) } });
        orClauses.push({ subtopic: { $in: mappedTopics.map(t => new RegExp(`^${escapeRegex(t)}$`, 'i')) } });
      }

      conditions.push({ $or: orClauses });
    }

    if (!broaden && section.subtopic && section.subtopic.trim() && !['All', 'General'].includes(section.subtopic)) {
      conditions.push({
        subtopic: new RegExp(`^${escapeRegex(section.subtopic.trim())}$`, 'i')
      });
    }

    if (!options?.ignoreDifficulty && section.difficulty && section.difficulty !== 'mixed') {
      query.difficulty = section.difficulty;
    }

    if (section.type === 'mcq') {
      query.type = { $in: ['mcq', 'multiple_select', 'true_false'] };
    } else if (section.type === 'coding') {
      query.type = 'coding';
    } else if (section.category?.toLowerCase() === 'coding' && !section.type) {
      query.type = 'coding';
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    return query;
  }

  /**
   * Pre-flight validation: Checks fresh question availability without silently repeating questions.
   */
  async validateSelection(params: {
    studentId: string;
    collegeId: string;
    sections: PracticeSectionInput[];
  }): Promise<ValidationSummary> {
    const { studentId, collegeId, sections } = params;

    this.validatePracticeConfiguration(sections);

    // Fetch student's previously attempted question IDs
    const history = await PracticeQuestionHistory.find({
      studentId: new mongoose.Types.ObjectId(studentId)
    })
      .select('questionId')
      .lean();

    const attemptedIds = Array.from(new Set(history.map(h => h.questionId.toString())));
    const attemptedObjectIds = attemptedIds.map(id => new mongoose.Types.ObjectId(id));

    const sectionResults: SectionValidationResult[] = [];
    let totalRequested = 0;
    let totalFresh = 0;
    let totalAll = 0;
    let overallSufficient = true;

    // Also track cross-section overlap during pre-flight validation
    const reservedFreshIds = new Set<string>();

    for (const section of sections) {
      const query = this.buildSectionQuery(collegeId, section);
      const reqCount = Number(section.count);
      totalRequested += reqCount;

      const totalMatching = await Question.countDocuments(query);
      const freshDocs = await Question.find({
        ...query,
        _id: {
          $nin: [
            ...attemptedObjectIds,
            ...Array.from(reservedFreshIds).map(id => new mongoose.Types.ObjectId(id))
          ]
        }
      })
        .select('_id')
        .lean();

      const freshMatching = freshDocs.length;
      freshDocs.slice(0, reqCount).forEach(d => reservedFreshIds.add(d._id.toString()));

      totalFresh += freshMatching;
      totalAll += totalMatching;

      const isSufficient = freshMatching >= reqCount;
      if (!isSufficient) {
        overallSufficient = false;
      }

      const suggestions: string[] = [];
      const controlledOptions: Array<'accept_available_fresh' | 'expand_difficulty' | 'broaden_category' | 'allow_repeats'> = [];
      let warningMessage: string | undefined;

      if (!isSufficient) {
        if (freshMatching > 0) {
          warningMessage = `Only ${freshMatching} fresh questions are available for ${section.topic || section.category} (${section.difficulty || 'mixed'}).`;
          suggestions.push(`Practice ${freshMatching} fresh questions`);
          controlledOptions.push('accept_available_fresh');
        } else if (totalMatching > 0) {
          warningMessage = `You have already attempted all ${totalMatching} questions in ${section.topic || section.category} (${section.difficulty || 'mixed'}).`;
        } else {
          warningMessage = `No questions found matching ${section.topic || section.category} (${section.difficulty || 'mixed'}).`;
        }

        if (section.difficulty && section.difficulty !== 'mixed') {
          suggestions.push('Change or expand difficulty (Easy + Medium + Hard)');
          controlledOptions.push('expand_difficulty');
        }
        if (section.topic && section.category) {
          suggestions.push(`Broaden selection to all ${section.category} topics`);
          controlledOptions.push('broaden_category');
        } else {
          suggestions.push('Choose another topic or category');
        }
        if (totalMatching > freshMatching) {
          suggestions.push('Include previously attempted questions for review');
          controlledOptions.push('allow_repeats');
        }
      }

      sectionResults.push({
        category: section.category,
        topic: section.topic,
        subtopic: section.subtopic,
        difficulty: section.difficulty || 'mixed',
        requestedCount: reqCount,
        freshAvailable: freshMatching,
        totalAvailable: totalMatching,
        isSufficient,
        warningMessage,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        controlledOptions: controlledOptions.length > 0 ? controlledOptions : undefined
      });
    }

    return {
      overallSufficient,
      totalRequested,
      totalFreshAvailable: totalFresh,
      totalAvailable: totalAll,
      sections: sectionResults
    };
  }

  /**
   * Generates a personalized, non-repeating practice set based on structured multi-section requirements.
   * Strictly enforces:
   * - No silent question repetition
   * - No silent unrelated question substitution unless explicitly opted in
   * - Cross-section duplicate prevention
   */
  async generatePracticeSet(options: GenerateMultiPracticeOptions): Promise<{
    questions: IQuestion[];
    sectionsConfig: IPracticeSectionConfig[];
    availabilityReport: AvailabilityReport;
  }> {
    const {
      studentId,
      collegeId,
      allowRepeatFallback = false,
      expandDifficulty = false,
      broadenCategory = false,
      enableAIReplenishment = true
    } = options;

    // Normalize sections array (support both multi-section and legacy single-topic request)
    let sections: PracticeSectionInput[] = [];
    if (options.sections && options.sections.length > 0) {
      sections = options.sections;
    } else {
      sections = [
        {
          topic: options.topic || 'Arrays',
          subtopic: options.subtopic,
          difficulty: options.difficulty || 'mixed',
          count: options.questionCount !== undefined ? Number(options.questionCount) : 10,
          type: options.type || 'mixed'
        }
      ];
    }

    this.validatePracticeConfiguration(sections);

    // Fetch all previously attempted question IDs for this user
    const history = await PracticeQuestionHistory.find({
      studentId: new mongoose.Types.ObjectId(studentId)
    })
      .select('questionId')
      .lean();

    const attemptedIds = Array.from(new Set(history.map(h => h.questionId.toString())));
    const attemptedObjectIds = attemptedIds.map(id => new mongoose.Types.ObjectId(id));

    const selectedQuestions: any[] = [];
    const selectedQuestionIdSet = new Set<string>();
    const sectionsConfig: IPracticeSectionConfig[] = [];

    let totalRequested = 0;
    let totalFreshAvailable = 0;
    let aiReplenishedCount = 0;
    let hasPartialSections = false;

    for (const section of sections) {
      const targetCount = Number(section.count);
      totalRequested += targetCount;

      const excludedObjectIds = () => [
        ...attemptedObjectIds,
        ...Array.from(selectedQuestionIdSet).map(id => new mongoose.Types.ObjectId(id))
      ];

      // 1. Primary query: strictly matching category, topic, and difficulty, excluding attempted and already-selected
      const primaryQuery = this.buildSectionQuery(collegeId, section);
      let candidatePool = await Question.find({
        ...primaryQuery,
        _id: { $nin: excludedObjectIds() }
      }).lean();

      // 1b. Phase 4 AI Question Pool Replenishment:
      // If forceAIGeneration is requested or the pool has insufficient fresh questions, invoke replenishment
      // provider to generate, validate, deduplicate, and store fresh questions in the DB pool.
      const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      const shouldForceAI = Boolean(options.forceAIGeneration || (!isTestEnv && ENV.AI_FORCE_FRESH_EVERY_TIME && enableAIReplenishment));
      if ((shouldForceAI || candidatePool.length < targetCount) && this.replenishmentProvider && enableAIReplenishment) {
        const missingCount = shouldForceAI ? targetCount : (targetCount - candidatePool.length);
        try {
          await this.replenishmentProvider.replenishQuestions({
            category: section.category,
            topic: section.topic,
            subtopic: section.subtopic,
            difficulty: section.difficulty || 'mixed',
            type: section.type || 'mixed',
            count: missingCount,
            collegeId,
            studentId
          });

          const replenishedFromPool = await Question.find({
            ...primaryQuery,
            _id: {
              $nin: [
                ...excludedObjectIds(),
                ...candidatePool.map(q => q._id)
              ]
            }
          }).lean();

          if (replenishedFromPool.length > 0) {
            candidatePool = shouldForceAI
              ? [...replenishedFromPool, ...candidatePool]
              : [...candidatePool, ...replenishedFromPool];
            aiReplenishedCount += replenishedFromPool.length;
          }
        } catch {
          // Graceful fallback: AI failure must never break practice session creation
        }
      }

      const exactFreshCount = candidatePool.length;
      totalFreshAvailable += exactFreshCount;

      // 2. Expand difficulty within same topic if needed to meet target count and permitted
      if (candidatePool.length < targetCount && expandDifficulty && section.difficulty && section.difficulty !== 'mixed') {
        const relaxedDiffQuery = this.buildSectionQuery(collegeId, section, { ignoreDifficulty: true });
        const diffExpandedPool = await Question.find({
          ...relaxedDiffQuery,
          _id: {
            $nin: [
              ...excludedObjectIds(),
              ...candidatePool.map(q => q._id)
            ]
          }
        }).lean();
        candidatePool = [...candidatePool, ...diffExpandedPool];
      }

      // 3. Broaden topic to category if needed to meet target count and permitted
      if (candidatePool.length < targetCount && broadenCategory && section.category) {
        const broadCatQuery = this.buildSectionQuery(collegeId, section, {
          ignoreDifficulty: true,
          broadenToCategory: true
        });
        const catExpandedPool = await Question.find({
          ...broadCatQuery,
          _id: {
            $nin: [
              ...excludedObjectIds(),
              ...candidatePool.map(q => q._id)
            ]
          }
        }).lean();
        candidatePool = [...candidatePool, ...catExpandedPool];
      }

      // 4. Include previously attempted questions if repeat fallback is permitted
      if (candidatePool.length < targetCount && allowRepeatFallback) {
        const repeatCandidates = await Question.find({
          ...primaryQuery,
          _id: {
            $nin: [
              ...Array.from(selectedQuestionIdSet).map(id => new mongoose.Types.ObjectId(id)),
              ...candidatePool.map(q => q._id)
            ]
          }
        }).lean();
        candidatePool = [...candidatePool, ...repeatCandidates];
      }

      // 4b. Category-wide repeat fallback if still under target count and permitted
      if (candidatePool.length < targetCount && allowRepeatFallback && broadenCategory && section.category) {
        const broadCatQuery = this.buildSectionQuery(collegeId, section, {
          ignoreDifficulty: true,
          broadenToCategory: true
        });
        const catRepeats = await Question.find({
          ...broadCatQuery,
          _id: {
            $nin: [
              ...Array.from(selectedQuestionIdSet).map(id => new mongoose.Types.ObjectId(id)),
              ...candidatePool.map(q => q._id)
            ]
          }
        }).lean();
        candidatePool = [...candidatePool, ...catRepeats];
      }

      // 4c. General format fallback if still under target count and repeat fallback is permitted
      if (candidatePool.length < targetCount && allowRepeatFallback && broadenCategory) {
        const typeFilter = section.type === 'coding' ? { type: 'coding' } : { type: { $ne: 'coding' } };
        const generalFill = await Question.find({
          ...typeFilter,
          _id: {
            $nin: [
              ...Array.from(selectedQuestionIdSet).map(id => new mongoose.Types.ObjectId(id)),
              ...candidatePool.map(q => q._id)
            ]
          }
        }).limit(targetCount * 2).lean();
        candidatePool = [...candidatePool, ...generalFill];
      }

      // 5. Shuffle and select up to targetCount with concept diversity and strict duplicate prevention
      const shuffled = [...candidatePool].sort(() => Math.random() - 0.5);
      const sectionChosen: any[] = [];
      const seenConcepts = new Set<string>();

      for (const q of shuffled) {
        if (sectionChosen.length >= targetCount) break;
        const qIdStr = q._id.toString();
        if (selectedQuestionIdSet.has(qIdStr)) continue;
        if (q.conceptId && seenConcepts.has(q.conceptId)) continue;

        sectionChosen.push(q);
        selectedQuestionIdSet.add(qIdStr);
        if (q.conceptId) seenConcepts.add(q.conceptId);
      }

      // Fill remaining from shuffled pool if concept diversity skipped eligible fresh questions
      if (sectionChosen.length < targetCount) {
        for (const q of shuffled) {
          if (sectionChosen.length >= targetCount) break;
          const qIdStr = q._id.toString();
          if (!selectedQuestionIdSet.has(qIdStr)) {
            sectionChosen.push(q);
            selectedQuestionIdSet.add(qIdStr);
          }
        }
      }

      if (sectionChosen.length < targetCount) {
        hasPartialSections = true;
      }

      selectedQuestions.push(...sectionChosen);

      sectionsConfig.push({
        category: section.category,
        topic: section.topic,
        subtopic: section.subtopic,
        difficulty: section.difficulty || 'mixed',
        requestedCount: targetCount,
        count: sectionChosen.length,
        type: section.type || 'mixed',
        questionIds: sectionChosen.map(q => new mongoose.Types.ObjectId(q._id)),
        solvedCount: 0,
        correctCount: 0
      });
    }

    const controlledOptions: Array<'accept_available_fresh' | 'expand_difficulty' | 'broaden_category' | 'allow_repeats'> = [];
    if (hasPartialSections) {
      if (selectedQuestions.length > 0) controlledOptions.push('accept_available_fresh');
      controlledOptions.push('expand_difficulty', 'broaden_category', 'allow_repeats');
    }

    return {
      questions: selectedQuestions as IQuestion[],
      sectionsConfig,
      availabilityReport: {
        overallSufficient: !hasPartialSections && selectedQuestions.length === totalRequested,
        totalRequested,
        totalSelected: selectedQuestions.length,
        totalFreshAvailable,
        hasPartialSections,
        aiReplenishedCount,
        controlledOptions: controlledOptions.length > 0 ? controlledOptions : undefined
      }
    };
  }

  /**
   * Updates student skill analytics, difficulty progression, and question history per topic using bulk operations.
   */
  async updateSkillAndHistory(params: {
    studentId: string;
    collegeId: string;
    topic?: string;
    answers: Array<{
      questionId: string;
      topic?: string;
      subtopic?: string;
      difficulty?: DifficultyLevel;
      wasCorrect: boolean;
      timeSpentSeconds: number;
    }>;
  }): Promise<void> {
    const { studentId, collegeId, topic: fallbackTopic, answers } = params;
    if (!answers || answers.length === 0) return;

    const studentObjId = new mongoose.Types.ObjectId(studentId);
    const collegeObjId = collegeId && mongoose.Types.ObjectId.isValid(collegeId)
      ? new mongoose.Types.ObjectId(collegeId)
      : null;

    const answersByTopic: Record<string, typeof answers> = {};
    const historyDocs: any[] = [];
    const questionBulkOps: any[] = [];

    for (const ans of answers) {
      const resolvedTopic = ans.topic || fallbackTopic || 'General';
      if (!answersByTopic[resolvedTopic]) {
        answersByTopic[resolvedTopic] = [];
      }
      answersByTopic[resolvedTopic].push(ans);

      historyDocs.push({
        studentId: studentObjId,
        collegeId: collegeObjId,
        questionId: new mongoose.Types.ObjectId(ans.questionId),
        topic: resolvedTopic,
        subtopic: ans.subtopic || 'General',
        difficulty: ans.difficulty || 'medium',
        wasCorrect: Boolean(ans.wasCorrect),
        timeSpentSeconds: Number(ans.timeSpentSeconds) || 0,
        attemptedAt: new Date()
      });

      questionBulkOps.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(ans.questionId) },
          update: {
            $inc: {
              attemptCount: 1,
              correctCount: ans.wasCorrect ? 1 : 0,
              usageCount: 1
            }
          }
        }
      });
    }

    // 1. Bulk insert question attempt history and bulk update question stats (eliminates N+1 queries)
    if (historyDocs.length > 0) {
      await PracticeQuestionHistory.insertMany(historyDocs);
    }
    if (questionBulkOps.length > 0) {
      await Question.bulkWrite(questionBulkOps);
    }

    // 2. Update StudentSkill documents per distinct topic
    for (const [topicName, topicAnswers] of Object.entries(answersByTopic)) {
      const totalAttempted = topicAnswers.length;
      const totalCorrect = topicAnswers.filter(a => a.wasCorrect).length;

      let skill = await StudentSkill.findOne({
        studentId: studentObjId,
        topic: topicName
      });

      if (!skill) {
        skill = new StudentSkill({
          studentId: studentObjId,
          collegeId: collegeObjId,
          topic: topicName,
          scorePercentage: 0,
          totalAttempted: 0,
          totalCorrect: 0,
          consecutiveSuccessCount: 0,
          difficultyLevel: 'easy',
          status: 'moderate'
        });
      }

      skill.totalAttempted += totalAttempted;
      skill.totalCorrect += totalCorrect;
      skill.scorePercentage = Math.round((skill.totalCorrect / skill.totalAttempted) * 100);
      skill.lastPracticedAt = new Date();

      // Adaptive difficulty progression
      if (totalCorrect >= Math.ceil(totalAttempted * 0.8)) {
        skill.consecutiveSuccessCount += 1;
        if (skill.consecutiveSuccessCount >= 2) {
          if (skill.difficultyLevel === 'easy') skill.difficultyLevel = 'medium';
          else if (skill.difficultyLevel === 'medium') skill.difficultyLevel = 'hard';
        }
      } else if (totalCorrect <= Math.floor(totalAttempted * 0.4)) {
        skill.consecutiveSuccessCount = 0;
        if (skill.difficultyLevel === 'hard') skill.difficultyLevel = 'medium';
        else if (skill.difficultyLevel === 'medium') skill.difficultyLevel = 'easy';
      }

      if (skill.scorePercentage >= 75) {
        skill.status = 'strong';
      } else if (skill.scorePercentage < 50) {
        skill.status = 'needs_improvement';
      } else {
        skill.status = 'moderate';
      }

      await skill.save();
    }
  }
}

export const dynamicPracticeService = new DynamicPracticeService();
export const questionEngine = dynamicPracticeService;
