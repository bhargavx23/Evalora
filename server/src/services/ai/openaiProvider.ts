import { ENV } from '../../config/env.js';
import {
  AIGenerationRequest,
  AIRawGenerationResponse,
  AIProviderError,
  IAIQuestionProvider
} from './types.js';
import { buildQuestionGenerationPrompt, getOpenAIResponseSchema } from './prompts.js';

export class OpenAIProvider implements IAIQuestionProvider {
  public readonly name = 'openai' as const;
  private apiKeyOverride?: string;
  private modelOverride?: string;
  private baseUrl: string;
  private customFetchFn?: typeof fetch;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    customFetchFn?: typeof fetch;
  }) {
    this.apiKeyOverride = options?.apiKey;
    this.modelOverride = options?.model;
    this.baseUrl = options?.baseUrl || 'https://api.openai.com/v1/chat/completions';
    this.customFetchFn = options?.customFetchFn;
  }

  get defaultModel(): string {
    return this.modelOverride || ENV.OPENAI_MODEL || ENV.AI_MODEL || 'gpt-4o-mini';
  }

  private getApiKey(): string {
    return this.apiKeyOverride !== undefined ? this.apiKeyOverride : ENV.OPENAI_API_KEY;
  }

  isConfigured(): boolean {
    if (this.customFetchFn && this.apiKeyOverride === undefined) {
      return Boolean(this.getApiKey()) || true;
    }
    const key = this.getApiKey();
    return typeof key === 'string' && key.trim().length > 0;
  }

  async generateQuestions(request: AIGenerationRequest): Promise<AIRawGenerationResponse> {
    const key = this.getApiKey();
    if (!this.customFetchFn && (!key || !key.trim())) {
      throw new AIProviderError({
        message: 'OpenAI provider is not configured.',
        code: 'PROVIDER_NOT_CONFIGURED',
        provider: 'openai',
        retryable: false
      });
    }

    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? ENV.AI_TIMEOUT_MS;
    const model = this.defaultModel;
    const prompt = buildQuestionGenerationPrompt(request);
    const jsonSchema = getOpenAIResponseSchema(request.type);
    const fetchImpl = this.customFetchFn || globalThis.fetch;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key || 'mock-key'}`
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? ENV.AI_TEMPERATURE,
          max_tokens: request.maxOutputTokens ?? ENV.AI_MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert technical assessment question generator. Respond strictly with valid JSON conforming to the requested schema.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: jsonSchema
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const status = response.status;
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore body read error
        }

        if (status === 429) {
          const isQuota = /insufficient_quota|quota|billing/i.test(errorBody);
          throw new AIProviderError({
            message: isQuota ? 'OpenAI quota exceeded.' : 'OpenAI rate limit reached.',
            code: isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMIT',
            provider: 'openai',
            retryable: !isQuota
          });
        }

        if (status === 401 || status === 403) {
          throw new AIProviderError({
            message: 'OpenAI authentication failed.',
            code: 'PROVIDER_NOT_CONFIGURED',
            provider: 'openai',
            retryable: false
          });
        }

        throw new AIProviderError({
          message: `OpenAI returned HTTP ${status}.`,
          code: status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_RESPONSE',
          provider: 'openai',
          retryable: status >= 500
        });
      }

      const data: any = await response.json();
      const rawText = data?.choices?.[0]?.message?.content?.trim() || '';

      if (!rawText) {
        throw new AIProviderError({
          message: 'OpenAI returned an empty response payload.',
          code: 'INVALID_RESPONSE',
          provider: 'openai',
          retryable: true
        });
      }

      return {
        provider: 'openai',
        model: data?.model || model,
        rawText,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      if (err instanceof AIProviderError) {
        throw err;
      }

      if (err?.name === 'AbortError' || /timeout|timed out|aborted/i.test(String(err?.message))) {
        throw new AIProviderError({
          message: `OpenAI generation timed out after ${timeoutMs}ms.`,
          code: 'TIMEOUT',
          provider: 'openai',
          retryable: true
        });
      }

      throw new AIProviderError({
        message: 'OpenAI network or service failure.',
        code: 'NETWORK_ERROR',
        provider: 'openai',
        retryable: true
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
