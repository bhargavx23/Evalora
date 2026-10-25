import { DifficultyLevel, QuestionType, CodingLanguage } from '../../shared/types.js';
import { IQuestion } from '../../models/Question.js';

export type AIProviderName = 'openai' | 'gemini';

export type AIProviderErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_RESPONSE'
  | 'MALFORMED_JSON'
  | 'NETWORK_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'VALIDATION_FAILED';

export class AIProviderError extends Error {
  public readonly code: AIProviderErrorCode;
  public readonly provider: AIProviderName;
  public readonly retryable: boolean;

  constructor(params: {
    message: string;
    code: AIProviderErrorCode;
    provider: AIProviderName;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = 'AIProviderError';
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = params.retryable ?? false;
  }
}

export interface AIGenerationRequest {
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty: DifficultyLevel;
  type: 'mcq' | 'coding';
  count: number;
  existingTitles?: string[];
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Untrusted raw candidate question returned by an AI provider before validation.
 * Supports both conceptual format (`questionText`, `options: string[]`, `correctAnswer`)
 * and Evalora structured format (`title`, `description`, `options: [{id, text, isCorrect}]`).
 */
export interface AIRawQuestionCandidate {
  category?: unknown;
  topic?: unknown;
  subtopic?: unknown;
  difficulty?: unknown;
  type?: unknown;
  title?: unknown;
  questionText?: unknown;
  description?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  marks?: unknown;
  negativeMarks?: unknown;
  estimatedTimeMinutes?: unknown;
  tags?: unknown;
  constraints?: unknown;
  inputFormat?: unknown;
  outputFormat?: unknown;
  examples?: unknown;
  testCases?: unknown;
  visibleTestCases?: unknown;
  hiddenTestCases?: unknown;
  referenceSolution?: unknown;
  supportedLanguages?: unknown;
  starterCode?: unknown;
  codingDetails?: unknown;
}

export interface AIRawGenerationResponse {
  provider: AIProviderName;
  model: string;
  rawText: string;
  latencyMs: number;
}

/**
 * Clean Provider Abstraction: The Question Engine and AIQuestionService
 * interact with providers solely through this interface.
 */
export interface IAIQuestionProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string;
  isConfigured(): boolean;
  generateQuestions(request: AIGenerationRequest): Promise<AIRawGenerationResponse>;
}

export interface ValidatedQuestionPayload {
  category: string;
  topic: string;
  subtopic: string;
  difficulty: DifficultyLevel;
  type: QuestionType;
  title: string;
  description: string;
  marks: number;
  negativeMarks: number;
  estimatedTimeMinutes: number;
  tags: string[];
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  codingDetails?: {
    supportedLanguages: CodingLanguage[];
    starterCode: {
      c?: string;
      cpp?: string;
      python?: string;
      java?: string;
    };
    inputFormat: string;
    outputFormat: string;
    constraints: string;
    examples: Array<{ input: string; output: string; explanation?: string }>;
    visibleTestCases: Array<{ id?: string; input: string; expectedOutput: string; weight?: number }>;
    hiddenTestCases: Array<{ id?: string; input: string; expectedOutput: string; weight?: number }>;
    timeLimitMs: number;
    memoryLimitMb: number;
    referenceSolution?: {
      language: CodingLanguage;
      code: string;
    };
  };
  explanation: string;
  normalizedHash: string;
  requiresCodingExecution: boolean;
}

export interface QuestionValidationOutcome {
  isValid: boolean;
  isDuplicate: boolean;
  reason?: string;
  stage?:
    | 'parse'
    | 'schema'
    | 'field'
    | 'content'
    | 'mcq'
    | 'difficulty'
    | 'coding'
    | 'duplicate'
    | 'execution';
  payload?: ValidatedQuestionPayload;
}

export interface AIGenerationMetrics {
  generationAttempts: number;
  successfulGenerations: number;
  failedGenerations: number;
  validationFailures: number;
  duplicatesRejected: number;
  codingPendingOrRejected: number;
  totalGeneratedCandidates: number;
  totalValidatedQuestions: number;
  providerStats: Record<
    AIProviderName,
    {
      calls: number;
      successes: number;
      errors: number;
      totalLatencyMs: number;
      avgLatencyMs: number;
    }
  >;
}

export interface AIQuestionGenerationResult {
  success: boolean;
  code:
    | 'SUCCESS'
    | 'PARTIAL_SUCCESS'
    | 'AI_GENERATION_UNAVAILABLE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'VALIDATION_REJECTED_ALL'
    | 'INVALID_INPUT';
  message: string;
  provider?: AIProviderName;
  model?: string;
  requestedCount: number;
  generatedCount: number;
  validatedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  pendingExecutionCount: number;
  durationMs: number;
  questions: IQuestion[];
}
