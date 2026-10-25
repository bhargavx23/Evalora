import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import { User } from '../src/models/User.js';
import { Subscription } from '../src/models/Subscription.js';
import { codeVisualizerService } from '../src/services/codeVisualizerService.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';

describe('Evalora — Premium Code Visualization & Execution Trace Suite', () => {
  let freeUserToken: string;
  let freeUserId: string;

  let starterUserToken: string;
  let starterUserId: string;

  let proUserToken: string;
  let proUserId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(ENV.MONGODB_URI || 'mongodb://127.0.0.1:27017/evalora');
    }
    const timestamp = Date.now();
    await User.deleteMany({ email: /.*vis.*@evalora-visualizer\.internal/ });
    await Subscription.deleteMany({ transactionId: /TX_.*_VIS_TEST.*/ });

    // 1. Create Free User
    const freeUser = await User.create({
      name: 'Free Student',
      email: `free.student.vis.${timestamp}@evalora-visualizer.internal`,
      passwordHash: 'HashedPassword123!',
      role: 'student',
      emailVerified: true
    });
    freeUserId = freeUser._id.toString();
    freeUserToken = jwt.sign({ userId: freeUserId, tokenVersion: 0, role: 'student', email: freeUser.email }, ENV.JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Starter User (Active subscription but codeVisualization = false)
    const starterUser = await User.create({
      name: 'Starter Student',
      email: `starter.student.vis.${timestamp}@evalora-visualizer.internal`,
      passwordHash: 'HashedPassword123!',
      role: 'student',
      emailVerified: true
    });
    starterUserId = starterUser._id.toString();
    starterUserToken = jwt.sign({ userId: starterUserId, tokenVersion: 0, role: 'student', email: starterUser.email }, ENV.JWT_SECRET, { expiresIn: '1d' });

    await Subscription.create({
      userId: starterUser._id,
      planId: 'starter',
      planName: 'Starter Practice Pack',
      transactionId: `TX_STARTER_VIS_TEST_${timestamp}`,
      status: 'active',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pricePaidAlgo: 3,
      currency: 'ALGO',
      walletAddress: 'WALLET_STARTER_TEST_ADDR',
      entitlements: {
        domainPreparation: false,
        allowedDomains: [],
        practiceAttempts: 35,
        codeWorkspacesEnabled: false,
        codeVisualization: false
      }
    });

    // 3. Create Pro User (Active subscription with codeVisualization = true)
    const proUser = await User.create({
      name: 'Pro Student',
      email: `pro.student.vis.${timestamp}@evalora-visualizer.internal`,
      passwordHash: 'HashedPassword123!',
      role: 'student',
      emailVerified: true
    });
    proUserId = proUser._id.toString();
    proUserToken = jwt.sign({ userId: proUserId, tokenVersion: 0, role: 'student', email: proUser.email }, ENV.JWT_SECRET, { expiresIn: '1d' });

    await Subscription.create({
      userId: proUser._id,
      planId: 'pro',
      planName: 'Pro Interview Bundle',
      transactionId: `TX_PRO_VIS_TEST_${timestamp}`,
      status: 'active',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pricePaidAlgo: 5,
      currency: 'ALGO',
      walletAddress: 'WALLET_PRO_TEST_ADDR',
      entitlements: {
        domainPreparation: true,
        allowedDomains: ['*'],
        practiceAttempts: 75,
        codeWorkspacesEnabled: true,
        codeVisualization: true
      }
    });
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({ email: /.*vis.*@evalora-visualizer\.internal/ });
    await Subscription.deleteMany({ transactionId: /TX_.*_VIS_TEST.*/ });
  });

  // --------------------------------------------------------------------------
  // 1. Unit Testing CodeVisualizerService (Genuine Execution Trace)
  // --------------------------------------------------------------------------
  describe('1. CodeVisualizerService Runtime Tracing', () => {
    it('executes and traces JavaScript code step-by-step with variable mutations and stdout', async () => {
      const code = `
let sum = 0;
let numbers = [10, 20];
for (let i = 0; i < numbers.length; i++) {
  sum += numbers[i];
}
console.log("Total:", sum);
`;

      const result = await codeVisualizerService.visualize({
        code,
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.supported).toBe(true);
      expect(result.totalSteps).toBeGreaterThanOrEqual(5);

      // Verify variables captured
      const lastStep = result.steps[result.steps.length - 1];
      expect(lastStep.variables.sum).toBe(30);
      expect(lastStep.variables.numbers).toEqual([10, 20]);
      expect(result.stdout).toContain('Total: 30');
    });

    it('captures JavaScript runtime errors cleanly at the exact crashing line', async () => {
      const code = `
let a = 10;
let b = undefined;
let c = b.invalidProperty;
`;

      const result = await codeVisualizerService.visualize({
        code,
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      const errorStep = result.steps.find((s) => s.eventType === 'error' || s.error);
      expect(errorStep).toBeDefined();
      expect(errorStep?.line).toBe(4);
    });

    it('protects against infinite loops by terminating safely at step limit', async () => {
      const code = `
let counter = 0;
while (true) {
  counter++;
}
`;

      const result = await codeVisualizerService.visualize({
        code,
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.totalSteps).toBeLessThanOrEqual(255);
      const loopStep = result.steps.find((s) => s.eventType === 'loop' || s.warning);
      expect(loopStep).toBeDefined();
    });

    it('executes and traces Python code via native sys.settrace', async () => {
      const code = `
def multiply(x, y):
    return x * y

a = 6
b = 7
res = multiply(a, b)
print("Product:", res)
`;

      const result = await codeVisualizerService.visualize({
        code,
        language: 'python'
      });

      expect(result.success).toBe(true);
      expect(result.supported).toBe(true);
      expect(result.totalSteps).toBeGreaterThan(0);
      expect(result.stdout).toContain('Product: 42');
    });

    it('honestly reports unsupported languages without fabricated results', async () => {
      const code = `#include <iostream>\nint main() { return 0; }`;

      const result = await codeVisualizerService.visualize({
        code,
        language: 'cpp'
      });

      expect(result.success).toBe(false);
      expect(result.supported).toBe(false);
      expect(result.message).toContain('currently available for JavaScript and Python');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Subscription Gating & Backend Entitlement Enforcement
  // --------------------------------------------------------------------------
  describe('2. Subscription Entitlement Enforcement', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/visualize')
        .send({ code: 'let a = 1;', language: 'javascript' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unsubscribed / free users with 403 CODE_VISUALIZATION_SUBSCRIPTION_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/visualize')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({ code: 'let a = 1;', language: 'javascript' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CODE_VISUALIZATION_SUBSCRIPTION_REQUIRED');
      expect(res.body.requiresSubscription).toBe(true);
    });

    it('rejects users with plans that do not include Code Visualization (starter plan) with 403 FEATURE_NOT_ENTITLED', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/visualize')
        .set('Authorization', `Bearer ${starterUserToken}`)
        .send({ code: 'let a = 1;', language: 'javascript' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_ENTITLED');
      expect(res.body.requiresUpgrade).toBe(true);
    });

    it('allows subscribed users with entitlement (pro plan) to generate execution traces', async () => {
      const res = await request(app)
        .post('/api/domains/mern-stack/visualize')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          code: 'let x = 5;\nlet y = 15;\nlet ans = x + y;\nconsole.log(ans);',
          language: 'javascript'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalSteps).toBeGreaterThanOrEqual(4);
      expect(res.body.steps[0].variables).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dedicated Code Visualization Standalone Feature Endpoints
  // --------------------------------------------------------------------------
  describe('3. Dedicated Standalone Visualizer Feature Endpoints', () => {
    it('retrieves database-stored sample algorithms via GET /api/visualizer/samples', async () => {
      const res = await request(app).get('/api/visualizer/samples');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.samples.length).toBeGreaterThanOrEqual(3);

      const sample = res.body.samples[0];
      expect(sample.sampleId).toBeDefined();
      expect(sample.title).toBeDefined();
      expect(sample.code).toBeDefined();
      expect(sample.language).toBeDefined();
    });

    it('retrieves a specific sample by sampleId via GET /api/visualizer/samples/:sampleId', async () => {
      const res = await request(app).get('/api/visualizer/samples/js-array-accumulator');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sample.title).toBe('Array Accumulator & Loop');
      expect(res.body.sample.code).toContain('numbers');
    });

    it('reports entitlement status correctly for free vs subscribed users via GET /api/visualizer/status', async () => {
      const freeRes = await request(app)
        .get('/api/visualizer/status')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(freeRes.status).toBe(200);
      expect(freeRes.body.entitled).toBe(false);

      const proRes = await request(app)
        .get('/api/visualizer/status')
        .set('Authorization', `Bearer ${proUserToken}`);

      expect(proRes.status).toBe(200);
      expect(proRes.body.entitled).toBe(true);
      expect(proRes.body.planId).toBe('pro');
    });

    it('generates an execution trace independently with custom code via POST /api/visualizer/trace', async () => {
      const res = await request(app)
        .post('/api/visualizer/trace')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          code: 'let a = 10;\nlet b = 20;\nlet c = a * b;\nconsole.log(c);',
          language: 'javascript'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalSteps).toBeGreaterThanOrEqual(4);
      expect(res.body.stdout).toContain('200');
    });

    it('rejects POST /api/visualizer/trace when user is on an unentitled plan (starter)', async () => {
      const res = await request(app)
        .post('/api/visualizer/trace')
        .set('Authorization', `Bearer ${starterUserToken}`)
        .send({
          code: 'let a = 1;',
          language: 'javascript'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_ENTITLED');
      expect(res.body.requiresUpgrade).toBe(true);
    });
  });
});
