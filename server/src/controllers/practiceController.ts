import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { Submission } from '../models/Submission.js';
import { StudentSkill } from '../models/StudentSkill.js';
import { Question, IQuestion } from '../models/Question.js';
import { dynamicPracticeService, PracticeSectionInput } from '../services/dynamicPracticeService.js';
import '../services/aiQuestionService.js';
import { aiService } from '../services/aiService.js';
import { codeExecutionService } from '../services/codeExecutionService.js';
import { performanceReportService } from '../services/documents/performanceReportService.js';
import { DifficultyLevel } from '../shared/types.js';
import { logger } from '../utils/logger.js';

/**
 * Strips sensitive answer keys, explanations, hidden test cases, reference solutions,
 * and internal AI generation metadata before sending questions to a student.
 */
function sanitizeQuestionForStudent(q: any): Record<string, any> {
  const obj = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  if (obj.options) {
    obj.options = obj.options.map((o: any) => ({ id: o.id, text: o.text }));
  }
  if (obj.codingDetails) {
    obj.codingDetails = { ...obj.codingDetails };
    delete obj.codingDetails.hiddenTestCases;
    delete obj.codingDetails.referenceSolution;
  }
  delete obj.explanation;
  delete obj.source;
  delete obj.createdBy;
  delete obj.generationProvider;
  delete obj.generationModel;
  delete obj.validationStatus;
  delete obj.normalizedHash;
  delete obj.generatedAt;
  delete obj.validatedAt;
  delete obj.rejectionReason;
  return obj;
}

/**
 * Pre-flight validation endpoint: reports fresh vs total questions for requested sections.
 */
export async function validatePracticeSelection(req: Request, res: Response): Promise<void> {
  try {
    const { sections } = req.body;
    const studentId = req.user!._id;
    const collegeId = req.user?.collegeId || '';

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one practice section is required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const summary = await dynamicPracticeService.validateSelection({
      studentId,
      collegeId,
      sections
    });

    res.json({
      success: true,
      summary
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message,
      code: error.code || 'SERVER_ERROR'
    });
  }
}

/**
 * Generates a practice session supporting both multi-section configurations and single-topic requests.
 * Enforces:
 * - Strict input validation
 * - Atomic attempt quota deduction (1 session = 1 attempt, concurrency-safe)
 * - No silent repetition of previously attempted questions
 */
export async function generatePractice(req: Request, res: Response): Promise<void> {
  try {
    const {
      sections,
      topic,
      subtopic,
      difficulty,
      questionCount = 10,
      type = 'mixed',
      language,
      allowRepeatFallback = false,
      expandDifficulty = false,
      broadenCategory = false,
      acceptAvailableFresh = false,
      rejectOnInsufficientFresh = false,
      enableAIReplenishment
    } = req.body;

    const studentId = req.user!._id;
    const collegeId = req.user?.collegeId || '';

    if ((!sections || !Array.isArray(sections) || sections.length === 0) && !topic) {
      res.status(400).json({
        success: false,
        message: 'Either topic or sections configuration is required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const normalizedSections: PracticeSectionInput[] =
      sections && Array.isArray(sections) && sections.length > 0
        ? sections
        : [
            {
              topic: String(topic),
              subtopic: subtopic ? String(subtopic) : undefined,
              difficulty: (difficulty || 'mixed') as DifficultyLevel | 'mixed',
              count: Number(questionCount),
              type: (type || 'mixed') as 'mcq' | 'coding' | 'mixed'
            }
          ];

    // 1. Validate section configuration before touching attempt quota
    dynamicPracticeService.validatePracticeConfiguration(normalizedSections);

    // 2. Check user existence and eligibility first (non-destructive pre-check)
    const existingUser = await User.findById(studentId).select('role freeAttempts paidAttempts');
    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const initialFreeLeft = Math.max(0, (existingUser.freeAttempts?.total ?? 10) - (existingUser.freeAttempts?.used ?? 0));
    const initialPaidLeft = Math.max(0, (existingUser.paidAttempts?.total ?? 0) - (existingUser.paidAttempts?.used ?? 0));

    if (existingUser.role === 'student' && initialFreeLeft + initialPaidLeft <= 0) {
      res.status(403).json({
        success: false,
        message: 'You have used all 10 complimentary practice attempts. Connect your Algorand wallet or upgrade your plan to continue.',
        code: 'INSUFFICIENT_PRACTICE_ATTEMPTS',
        attempts: {
          free: { total: existingUser.freeAttempts?.total ?? 10, used: existingUser.freeAttempts?.used ?? 10, remaining: 0 },
          paid: { total: existingUser.paidAttempts?.total ?? 0, used: existingUser.paidAttempts?.used ?? 0, remaining: 0 }
        }
      });
      return;
    }

    // 3. Generate question pool via Question Engine (strictly non-repeating by default)
    const result = await dynamicPracticeService.generatePracticeSet({
      studentId,
      collegeId,
      sections: normalizedSections,
      allowRepeatFallback: Boolean(allowRepeatFallback),
      expandDifficulty: Boolean(expandDifficulty),
      broadenCategory: Boolean(broadenCategory),
      acceptAvailableFresh: Boolean(acceptAvailableFresh),
      enableAIReplenishment:
        enableAIReplenishment !== undefined
          ? Boolean(enableAIReplenishment)
          : !Boolean(rejectOnInsufficientFresh)
    });

    const { questions, sectionsConfig, availabilityReport } = result;

    // If caller requested strict pre-check rejection when fresh questions < requested
    if (
      rejectOnInsufficientFresh &&
      availabilityReport.hasPartialSections &&
      !acceptAvailableFresh &&
      !allowRepeatFallback &&
      !expandDifficulty &&
      !broadenCategory
    ) {
      res.status(409).json({
        success: false,
        message: `Only ${availabilityReport.totalFreshAvailable} fresh questions are available out of ${availabilityReport.totalRequested} requested.`,
        code: 'INSUFFICIENT_FRESH_QUESTIONS',
        error: {
          code: 'INSUFFICIENT_FRESH_QUESTIONS',
          message: `Only ${availabilityReport.totalFreshAvailable} fresh questions are available out of ${availabilityReport.totalRequested} requested.`
        },
        availabilityReport,
        sections: sectionsConfig
      });
      return;
    }

    if (questions.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No fresh questions are currently available matching your selection. Please try expanding difficulty, broadening the category, or enabling review of previous questions.',
        code: 'NO_FRESH_QUESTIONS_AVAILABLE',
        availabilityReport
      });
      return;
    }

    // 4. Atomically claim 1 practice attempt (concurrency-safe against race conditions across tabs)
    let claimedAttemptBucket: 'free' | 'paid' | null = null;
    let updatedUser = existingUser;

    if (existingUser.role === 'student') {
      const freeClaimed = await User.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(studentId),
          $expr: {
            $lt: [
              { $ifNull: ['$freeAttempts.used', 0] },
              { $ifNull: ['$freeAttempts.total', 10] }
            ]
          }
        },
        { $inc: { 'freeAttempts.used': 1 } },
        { new: true }
      );

      if (freeClaimed) {
        claimedAttemptBucket = 'free';
        updatedUser = freeClaimed;
      } else {
        const paidClaimed = await User.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(studentId),
            $expr: {
              $lt: [
                { $ifNull: ['$paidAttempts.used', 0] },
                { $ifNull: ['$paidAttempts.total', 0] }
              ]
            }
          },
          { $inc: { 'paidAttempts.used': 1 } },
          { new: true }
        );

        if (paidClaimed) {
          claimedAttemptBucket = 'paid';
          updatedUser = paidClaimed;
        } else {
          res.status(403).json({
            success: false,
            message: 'You have used all 10 complimentary practice attempts. Connect your Algorand wallet or upgrade your plan to continue.',
            code: 'INSUFFICIENT_PRACTICE_ATTEMPTS'
          });
          return;
        }
      }
    }

    // 5. Create PracticeSession document (refunding attempt if DB creation fails)
    const sessionTopic = normalizedSections.length > 0
      ? normalizedSections.map(s => s.topic || s.category).filter(Boolean).join(' + ')
      : (topic || 'Practice');

    const sessionDifficulty = normalizedSections.length > 1
      ? 'mixed'
      : (normalizedSections[0]?.difficulty || difficulty || 'medium');

    const sessionType = normalizedSections.length > 0
      ? (normalizedSections.some(s => s.type === 'coding') && normalizedSections.some(s => s.type === 'mcq')
          ? 'mixed'
          : normalizedSections[0]?.type || type || 'mixed')
      : (type || 'mixed');

    let session;
    try {
      session = await PracticeSession.create({
        studentId: new mongoose.Types.ObjectId(studentId),
        collegeId: collegeId && mongoose.Types.ObjectId.isValid(collegeId) ? new mongoose.Types.ObjectId(collegeId) : null,
        topic: sessionTopic,
        subtopic,
        difficulty: sessionDifficulty,
        questionCount: questions.length,
        type: sessionType,
        language,
        sections: sectionsConfig,
        questionIds: questions.map(q => q._id),
        answers: [],
        score: 0,
        accuracyPercentage: 0,
        totalQuestions: questions.length,
        correctCount: 0,
        timeTakenSeconds: 0,
        startedAt: new Date(),
        status: 'active'
      });
    } catch (createErr) {
      if (claimedAttemptBucket === 'free') {
        await User.findByIdAndUpdate(studentId, { $inc: { 'freeAttempts.used': -1 } });
      } else if (claimedAttemptBucket === 'paid') {
        await User.findByIdAndUpdate(studentId, { $inc: { 'paidAttempts.used': -1 } });
      }
      throw createErr;
    }

    const freeRemaining = Math.max(0, (updatedUser.freeAttempts?.total ?? 10) - (updatedUser.freeAttempts?.used ?? 0));
    const paidRemaining = Math.max(0, (updatedUser.paidAttempts?.total ?? 0) - (updatedUser.paidAttempts?.used ?? 0));

    logger.info('PRACTICE_STARTED', {
      userId: studentId,
      collegeId,
      details: {
        sessionId: session._id,
        topic: sessionTopic,
        questionCount: questions.length,
        freeAttemptsRemaining: freeRemaining
      }
    });

    const sanitizedQuestions = questions.map(sanitizeQuestionForStudent);

    res.json({
      success: true,
      message: availabilityReport.hasPartialSections
        ? `Practice set generated with ${questions.length} available fresh questions (out of ${availabilityReport.totalRequested} requested).`
        : 'Practice set generated dynamically',
      session,
      questions: sanitizedQuestions,
      totalRequested: availabilityReport.totalRequested,
      totalDelivered: questions.length,
      hasShortfall: availabilityReport.hasPartialSections,
      availabilityReport,
      attemptsRemaining: freeRemaining + paidRemaining
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message,
      code: error.code || 'SERVER_ERROR'
    });
  }
}

/**
 * Retrieves an existing practice session by ID, strictly enforcing session ownership.
 */
export async function getPracticeSession(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const studentId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid practice session ID format.',
        code: 'INVALID_ID'
      });
      return;
    }

    const session = await PracticeSession.findById(id);
    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Practice session not found.',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (session.studentId.toString() !== studentId) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this practice session.',
        code: 'FORBIDDEN'
      });
      return;
    }

    const questionDocs = await Question.find({
      _id: { $in: session.questionIds }
    });

    const questionMap = new Map<string, IQuestion>();
    questionDocs.forEach(q => questionMap.set(q._id.toString(), q));

    const orderedQuestions = session.questionIds
      .map(qid => questionMap.get(qid.toString()))
      .filter(Boolean)
      .map(sanitizeQuestionForStudent);

    res.json({
      success: true,
      session,
      questions: orderedQuestions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Incrementally records or updates a single answer in an active practice session.
 */
export async function savePracticeAnswer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { questionId, selectedOptionIds, codeSubmission, timeSpentSeconds } = req.body;
    const studentId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(questionId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid session ID or question ID.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const session = await PracticeSession.findById(id);
    if (!session) {
      res.status(404).json({ success: false, message: 'Practice session not found', code: 'NOT_FOUND' });
      return;
    }

    if (session.studentId.toString() !== studentId) {
      res.status(403).json({ success: false, message: 'Access denied to this session', code: 'FORBIDDEN' });
      return;
    }

    if (session.status === 'completed') {
      res.status(409).json({
        success: false,
        message: 'Practice session is already completed and cannot be modified.',
        code: 'SESSION_ALREADY_COMPLETED'
      });
      return;
    }

    const isInSession = session.questionIds.some(qid => qid.toString() === questionId);
    if (!isInSession) {
      res.status(400).json({
        success: false,
        message: 'Question does not belong to this practice session.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const existingIdx = session.answers.findIndex(a => a.questionId.toString() === questionId);
    const entry = {
      questionId: new mongoose.Types.ObjectId(questionId),
      selectedOptionIds: Array.isArray(selectedOptionIds) ? selectedOptionIds : undefined,
      codeSubmission,
      isCorrect: false,
      timeSpentSeconds: Number(timeSpentSeconds) || 0
    };

    if (existingIdx >= 0) {
      session.answers[existingIdx] = entry;
    } else {
      session.answers.push(entry);
    }

    if (session.status === 'created' || session.status === 'active') {
      session.status = 'in_progress';
    }

    await session.save();

    res.json({
      success: true,
      message: 'Answer progress saved',
      session
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
  }
}

/**
 * Completes and evaluates a practice session.
 * Enforces:
 * - Strict session ownership check (403 if not owner)
 * - Duplicate submission protection (409 if already completed)
 * - Server-side answer evaluation & bulk DB queries (no N+1 queries)
 */
export async function submitPractice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { answers, timeTakenSeconds } = req.body;
    const studentId = req.user!._id;
    const collegeId = req.user?.collegeId || '';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid practice session ID format.',
        code: 'INVALID_ID'
      });
      return;
    }

    const session = await PracticeSession.findById(id);

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Practice session not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (session.studentId.toString() !== studentId) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You cannot submit another user\'s practice session.',
        code: 'FORBIDDEN'
      });
      return;
    }

    if (session.status === 'completed') {
      res.status(409).json({
        success: false,
        message: 'This practice session has already been completed and cannot be submitted again.',
        code: 'SESSION_ALREADY_COMPLETED',
        error: {
          code: 'SESSION_ALREADY_COMPLETED',
          message: 'This practice session has already been completed and cannot be submitted again.'
        },
        session
      });
      return;
    }

    if (answers !== undefined && !Array.isArray(answers)) {
      res.status(400).json({
        success: false,
        message: 'Answers payload must be an array.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Bulk load all questions belonging to this session in a single query (eliminates N+1 queries)
    const sessionQuestionDocs = await Question.find({
      _id: { $in: session.questionIds }
    });

    const questionMap = new Map<string, IQuestion>();
    for (const qDoc of sessionQuestionDocs) {
      questionMap.set(qDoc._id.toString(), qDoc);
    }

    let correctCount = 0;
    const evaluatedAnswers: any[] = [];
    const skillAnswers: any[] = [];
    const evaluatedQuestionIds = new Set<string>();
    const sectionStats: Record<string, { solved: number; correct: number }> = {};

    for (const ans of answers || []) {
      if (!ans || !ans.questionId) continue;
      const qIdStr = String(ans.questionId);
      if (evaluatedQuestionIds.has(qIdStr)) continue; // Ignore duplicate answer entries for same question

      const q = questionMap.get(qIdStr);
      if (!q) continue;

      evaluatedQuestionIds.add(qIdStr);
      let isCorrect = false;

      if (q.type === 'coding') {
        if (ans.codeSubmission?.code) {
          const visibleCases = q.codingDetails?.visibleTestCases || [];
          const hiddenCases = q.codingDetails?.hiddenTestCases || [];
          let evalRes: any = null;

          try {
            if (visibleCases.length + hiddenCases.length === 0) {
              throw new Error('Coding question has no test cases configured');
            }

            evalRes = await codeExecutionService.evaluateTestCases({
              language: ans.codeSubmission.language || 'python',
              code: ans.codeSubmission.code,
              visibleTestCases: visibleCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
              hiddenTestCases: hiddenCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
              timeLimitMs: q.codingDetails?.timeLimitMs || 3000
            });

            isCorrect = evalRes.verdict === 'ACCEPTED';
            ans.codeSubmission.verdict = evalRes.verdict;
            ans.codeSubmission.testCasesPassed = evalRes.passedCount;
            ans.codeSubmission.totalTestCases = evalRes.totalTestCases;
          } catch {
            isCorrect = false;
            ans.codeSubmission.verdict = 'RUNTIME_ERROR';
          }

          await Submission.create({
            studentId: new mongoose.Types.ObjectId(studentId),
            collegeId: session.collegeId,
            questionId: q._id,
            practiceSessionId: session._id,
            language: ans.codeSubmission.language || 'python',
            code: ans.codeSubmission.code,
            verdict: evalRes?.verdict || ans.codeSubmission.verdict,
            testCasesPassed: evalRes?.passedCount || 0,
            totalTestCases: evalRes?.totalTestCases || visibleCases.length + hiddenCases.length,
            executionTimeMs: evalRes?.avgExecutionTimeMs || 0,
            memoryKb: evalRes?.maxMemoryKb || 0,
            errorOutput: evalRes?.compileError,
            score: evalRes?.score || 0
          });
        }
      } else {
        const correctIds = (q.options || []).filter(o => o.isCorrect).map(o => o.id);
        const selectedIds = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : [];

        if (q.type === 'multiple_select') {
          isCorrect =
            correctIds.length === selectedIds.length &&
            correctIds.every(id => selectedIds.includes(id));
        } else {
          isCorrect = correctIds.length > 0 && selectedIds.length === 1 && selectedIds[0] === correctIds[0];
        }
      }

      if (isCorrect) correctCount++;

      const qTopic = q.topic || 'General';
      if (!sectionStats[qTopic]) sectionStats[qTopic] = { solved: 0, correct: 0 };
      sectionStats[qTopic].solved += 1;
      if (isCorrect) sectionStats[qTopic].correct += 1;

      evaluatedAnswers.push({
        questionId: q._id,
        selectedOptionIds: Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : undefined,
        codeSubmission: ans.codeSubmission,
        isCorrect,
        timeSpentSeconds: Math.max(0, Number(ans.timeSpentSeconds) || 0)
      });

      skillAnswers.push({
        questionId: q._id.toString(),
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        wasCorrect: isCorrect,
        timeSpentSeconds: Math.max(0, Number(ans.timeSpentSeconds) || 0)
      });
    }

    const total = session.questionIds.length || evaluatedAnswers.length || session.questionCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    session.answers = evaluatedAnswers;
    session.totalQuestions = total;
    session.correctCount = correctCount;
    session.score = correctCount;
    session.accuracyPercentage = accuracy;
    session.timeTakenSeconds =
      Number(timeTakenSeconds) ||
      evaluatedAnswers.reduce((tot, ans) => tot + (Number(ans.timeSpentSeconds) || 0), 0);
    session.completedAt = new Date();
    session.status = 'completed';

    if (session.sections && session.sections.length > 0) {
      session.sections = session.sections.map(sec => {
        // Compute section score by matching section questionIds if present, or fallback to topic stats
        if (sec.questionIds && sec.questionIds.length > 0) {
          const secQSet = new Set(sec.questionIds.map(id => id.toString()));
          const secAns = evaluatedAnswers.filter(a => secQSet.has(a.questionId.toString()));
          return {
            category: sec.category,
            topic: sec.topic,
            subtopic: sec.subtopic,
            difficulty: sec.difficulty,
            requestedCount: sec.requestedCount,
            count: sec.count,
            type: sec.type,
            questionIds: sec.questionIds,
            solvedCount: secAns.length,
            correctCount: secAns.filter(a => a.isCorrect).length
          };
        }
        const stats = sectionStats[sec.topic] || { solved: 0, correct: 0 };
        return {
          category: sec.category,
          topic: sec.topic,
          subtopic: sec.subtopic,
          difficulty: sec.difficulty,
          requestedCount: sec.requestedCount,
          count: sec.count,
          type: sec.type,
          questionIds: sec.questionIds,
          solvedCount: stats.solved,
          correctCount: stats.correct
        };
      });
    }

    await session.save();

    await dynamicPracticeService.updateSkillAndHistory({
      studentId,
      collegeId,
      topic: session.topic,
      answers: skillAnswers
    });

    logger.info('PRACTICE_COMPLETED', {
      userId: studentId,
      collegeId,
      details: {
        sessionId: session._id,
        score: correctCount,
        totalQuestions: total,
        accuracyPercentage: accuracy
      }
    });

    const reviewQuestions = sessionQuestionDocs.map(q => ({
      _id: q._id,
      title: q.title,
      description: q.description,
      type: q.type,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      options: q.options,
      codingDetails: q.codingDetails,
      explanation: q.explanation
    }));

    res.json({
      success: true,
      message: 'Practice completed successfully',
      session,
      reviewQuestions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Retrieves the results and solution explanations for a completed practice session.
 */
export async function getPracticeResult(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const studentId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid practice session ID format.',
        code: 'INVALID_ID'
      });
      return;
    }

    const session = await PracticeSession.findById(id);
    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Practice session not found.',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (session.studentId.toString() !== studentId) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this practice session.',
        code: 'FORBIDDEN'
      });
      return;
    }

    const reviewQuestions = await Question.find({
      _id: { $in: session.questionIds }
    }).select('title description type topic subtopic difficulty options codingDetails explanation');

    res.json({
      success: true,
      session,
      reviewQuestions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'SERVER_ERROR'
    });
  }
}

export async function getPracticeHistory(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!._id;
    const history = await PracticeSession.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
  }
}

export async function getSkillProfile(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!._id;
    const skills = await StudentSkill.find({
      studentId: new mongoose.Types.ObjectId(studentId)
    }).sort({ scorePercentage: -1 });

    const strongAreas = skills.filter(s => s.status === 'strong' || s.scorePercentage >= 75);
    const needsImprovement = skills.filter(s => s.status === 'needs_improvement' || s.scorePercentage < 50);
    const moderate = skills.filter(s => s.scorePercentage >= 50 && s.scorePercentage < 75);

    const recommendations = await aiService.generateSkillGapAnalysis(
      skills.map(s => ({
        topic: s.topic,
        scorePercentage: s.scorePercentage,
        totalAttempted: s.totalAttempted
      }))
    );

    res.json({
      success: true,
      skills,
      categories: {
        strongAreas,
        needsImprovement,
        moderate
      },
      recommendations
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
  }
}

/**
 * GET /api/practice/:id/report/data
 * Returns the full compiled JSON performance analysis report for the practice session.
 */
export async function getPracticeReportData(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const isAdmin = req.user?.role === 'platform_admin';

    const reportData = await performanceReportService.compileReportData(id, userId, isAdmin);
    res.json({
      success: true,
      report: reportData
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to compile performance report.',
      code: error.code || 'REPORT_ERROR'
    });
  }
}

/**
 * GET /api/practice/:id/report/pdf
 * Generates and downloads a professionally designed PDF performance report.
 */
export async function downloadPracticeReportPdf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const isAdmin = req.user?.role === 'platform_admin';

    const reportData = await performanceReportService.compileReportData(id, userId, isAdmin);
    const pdfBuffer = await performanceReportService.generatePdf(reportData);

    const safeTopic = reportData.session.topic.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Evalora-Performance-Report-${safeTopic}-${reportData.reportId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to generate performance report PDF.',
      code: error.code || 'REPORT_ERROR'
    });
  }
}

