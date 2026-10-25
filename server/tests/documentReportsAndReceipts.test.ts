import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { ENV } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { PracticeSession } from '../src/models/PracticeSession.js';
import { Question } from '../src/models/Question.js';
import { PaymentTransaction } from '../src/models/PaymentTransaction.js';
import { PaymentIntent } from '../src/models/PaymentIntent.js';

describe('Evalora — Downloadable Performance Reports & Payment Receipts Subsystem', () => {
  let studentAId: string;
  let studentAToken: string;
  let studentBId: string;
  let studentBToken: string;
  let adminId: string;
  let adminToken: string;

  let practiceSessionId: string;
  let questionIds: mongoose.Types.ObjectId[] = [];
  let verifiedTxId: string;
  let pendingTxId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    // 1. Create Student A
    const studentA = await User.create({
      name: 'Ananya Sharma',
      email: `ananya.report.${Date.now()}@evalora.io`,
      role: 'student',
      status: 'active',
      walletAddress: 'GD6NO5MG2GZ6O7AO7Q3Q4W6MZYMFRQ3X66D5Y4M6J5D6V7M4G5H6J7K8L9'
    });
    studentAId = studentA._id.toString();
    studentAToken = jwt.sign({ userId: studentAId, role: 'student', tokenVersion: 0 }, ENV.JWT_SECRET, {
      expiresIn: '2h'
    });

    // 2. Create Student B (adversary / other student)
    const studentB = await User.create({
      name: 'Rohan Mehta',
      email: `rohan.report.${Date.now()}@evalora.io`,
      role: 'student',
      status: 'active'
    });
    studentBId = studentB._id.toString();
    studentBToken = jwt.sign({ userId: studentBId, role: 'student', tokenVersion: 0 }, ENV.JWT_SECRET, {
      expiresIn: '2h'
    });

    // 3. Create Platform Admin
    const adminUser = await User.create({
      name: 'Super Admin',
      email: `admin.report.${Date.now()}@evalora.io`,
      role: 'platform_admin',
      status: 'active'
    });
    adminId = adminUser._id.toString();
    adminToken = jwt.sign({ userId: adminId, role: 'platform_admin', tokenVersion: 0 }, ENV.JWT_SECRET, {
      expiresIn: '2h'
    });

    // 4. Create sample questions for practice session
    const q1 = await Question.create({
      title: 'Array Two Sum Problem',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      category: 'DSA',
      topic: 'Arrays',
      subtopic: 'Hash Maps',
      difficulty: 'medium',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'O(N) with Hash Map', isCorrect: true },
        { id: 'opt_2', text: 'O(N^3) Brute Force', isCorrect: false },
        { id: 'opt_3', text: 'O(1) Direct Lookup', isCorrect: false },
        { id: 'opt_4', text: 'O(N!) Permutations', isCorrect: false }
      ],
      explanation: 'Using a hash table to store complementary values achieves O(N) linear time complexity.'
    });

    const q2 = await Question.create({
      title: 'Train Platform Minimum Count',
      description: 'Find minimum number of platforms required so that no train waits at a railway station.',
      category: 'DSA',
      topic: 'Arrays',
      subtopic: 'Intervals',
      difficulty: 'hard',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'Greedy Interval Scheduling', isCorrect: true },
        { id: 'opt_2', text: 'Random Walk', isCorrect: false },
        { id: 'opt_3', text: 'Floyd Warshall', isCorrect: false },
        { id: 'opt_4', text: 'Dijkstra', isCorrect: false }
      ],
      explanation: 'Sort arrival and departure times separately and maintain concurrent active train count.'
    });

    const q3 = await Question.create({
      title: 'Discount and Profit Percentage',
      description: 'Calculate net profit percentage after applying a successive 20% and 10% discount on marked price.',
      category: 'Aptitude',
      topic: 'Percentages',
      subtopic: 'Successive Discounts',
      difficulty: 'easy',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: '28% Discount', isCorrect: true },
        { id: 'opt_2', text: '30% Discount', isCorrect: false },
        { id: 'opt_3', text: '25% Discount', isCorrect: false },
        { id: 'opt_4', text: '18% Discount', isCorrect: false }
      ],
      explanation: 'Net multiplier is 0.8 * 0.9 = 0.72, giving a 28% total discount.'
    });

    questionIds = [q1._id, q2._id, q3._id];

    // 5. Create completed practice session for Student A:
    // q1: answered correctly
    // q2: answered incorrectly
    // q3: unanswered
    const session = await PracticeSession.create({
      studentId: studentA._id,
      topic: 'DSA & Quantitative Aptitude',
      difficulty: 'mixed',
      questionCount: 3,
      totalQuestions: 3,
      type: 'mixed',
      questionIds,
      answers: [
        {
          questionId: q1._id,
          selectedOptionIds: ['opt_1'],
          isCorrect: true,
          timeSpentSeconds: 45
        },
        {
          questionId: q2._id,
          selectedOptionIds: ['opt_2'], // incorrect choice
          isCorrect: false,
          timeSpentSeconds: 70
        }
      ],
      score: 1,
      correctCount: 1,
      accuracyPercentage: 33,
      timeTakenSeconds: 115,
      completedAt: new Date(),
      status: 'completed'
    });
    practiceSessionId = session._id.toString();

    // 6. Create Payment Intent & Verified Transaction for Student A
    const intentId = `PI_TEST_${Date.now()}`;
    await PaymentIntent.create({
      intentId,
      userId: studentA._id,
      planId: 'pro',
      planName: 'Pro Tier Package',
      expectedAmountAlgo: 4,
      expectedAmountMicroAlgos: 4_000_000,
      currency: 'ALGO',
      expectedReceiver: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      paidAttemptsToUnlock: 10,
      status: 'completed',
      transactionId: `TX_ALGO_VERIFIED_${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000)
    });

    const verifiedTx = await PaymentTransaction.create({
      userId: studentA._id,
      walletAddress: 'GD6NO5MG2GZ6O7AO7Q3Q4W6MZYMFRQ3X66D5Y4M6J5D6V7M4G5H6J7K8L9',
      transactionId: `TX_ALGO_VERIFIED_${Date.now()}`,
      amount: 4,
      amountMicroAlgos: 4_000_000,
      currency: 'ALGO',
      purpose: 'PRACTICE_ATTEMPTS',
      planId: 'pro',
      paymentIntentId: intentId,
      receiverAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      network: 'testnet',
      blockchainRound: 42890123,
      attemptsUnlocked: 10,
      status: 'verified',
      receiptNumber: 'EV-2026-TEST01',
      verifiedAt: new Date()
    });
    verifiedTxId = verifiedTx.transactionId;

    // 7. Create Pending Transaction for Student A (unverified)
    const pendingTx = await PaymentTransaction.create({
      userId: studentA._id,
      walletAddress: 'GD6NO5MG2GZ6O7AO7Q3Q4W6MZYMFRQ3X66D5Y4M6J5D6V7M4G5H6J7K8L9',
      transactionId: `TX_ALGO_PENDING_${Date.now()}`,
      amount: 2,
      amountMicroAlgos: 2_000_000,
      currency: 'ALGO',
      purpose: 'PRACTICE_ATTEMPTS',
      planId: 'starter',
      receiverAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      network: 'testnet',
      status: 'pending',
      attemptsUnlocked: 0
    });
    pendingTxId = pendingTx.transactionId;
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: { $in: [studentAId, studentBId, adminId].filter(Boolean).map(id => new mongoose.Types.ObjectId(id)) }
    });
    if (practiceSessionId) {
      await PracticeSession.findByIdAndDelete(practiceSessionId);
    }
    if (questionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: questionIds } });
    }
    await PaymentTransaction.deleteMany({
      transactionId: { $in: [verifiedTxId, pendingTxId].filter(Boolean) }
    });
  });

  // =========================================================================
  // 1. PERFORMANCE ANALYSIS REPORT TESTS
  // =========================================================================
  describe('1. Performance Analysis Report', () => {
    it('enforces authentication and owner-only authorization on performance report data', async () => {
      // Unauthenticated
      const unauthRes = await request(app).get(`/api/practice/${practiceSessionId}/report/data`);
      expect(unauthRes.status).toBe(401);

      // Student B (different student attempting to access Student A report) -> 403 Forbidden
      const forbiddenRes = await request(app)
        .get(`/api/practice/${practiceSessionId}/report/data`)
        .set('Authorization', `Bearer ${studentBToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.code).toBe('FORBIDDEN');

      // Invalid ID format -> 400 Bad Request
      const invalidRes = await request(app)
        .get('/api/practice/invalid-id-123/report/data')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.code).toBe('INVALID_ID');
    });

    it('compiles accurate data-driven metrics in performance report for session owner', async () => {
      const res = await request(app)
        .get(`/api/practice/${practiceSessionId}/report/data`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const report = res.body.report;
      expect(report.reportId).toMatch(/^EV-REP-/);
      expect(report.user.name).toBe('Ananya Sharma');
      expect(report.summary.totalQuestions).toBe(3);
      expect(report.summary.questionsAttempted).toBe(2);
      expect(report.summary.correctCount).toBe(1);
      expect(report.summary.incorrectCount).toBe(1);
      expect(report.summary.unansweredCount).toBe(1);
      expect(report.summary.accuracyPercentage).toBe(33);
      expect(report.summary.timeFormatted).toBe('1m 55s');

      // Category breakdown
      expect(report.categoryAnalysis.length).toBeGreaterThanOrEqual(2);
      const dsaCat = report.categoryAnalysis.find((c: any) => c.category === 'DSA');
      expect(dsaCat).toBeDefined();
      expect(dsaCat.total).toBe(2);
      expect(dsaCat.correct).toBe(1);
      expect(dsaCat.accuracyPercentage).toBe(50);

      // Topic breakdown
      const arrayTopic = report.topicAnalysis.find((t: any) => t.topic === 'Arrays');
      expect(arrayTopic).toBeDefined();
      expect(arrayTopic.total).toBe(2);
      expect(arrayTopic.correct).toBe(1);

      // Question-level examination
      expect(report.questions.length).toBe(3);
      const q1Report = report.questions.find((q: any) => q.title === 'Array Two Sum Problem');
      expect(q1Report.result).toBe('Correct');
      expect(q1Report.userAnswerText).toBe('O(N) with Hash Map');

      const q2Report = report.questions.find((q: any) => q.title === 'Train Platform Minimum Count');
      expect(q2Report.result).toBe('Incorrect');
      expect(q2Report.userAnswerText).toBe('Random Walk');
      expect(q2Report.correctAnswerText).toBe('Greedy Interval Scheduling');
      expect(q2Report.explanation).toContain('Sort arrival and departure');

      const q3Report = report.questions.find((q: any) => q.title === 'Discount and Profit Percentage');
      expect(q3Report.result).toBe('Unanswered');
      expect(q3Report.correctAnswerText).toBe('28% Discount');

      // Strengths & Weak Areas
      expect(report.areasToImprove.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('allows platform admin to access performance report for academic review', async () => {
      const res = await request(app)
        .get(`/api/practice/${practiceSessionId}/report/data`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.user.name).toBe('Ananya Sharma');
    });

    it('generates and streams professional binary PDF performance report', async () => {
      // Forbidden check for student B
      const forbiddenRes = await request(app)
        .get(`/api/practice/${practiceSessionId}/report/pdf`)
        .set('Authorization', `Bearer ${studentBToken}`);
      expect(forbiddenRes.status).toBe(403);

      // Valid download for student A
      const res = await request(app)
        .get(`/api/practice/${practiceSessionId}/report/pdf`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment;');
      expect(res.headers['content-disposition']).toContain('.pdf');

      // Verify valid PDF magic header (%PDF-)
      const pdfBuffer = Buffer.from(res.body);
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-');
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });
  });

  // =========================================================================
  // 2. PAYMENT RECEIPT TESTS
  // =========================================================================
  describe('2. Professional Payment Receipt', () => {
    it('rejects receipt requests for unverified or pending transactions (400 Bad Request)', async () => {
      const res = await request(app)
        .get(`/api/payments/receipt/${pendingTxId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PAYMENT_NOT_VERIFIED');
    });

    it('enforces authentication and owner-only authorization on payment receipts', async () => {
      // Unauthenticated
      const unauthRes = await request(app).get(`/api/payments/receipt/${verifiedTxId}`);
      expect(unauthRes.status).toBe(401);

      // Student B attempting to access Student A's receipt -> 403 Forbidden
      const forbiddenRes = await request(app)
        .get(`/api/payments/receipt/${verifiedTxId}`)
        .set('Authorization', `Bearer ${studentBToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.code).toBe('FORBIDDEN');
    });

    it('returns structured receipt data with server-assigned receipt number and Algorand audit details', async () => {
      const res = await request(app)
        .get(`/api/payments/receipt/${verifiedTxId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const receipt = res.body.receipt;
      expect(receipt.receiptNumber).toMatch(/^EV-2026-/);
      expect(receipt.status).toBe('VERIFIED');
      expect(receipt.customer.name).toBe('Ananya Sharma');
      expect(receipt.customer.walletAddress).toContain('GD6NO5');
      expect(receipt.payment.amountAlgo).toBe(4);
      expect(receipt.payment.currency).toBe('ALGO');
      expect(receipt.payment.paymentMethod).toBe('Pera Wallet');
      expect(receipt.payment.network).toContain('Algorand');
      expect(receipt.transaction.transactionId).toBe(verifiedTxId);
      expect(receipt.transaction.receiver).toBe('WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA');
      expect(receipt.transaction.verificationStatus).toBe('Verified');
    });

    it('allows platform admin to retrieve receipt for financial/compliance inspection', async () => {
      const res = await request(app)
        .get(`/api/payments/receipt/${verifiedTxId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.receipt.customer.name).toBe('Ananya Sharma');
    });

    it('generates and streams professional binary PDF payment receipt', async () => {
      const res = await request(app)
        .get(`/api/payments/receipt/${verifiedTxId}/pdf`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename="Evalora-Payment-Receipt-EV-2026-');
      expect(res.headers['content-disposition']).toContain('.pdf');

      // Verify valid PDF magic header (%PDF-)
      const pdfBuffer = Buffer.from(res.body);
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-');
      expect(pdfBuffer.length).toBeGreaterThan(800);
    });
  });
});
