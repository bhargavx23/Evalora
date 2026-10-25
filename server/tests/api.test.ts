import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import app from "../src/server.js";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { emailService } from "../src/services/emailService.js";
import { AuthChallenge } from "../src/models/AuthChallenge.js";

describe("Evalora Core API & Multi-Tenancy Integration", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    const { College } = await import("../src/models/College.js");
    const { Department } = await import("../src/models/Department.js");
    const { User } = await import("../src/models/User.js");
    const { Assessment } = await import("../src/models/Assessment.js");
    const { Question } = await import("../src/models/Question.js");
    const { PracticeQuestionHistory } = await import("../src/models/PracticeQuestionHistory.js");

    const apexCollege = await College.findOneAndUpdate(
      { code: "APEX" },
      {
        name: "Apex Institute of Technology",
        code: "APEX",
        domain: "apex.edu",
        status: "active",
      },
      { upsert: true, new: true }
    );

    const apexCSE = await Department.findOneAndUpdate(
      { code: "CSE", collegeId: apexCollege._id },
      {
        name: "Computer Science & Engineering",
        code: "CSE",
        collegeId: apexCollege._id,
      },
      { upsert: true, new: true }
    );

    const passwordHash = await bcrypt.hash("Evalora@2026", 10);

    const bhargav = await User.findOneAndUpdate(
      { email: "student.bhargav@apex.edu" },
      {
        name: "Bhargav Ram",
        email: "student.bhargav@apex.edu",
        studentId: "22CSE045",
        passwordHash,
        role: "student",
        collegeId: apexCollege._id,
        departmentId: apexCSE._id,
        emailVerified: true,
        authProviders: ["password"],
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
        plan: "free",
        status: "active",
      },
      { upsert: true, new: true }
    );

    await User.findOneAndUpdate(
      { email: "faculty.dsa@apex.edu" },
      {
        name: "Dr. Ramesh Rao",
        email: "faculty.dsa@apex.edu",
        passwordHash,
        role: "faculty",
        collegeId: apexCollege._id,
        departmentId: apexCSE._id,
        emailVerified: true,
        authProviders: ["password"],
        status: "active",
      },
      { upsert: true, new: true }
    );

    await User.findOneAndUpdate(
      { email: "superadmin@evalora.com" },
      {
        name: "Platform Administrator",
        email: "superadmin@evalora.com",
        passwordHash,
        role: "platform_admin",
        emailVerified: true,
        authProviders: ["password"],
        status: "active",
      },
      { upsert: true, new: true }
    );

    const q = await Question.findOne({ topic: "Arrays" });
    await Assessment.findOneAndUpdate(
      { title: "Mid-Term DSA Assessment 2026", collegeId: apexCollege._id },
      {
        title: "Mid-Term DSA Assessment 2026",
        collegeId: apexCollege._id,
        description: "DSA mid-term",
        status: "published",
        durationMinutes: 60,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 86400000),
        questions: q ? [{ questionId: q._id, points: 10 }] : [],
      },
      { upsert: true }
    );

    if (bhargav) {
      await PracticeQuestionHistory.deleteMany({ studentId: bhargav._id });
    }
  });

  afterAll(async () => {
    // Keep connection or close cleanly
  });

  let studentToken = "";
  let facultyToken = "";
  let adminToken = "";

  it("POST /api/auth/login - should authenticate student and return token", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "student.bhargav@apex.edu",
      password: "Evalora@2026",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("student");
    studentToken = res.body.token;
  });

  it("POST /api/auth/login - should authenticate faculty", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "faculty.dsa@apex.edu",
      password: "Evalora@2026",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("faculty");
    facultyToken = res.body.token;
  });

  it("POST /api/auth/login - should authenticate platform admin", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "superadmin@evalora.com",
      password: "Evalora@2026",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("platform_admin");
    adminToken = res.body.token;
  });

  it("POST /api/auth/register - should always create an unscoped student account", async () => {
    const sendVerificationOTP = vi
      .spyOn(emailService, "sendVerificationOTP")
      .mockResolvedValue();
    const email = `student-${Date.now()}@example.test`;
    const res = await request(app).post("/api/auth/register").send({
      name: "Unscoped Student",
      email,
      password: "SecurePass123!",
      role: "platform_admin",
      collegeId: new mongoose.Types.ObjectId().toString(),
      departmentId: new mongoose.Types.ObjectId().toString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("student");
    expect(res.body.user.collegeId).toBeNull();
    expect(sendVerificationOTP).toHaveBeenCalledWith(
      email,
      expect.stringMatching(/^\d{6}$/),
    );
    sendVerificationOTP.mockRestore();
  });

  it("POST /api/auth/otp/request - should not reveal whether an email exists", async () => {
    const res = await request(app)
      .post("/api/auth/otp/request")
      .send({ email: "unknown@example.test", purpose: "login" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("OTP challenges expire, are single-use, limit attempts, and enforce resend cooldown", async () => {
    const email = "student.bhargav@apex.edu";
    const code = "482913";
    const codeHash = await bcrypt.hash(code, 10);

    await AuthChallenge.deleteMany({ email });
    await AuthChallenge.create({
      email,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      lastSentAt: new Date(),
    });

    const verified = await request(app)
      .post("/api/auth/otp/login")
      .send({ email, code });
    expect(verified.status).toBe(200);

    const reused = await request(app)
      .post("/api/auth/otp/login")
      .send({ email, code });
    expect(reused.status).toBe(401);

    await AuthChallenge.create({
      email,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() - 1_000),
      lastSentAt: new Date(Date.now() - 61_000),
    });
    const expired = await request(app)
      .post("/api/auth/otp/login")
      .send({ email, code });
    expect(expired.status).toBe(401);

    await AuthChallenge.deleteMany({ email });
    await AuthChallenge.create({
      email,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      lastSentAt: new Date(),
    });
    const blocked = await request(app)
      .post("/api/auth/otp/login")
      .send({ email, code: "000000" });
    expect(blocked.status).toBe(401);

    await AuthChallenge.deleteMany({ email });
    const sendLoginOTP = vi
      .spyOn(emailService, "sendLoginOTP")
      .mockResolvedValue();
    const firstRequest = await request(app)
      .post("/api/auth/otp/request")
      .send({ email, purpose: "login" });
    const secondRequest = await request(app)
      .post("/api/auth/otp/request")
      .send({ email, purpose: "login" });
    expect(firstRequest.status).toBe(200);
    expect(secondRequest.status).toBe(429);
    expect(sendLoginOTP).toHaveBeenCalledTimes(1);
    sendLoginOTP.mockRestore();
    await AuthChallenge.deleteMany({ email });
  });

  it("GET /api/auth/me - should return logged-in student profile", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Bhargav Ram");
    expect(res.body.user.studentId).toBe("22CSE045");
  });

  it("POST /api/auth/logout - should revoke the bearer token", async () => {
    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(logout.status).toBe(200);

    const revoked = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(revoked.status).toBe(401);

    const relogin = await request(app).post("/api/auth/login").send({
      email: "student.bhargav@apex.edu",
      password: "Evalora@2026",
    });
    expect(relogin.status).toBe(200);
    studentToken = relogin.body.token;
  });

  it("GET/PUT /api/profile - should persist only the authenticated student's profile", async () => {
    const empty = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(empty.status).toBe(200);
    expect(empty.body.completion).toBeDefined();

    const updated = await request(app)
      .put("/api/profile")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        headline: "Computer science student",
        bio: "Building reliable software and practicing problem solving.",
        skills: ["Python", "SQL"],
        degree: "B.Tech",
        branch: "Computer Science",
        graduationYear: 2027
      });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.headline).toBe("Computer science student");
    expect(updated.body.completion.percentage).toBeGreaterThan(0);
  });

  it("POST /api/profile/resume/analyze - should require a real uploaded resume", async () => {
    const res = await request(app)
      .post("/api/profile/resume/analyze")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("RBAC Guard: Student cannot access faculty question creation", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: "Unauthorized Question",
        description: "Test",
        type: "mcq",
        topic: "Arrays",
        subtopic: "General",
        difficulty: "easy",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/practice/generate - should generate dynamic practice set without hidden testcases", async () => {
    const res = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        topic: "Arrays",
        difficulty: "medium",
        questionCount: 5,
        type: "coding",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    expect(res.body.session).toBeDefined();

    // Security: verify hidden test cases are stripped for student
    res.body.questions.forEach((q: any) => {
      if (q.codingDetails) {
        expect(q.codingDetails.hiddenTestCases).toBeUndefined();
      }
    });

    // Submit the practice session so student analytics is populated even after a fresh DB seed
    await request(app)
      .post(`/api/practice/${res.body.session._id}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [
          {
            questionId: res.body.questions[0]._id,
            selectedOptionIds: ["a"],
          },
        ],
      });
  });

  it("GET /api/analytics/student - should return real database analytics for student dashboard", async () => {
    const res = await request(app)
      .get("/api/analytics/student")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analytics.overallScore).toBeDefined();
    expect(res.body.analytics.topicPerformance.length).toBeGreaterThan(0);
    expect(res.body.analytics.weakestTopic).toBeDefined();
  });

  it("GET /api/assessments - should return published assessments for student", async () => {
    const res = await request(app)
      .get("/api/assessments")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.assessments.length).toBeGreaterThan(0);
    expect(res.body.assessments[0].title).toBeDefined();
  });
});
