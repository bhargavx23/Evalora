import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { User, Plan, Subscription, DomainProgress } from '../src/models/index.js';
import { seedDefaultPlans } from '../src/config/plans.js';
import { seedDefaultDomains } from '../src/config/domains.js';

import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';

describe('Evalora — Subscription System, Premium Domain Practice & Entitlements Suite', () => {
  let freeUserToken: string;
  let freeUserId: string;
  let subscribedUserToken: string;
  let subscribedUserId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/evalora');
    }
    await seedDefaultPlans();
    await seedDefaultDomains();

    // 1. Create a clean free student user directly
    const freeEmail = `free_student_subs_${Date.now()}@evalora.test`;
    const freeUser = await User.create({
      name: 'Free Student',
      email: freeEmail,
      role: 'student',
      status: 'active',
      emailVerified: true
    });
    freeUserId = freeUser._id.toString();
    freeUserToken = jwt.sign(
      { userId: freeUserId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Create a clean subscribed student user directly
    const subEmail = `subscribed_student_subs_${Date.now()}@evalora.test`;
    const subUser = await User.create({
      name: 'Subscribed Student',
      email: subEmail,
      role: 'student',
      status: 'active',
      emailVerified: true,
      walletAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA'
    });
    subscribedUserId = subUser._id.toString();
    subscribedUserToken = jwt.sign(
      { userId: subscribedUserId, role: 'student', tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Grant verified subscription to subscribedUser
    await Subscription.create({
      userId: new mongoose.Types.ObjectId(subscribedUserId),
      planId: 'domain_pass',
      planName: 'Domain Preparation Pass',
      transactionId: 'TXID_TEST_VERIFIED_SUBSCRIPTION_PASS_998877',
      paymentIntentId: 'intent_test_998877',
      status: 'active',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pricePaidAlgo: 4,
      currency: 'ALGO',
      walletAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      entitlements: {
        domainPreparation: true,
        allowedDomains: ['*'],
        practiceAttempts: 25,
        unlimitedDomainPractice: true,
        codeWorkspacesEnabled: true
      }
    });

    // Also credit 25 paid attempts to subscribed user
    await User.findByIdAndUpdate(subscribedUserId, {
      $inc: { 'paidAttempts.total': 25 }
    });
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({ email: /_subs@evalora\.test$/ });
    await Subscription.deleteMany({ transactionId: /^TXID_TEST_/ });
  });

  describe('1. Subscription Preview, Pricing & Comparison Verification', () => {
    it('returns all active plans with prices strictly less than 9 ALGO and clear benefits', async () => {
      const res = await request(app).get('/api/payments/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plans).toBeInstanceOf(Array);
      expect(res.body.plans.length).toBeGreaterThanOrEqual(4);

      for (const plan of res.body.plans) {
        expect(plan.priceAlgo).toBeGreaterThan(0);
        expect(plan.priceAlgo).toBeLessThan(9);
        expect(plan.paidAttempts).toBeGreaterThan(0);
        expect(plan.entitlements).toBeDefined();
        expect(typeof plan.entitlements.domainPreparation).toBe('boolean');
        expect(Array.isArray(plan.features)).toBe(true);
      }
    });

    it('distinguishes between practice-only plans and full domain-preparation plans', async () => {
      const res = await request(app).get('/api/payments/plans');
      const starter = res.body.plans.find((p: any) => p.id === 'starter');
      const domainPass = res.body.plans.find((p: any) => p.id === 'domain_pass');
      const pro = res.body.plans.find((p: any) => p.id === 'pro');

      expect(starter).toBeDefined();
      expect(starter.entitlements.domainPreparation).toBe(false);

      expect(domainPass).toBeDefined();
      expect(domainPass.entitlements.domainPreparation).toBe(true);
      expect(domainPass.entitlements.subscriptionDurationDays).toBe(30);

      expect(pro).toBeDefined();
      expect(pro.entitlements.domainPreparation).toBe(true);
      expect(pro.paidAttempts).toBe(75);
    });
  });

  describe('2. Free User Quota & Domain Access Restrictions', () => {
    it('grants 10 free practice attempts to newly registered free users', async () => {
      const userDoc = await User.findById(freeUserId);
      expect(userDoc?.freeAttempts?.total).toBe(10);
      expect(userDoc?.freeAttempts?.used).toBe(0);
    });

    it('allows free users to view technology domain catalog and module syllabuses', async () => {
      const res = await request(app)
        .get('/api/domains')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.domains.length).toBeGreaterThan(0);

      const mern = res.body.domains.find((d: any) => d.slug === 'mern-stack');
      expect(mern).toBeDefined();
      expect(mern.moduleCount).toBe(7);
      expect(mern.hasAccess).toBe(false);
    });

    it('strictly blocks free users from starting domain practice without subscription (403 SUBSCRIPTION_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/practice/start')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          moduleId: 'mern-m1-web-fundamentals',
          topic: 'JavaScript fundamentals'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(res.body.requiresSubscription).toBe(true);
    });

    it('strictly blocks free users from running domain coding workspaces (403 SUBSCRIPTION_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/coding/run')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          code: 'console.log("hello")',
          language: 'javascript'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });
  });

  describe('3. Subscribed User Entitlements & Execution', () => {
    it('allows subscribed user to access domain practice session', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/practice/start')
        .set('Authorization', `Bearer ${subscribedUserToken}`)
        .send({
          moduleId: 'mern-m2-react',
          topic: 'Components',
          difficulty: 'medium',
          questionCount: 2
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.questions).toBeDefined();
    });

    it('allows subscribed user to execute sandboxed Node.js code workspace', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/coding/run')
        .set('Authorization', `Bearer ${subscribedUserToken}`)
        .send({
          code: 'console.log("MERN Workspace Active");',
          language: 'javascript'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.stdout).toContain('MERN Workspace Active');
    });

    it('retains historical progress and completed milestones on user profile', async () => {
      const res = await request(app)
        .get('/api/domains/mern-stack/progress')
        .set('Authorization', `Bearer ${subscribedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.progress).toBeDefined();
    });
  });

  describe('4. Expiration Policy & Duplicate Payment Safety', () => {
    it('enforces expiration by blocking premium operations on expired subscriptions', async () => {
      // Create user with expired subscription
      const expiredUser = await User.create({
        name: 'Expired Student',
        email: `expired_student_subs_${Date.now()}@evalora.test`,
        role: 'student',
        status: 'active',
        emailVerified: true,
        freeAttempts: { total: 10, used: 10 },
        paidAttempts: { total: 25, used: 5 }
      });

      const token = jwt.sign(
        { userId: expiredUser._id.toString(), role: 'student', tokenVersion: 0 },
        ENV.JWT_SECRET,
        { expiresIn: '1d' }
      );

      await Subscription.create({
        userId: expiredUser._id,
        planId: 'domain_pass',
        planName: 'Domain Pass',
        transactionId: 'TXID_TEST_EXPIRED_SUB_112233',
        status: 'expired',
        startDate: new Date(Date.now() - 40 * 24 * 3600 * 1000),
        expiresAt: new Date(Date.now() - 10 * 24 * 3600 * 1000), // Expired 10 days ago
        pricePaidAlgo: 4,
        currency: 'ALGO',
        walletAddress: 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
        entitlements: {
          domainPreparation: true,
          allowedDomains: ['*'],
          unlimitedDomainPractice: true
        }
      });

      const res = await request(app)
        .post('/api/domains/mern-stack/practice/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ moduleId: 'mern-m2-react', topic: 'Components' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');

      // But paid attempts remain intact and never expire!
      const refreshedUser = await User.findById(expiredUser._id);
      expect(refreshedUser?.paidAttempts.total).toBe(25);
      expect(refreshedUser?.paidAttempts.used).toBe(5);
    });

    it('rejects payment intent for plans priced >= 9 ALGO', async () => {
      // Attempt to forge a plan with 10 ALGO
      const res = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({ planId: 'invalid_expensive_plan' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
