import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import algosdk from "algosdk";
import app from "../src/server.js";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { AuthChallenge } from "../src/models/AuthChallenge.js";
import { emailService } from "../src/services/emailService.js";

describe("Evalora Authentication, Authorization & Quota Foundation", () => {
  let algoAccount: algosdk.Account;
  let validAlgoAddress: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    algoAccount = algosdk.generateAccount();
    validAlgoAddress = algoAccount.addr.toString();
  });

  const testEmail = "foundation.student@apex.edu";

  it("POST /api/auth/otp/request - should generate challenge and enforce resend throttling", async () => {
    await AuthChallenge.deleteMany({ email: testEmail });
    await User.findOneAndUpdate(
      { email: testEmail },
      {
        name: "Foundation Student",
        email: testEmail,
        role: "student",
        emailVerified: true,
        authProviders: ["otp"],
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
        plan: "free",
        status: "active"
      },
      { upsert: true }
    );
    const sendSpy = vi.spyOn(emailService, "sendLoginOTP").mockResolvedValue();

    const firstReq = await request(app)
      .post("/api/auth/otp/request")
      .send({ email: testEmail, purpose: "login" });

    expect(firstReq.status).toBe(200);
    expect(firstReq.body.success).toBe(true);

    // Second immediate request should trigger 429 resend limit
    const secondReq = await request(app)
      .post("/api/auth/otp/request")
      .send({ email: testEmail, purpose: "login" });

    expect(secondReq.status).toBe(429);
    expect(secondReq.body.success).toBe(false);

    sendSpy.mockRestore();
  });

  it("POST /api/auth/otp/login - should auto-create student with 10 free attempts on first OTP login", async () => {
    const newOtpEmail = `newstudent_${Date.now()}@apex.edu`;
    await User.deleteMany({ email: newOtpEmail });
    await AuthChallenge.deleteMany({ email: newOtpEmail });

    const code = "654321";
    const codeHash = await bcrypt.hash(code, 10);

    await AuthChallenge.create({
      email: newOtpEmail,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      lastSentAt: new Date(),
    });

    const res = await request(app)
      .post("/api/auth/otp/login")
      .send({ email: newOtpEmail, code });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user.freeAttempts.total).toBe(10);
    expect(res.body.user.freeAttempts.used).toBe(0);

    // Verify user in database
    const createdUser = await User.findOne({ email: newOtpEmail });
    expect(createdUser).toBeDefined();
    expect(createdUser?.freeAttempts.total).toBe(10);
    expect(createdUser?.role).toBe("student");
  });

  it("POST /api/auth/otp/login - should reject expired OTP and max-attempt exhausted OTP", async () => {
    const expiredEmail = `expired_${Date.now()}@apex.edu`;
    const code = "123456";
    const codeHash = await bcrypt.hash(code, 10);

    // 1. Expired OTP
    await AuthChallenge.create({
      email: expiredEmail,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() - 5000), // Expired
      lastSentAt: new Date(Date.now() - 60000),
    });

    const expRes = await request(app)
      .post("/api/auth/otp/login")
      .send({ email: expiredEmail, code });

    expect(expRes.status).toBe(401);

    // 2. Max attempts exceeded
    await AuthChallenge.deleteMany({ email: expiredEmail });
    await AuthChallenge.create({
      email: expiredEmail,
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 5, // Exceeded
      lastSentAt: new Date(),
    });

    const maxRes = await request(app)
      .post("/api/auth/otp/login")
      .send({ email: expiredEmail, code });

    expect(maxRes.status).toBe(401);
  });

  it("POST /api/auth/algorand/challenge - should generate challenge for valid address and reject invalid address", async () => {
    // Valid Algorand address
    const validRes = await request(app)
      .post("/api/auth/algorand/challenge")
      .send({ walletAddress: validAlgoAddress });

    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.challenge).toContain("Evalora Authentication Challenge");
    expect(validRes.body.challenge).toContain(validAlgoAddress);

    // Invalid address format
    const invalidRes = await request(app)
      .post("/api/auth/algorand/challenge")
      .send({ walletAddress: "invalid_not_an_algo_address" });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);
  });

  it("POST /api/auth/algorand/verify - should verify challenge, issue token and prevent signature replay", async () => {
    // 1. Generate challenge
    const chalRes = await request(app)
      .post("/api/auth/algorand/challenge")
      .send({ walletAddress: validAlgoAddress });

    const challenge = chalRes.body.challenge;

    // 2. Verify with test signature
    const verifyRes = await request(app)
      .post("/api/auth/algorand/verify")
      .send({
        walletAddress: validAlgoAddress,
        signature: "TEST_VALID_SIGNATURE",
        challenge
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.user.role).toBe("student");

    // 3. Replay attack prevention: Attempting to verify the exact same challenge again should fail
    const replayRes = await request(app)
      .post("/api/auth/algorand/verify")
      .send({
        walletAddress: validAlgoAddress,
        signature: "TEST_VALID_SIGNATURE",
        challenge
      });

    expect(replayRes.status).toBe(401);
  });

  it("Practice Attempt Quota - should decrement attempts on practice creation and block at 0", async () => {
    // 1. Create a student with exactly 1 free attempt remaining
    const quotaEmail = `quota_${Date.now()}@apex.edu`;
    const user = await User.create({
      name: "Quota Student",
      email: quotaEmail,
      role: "student",
      emailVerified: true,
      authProviders: ["otp"],
      freeAttempts: { total: 10, used: 9 }, // 1 attempt remaining
      paidAttempts: { total: 0, used: 0 },
      plan: "free",
      status: "active"
    });

    const jwt = (await import("jsonwebtoken")).default;
    const { ENV } = await import("../src/config/env.js");
    const quotaUserToken = jwt.sign(
      { userId: user._id.toString(), role: "student", collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Start 1st practice session (should succeed and consume the 10th attempt)
    const firstPractice = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${quotaUserToken}`)
      .send({
        topic: "Arrays",
        difficulty: "easy",
        questionCount: 2
      });

    expect(firstPractice.status).toBe(200);
    expect(firstPractice.body.success).toBe(true);

    // Check user in DB: freeAttempts.used should now be 10
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.freeAttempts.used).toBe(10);

    // 3. Attempting to start another session when exhausted (10/10 used) must be rejected with 403
    const blockedPractice = await request(app)
      .post("/api/practice/generate")
      .set("Authorization", `Bearer ${quotaUserToken}`)
      .send({
        topic: "Arrays",
        difficulty: "easy",
        questionCount: 2
      });

    expect(blockedPractice.status).toBe(403);
    expect(blockedPractice.body.code).toBe("INSUFFICIENT_PRACTICE_ATTEMPTS");
  });

  it("Centralized Error Handling - should return structured RFC-compliant JSON", async () => {
    const passwordHash = await bcrypt.hash("Evalora@2026", 10);
    await User.findOneAndUpdate(
      { email: "student.ananya@apex.edu" },
      {
        name: "Ananya Sharma",
        email: "student.ananya@apex.edu",
        passwordHash,
        role: "student",
        emailVerified: true,
        authProviders: ["password", "otp"],
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
        plan: "free",
        status: "active"
      },
      { upsert: true }
    );

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "student.ananya@apex.edu",
      password: "Evalora@2026",
    });
    const token = loginRes.body.token;

    const invalidIdRes = await request(app)
      .get("/api/questions/invalid_mongo_id")
      .set("Authorization", `Bearer ${token}`);

    expect(invalidIdRes.status).toBe(400);
    expect(invalidIdRes.body.success).toBe(false);
    expect(invalidIdRes.body.code).toBe("INVALID_ID");
  });
});
