import mongoose from 'mongoose';
import { Submission, ISubmission } from '../models/Submission.js';
import { CodeSimilarityResult } from '../models/CodeSimilarityResult.js';

export class CodeSimilarityService {
  private KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'return', 'switch', 'case', 'break', 'continue',
    'int', 'float', 'double', 'char', 'void', 'bool', 'auto', 'const', 'static', 'struct',
    'class', 'public', 'private', 'protected', 'def', 'import', 'from', 'in', 'is', 'not',
    'and', 'or', 'elif', 'lambda', 'try', 'except', 'finally', 'throw', 'catch', 'new',
    'package', 'extends', 'implements', 'interface', 'print', 'cout', 'cin', 'printf', 'scanf'
  ]);

  /**
   * Strips comments, string literals, and normalizes identifier names sequentially.
   */
  normalizeCode(code: string, language: string): string {
    // 1. Remove comments
    let stripped = code;
    if (language === 'python') {
      stripped = stripped.replace(/#.*$/gm, '');
      stripped = stripped.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, '');
    } else {
      // C, C++, Java
      stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
      stripped = stripped.replace(/\/\/.*$/gm, '');
    }

    // 2. Normalize strings & numbers
    stripped = stripped.replace(/"([^"\\]|\\.)*"/g, '__STR__');
    stripped = stripped.replace(/'([^'\\]|\\.)*'/g, '__STR__');
    stripped = stripped.replace(/\b\d+(\.\d+)?\b/g, '__NUM__');

    // 3. Tokenize identifiers and keywords
    const tokens = stripped.match(/[a-zA-Z_]\w*|[^\s\w]/g) || [];
    const varMap = new Map<string, string>();
    let varCount = 0;

    const normalizedTokens = tokens.map(token => {
      if (/^[a-zA-Z_]\w*$/.test(token)) {
        if (this.KEYWORDS.has(token) || token === '__STR__' || token === '__NUM__') {
          return token;
        }
        if (!varMap.has(token)) {
          varMap.set(token, `v${varCount++}`);
        }
        return varMap.get(token)!;
      }
      return token;
    });

    return normalizedTokens.join(' ');
  }

  /**
   * Generates k-grams from token array and computes Jaccard similarity.
   */
  computeTokenSimilarity(normalizedA: string, normalizedB: string, k: number = 3): number {
    const tokensA = normalizedA.split(' ');
    const tokensB = normalizedB.split(' ');

    if (tokensA.length < k || tokensB.length < k) {
      return tokensA.join('') === tokensB.join('') ? 100 : 0;
    }

    const ngramsA = new Set<string>();
    for (let i = 0; i <= tokensA.length - k; i++) {
      ngramsA.add(tokensA.slice(i, i + k).join('_'));
    }

    const ngramsB = new Set<string>();
    for (let i = 0; i <= tokensB.length - k; i++) {
      ngramsB.add(tokensB.slice(i, i + k).join('_'));
    }

    let intersectionCount = 0;
    for (const ngram of ngramsA) {
      if (ngramsB.has(ngram)) {
        intersectionCount++;
      }
    }

    const unionSize = new Set([...ngramsA, ...ngramsB]).size;
    if (unionSize === 0) return 0;

    return Math.round((intersectionCount / unionSize) * 100);
  }

  /**
   * Runs pairwise similarity matrix for all student submissions of a question in an assessment.
   */
  async compareSubmissionsForQuestion(assessmentId: string, questionId: string, collegeId: string) {
    const submissions = await Submission.find({
      assessmentId: new mongoose.Types.ObjectId(assessmentId),
      questionId: new mongoose.Types.ObjectId(questionId)
    }).populate('studentId', 'name email studentId');

    if (submissions.length < 2) {
      return [];
    }

    const results: any[] = [];

    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        const subA = submissions[i];
        const subB = submissions[j];

        // Skip if same student
        if (subA.studentId._id.toString() === subB.studentId._id.toString()) continue;

        // Ensure both have normalized code
        const normA = subA.normalizedCode || this.normalizeCode(subA.code, subA.language);
        const normB = subB.normalizedCode || this.normalizeCode(subB.code, subB.language);

        const similarity = this.computeTokenSimilarity(normA, normB);
        const isFlagged = similarity >= 80;

        const record = await CodeSimilarityResult.findOneAndUpdate(
          {
            assessmentId: new mongoose.Types.ObjectId(assessmentId),
            questionId: new mongoose.Types.ObjectId(questionId),
            studentAId: subA.studentId._id,
            studentBId: subB.studentId._id
          },
          {
            collegeId: new mongoose.Types.ObjectId(collegeId),
            submissionAId: subA._id,
            submissionBId: subB._id,
            similarityPercentage: similarity,
            matchedTokensCount: Math.round(similarity * 0.5),
            flagged: isFlagged,
            comparedAt: new Date()
          },
          { upsert: true, new: true }
        )
          .populate('studentAId', 'name email studentId')
          .populate('studentBId', 'name email studentId');

        results.push(record);
      }
    }

    return results;
  }
}

export const codeSimilarityService = new CodeSimilarityService();
