import { GoogleGenAI } from '@google/genai';
import { ENV } from '../config/env.js';
import { DEFAULT_STARTER_CODES } from '../shared/constants.js';
import { DifficultyLevel, QuestionType } from '../shared/types.js';

export interface GeneratedDraftQuestion {
  title: string;
  description: string;
  type: QuestionType;
  topic: string;
  subtopic: string;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  estimatedTimeMinutes: number;
  tags: string[];
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  codingDetails?: {
    supportedLanguages: string[];
    starterCode: { c: string; cpp: string; python: string; java: string };
    inputFormat: string;
    outputFormat: string;
    constraints: string;
    examples: Array<{ input: string; output: string; explanation: string }>;
    visibleTestCases: Array<{ input: string; expectedOutput: string }>;
    hiddenTestCases: Array<{ input: string; expectedOutput: string }>;
    timeLimitMs: number;
    memoryLimitMb: number;
  };
  explanation: string;
}

export class AIService {
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    if (ENV.GEMINI_API_KEY) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
      } catch (err) {
        console.warn('[Evalora AI] Could not initialize GoogleGenAI client with key:', err);
      }
    }
  }

  /**
   * Generates draft questions based on topic, difficulty, and question type.
   */
  async generateQuestions(params: {
    topic: string;
    difficulty: DifficultyLevel;
    type: 'mcq' | 'coding';
    count: number;
  }): Promise<GeneratedDraftQuestion[]> {
    const { topic, difficulty, type, count } = params;

    if (!this.aiClient || !ENV.GEMINI_API_KEY) {
      throw new Error('AI question generation is not configured. Set GEMINI_API_KEY to enable this feature.');
    }

    try {
      const prompt = `You are a Senior Computer Science Professor and Assessment Architect.
Generate ${count} high-quality ${difficulty} level ${type} questions for the topic: "${topic}".
Return ONLY a valid JSON array of objects conforming to this schema without markdown codeblocks:
[
  {
    "title": "Clear concise title",
    "description": "Comprehensive problem statement",
    "type": "${type}",
    "topic": "${topic}",
    "subtopic": "Relevant subtopic",
    "difficulty": "${difficulty}",
    "marks": ${type === 'coding' ? 10 : 2},
    "negativeMarks": 0,
    "estimatedTimeMinutes": ${type === 'coding' ? 25 : 2},
    "tags": ["tag1", "tag2"],
    ${
      type === 'mcq'
        ? `"options": [
      { "id": "opt_1", "text": "Option 1", "isCorrect": true },
      { "id": "opt_2", "text": "Option 2", "isCorrect": false },
      { "id": "opt_3", "text": "Option 3", "isCorrect": false },
      { "id": "opt_4", "text": "Option 4", "isCorrect": false }
    ],`
        : `"codingDetails": {
      "supportedLanguages": ["c", "cpp", "python", "java"],
      "inputFormat": "Input specification",
      "outputFormat": "Output specification",
      "constraints": "Constraints specification",
      "examples": [{ "input": "sample in", "output": "sample out", "explanation": "step explanation" }],
      "visibleTestCases": [{ "input": "sample in", "expectedOutput": "sample out" }],
      "hiddenTestCases": [{ "input": "hidden in", "expectedOutput": "hidden out" }],
      "timeLimitMs": 3000,
      "memoryLimitMb": 256
    },`
    }
    "explanation": "Detailed pedagogical explanation"
  }
]`;

      const response = await this.aiClient.models.generateContent({
        model: ENV.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: prompt
      });

      const rawText = response.text || '';
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => {
          if (item.type === 'coding' && item.codingDetails && !item.codingDetails.starterCode) {
            item.codingDetails.starterCode = DEFAULT_STARTER_CODES;
          }
          return item;
        });
      }
    } catch (err) {
      console.warn('[Evalora AI] Gemini generation error:', err);
      throw new Error('AI question generation failed. Please verify the AI service configuration and try again.');
    }

    throw new Error('AI question generation returned no draft questions.');
  }

  /**
   * Evaluates student's topic proficiency and generates actionable study recommendations.
   */
  async generateSkillGapAnalysis(metrics: Array<{ topic: string; scorePercentage: number; totalAttempted: number }>): Promise<{
    primaryWeakArea: string;
    secondaryWeakArea: string;
    summary: string;
    recommendedSequence: string[];
    actionPlan: string;
  } | null> {
    if (metrics.length === 0) {
      return null;
    }

    // Sort metrics by lowest score
    const sorted = [...metrics].sort((a, b) => a.scorePercentage - b.scorePercentage);
    const primaryWeak = sorted[0].topic;
    const secondaryWeak = sorted[1]?.topic || sorted[0].topic;
    const primaryScore = sorted[0].scorePercentage;
    const secondaryScore = sorted[1]?.scorePercentage ?? sorted[0].scorePercentage;

    return {
      primaryWeakArea: primaryWeak,
      secondaryWeakArea: secondaryWeak,
      summary: `Based on your stored practice and assessment attempts, your proficiency in ${primaryWeak} (${primaryScore}%) and ${secondaryWeak} (${secondaryScore}%) indicates opportunities for improvement.`,
      recommendedSequence: [
        `${primaryWeak} Fundamentals & Base Cases`,
        `${primaryWeak} Medium Practice Problems`,
        `Divide and Conquer Transitions`,
        `${secondaryWeak} State Formulation & Memoization`,
        `Integrated Mock Assessment`
      ],
      actionPlan: `Complete 10 focused practice questions on ${primaryWeak} today, focusing on identifying edge cases and base termination conditions.`
    };
  }
}

export const aiService = new AIService();
