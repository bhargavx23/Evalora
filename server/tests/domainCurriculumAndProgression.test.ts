import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import { ENV } from '../src/config/env.js';
import {
  User,
  Subscription,
  Domain,
  DomainProgress,
  DomainTopicContent,
  DomainAssignment
} from '../src/models/index.js';
import { seedDefaultPlans } from '../src/config/plans.js';
import { seedDefaultDomains } from '../src/config/domains.js';

describe('Evalora — Complete Domain Learning, Adaptive Assessments & Pass-to-Unlock Suite', () => {
  let unsubscribedStudentToken: string;
  let unsubscribedStudentId: string;
  let subscribedStudentToken: string;
  let subscribedStudentId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/evalora');
    }
    await seedDefaultPlans();
    await seedDefaultDomains();

    // 1. Unsubscribed student
    const unsubsEmail = `unsubs_learn_${Date.now()}@evalora.test`;
    const unsubsUser = await User.create({
      name: 'Unsubscribed Candidate',
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

    // 2. Subscribed student
    const subsEmail = `subs_learn_${Date.now()}@evalora.test`;
    const subsUser = await User.create({
      name: 'Subscribed Engineer',
      email: subsEmail,
      role: 'student',
      status: 'active',
      emailVerified: true,
      walletAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA'
    });
    subscribedStudentId = subsUser._id.toString();
    subscribedStudentToken = jwt.sign(
      { userId: subscribedStudentId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Grant active subscription
    await Subscription.create({
      userId: new mongoose.Types.ObjectId(subscribedStudentId),
      planId: 'domain_pass',
      planName: 'Domain Preparation Pass',
      transactionId: `TXID_LEARN_PASS_${Date.now()}`,
      status: 'active',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      pricePaidAlgo: 4,
      currency: 'ALGO',
      walletAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      entitlements: {
        domainPreparation: true,
        allowedDomains: ['*'],
        codeWorkspacesEnabled: true,
        unlimitedDomainPractice: true
      }
    });
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({ email: /_learn_.*@evalora\.test$/ });
    await Subscription.deleteMany({ transactionId: /^TXID_LEARN_PASS_/ });
    await DomainProgress.deleteMany({ userId: { $in: [unsubscribedStudentId, subscribedStudentId] } });
  });

  // =========================================================================
  // 1. Subscription Gating on Learning & Curriculum Routes
  // =========================================================================
  describe('1. Subscription Access Control on Learning Routes', () => {
    it('strictly blocks unsubscribed students from fetching topic content (403 SUBSCRIPTION_REQUIRED)', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/topics/HTML/content')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('strictly blocks unsubscribed students from accessing module assignments (403 SUBSCRIPTION_REQUIRED)', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment')
        .set('Authorization', `Bearer ${unsubscribedStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });
  });

  // =========================================================================
  // 2. Database-Backed Topic Content & Quality Validation
  // =========================================================================
  describe('2. Dynamic Database-Backed Topic Lessons & Exercises', () => {
    it('retrieves or dynamically generates rich topic lessons and stores in MongoDB', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/topics/HTML/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();

      const { content } = res.body;
      expect(content.topic).toBe('HTML');
      expect(content.moduleId).toBe('mern-m1-web-fundamentals');
      expect(content.overview).toBeDefined();
      expect(content.lessons.length).toBeGreaterThan(0);
      expect(content.lessons[0].concept).toBeDefined();
      expect(content.lessons[0].codeExamples.length).toBeGreaterThan(0);
      expect(content.exercises.length).toBeGreaterThan(0);

      // Verify stored in MongoDB collection
      const inDb = await DomainTopicContent.findOne({
        domainSlug: 'mern-stack',
        moduleId: 'mern-m1-web-fundamentals',
        topic: 'HTML'
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.status).toBe('published');
    });

    it('submits a topic exercise and records exercise completion in DomainProgress', async () => {
      // First get topic content to retrieve an exercise ID
      const contentRes = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/topics/HTML/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      const exercise = contentRes.body.content.exercises[0];
      expect(exercise).toBeDefined();

      const subRes = await request(app)
        .post(
          `/api/domains/mern-stack/modules/mern-m1-web-fundamentals/topics/HTML/exercises/${exercise.exerciseId}/submit`
        )
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          selectedOptionId: exercise.options?.[0]?.id || 'opt1',
          code: 'function testSolution() { return true; }'
        });

      expect(subRes.status).toBe(200);
      expect(subRes.body.success).toBe(true);

      // Verify updated in DomainProgress
      const progress = await DomainProgress.findOne({
        userId: new mongoose.Types.ObjectId(subscribedStudentId),
        domainSlug: 'mern-stack'
      });
      expect(progress).not.toBeNull();
      expect(progress?.completedExercises.some(e => e.exerciseId === exercise.exerciseId)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Module Progression & Mandatory Assignment Pass-to-Unlock
  // =========================================================================
  describe('3. Module Gating, Assignment Evaluation & Pass-to-Unlock', () => {
    it('enforces topic completion prerequisite before module assignment unlocks', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assignment).toBeDefined();
      // Since student has not completed all 12 topics of Module 1 yet, assignment must be locked!
      expect(res.body.isLocked).toBe(true);
      expect(res.body.lockReason).toContain('Complete all');
    });

    it('rejects assignment submission if topics in module are incomplete', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment/submit')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          files: [
            {
              filename: 'index.html',
              language: 'html',
              content: '<main><h1>Hello</h1></main>'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('locked');
    });

    it('blocks access to Module 2 learning when Module 1 assignment is not passed (403 MODULE_LOCKED)', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m2-react/topics/Components/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MODULE_LOCKED');
    });

    it('unlocks assignment once all topics are marked complete, evaluates rubric, and enforces passing threshold', async () => {
      // 1. Mark all Module 1 topics as completed in database
      const domain = await Domain.findOne({ slug: 'mern-stack' });
      const mod1Topics = domain?.modules[0].topics || [];

      await DomainProgress.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(subscribedStudentId), domainSlug: 'mern-stack' },
        {
          $addToSet: { completedTopics: { $each: mod1Topics } }
        },
        { upsert: true }
      );

      // Now assignment should be unlocked!
      const assignCheck = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(assignCheck.status).toBe(200);
      expect(assignCheck.body.isLocked).toBe(false);

      // 2. Submit FAILING assignment (score < 70)
      const failRes = await request(app)
        .post('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment/submit')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          files: [
            {
              filename: 'index.html',
              language: 'html',
              content: '<div>Incomplete snippet</div>'
            }
          ]
        });

      expect(failRes.status).toBe(200);
      expect(failRes.body.passed).toBe(false);
      expect(failRes.body.unlockedNextModule).toBe(false);

      // Module 2 must STILL be locked!
      const mod2CheckFail = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m2-react/topics/Components/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);
      expect(mod2CheckFail.status).toBe(403);
      expect(mod2CheckFail.body.code).toBe('MODULE_LOCKED');

      // 3. Submit PASSING assignment with full semantic HTML, CSS Flexbox, and JS event listener
      const passRes = await request(app)
        .post('/api/domains/mern-stack/modules/mern-m1-web-fundamentals/assignment/submit')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          files: [
            {
              filename: 'index.html',
              language: 'html',
              content: '<!DOCTYPE html><html><body><header><nav></nav></header><main><h1>Showcase</h1></main></body></html>'
            },
            {
              filename: 'styles.css',
              language: 'css',
              content: 'body { margin: 0; } .nav { display: flex; justify-content: space-between; }'
            },
            {
              filename: 'app.js',
              language: 'javascript',
              content: 'document.addEventListener("DOMContentLoaded", () => { console.log("Loaded"); });'
            }
          ]
        });

      expect(passRes.status).toBe(200);
      expect(passRes.body.passed).toBe(true);
      expect(passRes.body.score).toBeGreaterThanOrEqual(70);
      expect(passRes.body.unlockedNextModule).toBe(true);
      expect(passRes.body.nextModuleId).toBe('mern-m2-react');

      // 4. Module 2 topic content is NOW unlocked and accessible!
      const mod2Success = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m2-react/topics/Components/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(mod2Success.status).toBe(200);
      expect(mod2Success.body.success).toBe(true);
      expect(mod2Success.body.content.topic).toBe('Components');
    });

    it('strictly blocks direct API progression skips to Module 3 before Module 2 is passed', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/modules/mern-m3-nodejs/topics/Node.js%20Fundamentals/content')
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MODULE_LOCKED');
    });
  });

  // =========================================================================
  // 4. Persistent Coding Workspace Save and Restore
  // =========================================================================
  describe('4. Persistent Coding Workspace Cloud Save & Restore', () => {
    it('persists student workspace drafts and restores them without loss of work', async () => {
      const workspaceKey = `mern-stack_mod1_assignment_${subscribedStudentId}`;
      const sampleFiles = [
        {
          filename: 'index.html',
          language: 'html',
          content: '<h1>My Persistent Draft</h1>'
        },
        {
          filename: 'app.js',
          language: 'javascript',
          content: 'console.log("Persistent state preserved");'
        }
      ];

      // Save draft
      const saveRes = await request(app)
        .post('/api/domains/mern-stack/workspace/save')
        .set('Authorization', `Bearer ${subscribedStudentToken}`)
        .send({
          workspaceKey,
          files: sampleFiles
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);

      // Load draft
      const loadRes = await request(app)
        .get(`/api/domains/mern-stack/workspace/${workspaceKey}`)
        .set('Authorization', `Bearer ${subscribedStudentToken}`);

      expect(loadRes.status).toBe(200);
      expect(loadRes.body.success).toBe(true);
      expect(loadRes.body.files.length).toBe(2);
      expect(loadRes.body.files[0].content).toBe('<h1>My Persistent Draft</h1>');
    });
  });
});
