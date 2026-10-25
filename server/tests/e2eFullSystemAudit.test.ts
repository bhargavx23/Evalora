import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Question } from '../src/models/Question.js';
import { College } from '../src/models/College.js';
import { Assessment } from '../src/models/Assessment.js';
import { PaymentTransaction } from '../src/models/PaymentTransaction.js';
import { PaymentIntent } from '../src/models/PaymentIntent.js';
import { emailService } from '../src/services/emailService.js';
import algosdk from 'algosdk';
import { algorandService } from '../src/services/algorandService.js';

describe('Evalora — Complete End-to-End System Audit & Verification Suite', () => {
  let studentToken = '';
  let studentUserId = '';
  const studentEmail = 'audit.student@evalora.io';

  let collegeAdminToken = '';
  let collegeId = '';

  let platformAdminToken = '';

  const testAccount = algosdk.generateAccount();
  const testWallet = testAccount.addr.toString();
  const treasuryWallet = algorandService.getTreasuryWallet();

  let capturedOtp = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    vi.spyOn(emailService, 'sendLoginOTP').mockImplementation(async (_email: string, code: string) => {
      capturedOtp = code;
    });

    // Clean test data
    await User.deleteMany({ email: { $in: [studentEmail, 'audit.admin@evalora.io', 'audit.college@evalora.io'] } });
    await College.deleteMany({ code: 'AUDITCOL' });
    await Assessment.deleteMany({ title: /Audit Assessment/i });
    await PaymentTransaction.deleteMany({ transactionId: /AUDIT_TX_/i });
    await PaymentIntent.deleteMany({ intentId: /AUDIT_INTENT_/i });

    // Seed student user
    const studentUser = await User.create({
      name: 'Audit Student',
      email: studentEmail,
      role: 'student',
      emailVerified: true,
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 0, used: 0 },
      plan: 'free',
      status: 'active'
    });
    studentUserId = studentUser._id.toString();

    // Seed questions across all 4 categories if needed
    const categories = ['DSA', 'Aptitude', 'Reasoning', 'Coding'];
    for (const cat of categories) {
      const count = await Question.countDocuments({ category: cat });
      if (count < 5) {
        const questionsToInsert = Array.from({ length: 6 }).map((_, i) => ({
          title: `Audit ${cat} Problem ${i + 1}`,
          description: `Audit test statement for ${cat} index ${i + 1}`,
          category: cat,
          topic: cat === 'DSA' ? 'Arrays' : cat === 'Aptitude' ? 'Percentages' : cat === 'Reasoning' ? 'Blood Relations' : 'Recursion',
          subtopic: 'Fundamentals',
          difficulty: i % 2 === 0 ? 'easy' : 'medium',
          type: cat === 'Coding' ? 'coding' : 'mcq',
          marks: 10,
          options: cat === 'Coding' ? undefined : [
            { id: 'a', text: 'Option A (Correct)', isCorrect: true },
            { id: 'b', text: 'Option B', isCorrect: false },
            { id: 'c', text: 'Option C', isCorrect: false },
            { id: 'd', text: 'Option D', isCorrect: false }
          ],
          codingDetails: cat === 'Coding' ? {
            starterCode: { python: 'def solve():\n    return 42' },
            visibleTestCases: [{ input: '', expectedOutput: '42' }],
            hiddenTestCases: [{ input: '', expectedOutput: '42' }],
            timeLimitMs: 3000
          } : undefined,
          explanation: `Comprehensive explanation for ${cat} problem ${i + 1}`,
          status: 'verified',
          collegeId: null
        }));
        await Question.insertMany(questionsToInsert);
      }
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await User.deleteMany({ email: { $in: [studentEmail, 'audit.admin@evalora.io', 'audit.college@evalora.io'] } });
    await College.deleteMany({ code: 'AUDITCOL' });
    await Assessment.deleteMany({ title: /Audit Assessment/i });
  });

  // ===========================================================================
  // 1. AUTHENTICATION AUDIT: EMAIL + OTP & PERA QR
  // ===========================================================================
  describe('1. Authentication Flow Audit', () => {
    it('generates OTP challenge and securely logs in candidate with 10 complimentary attempts', async () => {
      // 1. Request OTP
      const reqRes = await request(app)
        .post('/api/auth/otp/request')
        .send({ email: studentEmail, purpose: 'login' });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.success).toBe(true);
      expect(capturedOtp).toMatch(/^\d{6}$/);

      // 2. Login with OTP
      const loginRes = await request(app)
        .post('/api/auth/otp/login')
        .send({
          email: studentEmail,
          code: capturedOtp
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.user).toBeDefined();
      expect(loginRes.body.user.role).toBe('student');
      expect(loginRes.body.user.freeAttempts.total).toBe(10);
      expect(loginRes.body.user.freeAttempts.used).toBe(0);

      studentToken = loginRes.body.token;
    });

    it('creates a desktop Pera QR authentication session and supports status lookup & cancel', async () => {
      const qrRes = await request(app)
        .post('/api/wallet/qr/create')
        .send({ purpose: 'LOGIN' });

      expect(qrRes.status).toBe(201);
      expect(qrRes.body.success).toBe(true);
      expect(qrRes.body.sessionId).toBeDefined();
      expect(qrRes.body.qrUri).toBeDefined();
      expect(qrRes.body.expiresAt).toBeDefined();

      const sid = qrRes.body.sessionId;

      // Check status
      const statusRes = await request(app).get(`/api/wallet/qr/${sid}/status`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('PENDING');

      // Cancel session
      const cancelRes = await request(app).post(`/api/wallet/qr/${sid}/cancel`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');
    });

    it('rejects access to protected routes without a valid token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns candidate profile upon presenting valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(studentEmail);
    });
  });

  // ===========================================================================
  // 2. QUESTION GENERATION & MULTI-SECTION COMBINATIONS AUDIT
  // ===========================================================================
  describe('2. Dynamic Question Generation & All Combinations Audit', () => {
    it('dynamically generates a single-section test: DSA Only', async () => {
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            { category: 'DSA', topic: 'Arrays', difficulty: 'easy', count: 2, type: 'mcq' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session).toBeDefined();
      expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.questions[0].options[0].isCorrect).toBeUndefined(); // Sensitive key stripped
    });

    it('dynamically generates a two-domain test: Aptitude + Reasoning', async () => {
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            { category: 'Aptitude', topic: 'Percentages', difficulty: 'easy', count: 2, type: 'mcq' },
            { category: 'Reasoning', topic: 'Blood Relations', difficulty: 'easy', count: 2, type: 'mcq' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(2);
    });

    it('dynamically generates a three-domain test: DSA + Aptitude + Coding', async () => {
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            { category: 'DSA', topic: 'Arrays', difficulty: 'easy', count: 1, type: 'mcq' },
            { category: 'Aptitude', topic: 'Percentages', difficulty: 'medium', count: 1, type: 'mcq' },
            { category: 'Coding', topic: 'Recursion', difficulty: 'easy', count: 1, type: 'coding' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(2);
    });

    it('dynamically generates a grand 4-domain test: DSA + Aptitude + Reasoning + Coding', async () => {
      const res = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            { category: 'DSA', topic: 'Arrays', difficulty: 'easy', count: 1, type: 'mcq' },
            { category: 'Aptitude', topic: 'Percentages', difficulty: 'easy', count: 1, type: 'mcq' },
            { category: 'Reasoning', topic: 'Blood Relations', difficulty: 'medium', count: 1, type: 'mcq' },
            { category: 'Coding', topic: 'Recursion', difficulty: 'medium', count: 1, type: 'coding' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ===========================================================================
  // 3. SESSION LIFECYCLE, SCORING & PERFORMANCE REPORT AUDIT
  // ===========================================================================
  describe('3. Practice Session Lifecycle, Scoring & PDF Report Audit', () => {
    let createdSessionId = '';
    let sessionQuestions: any[] = [];

    it('starts practice session and ensures page refresh restores same session with 0 attempt deduction', async () => {
      const createRes = await request(app)
        .post('/api/practice/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          sections: [
            { category: 'DSA', topic: 'Arrays', difficulty: 'easy', count: 2, type: 'mcq' }
          ]
        });

      expect(createRes.status).toBe(200);
      createdSessionId = createRes.body.session._id;
      sessionQuestions = createRes.body.questions;

      // Simulate browser refresh on PracticeRoom: calls GET /api/practice/:id
      const restoreRes = await request(app)
        .get(`/api/practice/${createdSessionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.session._id).toBe(createdSessionId);
      expect(restoreRes.body.questions.length).toBe(sessionQuestions.length);
    });

    it('submits practice answers and evaluates score on the server', async () => {
      const q1 = sessionQuestions[0];
      const answersPayload = [
        {
          questionId: q1._id,
          selectedOptionIds: ['a'],
          timeSpentSeconds: 25
        }
      ];

      const submitRes = await request(app)
        .post(`/api/practice/${createdSessionId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          answers: answersPayload,
          timeTakenSeconds: 65
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.session.status).toBe('completed');
      expect(submitRes.body.session.accuracyPercentage).toBeDefined();

      // Guard against duplicate submission (409)
      const dupRes = await request(app)
        .post(`/api/practice/${createdSessionId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ answers: answersPayload });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe('SESSION_ALREADY_COMPLETED');
    });

    it('generates performance analysis report data and vector PDF document', async () => {
      const dataRes = await request(app)
        .get(`/api/practice/${createdSessionId}/report/data`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(dataRes.status).toBe(200);
      expect(dataRes.body.success).toBe(true);
      expect(dataRes.body.report.summary.totalQuestions).toBeGreaterThan(0);
      expect(dataRes.body.report.strengths).toBeDefined();
      expect(dataRes.body.report.recommendations).toBeDefined();

      const pdfRes = await request(app)
        .get(`/api/practice/${createdSessionId}/report/pdf`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  // ===========================================================================
  // 4. PREMIUM PLANS & ALGORAND PAYMENT VERIFICATION AUDIT
  // ===========================================================================
  describe('4. Premium Pricing (< 9 ALGO), Pera Payment & Official Receipt Audit', () => {
    it('verifies all public premium plans cost strictly LESS THAN 9 ALGO', async () => {
      const res = await request(app).get('/api/payments/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plans.length).toBeGreaterThan(0);

      for (const plan of res.body.plans) {
        expect(plan.price).toBeGreaterThan(0);
        expect(plan.price).toBeLessThan(9);
        expect(plan.currency).toBe('ALGO');
      }
    });

    it('creates server-controlled payment intent and verifies confirmed Algorand transaction', async () => {
      // 1. Create intent
      const intentRes = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          planId: 'trial',
          walletAddress: testWallet
        });

      expect([200, 201]).toContain(intentRes.status);
      expect(intentRes.body.success).toBe(true);
      const paymentIntent = intentRes.body.paymentIntent || intentRes.body;
      const intentId = paymentIntent.intentId;
      const amount = paymentIntent.expectedAmount || paymentIntent.amount;
      expect(amount).toBeLessThan(9);

      const mockTxId = `DEV_PERA_TX_${Date.now()}`;

      // 2. Verify payment
      const verifyRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          intentId,
          transactionId: mockTxId,
          walletAddress: testWallet
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      const receiptNumber = verifyRes.body.transaction?.receiptNumber;
      expect(receiptNumber).toMatch(/^EV-\d{4}-[A-Z0-9]+$/);
      expect(verifyRes.body.attemptsUnlocked).toBeGreaterThan(0);

      const receiptId = receiptNumber;

      // 3. Download official payment receipt PDF
      const receiptPdfRes = await request(app)
        .get(`/api/payments/receipt/${receiptId}/pdf`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(receiptPdfRes.status).toBe(200);
      expect(receiptPdfRes.headers['content-type']).toContain('application/pdf');
      expect(receiptPdfRes.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('rejects issuing receipt for unverified or pending transactions', async () => {
      const fakeUnverifiedTx = await PaymentTransaction.create({
        userId: new mongoose.Types.ObjectId(studentUserId),
        planId: 'trial',
        transactionId: `AUDIT_UNVERIFIED_${Date.now()}`,
        amount: 3,
        amountMicroAlgos: 3_000_000,
        currency: 'ALGO',
        attemptsUnlocked: 25,
        status: 'pending',
        walletAddress: testWallet,
        receiverAddress: treasuryWallet
      });

      const res = await request(app)
        .get(`/api/payments/receipt/${fakeUnverifiedTx._id}/pdf`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAYMENT_NOT_VERIFIED');
    });
  });

  // ===========================================================================
  // 5. ORGANIZATION & FORMAL ASSESSMENT AUDIT
  // ===========================================================================
  describe('5. Organization Multi-Tenancy & Assessment Audit', () => {
    it('registers an institutional workspace and creates an assessment', async () => {
      const regRes = await request(app)
        .post('/api/auth/register-college')
        .send({
          collegeName: 'Audit Technological University',
          collegeCode: 'AUDITCOL',
          contactEmail: 'audit.college@evalora.io',
          adminName: 'Dean of Computing',
          adminPassword: 'Password@123!'
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      collegeId = regRes.body.college._id;

      // Login as college admin
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'audit.college@evalora.io',
          password: 'Password@123!'
        });

      expect(loginRes.status).toBe(200);
      collegeAdminToken = loginRes.body.token;

      // Create assessment with valid section, dates, and totalMarks
      const sampleQ = await Question.findOne({ category: 'DSA' });
      const createAssRes = await request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${collegeAdminToken}`)
        .send({
          title: 'Audit Assessment — Midterm Algorithms',
          description: 'Official departmental evaluation',
          durationMinutes: 45,
          totalMarks: 10,
          passPercentage: 50,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sections: [
            {
              id: 'sec-dsa',
              name: 'Core DSA',
              type: 'technical',
              questionIds: [sampleQ?._id || new mongoose.Types.ObjectId()],
              marksPerQuestion: 10,
              totalMarks: 10
            }
          ]
        });

      expect(createAssRes.status).toBe(201);
      expect(createAssRes.body.success).toBe(true);
      expect(createAssRes.body.assessment.title).toBe('Audit Assessment — Midterm Algorithms');
    });
  });

  // ===========================================================================
  // 6. PLATFORM ADMINISTRATOR AUDIT
  // ===========================================================================
  describe('6. Platform Administrator Security & Controls Audit', () => {
    it('authenticates authorized platform administrator and enforces server-side RBAC', async () => {
      // Ensure admin exists
      const adminEmail = 'audit.admin@evalora.io';
      let admin = await User.findOne({ email: adminEmail });
      if (!admin) {
        admin = await User.create({
          name: 'Platform Auditor',
          email: adminEmail,
          role: 'admin',
          emailVerified: true
        });
      }

      // Request OTP
      const reqRes = await request(app)
        .post('/api/auth/otp/request')
        .send({ email: adminEmail, purpose: 'login' });

      expect(reqRes.status).toBe(200);

      const adminLoginRes = await request(app)
        .post('/api/auth/otp/login')
        .send({
          email: adminEmail,
          code: capturedOtp
        });

      expect(adminLoginRes.status).toBe(200);
      platformAdminToken = adminLoginRes.body.token;

      // Platform admin can access /api/admin/overview
      const overviewRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.success).toBe(true);
      expect(overviewRes.body.metrics.users.total).toBeGreaterThanOrEqual(1);

      // Normal student is strictly blocked with 403 Forbidden
      const studentBlockedRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentBlockedRes.status).toBe(403);
      expect(studentBlockedRes.body.message).toContain('Administrator privileges required');
    });
  });
});
