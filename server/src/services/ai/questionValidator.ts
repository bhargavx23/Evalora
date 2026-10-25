import crypto from 'crypto';
import { ENV } from '../../config/env.js';
import { DEFAULT_STARTER_CODES } from '../../shared/constants.js';
import { CodingLanguage, DifficultyLevel, QuestionType } from '../../shared/types.js';
import {
  AIRawQuestionCandidate,
  QuestionValidationOutcome,
  ValidatedQuestionPayload
} from './types.js';
import { inferCategoryFromTopic } from './prompts.js';

const ALLOWED_CATEGORIES = new Set([
  'dsa',
  'aptitude',
  'reasoning',
  'coding',
  'placement/technical',
  'technical',
  'placement',
  'dbms',
  'operating systems',
  'computer networks',
  'oop'
]);

const ALLOWED_DIFFICULTIES = new Set<DifficultyLevel>(['easy', 'medium', 'hard']);
const ALLOWED_LANGUAGES = new Set<CodingLanguage>(['c', 'cpp', 'python', 'java']);

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'about',
  'as',
  'into',
  'like',
  'through',
  'after',
  'over',
  'between',
  'out',
  'against',
  'during',
  'without',
  'before',
  'under',
  'around',
  'among',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  'following',
  'given',
  'find',
  'determine',
  'calculate',
  'consider',
  'statement',
  'question'
]);

/**
 * Normalizes question text for exact and near-duplicate comparison:
 * - Lowercases
 * - Removes punctuation/special symbols
 * - Collapses whitespace
 */
export function normalizeQuestionText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a deterministic SHA-256 hash of normalized question content.
 */
export function computeNormalizedHash(text: string): string {
  const normalized = normalizeQuestionText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function extractTokens(text: string): string[] {
  const normalized = normalizeQuestionText(text);
  if (!normalized) return [];
  const rawTokens = normalized.split(' ').filter(Boolean);
  const filtered = rawTokens.filter(t => t.length > 1 && !STOP_WORDS.has(t));
  return filtered.length >= 3 ? filtered : rawTokens;
}

function buildBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

function setDiceSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Computes semantic/structural similarity in [0, 1] between two question texts
 * using stop-word-filtered unigram Dice + bigram shingle Dice similarity.
 */
export function computeQuestionSimilarity(textA: string, textB: string): number {
  const normA = normalizeQuestionText(textA);
  const normB = normalizeQuestionText(textB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const tokensA = extractTokens(normA);
  const tokensB = extractTokens(normB);

  const unigramSim = setDiceSimilarity(new Set(tokensA), new Set(tokensB));
  const bigramSim = setDiceSimilarity(buildBigrams(tokensA), buildBigrams(tokensB));

  if (tokensA.length < 2 || tokensB.length < 2) {
    return unigramSim;
  }

  return Number((unigramSim * 0.65 + bigramSim * 0.35).toFixed(4));
}

/**
 * Parses raw text from an AI provider into an array of untrusted question candidates.
 */
export function parseAIQuestionsJson(rawText: string): {
  ok: boolean;
  candidates: AIRawQuestionCandidate[];
  error?: string;
} {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { ok: false, candidates: [], error: 'Empty AI response text.' };
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, candidates: [], error: 'Malformed JSON in AI response.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, candidates: [], error: 'AI JSON root must be an object or array.' };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.questions)
      ? parsed.questions
      : null;

  if (!list || list.length === 0) {
    return { ok: false, candidates: [], error: 'AI response did not contain a non-empty questions array.' };
  }

  return { ok: true, candidates: list };
}

export interface ValidationContext {
  expectedCategory?: string;
  expectedTopic?: string;
  expectedDifficulty?: DifficultyLevel;
  expectedType?: 'mcq' | 'coding';
  existingQuestions?: Array<{ title?: string; description?: string; normalizedHash?: string }>;
  batchAccepted?: Array<{ title: string; description: string; normalizedHash: string }>;
  similarityThreshold?: number;
}

/**
 * Executes the multi-stage validation pipeline on a single untrusted AI question candidate:
 * Schema -> Field -> Content -> MCQ/Coding -> Difficulty -> Duplicate Check
 */
export function validateCandidateQuestion(
  candidate: AIRawQuestionCandidate,
  context: ValidationContext = {}
): QuestionValidationOutcome {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'schema',
      reason: 'Question candidate must be a valid JSON object.'
    };
  }

  // 1. Type normalization & validation
  const rawType = typeof candidate.type === 'string' ? candidate.type.trim().toLowerCase() : '';
  let normalizedType: QuestionType;
  if (rawType === 'mcq' || rawType === 'single-choice' || rawType === 'multiple-choice') {
    normalizedType = 'mcq';
  } else if (rawType === 'multiple_select') {
    normalizedType = 'multiple_select';
  } else if (rawType === 'true_false') {
    normalizedType = 'true_false';
  } else if (rawType === 'coding' || rawType === 'code') {
    normalizedType = 'coding';
  } else {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'field',
      reason: `Invalid or missing question type: "${String(candidate.type)}".`
    };
  }

  if (context.expectedType && normalizedType !== context.expectedType) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'field',
      reason: `Question type "${normalizedType}" does not match requested type "${context.expectedType}".`
    };
  }

  // 2. Category & Topic validation
  const rawTopic = typeof candidate.topic === 'string' ? candidate.topic.trim() : '';
  const topic = rawTopic || context.expectedTopic || '';
  if (!topic) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'field',
      reason: 'Missing or empty question topic.'
    };
  }

  const rawCategory =
    typeof candidate.category === 'string' && candidate.category.trim()
      ? candidate.category.trim()
      : context.expectedCategory || inferCategoryFromTopic(topic);

  if (!ALLOWED_CATEGORIES.has(rawCategory.toLowerCase())) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'field',
      reason: `Unsupported category "${rawCategory}".`
    };
  }

  // 3. Difficulty validation
  const rawDiff = typeof candidate.difficulty === 'string' ? candidate.difficulty.trim().toLowerCase() : '';
  if (!ALLOWED_DIFFICULTIES.has(rawDiff as DifficultyLevel)) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'difficulty',
      reason: `Invalid difficulty "${String(candidate.difficulty)}". Must be easy, medium, or hard.`
    };
  }
  const difficulty = rawDiff as DifficultyLevel;

  if (context.expectedDifficulty && difficulty !== context.expectedDifficulty) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'difficulty',
      reason: `Difficulty "${difficulty}" does not match requested difficulty "${context.expectedDifficulty}".`
    };
  }

  // 4. Question Text / Title / Description validation
  const rawQuestionText =
    typeof candidate.questionText === 'string' && candidate.questionText.trim()
      ? candidate.questionText.trim()
      : typeof candidate.description === 'string' && candidate.description.trim()
        ? candidate.description.trim()
        : '';

  if (!rawQuestionText || rawQuestionText.length < 10) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'content',
      reason: 'Question text/description is missing or too short (minimum 10 characters).'
    };
  }

  const rawTitle =
    typeof candidate.title === 'string' && candidate.title.trim().length >= 3
      ? candidate.title.trim()
      : rawQuestionText.slice(0, 90).trim();

  const subtopic =
    typeof candidate.subtopic === 'string' && candidate.subtopic.trim()
      ? candidate.subtopic.trim()
      : topic;

  const explanation =
    typeof candidate.explanation === 'string' ? candidate.explanation.trim() : '';
  if (!explanation || explanation.length < 5) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'content',
      reason: 'Question explanation is missing or too short.'
    };
  }

  // 5. Duplicate Detection (against existing pool AND same-batch accepted questions)
  const combinedStem = `${rawTitle} ${rawQuestionText}`;
  const normalizedHash = computeNormalizedHash(combinedStem);
  const stemOnlyHash = computeNormalizedHash(rawQuestionText);
  const threshold = context.similarityThreshold ?? ENV.AI_SIMILARITY_THRESHOLD ?? 0.72;

  const checkPoolForDuplicate = (
    items: Array<{ title?: string; description?: string; normalizedHash?: string }>,
    sourceLabel: string
  ): string | null => {
    for (const item of items) {
      const itemCombined = `${item.title || ''} ${item.description || ''}`.trim();
      const itemDesc = (item.description || item.title || '').trim();
      if (!itemDesc) continue;

      if (
        item.normalizedHash &&
        (item.normalizedHash === normalizedHash || item.normalizedHash === stemOnlyHash)
      ) {
        return `Exact hash duplicate detected in ${sourceLabel}.`;
      }

      if (
        normalizeQuestionText(itemDesc) === normalizeQuestionText(rawQuestionText) ||
        normalizeQuestionText(itemCombined) === normalizeQuestionText(combinedStem)
      ) {
        return `Normalized exact duplicate detected in ${sourceLabel}.`;
      }

      const simDesc = computeQuestionSimilarity(rawQuestionText, itemDesc);
      const simCombined = computeQuestionSimilarity(combinedStem, itemCombined);
      const maxSim = Math.max(simDesc, simCombined);
      if (maxSim >= threshold) {
        return `Near-duplicate question detected in ${sourceLabel} (similarity=${maxSim}).`;
      }
    }
    return null;
  };

  if (context.batchAccepted && context.batchAccepted.length > 0) {
    const batchDupReason = checkPoolForDuplicate(context.batchAccepted, 'current generation batch');
    if (batchDupReason) {
      return {
        isValid: false,
        isDuplicate: true,
        stage: 'duplicate',
        reason: batchDupReason
      };
    }
  }

  if (context.existingQuestions && context.existingQuestions.length > 0) {
    const dbDupReason = checkPoolForDuplicate(context.existingQuestions, 'existing question pool');
    if (dbDupReason) {
      return {
        isValid: false,
        isDuplicate: true,
        stage: 'duplicate',
        reason: dbDupReason
      };
    }
  }

  // 6. Type-specific validation: MCQ vs Coding
  if (normalizedType === 'mcq' || normalizedType === 'multiple_select' || normalizedType === 'true_false') {
    if (!Array.isArray(candidate.options)) {
      return {
        isValid: false,
        isDuplicate: false,
        stage: 'mcq',
        reason: 'MCQ options must be an array.'
      };
    }

    const minOptions = normalizedType === 'true_false' ? 2 : 4;
    if (candidate.options.length < minOptions) {
      return {
        isValid: false,
        isDuplicate: false,
        stage: 'mcq',
        reason: `MCQ requires at least ${minOptions} options, received ${candidate.options.length}.`
      };
    }

    const formattedOptions: Array<{ id: string; text: string; isCorrect: boolean }> = [];
    const seenNormalizedOptions = new Set<string>();
    const rawCorrectAnswer =
      typeof candidate.correctAnswer === 'string' ? candidate.correctAnswer.trim() : '';

    for (let idx = 0; idx < candidate.options.length; idx++) {
      const rawOpt = candidate.options[idx];
      let optText = '';
      let optId = `opt_${idx + 1}`;
      let optIsCorrect = false;

      if (typeof rawOpt === 'string') {
        optText = rawOpt.trim();
      } else if (rawOpt && typeof rawOpt === 'object') {
        optText = typeof (rawOpt as any).text === 'string' ? (rawOpt as any).text.trim() : '';
        if (typeof (rawOpt as any).id === 'string' && (rawOpt as any).id.trim()) {
          optId = (rawOpt as any).id.trim();
        }
        optIsCorrect = Boolean((rawOpt as any).isCorrect);
      }

      if (!optText) {
        return {
          isValid: false,
          isDuplicate: false,
          stage: 'mcq',
          reason: `Option ${idx + 1} has empty or invalid text.`
        };
      }

      const normOpt = optText
        .toLowerCase()
        .replace(/[^a-z0-9+\-*/^<>=%\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!normOpt) {
        return {
          isValid: false,
          isDuplicate: false,
          stage: 'mcq',
          reason: `Option ${idx + 1} is not meaningful.`
        };
      }

      if (seenNormalizedOptions.has(normOpt)) {
        return {
          isValid: false,
          isDuplicate: false,
          stage: 'mcq',
          reason: `Duplicate option text detected: "${optText}".`
        };
      }
      seenNormalizedOptions.add(normOpt);

      const normCorrect = rawCorrectAnswer
        .toLowerCase()
        .replace(/[^a-z0-9+\-*/^<>=%\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (
        rawCorrectAnswer &&
        (optText === rawCorrectAnswer ||
          normOpt === normCorrect ||
          optId.toLowerCase() === rawCorrectAnswer.toLowerCase())
      ) {
        optIsCorrect = true;
      }

      formattedOptions.push({
        id: optId,
        text: optText,
        isCorrect: optIsCorrect
      });
    }

    const correctOptions = formattedOptions.filter(o => o.isCorrect);
    if (correctOptions.length === 0) {
      return {
        isValid: false,
        isDuplicate: false,
        stage: 'mcq',
        reason: 'Correct answer does not match any of the provided MCQ options.'
      };
    }

    if (normalizedType === 'mcq' && correctOptions.length > 1) {
      return {
        isValid: false,
        isDuplicate: false,
        stage: 'mcq',
        reason: 'Single-choice MCQ must have exactly one correct option.'
      };
    }

    const tags = Array.isArray(candidate.tags)
      ? candidate.tags.filter(t => typeof t === 'string' && t.trim()).map(t => String(t).trim())
      : [rawCategory, topic];

    return {
      isValid: true,
      isDuplicate: false,
      payload: {
        category: rawCategory,
        topic,
        subtopic,
        difficulty,
        type: normalizedType,
        title: rawTitle,
        description: rawQuestionText,
        marks: typeof candidate.marks === 'number' && candidate.marks > 0 ? candidate.marks : 2,
        negativeMarks: typeof candidate.negativeMarks === 'number' && candidate.negativeMarks >= 0 ? candidate.negativeMarks : 0,
        estimatedTimeMinutes:
          typeof candidate.estimatedTimeMinutes === 'number' && candidate.estimatedTimeMinutes > 0
            ? candidate.estimatedTimeMinutes
            : 2,
        tags,
        options: formattedOptions,
        explanation,
        normalizedHash,
        requiresCodingExecution: false
      }
    };
  }

  // Coding Question Validation
  const codingSource: any =
    candidate.codingDetails && typeof candidate.codingDetails === 'object'
      ? { ...candidate, ...(candidate.codingDetails as object) }
      : candidate;

  const constraints = typeof codingSource.constraints === 'string' ? codingSource.constraints.trim() : '';
  const inputFormat = typeof codingSource.inputFormat === 'string' ? codingSource.inputFormat.trim() : '';
  const outputFormat = typeof codingSource.outputFormat === 'string' ? codingSource.outputFormat.trim() : '';

  if (!constraints || !inputFormat || !outputFormat) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'coding',
      reason: 'Coding question must include non-empty constraints, inputFormat, and outputFormat.'
    };
  }

  const rawExamples = Array.isArray(codingSource.examples) ? codingSource.examples : [];
  if (rawExamples.length === 0) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'coding',
      reason: 'Coding question must include at least one example case.'
    };
  }

  const examples: Array<{ input: string; output: string; explanation?: string }> = [];
  for (const ex of rawExamples) {
    if (!ex || typeof ex !== 'object' || typeof ex.input !== 'string' || typeof ex.output !== 'string') {
      return {
        isValid: false,
        isDuplicate: false,
        stage: 'coding',
        reason: 'Coding example is missing valid input or output strings.'
      };
    }
    examples.push({
      input: ex.input,
      output: ex.output,
      explanation: typeof ex.explanation === 'string' ? ex.explanation : undefined
    });
  }

  const rawVisible = Array.isArray(codingSource.visibleTestCases)
    ? codingSource.visibleTestCases
    : Array.isArray(codingSource.testCases)
      ? codingSource.testCases
      : [];

  const rawHidden = Array.isArray(codingSource.hiddenTestCases) ? codingSource.hiddenTestCases : [];

  if (rawVisible.length === 0) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'coding',
      reason: 'Coding question must include at least one visible test case.'
    };
  }

  const parseTestCases = (arr: any[]): Array<{ input: string; expectedOutput: string }> | null => {
    const out: Array<{ input: string; expectedOutput: string }> = [];
    for (const tc of arr) {
      if (!tc || typeof tc !== 'object') return null;
      const inp = typeof tc.input === 'string' ? tc.input : null;
      const exp =
        typeof tc.expectedOutput === 'string'
          ? tc.expectedOutput
          : typeof tc.output === 'string'
            ? tc.output
            : null;
      if (inp === null || exp === null || exp.trim().length === 0) return null;
      out.push({ input: inp, expectedOutput: exp });
    }
    return out;
  };

  const visibleTestCases = parseTestCases(rawVisible);
  const hiddenTestCases = rawHidden.length > 0 ? parseTestCases(rawHidden) : visibleTestCases;

  if (!visibleTestCases || !hiddenTestCases || visibleTestCases.length === 0) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'coding',
      reason: 'Coding test cases are malformed or missing expectedOutput.'
    };
  }

  const refSolRaw = codingSource.referenceSolution;
  let referenceSolution: { language: CodingLanguage; code: string } | undefined;
  if (refSolRaw && typeof refSolRaw === 'object') {
    const lang = String(refSolRaw.language || 'python').toLowerCase() as CodingLanguage;
    const code = typeof refSolRaw.code === 'string' ? refSolRaw.code.trim() : '';
    if (ALLOWED_LANGUAGES.has(lang) && code.length > 0) {
      referenceSolution = { language: lang, code };
    }
  } else if (typeof refSolRaw === 'string' && refSolRaw.trim().length > 0) {
    referenceSolution = { language: 'python', code: refSolRaw.trim() };
  }

  if (!referenceSolution) {
    return {
      isValid: false,
      isDuplicate: false,
      stage: 'coding',
      reason: 'Coding question must include a valid referenceSolution ({ language, code }).'
    };
  }

  const supportedLanguages: CodingLanguage[] = Array.isArray(codingSource.supportedLanguages)
    ? codingSource.supportedLanguages
        .map((l: any) => String(l).toLowerCase() as CodingLanguage)
        .filter((l: CodingLanguage) => ALLOWED_LANGUAGES.has(l))
    : ['c', 'cpp', 'python', 'java'];

  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.filter(t => typeof t === 'string' && t.trim()).map(t => String(t).trim())
    : [rawCategory, topic];

  return {
    isValid: true,
    isDuplicate: false,
    payload: {
      category: rawCategory,
      topic,
      subtopic,
      difficulty,
      type: 'coding',
      title: rawTitle,
      description: rawQuestionText,
      marks: typeof candidate.marks === 'number' && candidate.marks > 0 ? candidate.marks : 10,
      negativeMarks: 0,
      estimatedTimeMinutes:
        typeof candidate.estimatedTimeMinutes === 'number' && candidate.estimatedTimeMinutes > 0
          ? candidate.estimatedTimeMinutes
          : 20,
      tags,
      codingDetails: {
        supportedLanguages: supportedLanguages.length > 0 ? supportedLanguages : ['c', 'cpp', 'python', 'java'],
        starterCode: DEFAULT_STARTER_CODES,
        inputFormat,
        outputFormat,
        constraints,
        examples,
        visibleTestCases,
        hiddenTestCases,
        timeLimitMs: 3000,
        memoryLimitMb: 256,
        referenceSolution
      },
      explanation,
      normalizedHash,
      requiresCodingExecution: true
    }
  };
}
