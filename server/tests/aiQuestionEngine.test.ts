import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { ENV } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Question } from '../src/models/Question.js';
import { PracticeQuestionHistory } from '../src/models/PracticeQuestionHistory.js';
import { PracticeSession } from '../src/models/PracticeSession.js';
import {
  normalizeQuestionText,
  computeNormalizedHash,
  computeQuestionSimilarity,
  parseAIQuestionsJson,
  validateCandidateQuestion
} from '../src/services/ai/questionValidator.js';
import { GeminiProvider } from '../src/services/ai/geminiProvider.js';
import { OpenAIProvider } from '../src/services/ai/openaiProvider.js';
import {
  AIGenerationRequest,
  AIRawGenerationResponse,
  AIProviderError,
  IAIQuestionProvider
} from '../src/services/ai/types.js';
import { aiQuestionService } from '../src/services/aiQuestionService.js';
import { dynamicPracticeService } from '../src/services/dynamicPracticeService.js';

describe('Evalora Phase 4 — AI Question Generation & Validation System', () => {
  let studentToken = '';
  let studentId = '';
  let facultyToken = '';
  let facultyId = '';
  const testTopic = 'Phase4_Graph_Algorithms_Test';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    // Create/reset isolated student user
    let student = await User.findOne({ email: 'phase4.student@evalora.io' });
    if (!student) {
      student = await User.create({
        name: 'Phase 4 Student',
        email: 'phase4.student@evalora.io',
        role: 'student',
        emailVerified: true,
        status: 'active',
        freeAttempts: { total: 20, used: 0 },
        paidAttempts: { total: 0, used: 0 }
      });
    } else {
      student.freeAttempts = { total: 20, used: 0 };
      student.paidAttempts = { total: 0, used: 0 };
      await student.save();
    }
    studentId = student._id.toString();
    studentToken = jwt.sign(
      { userId: studentId, role: 'student', collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create/reset isolated faculty user
    let faculty = await User.findOne({ email: 'phase4.faculty@evalora.io' });
    if (!faculty) {
      faculty = await User.create({
        name: 'Phase 4 Faculty',
        email: 'phase4.faculty@evalora.io',
        role: 'faculty',
        emailVerified: true,
        status: 'active'
      });
    }
    facultyId = faculty._id.toString();
    facultyToken = jwt.sign(
      { userId: facultyId, role: 'faculty', collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    aiQuestionService.resetConfiguration();
    aiQuestionService.resetMetrics();
    dynamicPracticeService.setReplenishmentProvider(aiQuestionService);
    await Question.deleteMany({ topic: testTopic });
  });

  afterAll(async () => {
    aiQuestionService.resetConfiguration();
    await Question.deleteMany({ topic: testTopic });
    if (studentId) {
      await PracticeQuestionHistory.deleteMany({
        studentId: new mongoose.Types.ObjectId(studentId)
      });
      await PracticeSession.deleteMany({
        studentId: new mongoose.Types.ObjectId(studentId)
      });
      await User.findByIdAndDelete(studentId);
    }
    if (facultyId) {
      await User.findByIdAndDelete(facultyId);
    }
  });

  // =========================================================================
  // 1. VALIDATION PIPELINE UNIT TESTS
  // =========================================================================
  describe('1. Validation Pipeline & MCQ Rules', () => {
    it('accepts a valid structured MCQ candidate and normalizes options', () => {
      const outcome = validateCandidateQuestion(
        {
          category: 'DSA',
          topic: 'Arrays',
          subtopic: 'Sliding Window',
          difficulty: 'medium',
          type: 'MCQ',
          title: 'Maximum Sum Subarray of Size K',
          questionText: 'What is the optimal time complexity to find the maximum sum subarray of fixed size K in an array of N elements?',
          options: ['O(N)', 'O(N log N)', 'O(N * K)', 'O(K^2)'],
          correctAnswer: 'O(N)',
          explanation: 'Using a sliding window of size K, we add the entering element and subtract the leaving element in O(1) per step, giving O(N) total time.'
        },
        {
          expectedCategory: 'DSA',
          expectedTopic: 'Arrays',
          expectedDifficulty: 'medium',
          expectedType: 'mcq'
        }
      );

      expect(outcome.isValid).toBe(true);
      expect(outcome.isDuplicate).toBe(false);
      expect(outcome.payload).toBeDefined();
      expect(outcome.payload?.options?.length).toBe(4);
      expect(outcome.payload?.options?.filter(o => o.isCorrect).length).toBe(1);
      expect(outcome.payload?.options?.find(o => o.isCorrect)?.text).toBe('O(N)');
    });

    it('rejects missing questionText, invalid category, and invalid difficulty', () => {
      const missingText = validateCandidateQuestion({
        category: 'DSA',
        topic: 'Arrays',
        difficulty: 'medium',
        type: 'MCQ',
        questionText: 'Short',
        options: ['A1', 'B1', 'C1', 'D1'],
        correctAnswer: 'A1',
        explanation: 'Valid explanation text.'
      });
      expect(missingText.isValid).toBe(false);
      expect(missingText.stage).toBe('content');

      const invalidCat = validateCandidateQuestion({
        category: 'Astrology',
        topic: 'Horoscopes',
        difficulty: 'medium',
        type: 'MCQ',
        questionText: 'Which planet rules the third house in this invalid category question?',
        options: ['Mars', 'Venus', 'Mercury', 'Jupiter'],
        correctAnswer: 'Mercury',
        explanation: 'Invalid category test.'
      });
      expect(invalidCat.isValid).toBe(false);
      expect(invalidCat.stage).toBe('field');

      const invalidDiff = validateCandidateQuestion({
        category: 'DSA',
        topic: 'Arrays',
        difficulty: 'impossible',
        type: 'MCQ',
        questionText: 'What is the time complexity of binary search on a sorted array?',
        options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
        correctAnswer: 'O(log N)',
        explanation: 'Binary search halves the search space each step.'
      });
      expect(invalidDiff.isValid).toBe(false);
      expect(invalidDiff.stage).toBe('difficulty');
    });

    it('rejects MCQ with duplicate options, fewer than 4 options, or non-matching correctAnswer', () => {
      // Duplicate options
      const dupOptions = validateCandidateQuestion({
        category: 'DSA',
        topic: 'Arrays',
        difficulty: 'easy',
        type: 'MCQ',
        questionText: 'What is the worst-case time complexity of linear search in an unsorted array?',
        options: ['O(N)', 'o(n)', 'O(log N)', 'O(1)'],
        correctAnswer: 'O(N)',
        explanation: 'Linear search inspects up to N elements.'
      });
      expect(dupOptions.isValid).toBe(false);
      expect(dupOptions.stage).toBe('mcq');

      // Missing / non-existent correct answer
      const badAnswer = validateCandidateQuestion({
        category: 'DSA',
        topic: 'Arrays',
        difficulty: 'easy',
        type: 'MCQ',
        questionText: 'What is the worst-case time complexity of linear search in an unsorted array?',
        options: ['O(N)', 'O(N^2)', 'O(log N)', 'O(1)'],
        correctAnswer: 'O(2^N)',
        explanation: 'Linear search inspects up to N elements.'
      });
      expect(badAnswer.isValid).toBe(false);
      expect(badAnswer.stage).toBe('mcq');

      // Too few options
      const tooFew = validateCandidateQuestion({
        category: 'DSA',
        topic: 'Arrays',
        difficulty: 'easy',
        type: 'MCQ',
        questionText: 'What is the worst-case time complexity of linear search in an unsorted array?',
        options: ['O(N)', 'O(1)'],
        correctAnswer: 'O(N)',
        explanation: 'Linear search inspects up to N elements.'
      });
      expect(tooFew.isValid).toBe(false);
      expect(tooFew.stage).toBe('mcq');
    });
  });

  // =========================================================================
  // 2. DUPLICATE DETECTION TESTS
  // =========================================================================
  describe('2. Duplicate & Similarity Detection', () => {
    it('detects exact, normalized, semantic/similar, and same-batch duplicates', () => {
      const baseText =
        'Find the minimum number of platforms required at a railway station so that no train waits.';
      const normalizedVariant =
        '  FIND the minimum number of platforms required at a railway station, so that no train waits!! ';
      const similarParaphrase =
        'Determine the minimum number of railway platforms required at a station so that no train has to wait.';
      const distinctQuestion =
        'Compute the diameter of a binary tree given its root node using depth-first search.';

      expect(normalizeQuestionText(baseText)).toBe(normalizeQuestionText(normalizedVariant));
      expect(computeNormalizedHash(baseText)).toBe(computeNormalizedHash(normalizedVariant));

      const simScore = computeQuestionSimilarity(baseText, similarParaphrase);
      expect(simScore).toBeGreaterThanOrEqual(0.72);

      const distinctScore = computeQuestionSimilarity(baseText, distinctQuestion);
      expect(distinctScore).toBeLessThan(0.35);

      // Verify validator rejects normalized duplicate against existingQuestions
      const dupCheck = validateCandidateQuestion(
        {
          category: 'DSA',
          topic: 'Arrays',
          difficulty: 'medium',
          type: 'MCQ',
          title: 'Minimum Platforms Required',
          questionText: normalizedVariant,
          options: ['O(N log N)', 'O(N)', 'O(N^2)', 'O(1)'],
          correctAnswer: 'O(N log N)',
          explanation: 'Sorting arrival and departure times takes O(N log N).'
        },
        {
          existingQuestions: [
            {
              title: 'Railway Platforms',
              description: baseText,
              normalizedHash: computeNormalizedHash(baseText)
            }
          ]
        }
      );
      expect(dupCheck.isValid).toBe(false);
      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.stage).toBe('duplicate');

      // Verify validator rejects same-batch near-duplicate
      const batchCheck = validateCandidateQuestion(
        {
          category: 'DSA',
          topic: 'Arrays',
          difficulty: 'medium',
          type: 'MCQ',
          title: 'Station Platforms Count',
          questionText: similarParaphrase,
          options: ['O(N log N)', 'O(N)', 'O(N^2)', 'O(1)'],
          correctAnswer: 'O(N log N)',
          explanation: 'Sorting arrival and departure times takes O(N log N).'
        },
        {
          batchAccepted: [
            {
              title: 'Minimum Platforms',
              description: baseText,
              normalizedHash: computeNormalizedHash(baseText)
            }
          ]
        }
      );
      expect(batchCheck.isValid).toBe(false);
      expect(batchCheck.isDuplicate).toBe(true);
    });
  });

  // =========================================================================
  // 3. PROVIDER ABSTRACTION, RETRIES, TIMEOUT & FALLBACK TESTS
  // =========================================================================
  describe('3. Provider Abstraction (OpenAI & Gemini), Retries & Fallback', () => {
    it('supports both GeminiProvider and OpenAIProvider through IAIQuestionProvider without real network calls', async () => {
      const samplePayload = JSON.stringify({
        questions: [
          {
            category: 'DSA',
            topic: testTopic,
            subtopic: 'Shortest Path',
            difficulty: 'medium',
            type: 'MCQ',
            title: 'Dijkstra Priority Queue Complexity',
            questionText:
              'What is the time complexity of Dijkstra shortest path algorithm using a binary heap on a graph with V vertices and E edges?',
            options: ['O((V + E) log V)', 'O(V^2)', 'O(V * E)', 'O(E log E + V^2)'],
            correctAnswer: 'O((V + E) log V)',
            explanation: 'Each vertex extraction takes O(log V) and each edge relaxation takes O(log V).'
          }
        ]
      });

      const mockGemini = new GeminiProvider({
        apiKey: 'mock-gemini-key',
        model: 'gemini-3.8-flash',
        customGenerateFn: async () => ({ text: samplePayload })
      });

      const geminiResp = await mockGemini.generateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'medium',
        type: 'mcq',
        count: 1
      });
      expect(geminiResp.provider).toBe('gemini');
      expect(geminiResp.model).toBe('gemini-3.8-flash');
      expect(parseAIQuestionsJson(geminiResp.rawText).ok).toBe(true);

      const mockOpenAI = new OpenAIProvider({
        apiKey: 'mock-openai-key',
        model: 'gpt-4o-mini',
        customFetchFn: (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              model: 'gpt-4o-mini',
              choices: [{ message: { content: samplePayload } }]
            })
          }) as any) as typeof fetch
      });

      const openaiResp = await mockOpenAI.generateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'medium',
        type: 'mcq',
        count: 1
      });
      expect(openaiResp.provider).toBe('openai');
      expect(openaiResp.model).toBe('gpt-4o-mini');
      expect(parseAIQuestionsJson(openaiResp.rawText).ok).toBe(true);
    });

    it('handles transient rate-limit / malformed JSON via bounded retry and succeeds', async () => {
      let callCount = 0;
      const flakyProvider: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async (_req: AIGenerationRequest): Promise<AIRawGenerationResponse> => {
          callCount += 1;
          if (callCount === 1) {
            throw new AIProviderError({
              message: 'Rate limit exceeded',
              code: 'RATE_LIMIT',
              provider: 'gemini',
              retryable: true
            });
          }
          if (callCount === 2) {
            return {
              provider: 'gemini',
              model: 'gemini-3.8-flash',
              rawText: '{ malformed json without closing brace',
              latencyMs: 12
            };
          }
          return {
            provider: 'gemini',
            model: 'gemini-3.8-flash',
            rawText: JSON.stringify({
              questions: [
                {
                  category: 'DSA',
                  topic: testTopic,
                  subtopic: 'Topological Sort',
                  difficulty: 'medium',
                  type: 'MCQ',
                  title: 'Kahn Algorithm Data Structure',
                  questionText:
                    'Which primary data structure is used to track zero in-degree vertices in Kahn topological sorting algorithm?',
                  options: ['Queue', 'Stack', 'Disjoint Set', 'Segment Tree'],
                  correctAnswer: 'Queue',
                  explanation: 'Kahn algorithm maintains a queue of vertices whose in-degree becomes zero.'
                }
              ]
            }),
            latencyMs: 18
          };
        }
      };

      aiQuestionService.registerProvider(flakyProvider);
      aiQuestionService.configure({ preferredProvider: 'gemini', maxRetries: 2 });

      const result = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'medium',
        type: 'mcq',
        count: 1
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(3); // 1 initial + 2 retries
      expect(result.validatedCount).toBe(1);
    });

    it('falls back from OpenAI to Gemini ONLY when fallbackProvider is configured', async () => {
      const failingOpenAI: IAIQuestionProvider = {
        name: 'openai',
        defaultModel: 'gpt-4o-mini',
        isConfigured: () => true,
        generateQuestions: async () => {
          throw new AIProviderError({
            message: 'OpenAI 503 Unavailable',
            code: 'PROVIDER_UNAVAILABLE',
            provider: 'openai',
            retryable: false
          });
        }
      };

      const workingGemini: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async () => ({
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          latencyMs: 15,
          rawText: JSON.stringify({
            questions: [
              {
                category: 'DSA',
                topic: testTopic,
                subtopic: 'MST',
                difficulty: 'medium',
                type: 'MCQ',
                title: 'Kruskal Algorithm Union Find',
                questionText:
                  'Which auxiliary data structure allows Kruskal minimum spanning tree algorithm to detect cycles in nearly O(1) amortized time?',
                options: ['Disjoint Set Union (DSU)', 'Binary Search Tree', 'Hash Table', 'Adjacency Matrix'],
                correctAnswer: 'Disjoint Set Union (DSU)',
                explanation: 'DSU with path compression and union by rank detects cycles in O(alpha(V)) time.'
              }
            ]
          })
        })
      };

      aiQuestionService.registerProvider(failingOpenAI);
      aiQuestionService.registerProvider(workingGemini);

      // Case A: Fallback NOT configured -> returns controlled AI_GENERATION_UNAVAILABLE without calling Gemini
      aiQuestionService.configure({ preferredProvider: 'openai', fallbackProvider: '', maxRetries: 0 });
      const noFallbackResult = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'medium',
        type: 'mcq',
        count: 1
      });
      expect(noFallbackResult.success).toBe(false);
      expect(noFallbackResult.code).toBe('AI_GENERATION_UNAVAILABLE');
      expect(aiQuestionService.getMetrics().providerStats.gemini.calls).toBe(0);

      // Case B: Fallback configured ('gemini') -> seamlessly falls back to Gemini
      aiQuestionService.configure({ preferredProvider: 'openai', fallbackProvider: 'gemini', maxRetries: 0 });
      const fallbackResult = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'medium',
        type: 'mcq',
        count: 1
      });
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.provider).toBe('gemini');
      expect(fallbackResult.validatedCount).toBe(1);
    });
  });

  // =========================================================================
  // 4. CODING QUESTION SANDBOXED EXECUTION VALIDATION TESTS
  // =========================================================================
  describe('4. Coding Question Reference Solution Execution Validation', () => {
    it('only publishes coding questions whose referenceSolution passes sandboxed test cases, rejecting broken solutions', async () => {
      const codingProvider: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async () => ({
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          latencyMs: 25,
          rawText: JSON.stringify({
            questions: [
              // Candidate 1: Valid working Python reference solution
              {
                category: 'Coding',
                topic: testTopic,
                subtopic: 'Graph Degree',
                difficulty: 'easy',
                type: 'coding',
                title: 'Double an Integer',
                description: 'Given an integer N on standard input, print 2 * N.',
                constraints: '1 <= N <= 10^6',
                inputFormat: 'A single integer N.',
                outputFormat: 'A single integer equal to 2 * N.',
                supportedLanguages: ['python', 'c', 'cpp', 'java'],
                examples: [{ input: '5', output: '10', explanation: '2 * 5 = 10' }],
                visibleTestCases: [
                  { input: '5\n', expectedOutput: '10' },
                  { input: '12\n', expectedOutput: '24' }
                ],
                hiddenTestCases: [{ input: '100\n', expectedOutput: '200' }],
                referenceSolution: {
                  language: 'python',
                  code: 'import sys\nn = int(sys.stdin.read().strip())\nprint(n * 2)\n'
                },
                explanation: 'Multiply the input integer by 2.'
              },
              // Candidate 2: Broken reference solution (prints N * 999 instead of factorial)
              {
                category: 'Coding',
                topic: testTopic,
                subtopic: 'Graph Combinatorics',
                difficulty: 'easy',
                type: 'coding',
                title: 'Compute Factorial of Vertex Count Broken',
                description:
                  'Compute and output the factorial product of all positive integers up to the vertex count K.',
                constraints: '1 <= K <= 12',
                inputFormat: 'A single positive integer K.',
                outputFormat: 'A single integer equal to K factorial.',
                supportedLanguages: ['python'],
                examples: [{ input: '4', output: '24', explanation: '4! = 24' }],
                visibleTestCases: [{ input: '4\n', expectedOutput: '24' }],
                hiddenTestCases: [{ input: '5\n', expectedOutput: '120' }],
                referenceSolution: {
                  language: 'python',
                  code: 'import sys\nn = int(sys.stdin.read().strip())\nprint(n * 999)\n'
                },
                explanation: 'Broken reference solution test.'
              }
            ]
          })
        })
      };

      aiQuestionService.registerProvider(codingProvider);
      aiQuestionService.configure({ preferredProvider: 'gemini', enableCodingExecutionValidation: true });

      const result = await aiQuestionService.generateAndValidateQuestions({
        category: 'Coding',
        topic: testTopic,
        difficulty: 'easy',
        type: 'coding',
        count: 2
      });

      expect(result.success).toBe(true);
      expect(result.generatedCount).toBe(2);
      expect(result.validatedCount).toBe(1);
      expect(result.rejectedCount).toBe(1);
      expect(result.questions[0].title).toBe('Double an Integer');
      expect(result.questions[0].validationStatus).toBe('validated');
      expect(result.questions[0].status).toBe('verified');
    });
  });

  // =========================================================================
  // 5. QUESTION ENGINE INTEGRATION TESTS (POOL + AI REPLENISHMENT + FALLBACK)
  // =========================================================================
  describe('5. Question Engine Integration (Replenishment & Graceful Fallback)', () => {
    it('replenishes missing fresh questions (Need 5, Pool has 2 -> AI generates 3) and selects all 5 via Question Engine', async () => {
      // Seed 2 existing verified questions in testTopic
      await Question.insertMany([
        {
          collegeId: null,
          createdBy: 'human',
          source: 'manual',
          validationStatus: 'validated',
          category: 'DSA',
          topic: testTopic,
          subtopic: 'BFS',
          difficulty: 'medium',
          type: 'mcq',
          title: 'BFS Shortest Path in Unweighted Graph',
          description: 'Which traversal guarantees the shortest path in an unweighted graph from a source vertex?',
          options: [
            { id: 'opt_1', text: 'Breadth-First Search (BFS)', isCorrect: true },
            { id: 'opt_2', text: 'Depth-First Search (DFS)', isCorrect: false },
            { id: 'opt_3', text: 'Preorder Traversal', isCorrect: false },
            { id: 'opt_4', text: 'Postorder Traversal', isCorrect: false }
          ],
          explanation: 'BFS explores vertices layer by layer by distance from source.',
          status: 'verified'
        },
        {
          collegeId: null,
          createdBy: 'human',
          source: 'manual',
          validationStatus: 'validated',
          category: 'DSA',
          topic: testTopic,
          subtopic: 'DFS',
          difficulty: 'medium',
          type: 'mcq',
          title: 'Cycle Detection in Directed Graph',
          description: 'How can a cycle be detected in a directed graph using Depth-First Search?',
          options: [
            { id: 'opt_1', text: 'Presence of a back edge to a vertex in the current recursion stack', isCorrect: true },
            { id: 'opt_2', text: 'Graph has more than V - 1 edges', isCorrect: false },
            { id: 'opt_3', text: 'Every vertex has degree at least 2', isCorrect: false },
            { id: 'opt_4', text: 'Presence of a cross edge', isCorrect: false }
          ],
          explanation: 'A back edge to an active ancestor in the recursion stack indicates a directed cycle.',
          status: 'verified'
        }
      ]);

      // Configure mock AI provider that generates 3 fresh distinct questions + 1 duplicate
      const mockReplenishProvider: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async (req: AIGenerationRequest) => ({
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          latencyMs: 20,
          rawText: JSON.stringify({
            questions: [
              // Duplicate of existing seeded question -> must be rejected by validator
              {
                category: 'DSA',
                topic: req.topic,
                difficulty: 'medium',
                type: 'MCQ',
                title: 'BFS Shortest Path Duplicate',
                questionText: 'Which traversal guarantees the shortest path in an unweighted graph from a source vertex?',
                options: ['Breadth-First Search (BFS)', 'Depth-First Search (DFS)', 'Preorder', 'Postorder'],
                correctAnswer: 'Breadth-First Search (BFS)',
                explanation: 'Duplicate question.'
              },
              {
                category: 'DSA',
                topic: req.topic,
                difficulty: 'medium',
                type: 'MCQ',
                title: 'Bellman-Ford Negative Cycle Detection',
                questionText:
                  'How many relaxation passes over all edges does the Bellman-Ford algorithm perform before checking for negative-weight cycles?',
                options: ['V - 1 passes', 'V + E passes', 'log(V) passes', '2 * V passes'],
                correctAnswer: 'V - 1 passes',
                explanation: 'Simple shortest paths contain at most V - 1 edges; a V-th relaxation indicates a negative cycle.'
              },
              {
                category: 'DSA',
                topic: req.topic,
                difficulty: 'medium',
                type: 'MCQ',
                title: 'Floyd-Warshall All-Pairs Shortest Path',
                questionText:
                  'What is the time complexity of the Floyd-Warshall algorithm for computing all-pairs shortest paths in a dense graph with V vertices?',
                options: ['O(V^3)', 'O(V^2 log V)', 'O(V * E)', 'O(E^2)'],
                correctAnswer: 'O(V^3)',
                explanation: 'Floyd-Warshall uses three nested loops over all V vertices.'
              },
              {
                category: 'DSA',
                topic: req.topic,
                difficulty: 'medium',
                type: 'MCQ',
                title: 'Tarjan Strongly Connected Components',
                questionText:
                  'What is the time complexity of Tarjan algorithm for finding all strongly connected components in a directed graph?',
                options: ['O(V + E)', 'O(V^2)', 'O(E log V)', 'O(V * E)'],
                correctAnswer: 'O(V + E)',
                explanation: 'Tarjan algorithm performs a single DFS traversal Maintaining discovery and low-link values in O(V + E).'
              }
            ]
          })
        })
      };

      aiQuestionService.registerProvider(mockReplenishProvider);
      aiQuestionService.configure({ preferredProvider: 'gemini' });

      // Student requests 5 questions via Practice Engine
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            {
              category: 'DSA',
              topic: testTopic,
              difficulty: 'medium',
              count: 5,
              type: 'mcq'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalRequested).toBe(5);
      expect(res.body.totalDelivered).toBe(5);
      expect(res.body.questions.length).toBe(5);
      expect(res.body.availabilityReport.aiReplenishedCount).toBe(3);

      // Verify internal AI metadata and answer keys are stripped for students
      for (const q of res.body.questions) {
        expect(q.source).toBeUndefined();
        expect(q.generationProvider).toBeUndefined();
        expect(q.validationStatus).toBeUndefined();
        expect(q.normalizedHash).toBeUndefined();
        q.options?.forEach((opt: any) => {
          expect(opt.isCorrect).toBeUndefined();
        });
      }
    });

    it('gracefully falls back to existing validated pool when AI provider fails (never crashes practice)', async () => {
      // Seed 2 fresh questions in testTopic
      await Question.insertMany([
        {
          collegeId: null,
          createdBy: 'human',
          source: 'manual',
          validationStatus: 'validated',
          category: 'DSA',
          topic: testTopic,
          subtopic: 'Bipartite',
          difficulty: 'medium',
          type: 'mcq',
          title: 'Bipartite Graph Odd Cycle Characterization',
          description: 'A graph is bipartite if and only if it contains no cycle of what length?',
          options: [
            { id: 'opt_1', text: 'Odd length', isCorrect: true },
            { id: 'opt_2', text: 'Even length', isCorrect: false },
            { id: 'opt_3', text: 'Length 4', isCorrect: false },
            { id: 'opt_4', text: 'Prime length', isCorrect: false }
          ],
          explanation: 'A graph is 2-colorable iff it has no odd cycles.',
          status: 'verified'
        },
        {
          collegeId: null,
          createdBy: 'human',
          source: 'manual',
          validationStatus: 'validated',
          category: 'DSA',
          topic: testTopic,
          subtopic: 'DAG',
          difficulty: 'medium',
          type: 'mcq',
          title: 'Minimum Edges in Connected Graph',
          description: 'What is the minimum number of edges in a connected undirected graph with V vertices?',
          options: [
            { id: 'opt_1', text: 'V - 1', isCorrect: true },
            { id: 'opt_2', text: 'V', isCorrect: false },
            { id: 'opt_3', text: 'V + 1', isCorrect: false },
            { id: 'opt_4', text: 'V * (V - 1) / 2', isCorrect: false }
          ],
          explanation: 'A tree on V vertices is minimally connected and has V - 1 edges.',
          status: 'verified'
        }
      ]);

      // Register failing AI provider
      const downProvider: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async () => {
          throw new AIProviderError({
            message: 'Gemini outage',
            code: 'PROVIDER_UNAVAILABLE',
            provider: 'gemini',
            retryable: false
          });
        }
      };

      aiQuestionService.registerProvider(downProvider);
      aiQuestionService.configure({ preferredProvider: 'gemini', maxRetries: 0 });

      // Student requests 5 questions when 2 exist and AI is down -> returns 2 fresh questions without crashing
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            {
              category: 'DSA',
              topic: testTopic,
              difficulty: 'medium',
              count: 5,
              type: 'mcq'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalRequested).toBe(5);
      expect(res.body.totalDelivered).toBe(2);
      expect(res.body.hasShortfall).toBe(true);
    });
  });

  // =========================================================================
  // 6. SECURITY, RATE LIMITING & BATCH CHUNKING TESTS
  // =========================================================================
  describe('6. Security, Authorization, Rate Limits & Batch Chunking', () => {
    it('blocks students from calling admin AI generation or metrics endpoints (403 Forbidden)', async () => {
      const genRes = await request(app)
        .post('/api/questions/ai-generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ topic: 'Arrays', difficulty: 'medium', type: 'mcq', count: 2 });
      expect(genRes.status).toBe(403);

      const metricsRes = await request(app)
        .get('/api/questions/ai-metrics')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(metricsRes.status).toBe(403);

      // Faculty can view AI metrics
      const facMetricsRes = await request(app)
        .get('/api/questions/ai-metrics')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(facMetricsRes.status).toBe(200);
      expect(facMetricsRes.body.metrics).toBeDefined();
    });

    it('enforces batch size chunking and sliding-window rate limits', async () => {
      const requestedChunkSizes: number[] = [];
      let qCounter = 0;

      const batchTrackingProvider: IAIQuestionProvider = {
        name: 'gemini',
        defaultModel: 'gemini-3.8-flash',
        isConfigured: () => true,
        generateQuestions: async (req: AIGenerationRequest) => {
          requestedChunkSizes.push(req.count);
          const items = Array.from({ length: req.count }).map(() => {
            qCounter += 1;
            return {
              category: 'DSA',
              topic: testTopic,
              subtopic: `BatchSub_${qCounter}`,
              difficulty: 'easy',
              type: 'MCQ',
              title: `Distinct Graph Property Question #${qCounter}`,
              questionText: `In a directed graph analysis scenario #${qCounter * 137}, what is the sum of in-degrees across all vertices when the graph contains ${qCounter * 19} edges?`,
              options: [
                `${qCounter * 19} edges`,
                `${qCounter * 38} edges`,
                `${qCounter + 100} edges`,
                `Zero edges`
              ],
              correctAnswer: `${qCounter * 19} edges`,
              explanation: `Each directed edge contributes exactly 1 to the in-degree of its target vertex (#${qCounter}).`
            };
          });
          return {
            provider: 'gemini',
            model: 'gemini-3.8-flash',
            latencyMs: 10,
            rawText: JSON.stringify({ questions: items })
          };
        }
      };

      aiQuestionService.registerProvider(batchTrackingProvider);
      aiQuestionService.configure({
        preferredProvider: 'gemini',
        maxBatchSize: 2,
        rateLimitPerMinute: 2
      });

      // Request 5 questions with maxBatchSize=2 -> chunks into [2, 2, 1]
      const firstRun = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'easy',
        type: 'mcq',
        count: 5,
        callerKey: 'rate-limit-tester'
      });
      expect(firstRun.success).toBe(true);
      expect(requestedChunkSizes).toEqual([2, 2, 1]);

      // 2nd request within the minute succeeds (2/2 limit)
      const secondRun = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'easy',
        type: 'mcq',
        count: 1,
        callerKey: 'rate-limit-tester'
      });
      expect(secondRun.code).not.toBe('RATE_LIMIT_EXCEEDED');

      // 3rd request within the minute is blocked by rate limiter
      const thirdRun = await aiQuestionService.generateAndValidateQuestions({
        category: 'DSA',
        topic: testTopic,
        difficulty: 'easy',
        type: 'mcq',
        count: 1,
        callerKey: 'rate-limit-tester'
      });
      expect(thirdRun.success).toBe(false);
      expect(thirdRun.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
