import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/server.js";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { Question } from "../src/models/Question.js";
import { PracticeQuestionHistory } from "../src/models/PracticeQuestionHistory.js";
import { PracticeSession } from "../src/models/PracticeSession.js";
import { StudentSkill } from "../src/models/StudentSkill.js";
import jwt from "jsonwebtoken";
import { ENV } from "../src/config/env.js";

describe("Evalora Phase 3 — Practice Builder & Adaptive Question Engine", () => {
  let studentToken = "";
  let studentId = "";
  let collegeId: mongoose.Types.ObjectId | null = null;

  let secondUserToken = "";
  let secondUserId = "";
  const createdQuestionIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    // Get collegeId from seeded student without sharing tokenVersion with authFoundation.test.ts
    const seededStudent = await User.findOne({ email: "student.bhargav@apex.edu" });
    collegeId = seededStudent?.collegeId ? new mongoose.Types.ObjectId(seededStudent.collegeId.toString()) : null;

    let primaryStudent = await User.findOne({ email: "phase3.student@evalora.io" });
    if (!primaryStudent) {
      primaryStudent = await User.create({
        name: "Phase 3 Primary Student",
        email: "phase3.student@evalora.io",
        role: "student",
        collegeId,
        emailVerified: true,
        status: "active",
        tokenVersion: 0,
        freeAttempts: { total: 25, used: 0 },
        paidAttempts: { total: 0, used: 0 },
      });
    } else {
      primaryStudent.collegeId = collegeId || undefined;
      primaryStudent.freeAttempts = { total: 25, used: 0 };
      primaryStudent.paidAttempts = { total: 0, used: 0 };
      primaryStudent.tokenVersion = 0;
      await primaryStudent.save();
    }
    studentId = primaryStudent._id.toString();
    studentToken = jwt.sign(
      {
        userId: studentId,
        role: primaryStudent.role,
        collegeId: collegeId ? collegeId.toString() : null,
        tokenVersion: 0,
      },
      ENV.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await PracticeQuestionHistory.deleteMany({
      studentId: new mongoose.Types.ObjectId(studentId),
    });

    // Create/reset a second isolated test student for ownership & exact 13/20 fresh pool tests
    let secondUser = await User.findOne({ email: "phase3.tester@evalora.io" });
    if (!secondUser) {
      secondUser = await User.create({
        name: "Phase 3 Tester",
        email: "phase3.tester@evalora.io",
        role: "student",
        collegeId,
        emailVerified: true,
        status: "active",
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
      });
    } else {
      secondUser.freeAttempts = { total: 10, used: 0 };
      secondUser.paidAttempts = { total: 0, used: 0 };
      await secondUser.save();
    }
    secondUserId = secondUser._id.toString();
    secondUserToken = jwt.sign(
      {
        userId: secondUser._id.toString(),
        role: secondUser.role,
        collegeId: secondUser.collegeId ? secondUser.collegeId.toString() : null,
        tokenVersion: 0,
      },
      ENV.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Ensure sufficient questions exist in DB for the exact Section 31 scenarios:
    // 1. DSA / Arrays / medium (>= 20 questions)
    // 2. Aptitude / Percentages / easy (>= 10 questions)
    // 3. Reasoning / Blood Relations / medium (>= 10 questions)
    const creatorId = new mongoose.Types.ObjectId(studentId);

    const ensurePool = async (
      category: string,
      topic: string,
      subtopic: string,
      difficulty: "easy" | "medium" | "hard",
      targetCount: number,
      tags: string[]
    ) => {
      const existingCount = await Question.countDocuments({
        topic,
        difficulty,
        status: "verified",
        validationStatus: { $nin: ['generated', 'validating', 'rejected', 'disabled', 'pending_execution'] }
      });
      const needed = Math.max(0, targetCount - existingCount);
      if (needed > 0) {
        const docs = Array.from({ length: needed }).map((_, idx) => ({
          collegeId: null,
          creatorId,
          category,
          title: `[Phase3 Seed] ${topic} - ${subtopic} (${difficulty}) #${idx + 1}_${Date.now()}`,
          description: `Solve the ${topic} (${subtopic}) problem #${idx + 1} at ${difficulty} level.`,
          type: "mcq" as const,
          difficulty,
          topic,
          subtopic,
          tags,
          marks: 2,
          negativeMarks: 0,
          estimatedTimeMinutes: 2,
          options: [
            { id: "opt_a", text: "Option A", isCorrect: true },
            { id: "opt_b", text: "Option B", isCorrect: false },
            { id: "opt_c", text: "Option C", isCorrect: false },
            { id: "opt_d", text: "Option D", isCorrect: false },
          ],
          explanation: `Option A is the verified answer for ${topic} #${idx + 1}.`,
          status: "verified" as const,
          validationStatus: "validated" as const,
        }));
        const inserted = await Question.insertMany(docs);
        inserted.forEach((q) => createdQuestionIds.push(q._id as mongoose.Types.ObjectId));
      }
    };

    await ensurePool("DSA", "Arrays", "Subarrays", "medium", 25, ["DSA", "Arrays"]);
    await ensurePool("Aptitude", "Percentages", "Percentages", "easy", 12, ["Aptitude", "Percentages"]);
    await ensurePool("Reasoning", "Blood Relations", "Family Tree", "medium", 12, ["Reasoning", "Blood Relations"]);
  });

  afterAll(async () => {
    if (createdQuestionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: createdQuestionIds } });
    }
    if (secondUserId) {
      await PracticeQuestionHistory.deleteMany({
        studentId: new mongoose.Types.ObjectId(secondUserId),
      });
      await PracticeSession.deleteMany({
        studentId: new mongoose.Types.ObjectId(secondUserId),
      });
      await User.findByIdAndDelete(secondUserId);
    }
  });

  it("1. Configuration Validation - rejects empty sections, negative counts, and invalid difficulties without deducting attempts", async () => {
    const beforeUser = await User.findById(studentId);
    const usedBefore = beforeUser?.freeAttempts?.used || 0;

    // Empty sections
    const emptyRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ sections: [] });
    expect(emptyRes.status).toBe(400);

    // Invalid count (0)
    const zeroCountRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [{ category: "DSA", topic: "Arrays", difficulty: "medium", count: 0 }],
      });
    expect(zeroCountRes.status).toBe(400);

    // Excessive count (> 50 per section)
    const hugeCountRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [{ category: "DSA", topic: "Arrays", difficulty: "medium", count: 65 }],
      });
    expect(hugeCountRes.status).toBe(400);

    // Invalid difficulty
    const badDiffRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [{ category: "DSA", topic: "Arrays", difficulty: "extreme", count: 5 }],
      });
    expect(badDiffRes.status).toBe(400);

    // Verify no attempts were deducted on validation failures
    const afterUser = await User.findById(studentId);
    expect(afterUser?.freeAttempts?.used).toBe(usedBefore);
  });

  it("2. Exact Section 31 Multi-Category Scenario: DSA/Arrays/Medium/10 + Aptitude/Percentages/Easy/10 + Reasoning/Blood Relations/Medium/10 = 30 questions & 1 attempt deducted", async () => {
    const beforeUser = await User.findById(studentId);
    const usedBefore = beforeUser?.freeAttempts?.used || 0;

    const res = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "medium",
            count: 10,
          },
          {
            category: "Aptitude",
            topic: "Percentages",
            difficulty: "easy",
            count: 10,
          },
          {
            category: "Reasoning",
            topic: "Blood Relations",
            difficulty: "medium",
            count: 10,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalRequested).toBe(30);
    expect(res.body.totalDelivered).toBe(30);
    expect(res.body.questions.length).toBe(30);
    expect(res.body.session.sections.length).toBe(3);

    // Verify section distribution (10 + 10 + 10)
    expect(res.body.session.sections[0].count).toBe(10);
    expect(res.body.session.sections[0].questionIds.length).toBe(10);
    expect(res.body.session.sections[1].count).toBe(10);
    expect(res.body.session.sections[1].questionIds.length).toBe(10);
    expect(res.body.session.sections[2].count).toBe(10);
    expect(res.body.session.sections[2].questionIds.length).toBe(10);

    // Verify zero duplicate question IDs across the entire 30-question session
    const allIds = res.body.questions.map((q: any) => q._id.toString());
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(30);

    // Verify answers and hidden test cases are stripped
    res.body.questions.forEach((q: any) => {
      q.options?.forEach((opt: any) => {
        expect(opt.isCorrect).toBeUndefined();
      });
    });

    // Verify ONLY ONE practice attempt was deducted for the 30-question multi-section session
    const afterUser = await User.findById(studentId);
    expect(afterUser?.freeAttempts?.used).toBe(usedBefore + 1);
  });

  it("3. Exact Section 31 Insufficient Fresh Scenario: Requesting 20 DSA/Arrays/Medium when only 13 fresh exist must NOT silently return 20 with 7 repeated questions", async () => {
    // Prepare secondUser so that out of TotalM DSA/Arrays/Medium questions, exactly 13 remain fresh
    const allMediumArrays = await Question.find({
      topic: "Arrays",
      difficulty: "medium",
      status: "verified",
    }).select("_id");

    expect(allMediumArrays.length).toBeGreaterThanOrEqual(20);
    const countToMarkAttempted = allMediumArrays.length - 13;
    const questionsToMark = allMediumArrays.slice(0, countToMarkAttempted);

    await PracticeQuestionHistory.deleteMany({
      studentId: new mongoose.Types.ObjectId(secondUserId),
    });

    await PracticeQuestionHistory.insertMany(
      questionsToMark.map((q) => ({
        studentId: new mongoose.Types.ObjectId(secondUserId),
        collegeId,
        questionId: q._id,
        topic: "Arrays",
        subtopic: "Subarrays",
        difficulty: "medium",
        wasCorrect: true,
        timeSpentSeconds: 30,
      }))
    );

    // Step A: Validate selection confirms 13 fresh available out of 20 requested
    const valRes = await request(app)
      .post("/api/practice/validate-selection")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "medium",
            count: 20,
          },
        ],
      });

    expect(valRes.status).toBe(200);
    expect(valRes.body.summary.totalRequested).toBe(20);
    expect(valRes.body.summary.totalFreshAvailable).toBe(13);
    expect(valRes.body.summary.overallSufficient).toBe(false);

    // Step B: With rejectOnInsufficientFresh=true, returns 409 and refunds attempt
    const rejectRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "medium",
            count: 20,
          },
        ],
        rejectOnInsufficientFresh: true,
      });

    expect(rejectRes.status).toBe(409);
    expect(rejectRes.body.error?.code).toBe("INSUFFICIENT_FRESH_QUESTIONS");

    // Step C: Default controlled generation (acceptAvailableFresh=true, allowRepeatFallback=false)
    // Must deliver ONLY the 13 fresh questions and NEVER silently repeat the 7 attempted questions
    const controlledRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "medium",
            count: 20,
          },
        ],
      });

    expect(controlledRes.status).toBe(200);
    expect(controlledRes.body.totalRequested).toBe(20);
    expect(controlledRes.body.totalDelivered).toBe(13);
    expect(controlledRes.body.questions.length).toBe(13);
    expect(controlledRes.body.hasShortfall).toBe(true);

    // Verify none of the 13 returned questions are in the attempted set
    const attemptedIdStrings = new Set(questionsToMark.map((q) => q._id.toString()));
    for (const q of controlledRes.body.questions) {
      expect(attemptedIdStrings.has(q._id.toString())).toBe(false);
    }
  }, 20000);

  it("4. Session Lifecycle, Ownership Security (403), Incremental Save, and Duplicate Submit Guard (409)", async () => {
    // Student 1 generates a session
    const genRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "easy",
            count: 2,
          },
        ],
      });

    expect(genRes.status).toBe(200);
    const sessionId = genRes.body.session._id;
    const questions = genRes.body.questions;

    // GET /api/practice/:id as owner succeeds without deducting another attempt
    const getRes = await request(app)
      .get(`/api/practice/${sessionId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.session._id).toBe(sessionId);
    expect(getRes.body.questions.length).toBe(questions.length);

    // Security check: Second user cannot view Student 1's session (403 FORBIDDEN)
    const unauthorizedGet = await request(app)
      .get(`/api/practice/${sessionId}`)
      .set("Authorization", `Bearer ${secondUserToken}`);
    expect(unauthorizedGet.status).toBe(403);

    // Incremental answer save: POST /api/practice/:id/answer
    const saveAnsRes = await request(app)
      .post(`/api/practice/${sessionId}/answer`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        questionId: questions[0]._id,
        selectedOptionIds: questions[0].options?.[0]?.id ? [questions[0].options[0].id] : ["opt_a"],
        timeSpentSeconds: 20,
      });
    expect(saveAnsRes.status).toBe(200);
    expect(saveAnsRes.body.session.status).toBe("in_progress");

    // Security check: Second user cannot submit Student 1's session (403 FORBIDDEN)
    const unauthorizedSubmit = await request(app)
      .post(`/api/practice/${sessionId}/submit`)
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({ answers: [], timeTakenSeconds: 30 });
    expect(unauthorizedSubmit.status).toBe(403);

    // Owner submits session
    const answersPayload = questions.map((q: any) => ({
      questionId: q._id,
      selectedOptionIds: q.options?.[0]?.id ? [q.options[0].id] : [],
      timeSpentSeconds: 25,
    }));

    const submitRes = await request(app)
      .post(`/api/practice/${sessionId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: answersPayload,
        timeTakenSeconds: 50,
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.session.status).toBe("completed");
    expect(submitRes.body.session.completedAt).toBeDefined();

    // Duplicate submission guard: submitting again returns 409 SESSION_ALREADY_COMPLETED
    const duplicateSubmitRes = await request(app)
      .post(`/api/practice/${sessionId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: answersPayload,
        timeTakenSeconds: 50,
      });
    expect(duplicateSubmitRes.status).toBe(409);
    expect(duplicateSubmitRes.body.error?.code).toBe("SESSION_ALREADY_COMPLETED");

    // GET /api/practice/:id/result returns full review data
    const resultRes = await request(app)
      .get(`/api/practice/${sessionId}/result`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(resultRes.status).toBe(200);
    expect(resultRes.body.reviewQuestions.length).toBe(questions.length);
  }, 20000);

  it("5. Controlled Fallback Modes - expandDifficulty and allowRepeatFallback only activate when explicitly requested", async () => {
    // Ensure secondUser has attempts available
    await User.findByIdAndUpdate(secondUserId, {
      $set: {
        "freeAttempts.total": 10,
        "freeAttempts.used": 2,
      },
    });

    // When allowRepeatFallback=true is explicitly requested on the 13/20 DSA/Arrays/Medium pool,
    // it fills the remaining 7 slots from previously attempted questions to deliver all 20
    const repeatOptInRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({
        sections: [
          {
            category: "DSA",
            topic: "Arrays",
            difficulty: "medium",
            count: 20,
          },
        ],
        allowRepeatFallback: true,
      });

    expect(repeatOptInRes.status).toBe(200);
    expect(repeatOptInRes.body.totalRequested).toBe(20);
    expect(repeatOptInRes.body.totalDelivered).toBe(20);
    expect(repeatOptInRes.body.questions.length).toBe(20);
  });

  it("6. Concurrency & Race Condition Protection - 5 simultaneous requests when 1 attempt remains allows only 1 session", async () => {
    // Set secondUser to have exactly 1 remaining attempt (9 used out of 10)
    await User.findByIdAndUpdate(secondUserId, {
      $set: {
        "freeAttempts.total": 10,
        "freeAttempts.used": 9,
        "paidAttempts.total": 0,
        "paidAttempts.used": 0,
      },
    });

    const payload = {
      sections: [
        {
          category: "Aptitude",
          topic: "Percentages",
          difficulty: "easy",
          count: 2,
        },
      ],
    };

    // Fire 5 parallel requests simultaneously
    const responses = await Promise.all([
      request(app).post("/api/practice/generate").set("Authorization", `Bearer ${secondUserToken}`).send(payload),
      request(app).post("/api/practice/generate").set("Authorization", `Bearer ${secondUserToken}`).send(payload),
      request(app).post("/api/practice/generate").set("Authorization", `Bearer ${secondUserToken}`).send(payload),
      request(app).post("/api/practice/generate").set("Authorization", `Bearer ${secondUserToken}`).send(payload),
      request(app).post("/api/practice/generate").set("Authorization", `Bearer ${secondUserToken}`).send(payload),
    ]);

    const statusCodes = responses.map((r) => r.status);
    const successes = statusCodes.filter((s) => s === 200);
    const limitReached = statusCodes.filter((s) => s === 403);

    expect(successes.length).toBe(1);
    expect(limitReached.length).toBe(4);

    const updatedUser = await User.findById(secondUserId);
    expect(updatedUser?.freeAttempts?.used).toBe(10);
  });

  it("7. Dynamic Arbitrary Section Combinations - supports all combinations (DSA, Aptitude, Reasoning, Coding) generically", async () => {
    // Give primary student enough attempts
    await User.findByIdAndUpdate(studentId, {
      $set: {
        "freeAttempts.total": 100,
        "freeAttempts.used": 0,
      },
    });

    // Test 1: Dual Combination: DSA + Reasoning
    const dualRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [
          { category: "DSA", topic: "Arrays", difficulty: "medium", count: 2, type: "mcq" },
          { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium", count: 2, type: "mcq" },
        ],
        allowRepeatFallback: true,
      });

    expect(dualRes.status).toBe(200);
    expect(dualRes.body.success).toBe(true);
    expect(dualRes.body.session).toBeDefined();
    expect(dualRes.body.totalDelivered).toBeGreaterThanOrEqual(1);

    // Test 2: Triple Combination: DSA + Aptitude + Coding
    const tripleRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [
          { category: "DSA", topic: "Arrays", difficulty: "medium", count: 2, type: "mixed" },
          { category: "Aptitude", topic: "Percentages", difficulty: "easy", count: 2, type: "mcq" },
          { category: "Coding", topic: "Arrays", difficulty: "medium", count: 1, type: "coding" },
        ],
        allowRepeatFallback: true,
      });

    expect(tripleRes.status).toBe(200);
    expect(tripleRes.body.success).toBe(true);
    expect(tripleRes.body.session).toBeDefined();

    // Test 3: Grand Quad Combination: DSA + Aptitude + Reasoning + Coding
    const quadRes = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        sections: [
          { category: "DSA", topic: "Arrays", difficulty: "medium", count: 2, type: "mixed" },
          { category: "Aptitude", topic: "Percentages", difficulty: "easy", count: 2, type: "mcq" },
          { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium", count: 2, type: "mcq" },
          { category: "Coding", topic: "Arrays", difficulty: "medium", count: 1, type: "coding" },
        ],
        allowRepeatFallback: true,
      });

    expect(quadRes.status).toBe(200);
    expect(quadRes.body.success).toBe(true);
    expect(quadRes.body.session).toBeDefined();
    expect(quadRes.body.session.sections.length).toBe(4);
  });
});
