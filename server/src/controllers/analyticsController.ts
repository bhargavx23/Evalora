import { Request, Response } from "express";
import mongoose from "mongoose";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { PracticeSession } from "../models/PracticeSession.js";
import { StudentSkill } from "../models/StudentSkill.js";
import { Question } from "../models/Question.js";
import { Submission } from "../models/Submission.js";
import { College } from "../models/College.js";
import { User } from "../models/User.js";
import { Assessment } from "../models/Assessment.js";

export async function getStudentAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const studentId = new mongoose.Types.ObjectId(req.user!._id);

    // 1. Fetch attempts & practice sessions
    const [assessmentAttempts, practiceSessions, skills] = await Promise.all([
      AssessmentAttempt.find({
        studentId,
        status: { $in: ["submitted", "evaluated", "auto_submitted"] },
      })
        .populate("assessmentId", "title totalMarks durationMinutes")
        .sort({ createdAt: -1 }),
      PracticeSession.find({ studentId, status: "completed" }).sort({
        createdAt: -1,
      }),
      StudentSkill.find({ studentId }).sort({ scorePercentage: 1 }),
    ]);

    // 2. Score progression (combining completed assessments and practice sessions chronologically)
    const scoreTrends = [
      ...assessmentAttempts.map((att) => ({
        date: att.createdAt.toISOString().split("T")[0],
        score: att.percentage,
        title: (att.assessmentId as any)?.title || "Assessment",
        type: "assessment",
        integrity: att.integrityScore,
        createdAt: att.createdAt,
      })),
      ...practiceSessions.map((p) => ({
        date: p.createdAt.toISOString().split("T")[0],
        score: p.accuracyPercentage ?? 0,
        title: `Practice: ${p.topic || "General"}`,
        type: "practice",
        integrity: 100,
        createdAt: p.createdAt,
      })),
    ]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-15)
      .map(({ createdAt, ...trend }) => trend);

    // 3. Overall performance (blending assessments and completed practice sessions)
    const totalAssessmentsCount = assessmentAttempts.length;
    const totalPracticeCount = practiceSessions.length;
    const assessmentTotalScore = assessmentAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0);
    const practiceTotalAccuracy = practiceSessions.reduce((acc, p) => acc + (p.accuracyPercentage ?? 0), 0);
    const totalCombinedEvaluations = totalAssessmentsCount + totalPracticeCount;

    const overallScore =
      totalCombinedEvaluations > 0
        ? Math.round((assessmentTotalScore + practiceTotalAccuracy) / totalCombinedEvaluations)
        : null;

    // Coding score from submissions
    const codingSubmissions = await Submission.find({ studentId });
    const acceptedCount = codingSubmissions.filter(
      (s) => s.verdict === "ACCEPTED",
    ).length;
    const codingScore =
      codingSubmissions.length > 0
        ? Math.round((acceptedCount / codingSubmissions.length) * 100)
        : null;

    // Topic map combining StudentSkill records and completed practice sessions
    const topicMap: Record<string, { totalSolved: number; totalCorrect: number; status: string }> = {};

    for (const s of skills) {
      topicMap[s.topic] = {
        totalSolved: s.totalAttempted || 0,
        totalCorrect: s.totalCorrect || 0,
        status: s.status,
      };
    }

    for (const p of practiceSessions) {
      if (p.sections && Array.isArray(p.sections)) {
        for (const sec of p.sections) {
          if (!topicMap[sec.topic]) {
            topicMap[sec.topic] = { totalSolved: 0, totalCorrect: 0, status: "needs_practice" };
          }
          topicMap[sec.topic].totalSolved += sec.solvedCount ?? sec.count ?? 0;
          topicMap[sec.topic].totalCorrect += sec.correctCount ?? 0;
        }
      } else if (p.topic) {
        if (!topicMap[p.topic]) {
          topicMap[p.topic] = { totalSolved: 0, totalCorrect: 0, status: "needs_practice" };
        }
        topicMap[p.topic].totalSolved += p.totalQuestions || 0;
        topicMap[p.topic].totalCorrect += p.correctCount || 0;
      }
    }

    const topicPerformance = Object.entries(topicMap)
      .map(([topic, data]) => {
        const score = data.totalSolved > 0 ? Math.round((data.totalCorrect / data.totalSolved) * 100) : 0;
        let status = "needs_practice";
        if (score >= 80) status = "mastered";
        else if (score >= 60) status = "proficient";
        return {
          topic,
          score,
          status,
          attempted: data.totalSolved,
        };
      })
      .sort((a, b) => a.score - b.score);

    // Aptitude and Technical topic averages
    const aptitudeTopics = [
      "Quantitative Aptitude",
      "Percentages",
      "Logical Reasoning",
      "Verbal Ability",
      "Aptitude",
      "Reasoning",
      "Profit and Loss",
      "Time and Work",
      "Number Systems",
    ];
    const technicalTopics = [
      "DSA",
      "Arrays",
      "Strings",
      "Trees",
      "Graphs",
      "Linked Lists",
      "Dynamic Programming",
      "DBMS",
      "Operating Systems",
      "Computer Networks",
      "OOP",
      "Coding",
    ];

    const aptitudeItems = topicPerformance.filter((t) =>
      aptitudeTopics.some((at) => at.toLowerCase() === t.topic.toLowerCase()),
    );
    const aptitudeScore =
      aptitudeItems.length > 0
        ? Math.round(aptitudeItems.reduce((acc, s) => acc + s.score, 0) / aptitudeItems.length)
        : null;

    const technicalItems = topicPerformance.filter((t) =>
      technicalTopics.some((tt) => tt.toLowerCase() === t.topic.toLowerCase()),
    );
    const technicalScore =
      technicalItems.length > 0
        ? Math.round(technicalItems.reduce((acc, s) => acc + s.score, 0) / technicalItems.length)
        : null;

    // 5. Weakest topic for recommendation
    const weakestTopic = topicPerformance.length > 0 ? topicPerformance[0].topic : null;
    const weakestScore = topicPerformance.length > 0 ? topicPerformance[0].score : null;

    res.json({
      success: true,
      analytics: {
        overallScore,
        codingScore,
        aptitudeScore,
        technicalScore,
        totalAssessmentsTaken: totalAssessmentsCount,
        totalPracticeCompleted: totalPracticeCount,
        totalCodeSubmissions: codingSubmissions.length,
        weakestTopic: {
          topic: weakestTopic,
          score: weakestScore,
          recommendedQuestionCount: weakestTopic ? 10 : 0,
        },
        scoreTrends,
        topicPerformance,
        recentActivity: [
          ...assessmentAttempts.slice(0, 5).map((a) => ({
            type: "assessment",
            title: (a.assessmentId as any)?.title || "Assessment",
            date: a.createdAt,
            score: a.percentage,
            passed: a.passed,
          })),
          ...practiceSessions.slice(0, 5).map((p) => ({
            type: "practice",
            title: `Practice: ${p.topic} (${p.difficulty})`,
            date: p.createdAt,
            score: p.accuracyPercentage,
            passed: (p.accuracyPercentage ?? 0) >= 60,
          })),
        ]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 8),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getBatchAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const collegeId = req.user?.collegeId
      ? new mongoose.Types.ObjectId(req.user.collegeId)
      : null;
    const { assessmentId } = req.query;

    const filter: any = {};
    if (req.user?.role !== "platform_admin") {
      if (!collegeId) {
        res
          .status(400)
          .json({ success: false, message: "College association required" });
        return;
      }
      filter.collegeId = collegeId;
    }

    if (assessmentId) {
      if (!mongoose.isValidObjectId(assessmentId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid assessment ID" });
        return;
      }

      const assessment =
        await Assessment.findById(assessmentId).select("collegeId");
      if (
        !assessment ||
        (collegeId && assessment.collegeId.toString() !== collegeId.toString())
      ) {
        res
          .status(404)
          .json({ success: false, message: "Assessment not found" });
        return;
      }

      filter.assessmentId = new mongoose.Types.ObjectId(assessmentId as string);
    }

    const attempts = await AssessmentAttempt.find(filter).sort({
      percentage: -1,
    });

    if (attempts.length === 0) {
      res.json({
        success: true,
        stats: {
          classAverage: null,
          highest: null,
          lowest: null,
          median: null,
          totalAttempts: 0,
          passRate: null,
          topicPerformance: [],
        },
      });
      return;
    }

    const scores = attempts.map((a) => a.percentage);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const classAverage = Math.round(
      scores.reduce((acc, s) => acc + s, 0) / scores.length,
    );

    // Median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    const median =
      sortedScores.length % 2 !== 0
        ? sortedScores[mid]
        : Math.round((sortedScores[mid - 1] + sortedScores[mid]) / 2);

    const passedCount = attempts.filter((a) => a.passed).length;
    const passRate = Math.round((passedCount / attempts.length) * 100);

    // Topic performance across all attempts
    const topicMap: Record<string, { totalMarks: number; maxMarks: number }> =
      {};

    for (const att of attempts) {
      for (const ans of att.answers) {
        const q = await Question.findById(ans.questionId);
        if (q) {
          if (!topicMap[q.topic]) {
            topicMap[q.topic] = { totalMarks: 0, maxMarks: 0 };
          }
          topicMap[q.topic].totalMarks += Math.max(0, ans.marksObtained);
          topicMap[q.topic].maxMarks += q.marks || 1;
        }
      }
    }

    const topicPerformance = Object.entries(topicMap)
      .map(([topic, data]) => ({
        topic,
        average:
          data.maxMarks > 0
            ? Math.round((data.totalMarks / data.maxMarks) * 100)
            : null,
      }))
      .sort(
        (a, b) =>
          (a.average ?? Number.MAX_SAFE_INTEGER) -
          (b.average ?? Number.MAX_SAFE_INTEGER),
      );

    res.json({
      success: true,
      stats: {
        classAverage,
        highest,
        lowest,
        median,
        totalAttempts: attempts.length,
        passRate,
        topicPerformance,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getQuestionAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const collegeId = req.user?.collegeId
      ? new mongoose.Types.ObjectId(req.user.collegeId)
      : null;

    const filter: any = {};
    if (collegeId) {
      filter.$or = [{ collegeId }, { collegeId: null }];
    }

    const questions = await Question.find(filter)
      .sort({ attemptCount: -1 })
      .limit(50);

    const enriched = questions.map((q) => {
      const attempts = q.attemptCount || 0;
      const corrects = q.correctCount || 0;
      const correctRate =
        attempts > 0 ? Math.round((corrects / attempts) * 100) : null;
      const incorrectRate = correctRate === null ? null : 100 - correctRate;

      // Quality Flag checks
      let flag: string | undefined = undefined;
      if (correctRate !== null && correctRate < 30 && attempts >= 5) {
        flag = "Potentially difficult question (low success rate)";
      } else if (correctRate !== null && correctRate < 15) {
        flag = "Possible ambiguous question (extreme failure rate)";
      }

      return {
        _id: q._id,
        title: q.title,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        type: q.type,
        attemptCount: attempts,
        correctPercentage: correctRate,
        incorrectPercentage: incorrectRate,
        averageTimeSeconds: q.avgTimeSeconds || null,
        discriminationIndex: q.discriminationIndex || null,
        flag,
      };
    });

    res.json({ success: true, questions: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPlatformAnalytics(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const [
      collegeCount,
      studentCount,
      facultyCount,
      questionCount,
      assessmentCount,
      submissionCount,
    ] = await Promise.all([
      College.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "faculty" }),
      Question.countDocuments(),
      Assessment.countDocuments(),
      Submission.countDocuments(),
    ]);

    const activeColleges = await College.find().select(
      "name code status createdAt settings",
    );

    res.json({
      success: true,
      metrics: {
        totalColleges: collegeCount,
        totalStudents: studentCount,
        totalFaculty: facultyCount,
        totalQuestions: questionCount,
        totalAssessments: assessmentCount,
        totalSubmissions: submissionCount,
      },
      colleges: activeColleges,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
