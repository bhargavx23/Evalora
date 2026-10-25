import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Question } from '../models/Question.js';
import { Submission } from '../models/Submission.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { codeExecutionService } from '../services/codeExecutionService.js';
import { codeSimilarityService } from '../services/codeSimilarityService.js';
import { CodingLanguage } from '../shared/types.js';

export async function runCustomCode(req: Request, res: Response): Promise<void> {
  try {
    const { language, code, stdin = '', timeoutMs } = req.body;

    if (!language || !code) {
      res.status(400).json({ success: false, message: 'Language and code are required' });
      return;
    }

    const result = await codeExecutionService.execute({
      language,
      code,
      stdin,
      timeoutMs: timeoutMs ? Math.min(timeoutMs, 10000) : 4000
    });

    res.json({
      success: true,
      result: {
        ...result,
        verdict: null,
        status: 'EXECUTED',
        isVerified: false
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function evaluateCode(req: Request, res: Response): Promise<void> {
  try {
    const { questionId, language, code, assessmentId, practiceSessionId } = req.body;
    const studentId = req.user!._id;
    const collegeId = req.user?.collegeId || '';

    if (!questionId || !language || !code) {
      res.status(400).json({ success: false, message: 'questionId, language, and code are required' });
      return;
    }

    const supportedLanguages: CodingLanguage[] = ['c', 'cpp', 'python', 'java'];
    if (!supportedLanguages.includes(language as CodingLanguage)) {
      res.status(400).json({ success: false, message: 'Unsupported coding language' });
      return;
    }

    if (!collegeId || !mongoose.isValidObjectId(collegeId)) {
      res.status(403).json({ success: false, message: 'A college-scoped student account is required for evaluation' });
      return;
    }

    const question = await Question.findOne({
      _id: questionId,
      type: 'coding',
      status: 'verified',
      $or: [{ collegeId: null }, { collegeId: new mongoose.Types.ObjectId(collegeId) }]
    });
    if (!question) {
      res.status(404).json({ success: false, message: 'Coding question not found or not accessible' });
      return;
    }

    if (assessmentId) {
      if (!mongoose.isValidObjectId(assessmentId)) {
        res.status(400).json({ success: false, message: 'Invalid assessment ID' });
        return;
      }
      const attempt = await AssessmentAttempt.findOne({
        assessmentId: new mongoose.Types.ObjectId(assessmentId),
        studentId: new mongoose.Types.ObjectId(studentId),
        collegeId: new mongoose.Types.ObjectId(collegeId),
        status: 'in_progress',
        'answers.questionId': question._id
      });
      if (!attempt || !(await Assessment.exists({ _id: assessmentId, collegeId: new mongoose.Types.ObjectId(collegeId) }))) {
        res.status(403).json({ success: false, message: 'This coding question is not part of your active assessment' });
        return;
      }
    }

    if (practiceSessionId) {
      if (!mongoose.isValidObjectId(practiceSessionId)) {
        res.status(400).json({ success: false, message: 'Invalid practice session ID' });
        return;
      }
      const session = await PracticeSession.findOne({
        _id: practiceSessionId,
        studentId: new mongoose.Types.ObjectId(studentId),
        collegeId: new mongoose.Types.ObjectId(collegeId),
        status: 'active',
        questionIds: question._id
      });
      if (!session) {
        res.status(403).json({ success: false, message: 'This coding question is not part of your active practice session' });
        return;
      }
    }

    const visibleCases = question.codingDetails?.visibleTestCases || [];
    const hiddenCases = question.codingDetails?.hiddenTestCases || [];
    if (visibleCases.length + hiddenCases.length === 0) {
      res.status(422).json({ success: false, message: 'This coding question has no test cases configured' });
      return;
    }

    const evalResult = await codeExecutionService.evaluateTestCases({
      language,
      code,
      visibleTestCases: visibleCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
      hiddenTestCases: hiddenCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
      timeLimitMs: question.codingDetails?.timeLimitMs || 3000
    });

    // Normalize code for similarity / anti-cheating comparisons
    const normalizedCode = codeSimilarityService.normalizeCode(code, language);

    // Save submission record
    const submission = await Submission.create({
      studentId: new mongoose.Types.ObjectId(studentId),
      collegeId: collegeId ? new mongoose.Types.ObjectId(collegeId) : null,
      questionId: question._id,
      assessmentId: assessmentId ? new mongoose.Types.ObjectId(assessmentId) : null,
      practiceSessionId: practiceSessionId ? new mongoose.Types.ObjectId(practiceSessionId) : null,
      language,
      code,
      normalizedCode,
      verdict: evalResult.verdict,
      testCasesPassed: evalResult.passedCount,
      totalTestCases: evalResult.totalTestCases,
      executionTimeMs: evalResult.avgExecutionTimeMs,
      memoryKb: evalResult.maxMemoryKb,
      errorOutput: evalResult.compileError,
      score: evalResult.score
    });

    res.json({
      success: true,
      message: `Evaluation completed: ${evalResult.passedCount}/${evalResult.totalTestCases} test cases passed`,
      result: { ...evalResult, isVerified: true },
      submissionId: submission._id
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSubmissionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const filter: Record<string, any> = { _id: id };
    if (req.user?.role === 'student') {
      filter.studentId = new mongoose.Types.ObjectId(req.user._id);
    } else if (req.user?.collegeId && req.user.role !== 'platform_admin') {
      filter.collegeId = new mongoose.Types.ObjectId(req.user.collegeId);
    }

    const submission = await Submission.findOne(filter).populate('questionId', 'title topic difficulty');

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    res.json({ success: true, submission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
