import mongoose from 'mongoose';
import { Assessment, IAssessment } from '../models/Assessment.js';
import { AssessmentAttempt, IAssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Question } from '../models/Question.js';
import { Submission } from '../models/Submission.js';
import { SuspiciousActivity } from '../models/SuspiciousActivity.js';
import { codeExecutionService } from './codeExecutionService.js';
import { dynamicPracticeService } from './dynamicPracticeService.js';
import { IntegrityEventType } from '../shared/types.js';

export class AssessmentEvaluationService {
  /**
   * Starts a new assessment attempt with server-side timer enforcement.
   */
  async startAttempt(assessmentId: string, studentId: string, collegeId: string): Promise<IAssessmentAttempt> {
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    if (assessment.status !== 'published') {
      throw new Error('Assessment is not currently published');
    }

    const now = new Date();
    if (now < assessment.startDate) {
      throw new Error('Assessment has not started yet');
    }
    if (now > assessment.endDate) {
      throw new Error('Assessment has already ended');
    }

    // Check existing attempts
    const existingAttempts = await AssessmentAttempt.find({
      assessmentId: assessment._id,
      studentId: new mongoose.Types.ObjectId(studentId)
    });

    // Check if an active attempt is already in progress
    const activeAttempt = existingAttempts.find(a => a.status === 'in_progress');
    if (activeAttempt) {
      // Check if it's not expired
      if (new Date() < activeAttempt.expiresAt) {
        return activeAttempt;
      } else {
        // Expired in-progress attempt, auto submit it
        await this.submitAttempt(activeAttempt._id.toString(), studentId);
      }
    }

    if (existingAttempts.length >= assessment.rules.maxAttempts) {
      throw new Error(`Maximum attempt limit (${assessment.rules.maxAttempts}) reached for this assessment`);
    }

    // Calculate server-side expiration: duration + 1 minute grace buffer for network latency
    const expiresAt = new Date(now.getTime() + (assessment.durationMinutes * 60 + 60) * 1000);

    // Collect all question IDs from sections
    const initialAnswers: any[] = [];
    for (const sec of assessment.sections) {
      for (const qId of sec.questionIds) {
        initialAnswers.push({
          questionId: qId,
          sectionId: sec.id,
          selectedOptionIds: [],
          isMarkedForReview: false,
          isAttempted: false,
          marksObtained: 0
        });
      }
    }

    const attempt = await AssessmentAttempt.create({
      assessmentId: assessment._id,
      studentId: new mongoose.Types.ObjectId(studentId),
      collegeId: new mongoose.Types.ObjectId(collegeId),
      status: 'in_progress',
      startedAt: now,
      expiresAt,
      answers: initialAnswers,
      totalScore: 0,
      maxScore: assessment.totalMarks,
      percentage: 0,
      passed: false,
      integrityScore: 100,
      suspiciousEventCount: 0
    });

    return attempt;
  }

  /**
   * Autosaves a student's answer (option selection or code).
   */
  async autosaveAnswer(
    attemptId: string,
    studentId: string,
    data: {
      questionId: string;
      selectedOptionIds?: string[];
      codeSubmission?: {
        language: string;
        code: string;
      };
      isMarkedForReview?: boolean;
    }
  ): Promise<void> {
    const attempt = await AssessmentAttempt.findOne({
      _id: attemptId,
      studentId: new mongoose.Types.ObjectId(studentId)
    });

    if (!attempt) {
      throw new Error('Assessment attempt not found');
    }

    if (attempt.status !== 'in_progress') {
      throw new Error('Assessment is already submitted or closed');
    }

    if (new Date() > attempt.expiresAt) {
      // Exceeded time limit, trigger auto-submit
      await this.submitAttempt(attemptId, studentId);
      throw new Error('Time limit expired. Assessment has been auto-submitted.');
    }

    const answer = attempt.answers.find(a => a.questionId.toString() === data.questionId);
    if (answer) {
      if (data.selectedOptionIds !== undefined) {
        answer.selectedOptionIds = data.selectedOptionIds;
        answer.isAttempted = data.selectedOptionIds.length > 0;
      }
      if (data.codeSubmission !== undefined) {
        answer.codeSubmission = {
          language: data.codeSubmission.language,
          code: data.codeSubmission.code,
          testCasesPassed: answer.codeSubmission?.testCasesPassed || 0,
          totalTestCases: answer.codeSubmission?.totalTestCases || 0,
          score: answer.codeSubmission?.score || 0,
          verdict: answer.codeSubmission?.verdict || 'SAVED'
        };
        answer.isAttempted = data.codeSubmission.code.trim().length > 0;
      }
      if (data.isMarkedForReview !== undefined) {
        answer.isMarkedForReview = data.isMarkedForReview;
      }
      answer.savedAt = new Date();
    }

    await attempt.save();
  }

  /**
   * Logs suspicious activity (tab switches, fullscreen exits, copy/paste) and adjusts integrity score.
   */
  async recordIntegrityEvent(
    attemptId: string,
    studentId: string,
    collegeId: string,
    type: IntegrityEventType,
    details?: string,
    metadata?: Record<string, any>
  ): Promise<{ integrityScore: number; count: number; autoSubmitted: boolean }> {
    const attempt = await AssessmentAttempt.findOne({
      _id: attemptId,
      studentId: new mongoose.Types.ObjectId(studentId)
    });

    if (!attempt) {
      throw new Error('Attempt not found');
    }

    // Log suspicious event
    await SuspiciousActivity.create({
      attemptId: attempt._id,
      assessmentId: attempt.assessmentId,
      studentId: new mongoose.Types.ObjectId(studentId),
      collegeId: new mongoose.Types.ObjectId(collegeId),
      type,
      details,
      metadata,
      timestamp: new Date()
    });

    attempt.suspiciousEventCount += 1;

    // Deduct integrity score safely
    const penalties: Record<IntegrityEventType, number> = {
      tab_switch: 5,
      fullscreen_exit: 10,
      copy_attempt: 5,
      paste_attempt: 5,
      window_blur: 3
    };
    attempt.integrityScore = Math.max(0, attempt.integrityScore - (penalties[type] || 5));

    // Check if college/assessment tab switch limit is exceeded
    const assessment = await Assessment.findById(attempt.assessmentId);
    let autoSubmitted = false;
    if (assessment && assessment.rules.tabSwitchLimit > 0) {
      if (type === 'tab_switch' && attempt.suspiciousEventCount >= assessment.rules.tabSwitchLimit * 2) {
        // Severe violation: auto-submit
        await this.submitAttempt(attemptId, studentId);
        autoSubmitted = true;
      }
    }

    await attempt.save();

    return {
      integrityScore: attempt.integrityScore,
      count: attempt.suspiciousEventCount,
      autoSubmitted
    };
  }

  /**
   * Evaluates all student answers against correct options & executes code against test cases.
   */
  async submitAttempt(attemptId: string, studentId: string): Promise<IAssessmentAttempt> {
    const attempt = await AssessmentAttempt.findOne({
      _id: attemptId,
      studentId: new mongoose.Types.ObjectId(studentId)
    });

    if (!attempt) {
      throw new Error('Attempt not found');
    }

    if (attempt.status !== 'in_progress') {
      return attempt;
    }

    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    let totalScore = 0;
    const answeredTopics: Record<string, { attempted: number; correct: number; total: number }> = {};

    for (const ans of attempt.answers) {
      const question = await Question.findById(ans.questionId);
      if (!question) continue;

      const topic = question.topic;
      if (!answeredTopics[topic]) {
        answeredTopics[topic] = { attempted: 0, correct: 0, total: 0 };
      }
      answeredTopics[topic].total += 1;

      // Find section rules and marks
      const section = assessment.sections.find(s => s.id === ans.sectionId);
      const marksPerQ = section ? section.marksPerQuestion : (question.marks || 1);
      const negMarks = assessment.rules.negativeMarking ? (question.negativeMarks || 0) : 0;

      if (question.type === 'mcq' || question.type === 'true_false') {
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
          answeredTopics[topic].attempted += 1;
          const selectedId = ans.selectedOptionIds[0];
          const correctOption = question.options?.find(o => o.isCorrect);

          if (correctOption && correctOption.id === selectedId) {
            ans.marksObtained = marksPerQ;
            totalScore += marksPerQ;
            answeredTopics[topic].correct += 1;
          } else {
            ans.marksObtained = -negMarks;
            totalScore = Math.max(0, totalScore - negMarks);
          }
        } else {
          ans.marksObtained = 0;
        }
      } else if (question.type === 'multiple_select') {
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
          answeredTopics[topic].attempted += 1;
          const correctIds = (question.options || []).filter(o => o.isCorrect).map(o => o.id);
          const studentIds = ans.selectedOptionIds;

          const isExactMatch =
            correctIds.length === studentIds.length &&
            correctIds.every(id => studentIds.includes(id));

          if (isExactMatch) {
            ans.marksObtained = marksPerQ;
            totalScore += marksPerQ;
            answeredTopics[topic].correct += 1;
          } else {
            ans.marksObtained = -negMarks;
            totalScore = Math.max(0, totalScore - negMarks);
          }
        } else {
          ans.marksObtained = 0;
        }
      } else if (question.type === 'coding') {
        if (ans.codeSubmission && ans.codeSubmission.code && ans.codeSubmission.code.trim()) {
          answeredTopics[topic].attempted += 1;
          const lang = ans.codeSubmission.language as any;
          const visibleCases = question.codingDetails?.visibleTestCases || [];
          const hiddenCases = question.codingDetails?.hiddenTestCases || [];
          let evalResult: any = null;

          try {
            if (visibleCases.length + hiddenCases.length === 0) {
              throw new Error('Coding question has no test cases configured');
            }

            evalResult = await codeExecutionService.evaluateTestCases({
              language: lang,
              code: ans.codeSubmission.code,
              visibleTestCases: visibleCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
              hiddenTestCases: hiddenCases.map(c => ({ input: c.input, expectedOutput: c.expectedOutput })),
              timeLimitMs: question.codingDetails?.timeLimitMs || 3000
            });

            ans.codeSubmission.testCasesPassed = evalResult.passedCount;
            ans.codeSubmission.totalTestCases = evalResult.totalTestCases;
            ans.codeSubmission.verdict = evalResult.verdict;
            ans.codeSubmission.score = evalResult.score;

            // Pro-rated marks based on test cases passed percentage
            const codingMarks = Math.round((evalResult.score / 100) * marksPerQ);
            ans.marksObtained = codingMarks;
            totalScore += codingMarks;

            if (evalResult.verdict === 'ACCEPTED') {
              answeredTopics[topic].correct += 1;
            }
          } catch (err: any) {
            ans.codeSubmission.verdict = 'RUNTIME_ERROR';
            ans.marksObtained = 0;
          }

          await Submission.create({
            studentId: new mongoose.Types.ObjectId(studentId),
            collegeId: attempt.collegeId,
            questionId: question._id,
            assessmentId: assessment._id,
            language: lang,
            code: ans.codeSubmission.code,
            verdict: evalResult?.verdict || ans.codeSubmission.verdict,
            testCasesPassed: evalResult?.passedCount || 0,
            totalTestCases: evalResult?.totalTestCases || visibleCases.length + hiddenCases.length,
            executionTimeMs: evalResult?.avgExecutionTimeMs || 0,
            memoryKb: evalResult?.maxMemoryKb || 0,
            errorOutput: evalResult?.compileError,
            score: evalResult?.score || 0
          });
        } else {
          ans.marksObtained = 0;
        }
      }
    }

    attempt.totalScore = totalScore;
    attempt.percentage = assessment.totalMarks > 0 ? Math.round((totalScore / assessment.totalMarks) * 100) : 0;
    attempt.passed = attempt.percentage >= assessment.passPercentage;
    attempt.status = 'evaluated';
    attempt.submittedAt = new Date();

    await attempt.save();

    // Update student skill profile for each topic attempted in this assessment
    for (const [t, data] of Object.entries(answeredTopics)) {
      if (data.attempted > 0) {
        await dynamicPracticeService.updateSkillAndHistory({
          studentId,
          collegeId: attempt.collegeId.toString(),
          topic: t,
          answers: [{
            questionId: attempt.answers[0].questionId.toString(),
            wasCorrect: data.correct >= Math.ceil(data.attempted * 0.6),
            timeSpentSeconds: 60
          }]
        }).catch(() => {});
      }
    }

    return attempt;
  }
}

export const assessmentEvaluationService = new AssessmentEvaluationService();
