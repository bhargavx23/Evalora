import { Type } from '@google/genai';
import { AIGenerationRequest } from './types.js';

/**
 * Builds a category- and type-aware prompt with strict instructions for uniqueness,
 * pedagogical accuracy, difficulty calibration, and structured JSON compliance.
 */
export function buildQuestionGenerationPrompt(req: AIGenerationRequest): string {
  const category = req.category || inferCategoryFromTopic(req.topic);
  const avoidList =
    req.existingTitles && req.existingTitles.length > 0
      ? `\nDO NOT generate questions similar to these existing questions in our bank:\n- ${req.existingTitles.slice(0, 15).join('\n- ')}\n`
      : '';

  const isCoding = req.type === 'coding' || req.category?.toLowerCase() === 'coding';
  if (isCoding) {
    return `You are a Principal Assessment Architect for Evalora, a university-grade technical assessment platform.
Generate exactly ${req.count} distinct, original "${req.difficulty}" difficulty CODING problem(s) for:
- Category: ${category}
- Topic: ${req.topic}
${req.subtopic ? `- Subtopic: ${req.subtopic}\n` : ''}${avoidList}
STRICT REQUIREMENTS:
1. Return ONLY valid JSON matching the required schema: { "questions": [ ... ] }.
2. Each problem must be self-contained, unambiguous, and solvable using standard stdin/stdout in Python, C, C++, and Java.
3. Provide a working Python 3 "referenceSolution" ({ "language": "python", "code": "..." }) that reads from standard input (e.g., using sys.stdin.read().split() or input()) and prints exact expected output to standard output without prompts.
4. Provide at least 2 "visibleTestCases" and at least 2 "hiddenTestCases" whose expectedOutput values are strictly trimmed and 100% consistent with running your referenceSolution on each test case input.
5. Do not produce duplicate or near-duplicate problems within the batch.
6. Ensure difficulty strictly matches "${req.difficulty}".`;
  }

  return `You are a Principal Assessment Architect for Evalora, a university-grade assessment platform.
Generate exactly ${req.count} distinct, original "${req.difficulty}" difficulty Multiple-Choice Questions (MCQ) for:
- Category: ${category}
- Topic: ${req.topic}
${req.subtopic ? `- Subtopic: ${req.subtopic}\n` : ''}${avoidList}
STRICT REQUIREMENTS:
1. Return ONLY valid JSON matching the required schema: { "questions": [ ... ] }.
2. Each question must have:
   - "category": "${category}"
   - "topic": "${req.topic}"
   - "subtopic": specific concept within "${req.topic}"
   - "difficulty": "${req.difficulty}"
   - "type": "MCQ"
   - "title": concise, unique question title (10 to 120 characters)
   - "questionText": complete, clear, self-contained question stem
   - "options": array of exactly 4 distinct, non-empty option strings
   - "correctAnswer": the exact text of the single correct option (MUST match one of the 4 options character-for-character)
   - "explanation": clear step-by-step derivation proving why correctAnswer is right and why distractors are wrong
3. Never invent ambiguous answers, duplicate options, or repeat questions within the batch.`;
}

export function inferCategoryFromTopic(topic: string): string {
  const t = (topic || '').toLowerCase();
  if (
    ['arrays', 'strings', 'linked lists', 'trees', 'graphs', 'recursion', 'dynamic programming', 'sorting', 'searching', 'heaps', 'hashing'].some(k =>
      t.includes(k)
    )
  ) {
    return 'DSA';
  }
  if (
    ['quantitative', 'percentages', 'profit', 'time and work', 'ratios', 'number system', 'probability', 'permutations', 'verbal', 'aptitude'].some(k =>
      t.includes(k)
    )
  ) {
    return 'Aptitude';
  }
  if (['logical', 'blood relations', 'syllogisms', 'direction sense', 'puzzles', 'seating', 'reasoning'].some(k => t.includes(k))) {
    return 'Reasoning';
  }
  if (['dbms', 'operating systems', 'computer networks', 'oop', 'sql', 'system design'].some(k => t.includes(k))) {
    return 'Placement/Technical';
  }
  return 'DSA';
}

/**
 * Gemini `@google/genai` responseJsonSchema definition.
 */
export function getGeminiResponseSchema(type: 'mcq' | 'coding'): any {
  if (type === 'coding') {
    return {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              topic: { type: Type.STRING },
              subtopic: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              questionText: { type: Type.STRING },
              description: { type: Type.STRING },
              constraints: { type: Type.STRING },
              inputFormat: { type: Type.STRING },
              outputFormat: { type: Type.STRING },
              supportedLanguages: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              examples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    input: { type: Type.STRING },
                    output: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ['input', 'output']
                }
              },
              visibleTestCases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    input: { type: Type.STRING },
                    expectedOutput: { type: Type.STRING }
                  },
                  required: ['input', 'expectedOutput']
                }
              },
              hiddenTestCases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    input: { type: Type.STRING },
                    expectedOutput: { type: Type.STRING }
                  },
                  required: ['input', 'expectedOutput']
                }
              },
              referenceSolution: {
                type: Type.OBJECT,
                properties: {
                  language: { type: Type.STRING },
                  code: { type: Type.STRING }
                },
                required: ['language', 'code']
              },
              explanation: { type: Type.STRING }
            },
            required: [
              'category',
              'topic',
              'difficulty',
              'type',
              'title',
              'description',
              'constraints',
              'inputFormat',
              'outputFormat',
              'examples',
              'visibleTestCases',
              'hiddenTestCases',
              'referenceSolution',
              'explanation'
            ]
          }
        }
      },
      required: ['questions']
    };
  }

  return {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            topic: { type: Type.STRING },
            subtopic: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            questionText: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: [
            'category',
            'topic',
            'difficulty',
            'type',
            'title',
            'questionText',
            'options',
            'correctAnswer',
            'explanation'
          ]
        }
      }
    },
    required: ['questions']
  };
}

/**
 * OpenAI Structured Outputs (`response_format: { type: 'json_schema' }`) definition.
 */
export function getOpenAIResponseSchema(type: 'mcq' | 'coding'): any {
  if (type === 'coding') {
    return {
      name: 'evalora_coding_questions',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                category: { type: 'string' },
                topic: { type: 'string' },
                subtopic: { type: 'string' },
                difficulty: { type: 'string' },
                type: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                constraints: { type: 'string' },
                inputFormat: { type: 'string' },
                outputFormat: { type: 'string' },
                supportedLanguages: {
                  type: 'array',
                  items: { type: 'string' }
                },
                examples: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      input: { type: 'string' },
                      output: { type: 'string' },
                      explanation: { type: 'string' }
                    },
                    required: ['input', 'output', 'explanation']
                  }
                },
                visibleTestCases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      input: { type: 'string' },
                      expectedOutput: { type: 'string' }
                    },
                    required: ['input', 'expectedOutput']
                  }
                },
                hiddenTestCases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      input: { type: 'string' },
                      expectedOutput: { type: 'string' }
                    },
                    required: ['input', 'expectedOutput']
                  }
                },
                referenceSolution: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    language: { type: 'string' },
                    code: { type: 'string' }
                  },
                  required: ['language', 'code']
                },
                explanation: { type: 'string' }
              },
              required: [
                'category',
                'topic',
                'subtopic',
                'difficulty',
                'type',
                'title',
                'description',
                'constraints',
                'inputFormat',
                'outputFormat',
                'supportedLanguages',
                'examples',
                'visibleTestCases',
                'hiddenTestCases',
                'referenceSolution',
                'explanation'
              ]
            }
          }
        },
        required: ['questions']
      }
    };
  }

  return {
    name: 'evalora_mcq_questions',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: { type: 'string' },
              topic: { type: 'string' },
              subtopic: { type: 'string' },
              difficulty: { type: 'string' },
              type: { type: 'string' },
              title: { type: 'string' },
              questionText: { type: 'string' },
              options: {
                type: 'array',
                items: { type: 'string' }
              },
              correctAnswer: { type: 'string' },
              explanation: { type: 'string' }
            },
            required: [
              'category',
              'topic',
              'subtopic',
              'difficulty',
              'type',
              'title',
              'questionText',
              'options',
              'correctAnswer',
              'explanation'
            ]
          }
        }
      },
      required: ['questions']
    }
  };
}
