import { Request, Response } from "express";
import mongoose from "mongoose";
import { Assessment, IAssessment } from "../models/Assessment.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { Question } from "../models/Question.js";
import { User } from "../models/User.js";
import { assessmentEvaluationService } from "../services/assessmentEvaluationService.js";
import { codeSimilarityService } from "../services/codeSimilarityService.js";
import { CodeSimilarityResult } from "../models/CodeSimilarityResult.js";

function assessmentScope(
  req: Request,
  id: string,
): Record<string, mongoose.Types.ObjectId> | null {
  if (!mongoose.isValidObjectId(id)) return null;
  const isSuperAdmin = req.user?.role === "platform_admin" || req.user?.role === "admin";
  if (isSuperAdmin) {
    return { _id: new mongoose.Types.ObjectId(id) };
  }
  if (!req.user?.collegeId || !mongoose.isValidObjectId(req.user.collegeId))
    return null;
  return {
    _id: new mongoose.Types.ObjectId(id),
    collegeId: new mongoose.Types.ObjectId(req.user.collegeId),
  };
}

export async function getAssessments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const isStudent = req.user?.role === "student";
    const isSuperAdmin = req.user?.role === "platform_admin" || req.user?.role === "admin";
    const collegeId = req.user?.collegeId
      ? new mongoose.Types.ObjectId(req.user.collegeId)
      : null;

    if (!collegeId && !isSuperAdmin) {
      // Independent student with no college affiliation: return published open assessments or empty list
      res.json({ success: true, assessments: [] });
      return;
    }

    const filter: any = {};
    if (!isSuperAdmin) {
      filter.collegeId = collegeId;
    }

    if (isStudent) {
      filter.status = "published";
      // Match department or student assignment
      const studentDeptId = req.user?.departmentId
        ? new mongoose.Types.ObjectId(req.user.departmentId)
        : null;
      const studentUserId = new mongoose.Types.ObjectId(req.user!._id);

      filter.$or = [
        { assignedDepartments: studentDeptId },
        { assignedStudents: studentUserId },
        { assignedDepartments: { $size: 0 }, assignedStudents: { $size: 0 } }, // Open to all in college
      ];
    }

    const assessments = await Assessment.find(filter)
      .sort({ createdAt: -1 })
      .populate("creatorId", "name email");

    // If student, attach attempt status (e.g. not_started, in_progress, submitted)
    if (isStudent) {
      const studentId = new mongoose.Types.ObjectId(req.user!._id);
      const enriched = await Promise.all(
        assessments.map(async (ass) => {
          const attempt = await AssessmentAttempt.findOne({
            assessmentId: ass._id,
            studentId,
          }).sort({ createdAt: -1 });

          return {
            ...ass.toObject(),
            userAttempt: attempt
              ? {
                  _id: attempt._id,
                  status: attempt.status,
                  totalScore: attempt.totalScore,
                  maxScore: attempt.maxScore,
                  percentage: attempt.percentage,
                  passed: attempt.passed,
                  startedAt: attempt.startedAt,
                  submittedAt: attempt.submittedAt,
                  expiresAt: attempt.expiresAt,
                }
              : null,
          };
        }),
      );
      res.json({ success: true, assessments: enriched });
      return;
    }

    // If faculty/admin, attach attempt counts
    const assessmentsWithCounts = await Promise.all(
      assessments.map(async (ass) => {
        const [totalAttempts, inProgressAttempts] = await Promise.all([
          AssessmentAttempt.countDocuments({ assessmentId: ass._id }),
          AssessmentAttempt.countDocuments({
            assessmentId: ass._id,
            status: "in_progress",
          }),
        ]);
        return {
          ...ass.toObject(),
          stats: {
            totalAttempts,
            inProgressAttempts,
          },
        };
      }),
    );

    res.json({ success: true, assessments: assessmentsWithCounts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAssessmentById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const scope = assessmentScope(req, id);
    const assessment =
      scope &&
      (await Assessment.findOne(scope)
        .populate("creatorId", "name email")
        .populate("assignedDepartments", "name code")
        .populate(
          "sections.questionIds",
          "title type topic difficulty marks negativeMarks estimatedTimeMinutes",
        ));

    if (!assessment) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    // If student, check if user has an attempt
    let userAttempt = null;
    if (req.user?.role === "student") {
      userAttempt = await AssessmentAttempt.findOne({
        assessmentId: assessment._id,
        studentId: new mongoose.Types.ObjectId(req.user._id),
      }).sort({ createdAt: -1 });
    }

    res.json({ success: true, assessment, userAttempt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body;
    const collegeId = req.user?.collegeId;

    if (!collegeId) {
      res
        .status(400)
        .json({ success: false, message: "User must belong to a college" });
      return;
    }

    // Calculate total marks across sections
    let totalMarks = 0;
    if (body.sections && Array.isArray(body.sections)) {
      body.sections.forEach((sec: any) => {
        sec.totalMarks =
          (sec.questionIds?.length || 0) * (sec.marksPerQuestion || 1);
        totalMarks += sec.totalMarks;
      });
    }

    const resolvedTotalMarks = totalMarks || body.totalMarks;
    if (!resolvedTotalMarks || resolvedTotalMarks <= 0) {
      res
        .status(400)
        .json({
          success: false,
          message:
            "Assessment must include questions or a positive totalMarks value",
        });
      return;
    }

    const assessment = await Assessment.create({
      ...body,
      collegeId: new mongoose.Types.ObjectId(collegeId),
      creatorId: new mongoose.Types.ObjectId(req.user!._id),
      totalMarks: resolvedTotalMarks,
      status: body.status || "draft",
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Assessment created successfully",
        assessment,
      });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;
    const scope = assessmentScope(req, id);

    const assessment =
      scope &&
      (await Assessment.findOneAndUpdate(scope, updates, { new: true }));
    if (!assessment) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    res.json({
      success: true,
      message: "Assessment updated successfully",
      assessment,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function publishAssessment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const scope = assessmentScope(req, id);
    const assessment = scope && (await Assessment.findOne(scope));
    if (!assessment) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    assessment.status = "published";
    await assessment.save();

    res.json({
      success: true,
      message: "Assessment published successfully",
      assessment,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function startAttempt(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const studentId = req.user!._id;
    const collegeId = req.user!.collegeId!;

    const attempt = await assessmentEvaluationService.startAttempt(
      id,
      studentId,
      collegeId,
    );

    // Fetch full questions for the attempt
    const questionIds = attempt.answers.map((a) => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    // Sanitize questions: strip hidden test cases and correct options
    const sanitizedQuestions = questions.map((q) => {
      const obj: any = q.toObject();
      if (obj.options) {
        obj.options = obj.options.map((o: any) => ({ id: o.id, text: o.text }));
      }
      if (obj.codingDetails) {
        delete obj.codingDetails.hiddenTestCases;
      }
      delete obj.explanation;
      return obj;
    });

    res.json({
      success: true,
      message: "Assessment attempt started",
      attempt,
      questions: sanitizedQuestions,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function autosaveAnswer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params; // assessmentId
    const {
      attemptId,
      questionId,
      selectedOptionIds,
      codeSubmission,
      isMarkedForReview,
    } = req.body;
    const studentId = req.user!._id;

    await assessmentEvaluationService.autosaveAnswer(attemptId, studentId, {
      questionId,
      selectedOptionIds,
      codeSubmission,
      isMarkedForReview,
    });

    res.json({ success: true, message: "Answer saved" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function recordIntegrityEvent(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { attemptId, type, details, metadata } = req.body;
    const studentId = req.user!._id;
    const collegeId = req.user!.collegeId!;

    const result = await assessmentEvaluationService.recordIntegrityEvent(
      attemptId,
      studentId,
      collegeId,
      type,
      details,
      metadata,
    );

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function submitAttempt(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { attemptId } = req.body;
    const studentId = req.user!._id;

    const evaluatedAttempt = await assessmentEvaluationService.submitAttempt(
      attemptId,
      studentId,
    );

    res.json({
      success: true,
      message: "Assessment submitted and evaluated successfully",
      attempt: evaluatedAttempt,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function getAssessmentAttempts(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const scope = assessmentScope(req, id);
    if (!scope || !(await Assessment.exists(scope))) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    const attempts = await AssessmentAttempt.find({
      assessmentId: scope._id,
      ...(req.user?.role === "platform_admin"
        ? {}
        : { collegeId: scope.collegeId }),
    })
      .populate("studentId", "name email studentId departmentId")
      .sort({ createdAt: -1 });

    res.json({ success: true, attempts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getLiveMonitoring(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const scope = assessmentScope(req, id);
    if (!scope || !(await Assessment.exists(scope))) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    const activeAttempts = await AssessmentAttempt.find({
      assessmentId: scope._id,
      ...(req.user?.role === "platform_admin"
        ? {}
        : { collegeId: scope.collegeId }),
      status: "in_progress",
    })
      .populate("studentId", "name email studentId")
      .sort({ startedAt: -1 });

    const liveData = activeAttempts.map((att) => {
      const answeredCount = att.answers.filter((a) => a.isAttempted).length;
      const totalQuestions = att.answers.length;
      return {
        attemptId: att._id,
        student: att.studentId,
        startedAt: att.startedAt,
        expiresAt: att.expiresAt,
        answeredCount,
        totalQuestions,
        progressPercentage:
          totalQuestions > 0
            ? Math.round((answeredCount / totalQuestions) * 100)
            : 0,
        integrityScore: att.integrityScore,
        suspiciousEventCount: att.suspiciousEventCount,
      };
    });

    res.json({ success: true, liveStudents: liveData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSimilarityReport(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { questionId } = req.query;
    const scope = assessmentScope(req, id);
    if (!scope) {
      res.status(404).json({ success: false, message: "Assessment not found" });
      return;
    }

    if (!questionId) {
      // Find all coding questions in this assessment
      const assessment = await Assessment.findOne(scope);
      const codingQuestionIds: any[] = [];
      assessment?.sections.forEach((s) => {
        if (s.type === "coding" || s.type === "mixed") {
          s.questionIds.forEach((qid) => codingQuestionIds.push(qid));
        }
      });

      const existingReports = await CodeSimilarityResult.find({
        assessmentId: scope._id,
        ...(req.user?.role === "platform_admin"
          ? {}
          : { collegeId: scope.collegeId }),
      })
        .populate("studentAId", "name email studentId")
        .populate("studentBId", "name email studentId")
        .populate("questionId", "title")
        .sort({ similarityPercentage: -1 });

      res.json({ success: true, reports: existingReports, codingQuestionIds });
      return;
    }

    // Run comparison for specified question
    const collegeId = req.user!.collegeId!;
    const results = await codeSimilarityService.compareSubmissionsForQuestion(
      id,
      questionId as string,
      collegeId,
    );

    res.json({ success: true, reports: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
