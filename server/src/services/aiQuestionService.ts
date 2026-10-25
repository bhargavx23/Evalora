import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { Question, IQuestion } from '../models/Question.js';
import { DifficultyLevel } from '../shared/types.js';
import { codeExecutionService, ICodeExecutionRunner } from './codeExecutionService.js';
import { dynamicPracticeService, IQuestionReplenishmentProvider } from './dynamicPracticeService.js';
import { logger } from '../utils/logger.js';
import {
  AIGenerationMetrics,
  AIGenerationRequest,
  AIProviderError,
  AIProviderName,
  AIQuestionGenerationResult,
  AIRawGenerationResponse,
  IAIQuestionProvider
} from './ai/types.js';
import { GeminiProvider } from './ai/geminiProvider.js';
import { OpenAIProvider } from './ai/openaiProvider.js';
import {
  parseAIQuestionsJson,
  validateCandidateQuestion
} from './ai/questionValidator.js';
import { inferCategoryFromTopic } from './ai/prompts.js';

export interface GenerateAndValidateOptions {
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty: DifficultyLevel | 'mixed';
  type?: 'mcq' | 'coding' | 'mixed';
  count: number;
  collegeId?: string | null;
  creatorId?: string | null;
  callerKey?: string;
  publishValidated?: boolean;
}

export class AIQuestionService implements IQuestionReplenishmentProvider {
  private providers: Map<AIProviderName, IAIQuestionProvider> = new Map();
  private preferredProviderOverride?: AIProviderName;
  private fallbackProviderOverride?: AIProviderName | '';
  private maxRetriesOverride?: number;
  private maxBatchSizeOverride?: number;
  private maxReplenishOverride?: number;
  private rateLimitOverride?: number;
  private enableCodingExecutionValidation: boolean = true;
  private codeRunner: ICodeExecutionRunner = codeExecutionService;

  // Sliding-window timestamps (ms) per callerKey and global
  private rateLimitBuckets: Map<string, number[]> = new Map();

  private metrics: AIGenerationMetrics = {
    generationAttempts: 0,
    successfulGenerations: 0,
    failedGenerations: 0,
    validationFailures: 0,
    duplicatesRejected: 0,
    codingPendingOrRejected: 0,
    totalGeneratedCandidates: 0,
    totalValidatedQuestions: 0,
    providerStats: {
      gemini: { calls: 0, successes: 0, errors: 0, totalLatencyMs: 0, avgLatencyMs: 0 },
      openai: { calls: 0, successes: 0, errors: 0, totalLatencyMs: 0, avgLatencyMs: 0 }
    }
  };

  constructor() {
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('openai', new OpenAIProvider());
  }

  /**
   * Registers or replaces a provider instance (used for testing or custom provider injection).
   */
  registerProvider(provider: IAIQuestionProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Configures runtime overrides for testing or dynamic reconfiguration.
   */
  configure(options: {
    preferredProvider?: AIProviderName;
    fallbackProvider?: AIProviderName | '';
    maxRetries?: number;
    maxBatchSize?: number;
    maxReplenishPerSession?: number;
    rateLimitPerMinute?: number;
    enableCodingExecutionValidation?: boolean;
    codeRunner?: ICodeExecutionRunner;
  }): void {
    if (options.preferredProvider !== undefined) {
      this.preferredProviderOverride = options.preferredProvider;
    }
    if (options.fallbackProvider !== undefined) {
      this.fallbackProviderOverride = options.fallbackProvider;
    }
    if (options.maxRetries !== undefined) {
      this.maxRetriesOverride = options.maxRetries;
    }
    if (options.maxBatchSize !== undefined) {
      this.maxBatchSizeOverride = options.maxBatchSize;
    }
    if (options.maxReplenishPerSession !== undefined) {
      this.maxReplenishOverride = options.maxReplenishPerSession;
    }
    if (options.rateLimitPerMinute !== undefined) {
      this.rateLimitOverride = options.rateLimitPerMinute;
    }
    if (options.enableCodingExecutionValidation !== undefined) {
      this.enableCodingExecutionValidation = options.enableCodingExecutionValidation;
    }
    if (options.codeRunner !== undefined) {
      this.codeRunner = options.codeRunner;
    }
  }

  resetConfiguration(): void {
    this.preferredProviderOverride = undefined;
    this.fallbackProviderOverride = undefined;
    this.maxRetriesOverride = undefined;
    this.maxBatchSizeOverride = undefined;
    this.maxReplenishOverride = undefined;
    this.rateLimitOverride = undefined;
    this.enableCodingExecutionValidation = true;
    this.codeRunner = codeExecutionService;
    this.rateLimitBuckets.clear();
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('openai', new OpenAIProvider());
  }

  /**
   * Checks if at least one configured AI provider (Gemini or OpenAI) is ready to generate questions.
   */
  isAIAvailable(): boolean {
    const primaryName = this.getPrimaryProviderName();
    const primaryProv = this.providers.get(primaryName);
    if (primaryProv && primaryProv.isConfigured()) return true;
    const fallbackName = this.getFallbackProviderName();
    const fallbackProv = fallbackName ? this.providers.get(fallbackName) : null;
    return !!(fallbackProv && fallbackProv.isConfigured());
  }

  getMetrics(): AIGenerationMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  resetMetrics(): void {
    this.metrics = {
      generationAttempts: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      validationFailures: 0,
      duplicatesRejected: 0,
      codingPendingOrRejected: 0,
      totalGeneratedCandidates: 0,
      totalValidatedQuestions: 0,
      providerStats: {
        gemini: { calls: 0, successes: 0, errors: 0, totalLatencyMs: 0, avgLatencyMs: 0 },
        openai: { calls: 0, successes: 0, errors: 0, totalLatencyMs: 0, avgLatencyMs: 0 }
      }
    };
  }

  private getPrimaryProviderName(): AIProviderName {
    const raw = (this.preferredProviderOverride || ENV.AI_PROVIDER || 'gemini').toLowerCase();
    return raw === 'openai' ? 'openai' : 'gemini';
  }

  private getFallbackProviderName(): AIProviderName | null {
    const raw = (
      this.fallbackProviderOverride !== undefined
        ? this.fallbackProviderOverride
        : ENV.AI_FALLBACK_PROVIDER
    ).toLowerCase();
    if (raw === 'openai' || raw === 'gemini') {
      const primary = this.getPrimaryProviderName();
      return raw !== primary ? raw : null;
    }
    return null;
  }

  private checkRateLimit(callerKey: string = 'global'): boolean {
    const limit = this.rateLimitOverride ?? ENV.AI_RATE_LIMIT_PER_MINUTE ?? 15;
    const now = Date.now();
    const windowMs = 60_000;

    for (const key of ['global', callerKey]) {
      const timestamps = (this.rateLimitBuckets.get(key) || []).filter(ts => now - ts < windowMs);
      if (timestamps.length >= limit) {
        this.rateLimitBuckets.set(key, timestamps);
        return false;
      }
    }

    for (const key of new Set(['global', callerKey])) {
      const timestamps = (this.rateLimitBuckets.get(key) || []).filter(ts => now - ts < windowMs);
      timestamps.push(now);
      this.rateLimitBuckets.set(key, timestamps);
    }

    return true;
  }

  private recordProviderCall(provider: AIProviderName, latencyMs: number, success: boolean): void {
    const stat = this.metrics.providerStats[provider];
    stat.calls += 1;
    if (success) {
      stat.successes += 1;
    } else {
      stat.errors += 1;
    }
    stat.totalLatencyMs += latencyMs;
    stat.avgLatencyMs = Math.round(stat.totalLatencyMs / stat.calls);
  }

  /**
   * Invokes a specific provider with bounded retries on transient failures or malformed JSON.
   */
  private async callProviderWithRetries(
    provider: IAIQuestionProvider,
    req: AIGenerationRequest
  ): Promise<{
    response: AIRawGenerationResponse;
    candidates: any[];
  }> {
    const maxRetries = Math.max(0, Math.min(3, this.maxRetriesOverride ?? ENV.AI_MAX_RETRIES ?? 2));
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      const callStart = Date.now();
      try {
        const response = await provider.generateQuestions(req);
        this.recordProviderCall(provider.name, response.latencyMs, true);

        const parsed = parseAIQuestionsJson(response.rawText);
        if (!parsed.ok) {
          throw new AIProviderError({
            message: parsed.error || 'Malformed JSON returned by AI provider.',
            code: 'MALFORMED_JSON',
            provider: provider.name,
            retryable: true
          });
        }

        return {
          response,
          candidates: parsed.candidates
        };
      } catch (err: any) {
        const elapsed = Date.now() - callStart;
        if (!(err instanceof AIProviderError) || err.code !== 'MALFORMED_JSON') {
          this.recordProviderCall(provider.name, elapsed, false);
        }
        lastError = err;

        const isRetryable = err instanceof AIProviderError ? err.retryable : false;
        if (!isRetryable || attempt > maxRetries) {
          break;
        }
      }
    }

    throw (
      lastError ||
      new AIProviderError({
        message: 'AI provider failed after maximum retries.',
        code: 'PROVIDER_UNAVAILABLE',
        provider: provider.name,
        retryable: false
      })
    );
  }

  /**
   * Executes provider call with optional configured fallback provider.
   */
  private async generateCandidatesWithFallback(req: AIGenerationRequest): Promise<{
    response: AIRawGenerationResponse;
    candidates: any[];
  }> {
    const primaryName = this.getPrimaryProviderName();
    const primaryProvider = this.providers.get(primaryName);

    if (!primaryProvider || !primaryProvider.isConfigured()) {
      const fallbackName = this.getFallbackProviderName();
      const fallbackProvider = fallbackName ? this.providers.get(fallbackName) : null;
      if (fallbackProvider && fallbackProvider.isConfigured()) {
        return this.callProviderWithRetries(fallbackProvider, req);
      }
      throw new AIProviderError({
        message: `AI provider "${primaryName}" is not configured.`,
        code: 'PROVIDER_NOT_CONFIGURED',
        provider: primaryName,
        retryable: false
      });
    }

    try {
      return await this.callProviderWithRetries(primaryProvider, req);
    } catch (primaryErr) {
      const fallbackName = this.getFallbackProviderName();
      const fallbackProvider = fallbackName ? this.providers.get(fallbackName) : null;

      if (fallbackProvider && fallbackProvider.isConfigured()) {
        logger.warn('AI_PROVIDER_FALLBACK_TRIGGERED', {
          details: {
            fromProvider: primaryName,
            toProvider: fallbackName,
            topic: req.topic
          }
        });
        return await this.callProviderWithRetries(fallbackProvider, req);
      }

      throw primaryErr;
    }
  }

  /**
   * Core pipeline:
   * 1. Input & Rate-Limit Verification
   * 2. Controlled Batching
   * 3. Provider Generation (with bounded retry & optional fallback)
   * 4. 10-Stage Validation & Duplicate Detection (against DB + same batch)
   * 5. Sandboxed Reference Solution Execution for Coding Questions
   * 6. Persistence into Question Pool
   */
  async generateAndValidateQuestions(
    options: GenerateAndValidateOptions
  ): Promise<AIQuestionGenerationResult> {
    const startTime = Date.now();
    this.metrics.generationAttempts += 1;

    const topic = (options.topic || '').trim();
    const category = (options.category || inferCategoryFromTopic(topic)).trim();
    const difficulty: DifficultyLevel =
      options.difficulty && options.difficulty !== 'mixed' ? options.difficulty : 'medium';
    const targetType: 'mcq' | 'coding' = options.type === 'coding' ? 'coding' : 'mcq';

    const maxCap = this.maxReplenishOverride ?? ENV.AI_MAX_REPLENISH_PER_SESSION ?? 20;
    const requestedCount = Math.max(0, Math.min(Number(options.count) || 0, maxCap));

    if (!topic || requestedCount <= 0) {
      this.metrics.failedGenerations += 1;
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: 'A valid topic and positive question count are required.',
        requestedCount: Number(options.count) || 0,
        generatedCount: 0,
        validatedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        pendingExecutionCount: 0,
        durationMs: Date.now() - startTime,
        questions: []
      };
    }

    // Fast-path check: if neither primary nor configured fallback provider has an API key / handler,
    // return controlled AI_GENERATION_UNAVAILABLE immediately without DB queries.
    const primaryName = this.getPrimaryProviderName();
    const primaryProv = this.providers.get(primaryName);
    const fallbackName = this.getFallbackProviderName();
    const fallbackProv = fallbackName ? this.providers.get(fallbackName) : null;

    if ((!primaryProv || !primaryProv.isConfigured()) && (!fallbackProv || !fallbackProv.isConfigured())) {
      this.metrics.failedGenerations += 1;
      return {
        success: false,
        code: 'AI_GENERATION_UNAVAILABLE',
        message: 'Fresh questions could not be generated at this time.',
        provider: primaryName,
        requestedCount,
        generatedCount: 0,
        validatedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        pendingExecutionCount: 0,
        durationMs: Date.now() - startTime,
        questions: []
      };
    }

    if (!this.checkRateLimit(options.callerKey || options.creatorId || 'global')) {
      this.metrics.failedGenerations += 1;
      logger.warn('AI_GENERATION_RATE_LIMITED', {
        details: {
          category,
          topic,
          difficulty,
          requestedCount
        }
      });
      return {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Fresh question generation rate limit reached. Please try again shortly.',
        requestedCount,
        generatedCount: 0,
        validatedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        pendingExecutionCount: 0,
        durationMs: Date.now() - startTime,
        questions: []
      };
    }

    // Load existing validated & recent questions for duplicate comparison
    const existingDocs = await Question.find({
      $or: [
        { topic: new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { source: 'ai' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('title description normalizedHash')
      .lean();

    const existingQuestions = existingDocs.map(d => ({
      title: d.title,
      description: d.description,
      normalizedHash: d.normalizedHash
    }));

    const existingTitles = existingDocs.slice(0, 15).map(d => d.title);

    const maxBatchSize = Math.max(1, Math.min(15, this.maxBatchSizeOverride ?? ENV.AI_MAX_GENERATION_BATCH ?? 10));
    const batchCounts: number[] = [];
    let remainingToRequest = requestedCount;
    while (remainingToRequest > 0) {
      const chunk = Math.min(remainingToRequest, maxBatchSize);
      batchCounts.push(chunk);
      remainingToRequest -= chunk;
    }

    const batchAccepted: Array<{ title: string; description: string; normalizedHash: string }> = [];
    const savedValidatedQuestions: IQuestion[] = [];

    let usedProvider: AIProviderName | undefined;
    let usedModel: string | undefined;
    let totalGeneratedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    let pendingExecutionCount = 0;

    try {
      for (const chunkCount of batchCounts) {
        const genResult = await this.generateCandidatesWithFallback({
          category,
          topic,
          subtopic: options.subtopic,
          difficulty,
          type: targetType,
          count: chunkCount,
          existingTitles: [...existingTitles, ...batchAccepted.map(b => b.title)]
        });

        usedProvider = genResult.response.provider;
        usedModel = genResult.response.model;
        totalGeneratedCount += genResult.candidates.length;
        this.metrics.totalGeneratedCandidates += genResult.candidates.length;

        for (const candidate of genResult.candidates) {
          if (savedValidatedQuestions.length >= requestedCount) {
            break;
          }

          const outcome = validateCandidateQuestion(candidate, {
            expectedCategory: category,
            expectedTopic: topic,
            expectedDifficulty: difficulty,
            expectedType: targetType,
            existingQuestions,
            batchAccepted
          });

          if (!outcome.isValid || !outcome.payload) {
            if (outcome.isDuplicate) {
              duplicateCount += 1;
              this.metrics.duplicatesRejected += 1;
            } else {
              rejectedCount += 1;
              this.metrics.validationFailures += 1;
            }
            continue;
          }

          const payload = outcome.payload;

          // Section 26: Coding Questions require sandboxed reference solution execution verification
          let isFullyValidated = true;
          let validationStatus: 'validated' | 'pending_execution' | 'rejected' = 'validated';
          let rejectionReason: string | undefined;

          if (payload.requiresCodingExecution && payload.codingDetails) {
            if (!this.enableCodingExecutionValidation) {
              isFullyValidated = false;
              validationStatus = 'pending_execution';
              rejectionReason = 'Coding execution validation is disabled; stored as pending_execution.';
              pendingExecutionCount += 1;
              this.metrics.codingPendingOrRejected += 1;
            } else {
              const refSol = payload.codingDetails.referenceSolution;
              if (!refSol || !refSol.code) {
                isFullyValidated = false;
                validationStatus = 'rejected';
                rejectionReason = 'Missing referenceSolution for coding execution verification.';
                rejectedCount += 1;
                this.metrics.codingPendingOrRejected += 1;
                continue;
              }

              try {
                const execEval = await this.codeRunner.evaluateTestCases({
                  language: refSol.language,
                  code: refSol.code,
                  visibleTestCases: payload.codingDetails.visibleTestCases,
                  hiddenTestCases: payload.codingDetails.hiddenTestCases,
                  timeLimitMs: payload.codingDetails.timeLimitMs || 3000,
                  memoryLimitMb: payload.codingDetails.memoryLimitMb || 256
                });

                if (
                  execEval.verdict !== 'ACCEPTED' ||
                  execEval.totalTestCases === 0 ||
                  execEval.passedCount !== execEval.totalTestCases
                ) {
                  isFullyValidated = false;
                  validationStatus = 'rejected';
                  rejectionReason = `Reference solution failed test case verification (${execEval.passedCount}/${execEval.totalTestCases} passed, verdict=${execEval.verdict}).`;
                  rejectedCount += 1;
                  this.metrics.validationFailures += 1;
                  this.metrics.codingPendingOrRejected += 1;
                  continue;
                }
              } catch {
                isFullyValidated = false;
                validationStatus = 'pending_execution';
                rejectionReason = 'Execution runner unavailable during coding validation.';
                pendingExecutionCount += 1;
                this.metrics.codingPendingOrRejected += 1;
              }
            }
          }

          const publishDirectly = options.publishValidated !== false && isFullyValidated;

          const createdDoc = await Question.create({
            collegeId:
              options.collegeId && mongoose.Types.ObjectId.isValid(options.collegeId)
                ? new mongoose.Types.ObjectId(options.collegeId)
                : null,
            creatorId:
              options.creatorId && mongoose.Types.ObjectId.isValid(options.creatorId)
                ? new mongoose.Types.ObjectId(options.creatorId)
                : null,
            createdBy: 'ai',
            source: 'ai',
            generationProvider: usedProvider,
            generationModel: usedModel,
            validationStatus,
            normalizedHash: payload.normalizedHash,
            generatedAt: new Date(),
            validatedAt: isFullyValidated ? new Date() : undefined,
            rejectionReason,
            category: payload.category,
            topic: payload.topic,
            subtopic: payload.subtopic,
            difficulty: payload.difficulty,
            type: payload.type,
            title: payload.title,
            description: payload.description,
            marks: payload.marks,
            negativeMarks: payload.negativeMarks,
            estimatedTimeMinutes: payload.estimatedTimeMinutes,
            tags: payload.tags,
            options: payload.options,
            codingDetails: payload.codingDetails,
            explanation: payload.explanation,
            status: publishDirectly ? 'verified' : 'draft'
          });

          batchAccepted.push({
            title: payload.title,
            description: payload.description,
            normalizedHash: payload.normalizedHash
          });

          if (isFullyValidated) {
            savedValidatedQuestions.push(createdDoc);
            this.metrics.totalValidatedQuestions += 1;
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const validatedCount = savedValidatedQuestions.length;

      if (validatedCount > 0) {
        this.metrics.successfulGenerations += 1;
      } else {
        this.metrics.failedGenerations += 1;
      }

      logger.info('AI_QUESTION_GENERATION', {
        details: {
          provider: usedProvider,
          model: usedModel,
          category,
          topic,
          difficulty,
          requestedCount,
          generatedCount: totalGeneratedCount,
          validatedCount,
          rejectedCount,
          duplicateCount,
          pendingExecutionCount,
          durationMs,
          status: validatedCount > 0 ? 'success' : 'validation_rejected_all'
        }
      });

      if (validatedCount === 0) {
        return {
          success: false,
          code: 'VALIDATION_REJECTED_ALL',
          message: 'Fresh questions could not be validated at this time.',
          provider: usedProvider,
          model: usedModel,
          requestedCount,
          generatedCount: totalGeneratedCount,
          validatedCount: 0,
          rejectedCount,
          duplicateCount,
          pendingExecutionCount,
          durationMs,
          questions: []
        };
      }

      return {
        success: true,
        code: validatedCount >= requestedCount ? 'SUCCESS' : 'PARTIAL_SUCCESS',
        message: `Generated and validated ${validatedCount} fresh question(s).`,
        provider: usedProvider,
        model: usedModel,
        requestedCount,
        generatedCount: totalGeneratedCount,
        validatedCount,
        rejectedCount,
        duplicateCount,
        pendingExecutionCount,
        durationMs,
        questions: savedValidatedQuestions
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.metrics.failedGenerations += 1;

      logger.warn('AI_QUESTION_GENERATION_FAILED', {
        details: {
          provider: error?.provider || this.getPrimaryProviderName(),
          errorCode: error?.code || 'AI_GENERATION_UNAVAILABLE',
          category,
          topic,
          difficulty,
          requestedCount,
          durationMs,
          status: 'failed'
        }
      });

      return {
        success: false,
        code: 'AI_GENERATION_UNAVAILABLE',
        message: 'Fresh questions could not be generated at this time.',
        provider: error?.provider || this.getPrimaryProviderName(),
        requestedCount,
        generatedCount: totalGeneratedCount,
        validatedCount: savedValidatedQuestions.length,
        rejectedCount,
        duplicateCount,
        pendingExecutionCount,
        durationMs,
        questions: savedValidatedQuestions
      };
    }
  }

  /**
   * Implementation of `IQuestionReplenishmentProvider` called by `DynamicPracticeService`.
   * Generates, validates, deduplicates, and stores missing fresh questions into the Question Pool.
   * Never throws on failure — returns an empty or partial array so the Question Engine continues gracefully.
   */
  async replenishQuestions(params: {
    category?: string;
    topic: string;
    subtopic?: string;
    difficulty: DifficultyLevel | 'mixed';
    type?: 'mcq' | 'coding' | 'mixed';
    count: number;
    collegeId?: string;
    studentId?: string;
  }): Promise<IQuestion[]> {
    const result = await this.generateAndValidateQuestions({
      category: params.category,
      topic: params.topic,
      subtopic: params.subtopic,
      difficulty: params.difficulty,
      type: params.type,
      count: params.count,
      collegeId: null, // Platform-wide validated pool replenishment
      callerKey: params.studentId || 'replenishment',
      publishValidated: true
    });

    return result.questions;
  }
}

export const aiQuestionService = new AIQuestionService();
dynamicPracticeService.setReplenishmentProvider(aiQuestionService);
