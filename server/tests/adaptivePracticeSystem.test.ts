import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { User } from '../src/models/User.js';
import { Question } from '../src/models/Question.js';
import { PracticeSession } from '../src/models/PracticeSession.js';
import { PracticeQuestionHistory } from '../src/models/PracticeQuestionHistory.js';
import { StudentSkill } from '../src/models/StudentSkill.js';
import { ScheduledJobLog } from '../src/models/ScheduledJobLog.js';
import { AdaptiveProfile } from '../src/models/AdaptiveProfile.js';
import { adaptiveSchedulerService, SCHEDULER_INTERVAL_MS } from '../src/services/adaptiveSchedulerService.js';
import { adaptiveRecommendationService } from '../src/services/adaptiveRecommendationService.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';

describe('Evalora — AI-Powered Adaptive Practice System & 48-Hour Scheduler', () => {
  let studentToken: string;
  let studentId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/evalora');
    }

    // 1. Setup Student User
    const studentEmail = `adaptive_student_${Date.now()}@evalora.test`;
    const studentUser = await User.create({
      name: 'Adaptive Learner',
      email: studentEmail,
      role: 'student',
      status: 'active',
      emailVerified: true,
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 5, used: 0 }
    });
    studentId = studentUser._id.toString();
    studentToken = jwt.sign(
      { userId: studentId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Setup Admin User
    const adminEmail = `adaptive_admin_${Date.now()}@evalora.test`;
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: adminEmail,
      role: 'platform_admin',
      status: 'active',
      emailVerified: true
    });
    adminId = adminUser._id.toString();
    adminToken = jwt.sign(
      { userId: adminId, role: 'platform_admin', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    adaptiveSchedulerService.stop();
    await User.deleteMany({ email: /^adaptive_/ });
    await Question.deleteMany({ tags: 'adaptive-48h' });
    await ScheduledJobLog.deleteMany({});
    await AdaptiveProfile.deleteMany({ userId: { $in: [studentId, adminId] } });
    await PracticeSession.deleteMany({ studentId });
    await PracticeQuestionHistory.deleteMany({ studentId });
    await StudentSkill.deleteMany({ studentId });
  });

  // =========================================================================
  // 1. 48-Hour Automatic Question Generation & Automated Publishing
  // =========================================================================
  describe('1. 48-Hour Automatic Question Generation & Publishing', () => {
    beforeEach(async () => {
      await ScheduledJobLog.deleteMany({});
    });

    it('determines when 48 hours have elapsed using completed job history', async () => {
      // With no completed runs, shouldRunCycle() must be true
      expect(await adaptiveSchedulerService.shouldRunCycle()).toBe(true);

      // Create a completed run from 10 hours ago
      await ScheduledJobLog.create({
        jobType: '48h_adaptive_question_generation',
        status: 'completed',
        startedAt: new Date(Date.now() - 10 * 3600 * 1000),
        completedAt: new Date(Date.now() - 10 * 3600 * 1000),
        lockUntil: new Date(),
        questionsGenerated: 10,
        questionsValidated: 10
      });

      // 10 hours < 48 hours -> should not run
      expect(await adaptiveSchedulerService.shouldRunCycle()).toBe(false);

      // Update to 49 hours ago -> should run
      await ScheduledJobLog.updateOne(
        {},
        {
          completedAt: new Date(Date.now() - 49 * 3600 * 1000)
        }
      );
      expect(await adaptiveSchedulerService.shouldRunCycle()).toBe(true);
    });

    it('automatically generates, validates, and publishes questions WITHOUT admin approval', async () => {
      const initialValidatedCount = await Question.countDocuments({
        validationStatus: 'validated',
        status: 'verified'
      });

      // Execute 48-hour cycle for DSA and MERN domains
      const result = await adaptiveSchedulerService.execute48HourCycle({
        force: true,
        triggerType: 'manual_admin',
        domains: ['dsa', 'mern-stack']
      });

      expect(result.success).toBe(true);
      expect(result.questionsValidated).toBeGreaterThan(0);
      expect(result.jobId).toBeDefined();

      // Check job record in database
      const job = await ScheduledJobLog.findById(result.jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('completed');
      expect(job!.domainsCovered).toContain('dsa');
      expect(job!.domainsCovered).toContain('mern-stack');

      // Verify questions in DB have validationStatus: validated, status: verified (published)
      const freshQuestions = await Question.find({ tags: 'adaptive-48h' });
      expect(freshQuestions.length).toBeGreaterThanOrEqual(result.questionsValidated);

      freshQuestions.forEach(q => {
        expect(q.validationStatus).toBe('validated');
        expect(q.status).toBe('verified'); // Published without admin approval
        expect(q.createdBy).toBe('ai');
        expect(q.normalizedHash).toBeDefined();
        expect(q.options?.length || q.codingDetails).toBeDefined();
      });

      const newValidatedCount = await Question.countDocuments({
        validationStatus: 'validated',
        status: 'verified'
      });
      expect(newValidatedCount).toBeGreaterThan(initialValidatedCount);
    });

    it('rejects duplicate questions and prevents concurrent job executions', async () => {
      // 1. Duplicate Rejection: running the same cycle again increments duplicates counter
      const rerun = await adaptiveSchedulerService.execute48HourCycle({
        force: true,
        triggerType: 'manual_admin',
        domains: ['dsa', 'mern-stack']
      });

      expect(rerun.success).toBe(true);
      const rerunJob = await ScheduledJobLog.findById(rerun.jobId);
      expect(rerunJob!.questionsDuplicated).toBeGreaterThan(0);

      // 2. Concurrency Lock: simulate a job currently running with valid lockUntil
      await ScheduledJobLog.create({
        jobType: '48h_adaptive_question_generation',
        status: 'running',
        startedAt: new Date(),
        lockUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 min
        triggerType: 'scheduled_48h'
      });

      const concurrentAttempt = await adaptiveSchedulerService.execute48HourCycle({
        force: true
      });

      expect(concurrentAttempt.success).toBe(false);
      expect(concurrentAttempt.message).toContain('Could not acquire lock');
    });

    it('allows admin to inspect 48-hour scheduler job history via API', async () => {
      await adaptiveSchedulerService.execute48HourCycle({
        force: true,
        triggerType: 'manual_admin',
        domains: ['dsa']
      });

      const res = await request(app)
        .get('/api/adaptive/jobs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.history.length).toBeGreaterThan(0);
      expect(res.body.latestJob).toBeDefined();
      expect(res.body.latestJob.jobType).toBe('48h_adaptive_question_generation');
    });
  });

  // =========================================================================
  // 2. Personalized Question Recommendations & Domain Scope
  // =========================================================================
  describe('2. Personalized Recommendations & Domain Scoping', () => {
    it('returns personalized recommendations matching user selected domains', async () => {
      // Set user preference to DSA only
      await request(app)
        .put('/api/adaptive/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedDomains: ['dsa'],
          preferredDifficulty: 'adaptive'
        });

      const res = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.adaptiveProfile).toBeDefined();
      expect(res.body.adaptiveProfile.selectedDomains).toEqual(['dsa']);
      expect(Array.isArray(res.body.recommendations)).toBe(true);

      // Recommendations must contain domain/topic, difficulty, reason, and fresh flag
      res.body.recommendations.forEach((rec: any) => {
        expect(rec.questionId).toBeDefined();
        expect(rec.topic).toBeDefined();
        expect(rec.difficulty).toBeDefined();
        expect(rec.reason).toBeDefined();
        expect(typeof rec.isFresh).toBe('boolean');
      });
    });

    it('excludes previously attempted questions from personalized recommendations', async () => {
      const recRes = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      const firstRec = recRes.body.recommendations[0];
      expect(firstRec).toBeDefined();

      // Record question as attempted in PracticeQuestionHistory
      await PracticeQuestionHistory.create({
        studentId: new mongoose.Types.ObjectId(studentId),
        questionId: new mongoose.Types.ObjectId(firstRec.questionId),
        topic: firstRec.topic,
        subtopic: firstRec.subtopic || 'General',
        difficulty: firstRec.difficulty,
        wasCorrect: true,
        timeSpentSeconds: 45
      });

      // Re-fetch recommendations -> attempted question must NOT appear
      const freshRecRes = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      const exists = freshRecRes.body.recommendations.some(
        (r: any) => r.questionId === firstRec.questionId
      );
      expect(exists).toBe(false);
    });
  });

  // =========================================================================
  // 3. Adaptive Difficulty Algorithm (Consistently Strong vs Declining)
  // =========================================================================
  describe('3. Adaptive Difficulty Algorithm Scaling', () => {
    beforeEach(async () => {
      await PracticeSession.deleteMany({ studentId });
      await AdaptiveProfile.deleteMany({ userId: studentId });
    });

    it('promotes difficulty by 1 level when user shows consistently strong performance (>= 80%)', async () => {
      // Initialize at Easy difficulty
      await AdaptiveProfile.create({
        userId: new mongoose.Types.ObjectId(studentId),
        currentAdaptiveDifficulty: 'easy',
        preferredDifficulty: 'adaptive',
        strictDifficulty: false
      });

      // Record 2 consecutive sessions with 90% and 85% accuracy
      await PracticeSession.create([
        {
          studentId: new mongoose.Types.ObjectId(studentId),
          topic: 'Arrays',
          difficulty: 'easy',
          questionCount: 5,
          type: 'mcq',
          questionIds: [],
          answers: [],
          score: 90,
          accuracyPercentage: 90,
          totalQuestions: 5,
          correctCount: 4,
          timeTakenSeconds: 120,
          status: 'completed',
          completedAt: new Date(Date.now() - 3600 * 1000)
        },
        {
          studentId: new mongoose.Types.ObjectId(studentId),
          topic: 'Strings',
          difficulty: 'easy',
          questionCount: 5,
          type: 'mcq',
          questionIds: [],
          answers: [],
          score: 85,
          accuracyPercentage: 85,
          totalQuestions: 5,
          correctCount: 4,
          timeTakenSeconds: 110,
          status: 'completed',
          completedAt: new Date()
        }
      ]);

      const res = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.adaptiveProfile.statusLabel).toBe('Improving');
      expect(res.body.adaptiveProfile.performanceTrend).toBe('improving');
      // Transition from Easy -> Medium (1 step at a time)
      expect(res.body.adaptiveProfile.currentDifficulty).toBe('medium');
      expect(res.body.adaptiveProfile.statusReason).toContain('Advanced from Easy to Medium');
    });

    it('eases difficulty by 1 level when performance is declining (< 50%)', async () => {
      // Initialize at Hard difficulty
      await AdaptiveProfile.create({
        userId: new mongoose.Types.ObjectId(studentId),
        currentAdaptiveDifficulty: 'hard',
        preferredDifficulty: 'adaptive',
        strictDifficulty: false
      });

      // Record 2 consecutive sessions with 30% and 40% accuracy
      await PracticeSession.create([
        {
          studentId: new mongoose.Types.ObjectId(studentId),
          topic: 'Dynamic Programming',
          difficulty: 'hard',
          questionCount: 5,
          type: 'mcq',
          questionIds: [],
          answers: [],
          score: 30,
          accuracyPercentage: 30,
          totalQuestions: 5,
          correctCount: 1,
          timeTakenSeconds: 300,
          status: 'completed',
          completedAt: new Date(Date.now() - 3600 * 1000)
        },
        {
          studentId: new mongoose.Types.ObjectId(studentId),
          topic: 'Graphs',
          difficulty: 'hard',
          questionCount: 5,
          type: 'mcq',
          questionIds: [],
          answers: [],
          score: 40,
          accuracyPercentage: 40,
          totalQuestions: 5,
          correctCount: 2,
          timeTakenSeconds: 280,
          status: 'completed',
          completedAt: new Date()
        }
      ]);

      const res = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.adaptiveProfile.statusLabel).toBe('Review Weak Topics');
      expect(res.body.adaptiveProfile.performanceTrend).toBe('declining');
      // Transition from Hard -> Medium (1 step at a time)
      expect(res.body.adaptiveProfile.currentDifficulty).toBe('medium');
      expect(res.body.adaptiveProfile.statusReason).toContain('Eased to Medium tier');
    });

    it('strictly respects user locked difficulty when strictDifficulty is enabled', async () => {
      // User locks difficulty to 'hard' with strictDifficulty: true
      await request(app)
        .put('/api/adaptive/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          preferredDifficulty: 'hard',
          strictDifficulty: true
        });

      // User performs poorly (20% accuracy)
      await PracticeSession.create({
        studentId: new mongoose.Types.ObjectId(studentId),
        topic: 'Recursion',
        difficulty: 'hard',
        questionCount: 5,
        type: 'mcq',
        questionIds: [],
        answers: [],
        score: 20,
        accuracyPercentage: 20,
        totalQuestions: 5,
        correctCount: 1,
        timeTakenSeconds: 250,
        status: 'completed',
        completedAt: new Date()
      });

      const res = await request(app)
        .get('/api/adaptive/recommendations')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      // Difficulty MUST remain 'hard' because strictDifficulty was locked!
      expect(res.body.adaptiveProfile.currentDifficulty).toBe('hard');
      expect(res.body.adaptiveProfile.strictDifficulty).toBe(true);
      expect(res.body.adaptiveProfile.statusReason).toContain('Difficulty locked at HARD');
    });
  });

  // =========================================================================
  // 4. Session Persistence & Resumption Across Refreshes
  // =========================================================================
  describe('4. Session Persistence & Resumption Without Question Regeneration', () => {
    it('creates an adaptive session and restores the EXACT same session on refresh', async () => {
      await PracticeSession.deleteMany({ studentId });

      // 1. Start adaptive practice session
      const startRes = await request(app)
        .post('/api/adaptive/start-session')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ count: 5 });

      expect(startRes.status).toBe(201);
      expect(startRes.body.success).toBe(true);
      expect(startRes.body.resumed).toBe(false);
      expect(startRes.body.session._id).toBeDefined();

      const createdSessionId = startRes.body.session._id;
      const initialQuestionIds = startRes.body.session.questionIds;

      // 2. User refreshes page or triggers start-session again while session is active
      const refreshRes = await request(app)
        .post('/api/adaptive/start-session')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ count: 5 });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.resumed).toBe(true); // Resumed existing session!
      expect(refreshRes.body.session._id).toBe(createdSessionId); // Same session ID!
      expect(refreshRes.body.session.questionIds).toEqual(initialQuestionIds); // Identical questions restored!

      // 3. User quota was NOT deducted a second time on resume
      const user = await User.findById(studentId);
      expect(user?.freeAttempts.used).toBe(1); // Exactly 1 attempt used, not 2!
    });
  });
});
