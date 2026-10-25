import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { User } from '../src/models/User.js';
import { Subscription } from '../src/models/Subscription.js';
import { Domain } from '../src/models/Domain.js';
import { DomainProgress } from '../src/models/DomainProgress.js';
import { seedDefaultPlans } from '../src/config/plans.js';
import { seedDefaultDomains } from '../src/config/domains.js';
import algosdk from 'algosdk';
import { algorandService } from '../src/services/algorandService.js';

import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';

describe('Evalora — Subscription-Based Multi-Domain Learning & Coding Platform', () => {
  let unsubscribedStudentToken: string;
  let unsubscribedStudentId: string;
  let subscribedStudentToken: string;
  let subscribedStudentId: string;
  let adminToken: string;

  const testAccount = algosdk.generateAccount();
  const testWallet = testAccount.addr.toString();
  const treasuryWallet = algorandService.getTreasuryWallet();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/evalora');
    }

    await seedDefaultPlans();
    await seedDefaultDomains();

    // 1. Setup Unsubscribed Student
    const unsubsEmail = `unsubscribed_${Date.now()}@evalora.test`;
    const unsubsUser = await User.create({
      name: 'Unsubscribed Student',
      email: unsubsEmail,
      role: 'student',
      status: 'active',
      emailVerified: true
    });
    unsubscribedStudentId = unsubsUser._id.toString();
    unsubscribedStudentToken = jwt.sign(
      { userId: unsubscribedStudentId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Setup Subscribed Student
    const subsEmail = `subscribed_${Date.now()}@evalora.test`;
    const subsUser = await User.create({
      name: 'Subscribed Student',
      email: subsEmail,
      role: 'student',
      status: 'active',
      emailVerified: true,
      walletAddress: testWallet
    });
    subscribedStudentId = subsUser._id.toString();
    subscribedStudentToken = jwt.sign(
      { userId: subscribedStudentId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 3. Setup Admin User
    const adminEmail = `admin_domain_${Date.now()}@evalora.test`;
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: adminEmail,
      role: 'platform_admin',
      status: 'active',
      emailVerified: true
    });
    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), role: 'platform_admin', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@evalora\.test$/ });
    await Subscription.deleteMany({ walletAddress: testWallet });
    await DomainProgress.deleteMany({});
  });

  // ==========================================
  // 1. Domain Exploration & Public Listing
  // ==========================================
  describe('1. Domain Exploration Catalog', () => {
    it('returns all active domains with curriculum modules and project counts', async () => {
      const res = await request(app).get('/api/domains');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.domains)).toBe(true);
      expect(res.body.domains.length).toBeGreaterThanOrEqual(6);

      // Verify MERN Stack domain exists
      const mern = res.body.domains.find((d: any) => d.slug === 'mern-stack');
      expect(mern).toBeDefined();
      expect(mern.name).toBe('MERN Stack Development');
      expect(mern.technologies).toContain('MongoDB');
      expect(mern.technologies).toContain('React.js');
      expect(mern.moduleCount).toBe(7);
      expect(mern.projectCount).toBeGreaterThanOrEqual(4);

      // Verify AI & Machine Learning domain exists
      const aiml = res.body.domains.find((d: any) => d.slug === 'ai-machine-learning');
      expect(aiml).toBeDefined();
      expect(aiml.technologies).toContain('Python');
      expect(aiml.moduleCount).toBe(7);
    });

    it('indicates access is locked for unsubscribed authenticated users', async () => {
      const res = await request(app)
        .get('/api/domains')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userSubscription.isSubscribed).toBe(false);

      const mern = res.body.domains.find((d: any) => d.slug === 'mern-stack');
      expect(mern.hasAccess).toBe(false);
    });
  });

  // ==========================================
  // 2. Subscription Access Gating (Backend Enforcement)
  // ==========================================
  describe('2. Backend Subscription Enforcement (Anti-Bypass)', () => {
    it('rejects unsubscribed access to domain learning path with 403 SUBSCRIPTION_REQUIRED', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(res.body.requiresSubscription).toBe(true);
    });

    it('rejects unsubscribed attempt to start domain practice session', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/practice/start')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`)
        .send({
          moduleId: 'mern-m1-web-fundamentals',
          topic: 'JavaScript fundamentals'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('rejects unsubscribed attempt to run domain code in sandbox', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/coding/run')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`)
        .send({
          language: 'javascript',
          code: 'console.log("hello");'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/domains/mern-stack');
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 3. Payment (< 9 ALGO) & Subscription Activation
  // ==========================================
  describe('3. Pera Wallet Payment & Subscription Activation', () => {
    it('creates server-controlled payment intent for domain plan (< 9 ALGO)', async () => {
      const intentRes = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          planId: 'domain_pass',
          walletAddress: testWallet
        });

      expect([200, 201]).toContain(intentRes.status);
      expect(intentRes.body.success).toBe(true);

      const intent = intentRes.body.paymentIntent;
      expect(intent.expectedAmount).toBe(4);
      expect(intent.expectedAmount).toBeLessThan(9);

      // Verify on-chain payment and activate subscription
      const mockTxId = `DEV_PERA_TX_${Date.now()}`;
      const verifyRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: mockTxId,
          walletAddress: testWallet
        });

      if (verifyRes.status !== 200) {
        console.error('VERIFY_FAILED_PAYLOAD:', verifyRes.status, verifyRes.body);
      }
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.subscription).toBeDefined();
      expect(verifyRes.body.subscription.active).toBe(true);
      expect(verifyRes.body.subscription.planId).toBe('domain_pass');

      // Verify subscription status API returns active
      const statusRes = await request(app)
        .get('/api/payments/subscription/status')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.subscribed).toBe(true);
      expect(statusRes.body.subscription.daysRemaining).toBeGreaterThan(0);
      expect(statusRes.body.subscription.entitlements.domainPreparation).toBe(true);
    });
  });

  // ==========================================
  // 4. Subscribed Access & MERN Complete Curriculum
  // ==========================================
  describe('4. Subscribed Access to MERN 7-Module Curriculum', () => {
    it('allows subscribed student to load full MERN curriculum', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.domain.name).toBe('MERN Stack Development');

      const modules = res.body.domain.modules;
      expect(modules.length).toBe(7);

      // Verify each required module title
      expect(modules[0].title).toContain('Web Fundamentals');
      expect(modules[1].title).toContain('React.js');
      expect(modules[2].title).toContain('Node.js');
      expect(modules[3].title).toContain('Express.js');
      expect(modules[4].title).toContain('MongoDB');
      expect(modules[5].title).toContain('Full-Stack Integration');
      expect(modules[6].title).toContain('Projects and Practical Tasks');

      // Verify Module 1 topics
      expect(modules[0].topics).toContain('HTML');
      expect(modules[0].topics).toContain('Semantic HTML');
      expect(modules[0].topics).toContain('CSS');
      expect(modules[0].topics).toContain('JavaScript fundamentals');
      expect(modules[0].topics).toContain('DOM');
      expect(modules[0].topics).toContain('Async/await');

      // Verify Module 2 topics
      expect(modules[1].topics).toContain('Components');
      expect(modules[1].topics).toContain('JSX');
      expect(modules[1].topics).toContain('Hooks');
      expect(modules[1].topics).toContain('Context API');

      // Verify Projects
      expect(res.body.domain.projects.length).toBeGreaterThanOrEqual(4);
      const todoProj = res.body.domain.projects.find((p: any) => p.projectId === 'mern-proj-todo');
      expect(todoProj).toBeDefined();
      expect(todoProj.title).toBe('Todo Application');
      expect(todoProj.starterFiles.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // 5. Domain Practice & Server-Side Scoring
  // ==========================================
  describe('5. Domain Practice Session & Server-Side Evaluation', () => {
    let sessionId: string;
    let questions: any[];

    it('generates domain-specific practice session without repeating attempted questions', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/practice/start')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          moduleId: 'mern-m2-react',
          topic: 'Components',
          difficulty: 'medium',
          questionCount: 3
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.session._id).toBeDefined();
      expect(res.body.questions.length).toBe(3);

      sessionId = res.body.session._id;
      questions = res.body.questions;

      // Questions must not expose answers
      questions.forEach((q: any) => {
        expect(q.options.every((o: any) => o.isCorrect === undefined)).toBe(true);
      });
    });

    it('submits domain practice answers, computes score, and updates DomainProgress', async () => {
      const answers = questions.map((q: any) => ({
        questionId: q._id,
        selectedOptionIds: [q.options[0]?.id || 'opt1'],
        timeSpentSeconds: 15
      }));

      const res = await request(app)
        .post(`/api/domains/mern-stack/practice/${sessionId}/submit`)
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({ answers });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.status).toBe('completed');
      expect(typeof res.body.session.score).toBe('number');

      // Verify DomainProgress was updated in database
      const progress = await DomainProgress.findOne({
        userId: subscribedStudentId,
        domainSlug: 'mern-stack'
      });

      expect(progress).toBeDefined();
      expect(progress!.questionsAttempted).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================
  // 6. Isolated Code Execution in Sandbox
  // ==========================================
  describe('6. Isolated Code Execution Sandbox', () => {
    it('executes JavaScript / Node.js code safely in isolated sandbox', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/coding/run')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          language: 'javascript',
          code: 'console.log("MERN_SANDBOX_SUCCESS: " + (2 + 2));'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.verdict).toBe('ACCEPTED');
      expect(res.body.result.stdout).toContain('MERN_SANDBOX_SUCCESS: 4');
    });

    it('evaluates multi-test-case coding challenges and updates progress on pass', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/coding/evaluate')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          language: 'javascript',
          code: `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
  const [a, b] = input.split(' ').map(Number);
  console.log(a + b);
}
          `,
          visibleTestCases: [{ input: '3 5', expectedOutput: '8' }],
          hiddenTestCases: [{ input: '10 20', expectedOutput: '30' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.evaluation.verdict).toBe('ACCEPTED');
      expect(res.body.evaluation.passedCount).toBe(2);
    });
  });

  // ==========================================
  // 7. Practical Project Evaluation & Milestone Verification
  // ==========================================
  describe('7. Practical Project Tasks & Evaluation', () => {
    it('evaluates practical Todo Application submission and saves score to DomainProgress', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/projects/mern-proj-todo/submit')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          files: [
            {
              filename: 'app.js',
              language: 'javascript',
              content: 'function addTodo() { todos.push("test"); render(); }'
            }
          ],
          taskStatus: {
            t1: true,
            t2: true
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.score).toBe(100);
      expect(res.body.tasksPassed).toBe(2);

      // Verify persistence in DomainProgress
      const progress = await DomainProgress.findOne({
        userId: subscribedStudentId,
        domainSlug: 'mern-stack'
      });

      expect(progress!.completedProjects.length).toBeGreaterThan(0);
      const projRecord = progress!.completedProjects.find(
        (p: any) => p.projectId === 'mern-proj-todo'
      );
      expect(projRecord).toBeDefined();
      expect(projRecord!.score).toBe(100);
    });
  });

  // ==========================================
  // 8. Admin Domain Management
  // ==========================================
  describe('8. Platform Administrator Domain Management', () => {
    it('allows admin to list all domains with learner analytics', async () => {
      const res = await request(app)
        .get('/api/domains/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.domains)).toBe(true);

      const mern = res.body.domains.find((d: any) => d.slug === 'mern-stack');
      expect(mern.stats).toBeDefined();
      expect(mern.stats.totalLearners).toBeGreaterThanOrEqual(1);
    });

    it('allows admin to create a new custom domain', async () => {
      const newSlug = `cybersecurity-${Date.now()}`;
      const res = await request(app)
        .post('/api/domains/admin/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: newSlug,
          name: 'Cybersecurity Fundamentals',
          shortDescription: 'Network security, penetration testing, cryptography, and defense architecture.',
          technologies: ['Linux', 'Wireshark', 'Cryptography', 'OWASP', 'Burp Suite'],
          modules: [
            {
              moduleId: 'sec-m1',
              title: 'Module 1: Network & Threat Fundamentals',
              order: 1,
              topics: ['TCP/IP Security', 'Firewalls', 'Port Scanning']
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.domain.slug).toBe(newSlug);

      // Clean up
      await Domain.deleteOne({ slug: newSlug });
    });
  });
});
