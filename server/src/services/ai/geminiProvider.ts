import { GoogleGenAI } from '@google/genai';
import { ENV } from '../../config/env.js';
import {
  AIGenerationRequest,
  AIRawGenerationResponse,
  AIProviderError,
  IAIQuestionProvider
} from './types.js';
import { buildQuestionGenerationPrompt, getGeminiResponseSchema } from './prompts.js';

export class GeminiProvider implements IAIQuestionProvider {
  public readonly name = 'gemini' as const;
  private apiKeyOverride?: string;
  private modelOverride?: string;
  private customGenerateFn?: (params: any) => Promise<{ text?: string }>;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    customGenerateFn?: (params: any) => Promise<{ text?: string }>;
  }) {
    this.apiKeyOverride = options?.apiKey;
    this.modelOverride = options?.model;
    this.customGenerateFn = options?.customGenerateFn;
  }

  get defaultModel(): string {
    return this.modelOverride || ENV.GEMINI_MODEL || ENV.AI_MODEL || 'gemini-3.8-flash';
  }

  private getCandidateModels(): string[] {
    const list = [this.defaultModel, 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash'];
    return Array.from(new Set(list.filter(Boolean)));
  }

  private getApiKey(): string {
    return this.apiKeyOverride !== undefined ? this.apiKeyOverride : ENV.GEMINI_API_KEY;
  }

  isConfigured(): boolean {
    if (this.customGenerateFn) return true;
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
      if (!process.env.ALLOW_LIVE_AI_TESTS) {
        return false;
      }
    }
    const key = this.getApiKey();
    return typeof key === 'string' && key.trim().length > 0;
  }

  async generateQuestions(request: AIGenerationRequest): Promise<AIRawGenerationResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({
        message: 'Gemini provider is not configured.',
        code: 'PROVIDER_NOT_CONFIGURED',
        provider: 'gemini',
        retryable: false
      });
    }

    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? ENV.AI_TIMEOUT_MS;
    const effectiveType = request.type === 'coding' || request.category?.toLowerCase() === 'coding' ? 'coding' : 'mcq';
    const responseJsonSchema = getGeminiResponseSchema(effectiveType);
    const prompt = buildQuestionGenerationPrompt(request);

    let usedModel = this.defaultModel;

    const invokeModel = async (): Promise<{ text?: string }> => {
      if (this.customGenerateFn) {
        usedModel = this.defaultModel;
        return this.customGenerateFn({
          model: usedModel,
          contents: prompt,
          config: {
            temperature: request.temperature ?? ENV.AI_TEMPERATURE,
            maxOutputTokens: request.maxOutputTokens ?? ENV.AI_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: responseJsonSchema,
            responseJsonSchema
          }
        });
      }

      const client = new GoogleGenAI({ apiKey: this.getApiKey() });
      const candidateModels = this.modelOverride ? [this.modelOverride] : this.getCandidateModels();
      let lastErr: any = null;

      for (const m of candidateModels) {
        try {
          const resp = await client.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              temperature: request.temperature ?? ENV.AI_TEMPERATURE,
              maxOutputTokens: request.maxOutputTokens ?? ENV.AI_MAX_OUTPUT_TOKENS,
              responseMimeType: 'application/json',
              responseSchema: responseJsonSchema,
              responseJsonSchema
            }
          });
          usedModel = m;
          return resp;
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || '');
          const status = Number(err?.status || err?.statusCode || 0);
          const isRetryableCandidate =
            status === 429 ||
            status === 404 ||
            status === 503 ||
            /resource_exhausted|quota|not found|rate limit|unavailable/i.test(msg);
          if (!isRetryableCandidate) {
            throw err;
          }
        }
      }

      throw lastErr;
    };

    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new AIProviderError({
              message: `Gemini generation timed out after ${timeoutMs}ms.`,
              code: 'TIMEOUT',
              provider: 'gemini',
              retryable: true
            })
          );
        }, timeoutMs);
      });

      const response = await Promise.race([invokeModel(), timeoutPromise]);
      const rawText = response?.text?.trim() || '';

      if (!rawText) {
        throw new AIProviderError({
          message: 'Gemini returned an empty response payload.',
          code: 'INVALID_RESPONSE',
          provider: 'gemini',
          retryable: true
        });
      }

      return {
        provider: 'gemini',
        model: usedModel,
        rawText,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      if (err instanceof AIProviderError) {
        throw err;
      }

      const msg = String(err?.message || 'Gemini provider error');
      const status = Number(err?.status || err?.statusCode || 0);

      if (status === 429 || /rate limit|too many requests/i.test(msg)) {
        throw new AIProviderError({
          message: 'Gemini rate limit reached.',
          code: 'RATE_LIMIT',
          provider: 'gemini',
          retryable: true
        });
      }

      if (/quota|billing|resource_exhausted/i.test(msg)) {
        throw new AIProviderError({
          message: 'Gemini quota exceeded.',
          code: 'QUOTA_EXCEEDED',
          provider: 'gemini',
          retryable: false
        });
      }

      if (/timeout|timed out|abort/i.test(msg)) {
        throw new AIProviderError({
          message: 'Gemini request timed out.',
          code: 'TIMEOUT',
          provider: 'gemini',
          retryable: true
        });
      }

      throw new AIProviderError({
        message: 'Gemini service is temporarily unavailable.',
        code: status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'NETWORK_ERROR',
        provider: 'gemini',
        retryable: status >= 500 || status === 0
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
