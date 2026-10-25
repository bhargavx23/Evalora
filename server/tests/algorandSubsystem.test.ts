import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import algosdk from 'algosdk';
import app from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { ENV } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { AuthChallenge } from '../src/models/AuthChallenge.js';
import { PaymentIntent } from '../src/models/PaymentIntent.js';
import { PaymentTransaction } from '../src/models/PaymentTransaction.js';
import { Subscription } from '../src/models/Subscription.js';
import { Plan } from '../src/models/Plan.js';
import { algorandService, NormalizedAlgorandTransaction } from '../src/services/algorandService.js';
import { AppError } from '../src/utils/errors.js';

/**
 * Helper to sign a challenge string using real Ed25519 Algorand cryptography (`algosdk.signBytes`).
 */
function signChallengeWithAccount(challenge: string, account: algosdk.Account): string {
  const messageBytes = new Uint8Array(Buffer.from(challenge, 'utf8'));
  const signatureBytes = algosdk.signBytes(messageBytes, account.sk);
  return Buffer.from(signatureBytes).toString('base64');
}

describe('Evalora Algorand Blockchain Subsystem — Auth, Wallet Linking & Payments', () => {
  let walletA: algosdk.Account;
  let addressA: string;
  let walletB: algosdk.Account;
  let addressB: string;
  let walletC: algosdk.Account;
  let addressC: string;
  let treasuryAddress: string;

  let emailUserToken = '';
  let emailUserId = '';
  let secondUserToken = '';
  let secondUserId = '';
  let adminToken = '';

  const testEmail1 = 'algo.student1@evalora.io';
  const testEmail2 = 'algo.student2@evalora.io';
  const testAdminEmail = 'algo.admin@evalora.io';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    walletA = algosdk.generateAccount();
    addressA = walletA.addr.toString();

    walletB = algosdk.generateAccount();
    addressB = walletB.addr.toString();

    walletC = algosdk.generateAccount();
    addressC = walletC.addr.toString();

    treasuryAddress = algorandService.getTreasuryWallet();

    // Clean up any prior test artifacts
    await User.deleteMany({
      $or: [
        { email: { $in: [testEmail1, testEmail2, testAdminEmail] } },
        { walletAddress: { $in: [addressA, addressB, addressC] } }
      ]
    });

    const user1 = await User.create({
      name: 'Algo Email Student 1',
      email: testEmail1,
      passwordHash: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5a5K2G5v9Y1X8Z0a1B2c3D4e',
      role: 'student',
      emailVerified: true,
      authProviders: ['password'],
      status: 'active',
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 0, used: 0 }
    });
    emailUserId = user1._id.toString();
    emailUserToken = jwt.sign(
      { userId: emailUserId, role: 'student', collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const user2 = await User.create({
      name: 'Algo Email Student 2',
      email: testEmail2,
      passwordHash: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5a5K2G5v9Y1X8Z0a1B2c3D4e',
      role: 'student',
      emailVerified: true,
      authProviders: ['password'],
      status: 'active',
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 0, used: 0 }
    });
    secondUserId = user2._id.toString();
    secondUserToken = jwt.sign(
      { userId: secondUserId, role: 'student', collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const admin = await User.create({
      name: 'Algo Platform Admin',
      email: testAdminEmail,
      role: 'platform_admin',
      emailVerified: true,
      status: 'active'
    });
    adminToken = jwt.sign(
      { userId: admin._id.toString(), role: 'platform_admin', collegeId: null, tokenVersion: 0 },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    algorandService.resetConfiguration();
    await PaymentIntent.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await PaymentTransaction.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await Subscription.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await User.findByIdAndUpdate(emailUserId, {
      $set: { 'paidAttempts.total': 0, 'paidAttempts.used': 0, plan: 'free' }
    });
  });

  afterAll(async () => {
    algorandService.resetConfiguration();
    await AuthChallenge.deleteMany({
      walletAddress: { $in: [addressA, addressB, addressC] }
    });
    await PaymentIntent.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await PaymentTransaction.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await Subscription.deleteMany({
      userId: {
        $in: [
          new mongoose.Types.ObjectId(emailUserId),
          new mongoose.Types.ObjectId(secondUserId)
        ]
      }
    });
    await User.deleteMany({
      $or: [
        { email: { $in: [testEmail1, testEmail2, testAdminEmail] } },
        { walletAddress: { $in: [addressA, addressB, addressC] } }
      ]
    });
  });

  // =========================================================================
  // 1. WALLET AUTHENTICATION, CRYPTOGRAPHIC SIGNATURES & REPLAY PROTECTION
  // =========================================================================
  describe('1. Wallet Authentication & Nonce Replay Protection', () => {
    it('rejects malformed Algorand wallet addresses on challenge and verify', async () => {
      const badChallenge = await request(app)
        .post('/api/wallet/challenge')
        .send({ walletAddress: 'NOT_A_VALID_ALGORAND_ADDRESS_12345' });

      expect(badChallenge.status).toBe(400);
      expect(badChallenge.body.success).toBe(false);

      const badVerify = await request(app)
        .post('/api/wallet/verify')
        .send({
          walletAddress: 'BAD_ADDR',
          challenge: 'Evalora Authentication Challenge',
          signature: 'ZmFrZQ=='
        });

      expect(badVerify.status).toBe(400);
      expect(badVerify.body.success).toBe(false);
    });

    it('authenticates valid Ed25519 signature (algosdk.signBytes) and blocks nonce replay', async () => {
      // 1. Request challenge for walletA
      const chalRes = await request(app)
        .post('/api/wallet/challenge')
        .send({ walletAddress: addressA });

      expect(chalRes.status).toBe(200);
      expect(chalRes.body.success).toBe(true);
      expect(chalRes.body.challenge).toContain('Evalora Authentication Challenge');
      expect(chalRes.body.challenge).toContain(`Wallet: ${addressA}`);
      expect(chalRes.body.nonce).toBeDefined();
      expect(chalRes.body.nonce.length).toBeGreaterThan(36); // UUID + 128-bit hex

      const challenge = chalRes.body.challenge;

      // 2. Sign with real Ed25519 private key of walletA
      const realSignature = signChallengeWithAccount(challenge, walletA);

      // 3. Verify signature -> creates account and returns JWT
      const verifyRes = await request(app)
        .post('/api/wallet/verify')
        .send({
          walletAddress: addressA,
          challenge,
          signature: realSignature
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.token).toBeDefined();
      expect(verifyRes.body.user.walletAddress).toBe(addressA);
      expect(verifyRes.body.isNewUser).toBe(true);

      // 4. Replay attack: Re-submitting the exact same signed challenge must fail (401)
      const replayRes = await request(app)
        .post('/api/wallet/verify')
        .send({
          walletAddress: addressA,
          challenge,
          signature: realSignature
        });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.success).toBe(false);
    });

    it('rejects challenge signed by a different Algorand wallet (wrong signer)', async () => {
      const chalRes = await request(app)
        .post('/api/wallet/challenge')
        .send({ walletAddress: addressA });

      const challengeForA = chalRes.body.challenge;
      // Signed by walletB instead of walletA!
      const signatureByB = signChallengeWithAccount(challengeForA, walletB);

      const verifyRes = await request(app)
        .post('/api/wallet/verify')
        .send({
          walletAddress: addressA,
          challenge: challengeForA,
          signature: signatureByB
        });

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.body.success).toBe(false);
    });

    it('rejects expired authentication challenges', async () => {
      const chalRes = await request(app)
        .post('/api/wallet/challenge')
        .send({ walletAddress: addressA });

      const challenge = chalRes.body.challenge;
      const realSignature = signChallengeWithAccount(challenge, walletA);

      // Manually expire the challenge in DB
      await AuthChallenge.updateMany(
        { walletAddress: addressA, nonce: challenge },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
      );

      const expiredRes = await request(app)
        .post('/api/wallet/verify')
        .send({
          walletAddress: addressA,
          challenge,
          signature: realSignature
        });

      expect(expiredRes.status).toBe(401);
      expect(expiredRes.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. WALLET LINKING, UNIQUENESS CONSTRAINT & UNLINKING
  // =========================================================================
  describe('2. Wallet Linking, Uniqueness & Unlinking', () => {
    it('links a verified Algorand wallet to an existing email user and blocks another user from linking the same wallet', async () => {
      // 1. User 1 requests a LINK_WALLET challenge for walletB
      const chalRes = await request(app)
        .post('/api/wallet/challenge')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({ walletAddress: addressB, purpose: 'LINK_WALLET' });

      expect(chalRes.status).toBe(200);
      const challenge = chalRes.body.challenge;
      expect(challenge).toContain('Purpose: LINK_WALLET');

      // 2. Sign with walletB and link to User 1
      const sigB = signChallengeWithAccount(challenge, walletB);

      const linkRes = await request(app)
        .post('/api/wallet/link')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          walletAddress: addressB,
          challenge,
          signature: sigB
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.success).toBe(true);
      expect(linkRes.body.user.walletAddress).toBe(addressB);

      // 3. User 2 attempts to link the SAME walletB -> must be rejected with 409 Conflict
      const chalRes2 = await request(app)
        .post('/api/wallet/challenge')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ walletAddress: addressB, purpose: 'LINK_WALLET' });

      const sigB2 = signChallengeWithAccount(chalRes2.body.challenge, walletB);

      const duplicateLinkRes = await request(app)
        .post('/api/wallet/link')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          walletAddress: addressB,
          challenge: chalRes2.body.challenge,
          signature: sigB2
        });

      expect(duplicateLinkRes.status).toBe(409);
      expect(duplicateLinkRes.body.success).toBe(false);

      // 4. User 1 unlinks walletB -> succeeds because User 1 has email + password auth
      const unlinkRes = await request(app)
        .post('/api/wallet/unlink')
        .set('Authorization', `Bearer ${emailUserToken}`);

      expect(unlinkRes.status).toBe(200);
      expect(unlinkRes.body.success).toBe(true);
      expect(unlinkRes.body.user.walletAddress).toBeUndefined();

      // 5. Now that User 1 unlinked walletB, User 2 can link walletB
      const chalRes3 = await request(app)
        .post('/api/wallet/challenge')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ walletAddress: addressB, purpose: 'LINK_WALLET' });

      const sigB3 = signChallengeWithAccount(chalRes3.body.challenge, walletB);

      const linkUser2Res = await request(app)
        .post('/api/wallet/link')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          walletAddress: addressB,
          challenge: chalRes3.body.challenge,
          signature: sigB3
        });

      expect(linkUser2Res.status).toBe(200);
      expect(linkUser2Res.body.user.walletAddress).toBe(addressB);

      // Cleanup: unlink from User 2
      await request(app)
        .post('/api/wallet/unlink')
        .set('Authorization', `Bearer ${secondUserToken}`);
    });
  });

  // =========================================================================
  // 3. ALGO PAYMENT INTENTS, BLOCKCHAIN VERIFICATION & SECURITY REJECTIONS
  // =========================================================================
  describe('3. Payment Intents & Blockchain Verification', () => {
    it('creates a server-controlled payment intent and verifies a valid confirmed ALGO transaction to unlock attempts', async () => {
      // 1. Check active plans
      const plansRes = await request(app).get('/api/payments/plans');
      expect(plansRes.status).toBe(200);
      expect(plansRes.body.plans.length).toBeGreaterThanOrEqual(3);

      // 2. Create payment intent for "pro" plan (5 ALGO -> 75 attempts, strictly < 9 ALGO)
      const intentRes = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          planId: 'pro',
          // Client attempts to spoof amount and attempts; server must ignore these!
          expectedAmount: 0.001,
          paidAttemptsToUnlock: 999999
        });

      expect(intentRes.status).toBe(201);
      const intent = intentRes.body.paymentIntent;
      expect(intent.expectedAmount).toBe(5); // Server enforced 5 ALGO (< 9 ALGO)
      expect(intent.expectedAmountMicroAlgos).toBe(5_000_000);
      expect(intent.paidAttemptsToUnlock).toBe(75); // Server enforced 75 attempts
      expect(intent.expectedReceiver).toBe(treasuryAddress);

      const validTxId = 'VALIDTXIDALGORANDTESTNETPAYMENTVERIFICATION234567234';

      // Mock Algorand service returning confirmed payment transaction
      algorandService.configureForTesting({
        customTxFetcher: async (txId: string): Promise<NormalizedAlgorandTransaction | null> => {
          if (txId !== validTxId) return null;
          return {
            txId: validTxId,
            confirmed: true,
            confirmedRound: 48120500,
            txType: 'pay',
            sender: addressC,
            receiver: treasuryAddress,
            amountMicroAlgos: 5_000_000,
            amountAlgo: 5,
            network: 'testnet',
            genesisId: 'testnet-v1.0'
          };
        }
      });

      // 3. Verify payment on backend
      const verifyRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: validTxId,
          walletAddress: addressC
        });

      if (verifyRes.status !== 200) {
        console.error('VERIFY_RES_435_ERROR:', verifyRes.status, verifyRes.body);
      }
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.status).toBe('verified');
      expect(verifyRes.body.attemptsUnlocked).toBe(75);
      expect(verifyRes.body.paidAttempts.total).toBe(75);

      // 4. Verify DB state
      const updatedUser = await User.findById(emailUserId);
      expect(updatedUser?.paidAttempts.total).toBe(75);
      expect(updatedUser?.plan).toBe('pro');
    });

    it('rejects fake/missing transaction ID, wrong receiver, wrong amount, wrong currency, wrong network, and expired intents', async () => {
      const createIntent = async () => {
        const res = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${emailUserToken}`)
          .send({ planId: 'starter' }); // 5 ALGO -> 25 attempts
        return res.body.paymentIntent;
      };

      // Case A: Fake / Non-existent transaction on Algorand
      const intentA = await createIntent();
      algorandService.configureForTesting({
        customTxFetcher: async () => null
      });
      const fakeTxRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentA.intentId,
          transactionId: 'FAKETXIDNOTFOUNDONALGORANDBLOCKCHAINNETWORK234567'
        });
      expect(fakeTxRes.status).toBe(400);
      expect(fakeTxRes.body.code).toBe('TRANSACTION_NOT_FOUND');

      // Case B: Wrong receiver address (sent to walletB instead of Evalora treasury)
      const intentB = await createIntent();
      const wrongRcvTxId = 'WRONGRCVTXIDALGORANDTESTNETPAYMENTVERIFICATION23456';
      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: wrongRcvTxId,
          confirmed: true,
          confirmedRound: 48120501,
          txType: 'pay',
          sender: addressC,
          receiver: addressB, // Wrong receiver!
          amountMicroAlgos: 3_000_000,
          amountAlgo: 3,
          network: 'testnet'
        })
      });
      const wrongRcvRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentB.intentId,
          transactionId: wrongRcvTxId
        });
      expect(wrongRcvRes.status).toBe(400);
      expect(wrongRcvRes.body.code).toBe('WRONG_RECEIVER');

      // Case C: Wrong amount (sent 1 ALGO when 3 ALGO was required)
      const intentC = await createIntent();
      const underpayTxId = 'UNDERPAYTXIDALGORANDTESTNETPAYMENTVERIFICATION2345';
      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: underpayTxId,
          confirmed: true,
          confirmedRound: 48120502,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 1_000_000, // Only 1 ALGO instead of 3 ALGO
          amountAlgo: 1,
          network: 'testnet'
        })
      });
      const wrongAmtRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentC.intentId,
          transactionId: underpayTxId
        });
      expect(wrongAmtRes.status).toBe(400);
      expect(wrongAmtRes.body.code).toBe('WRONG_AMOUNT');

      // Case D: Wrong currency (ASA token transfer 'axfer' instead of native ALGO 'pay')
      const intentD = await createIntent();
      const asaTxId = 'ASATOKENTXIDALGORANDTESTNETPAYMENTVERIFICATION23456';
      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: asaTxId,
          confirmed: true,
          confirmedRound: 48120503,
          txType: 'axfer',
          assetId: 10458941,
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 3_000_000,
          amountAlgo: 3,
          network: 'testnet'
        })
      });
      const wrongCurrRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentD.intentId,
          transactionId: asaTxId
        });
      expect(wrongCurrRes.status).toBe(400);
      expect(wrongCurrRes.body.code).toBe('WRONG_CURRENCY');

      // Case E: Wrong network
      const intentE = await createIntent();
      const wrongNetTxId = 'WRONGNETTXIDALGORANDTESTNETPAYMENTVERIFICATION23456';
      algorandService.configureForTesting({
        networkOverride: 'mainnet',
        customTxFetcher: async () => ({
          txId: wrongNetTxId,
          confirmed: true,
          confirmedRound: 48120504,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 3_000_000,
          amountAlgo: 3,
          network: 'testnet' // Mismatches mainnet override
        })
      });
      const wrongNetRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentE.intentId,
          transactionId: wrongNetTxId
        });
      expect(wrongNetRes.status).toBe(400);
      expect(wrongNetRes.body.code).toBe('WRONG_NETWORK');
      algorandService.resetConfiguration();

      // Case F: Expired payment intent
      const intentF = await createIntent();
      await PaymentIntent.updateOne(
        { intentId: intentF.intentId },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
      );
      const expiredIntentRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intentF.intentId,
          transactionId: 'EXPINTENTTXIDALGORANDTESTNETPAYMENTVERIFICATION2345'
        });
      expect(expiredIntentRes.status).toBe(400);
      expect(expiredIntentRes.body.code).toBe('PAYMENT_INTENT_EXPIRED');

      // Verify zero attempts were unlocked across all failed cases
      const userAfterFailures = await User.findById(emailUserId);
      expect(userAfterFailures?.paidAttempts.total).toBe(0);
    });

    it('handles pending transactions (202) and Algorand network outages (503) without unlocking prematurely', async () => {
      const intentRes = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({ planId: 'starter' });
      const intent = intentRes.body.paymentIntent;
      const pendingTxId = 'PENDINGTXIDALGORANDTESTNETPAYMENTVERIFICATION234567';

      // 1. Transaction submitted but unconfirmed (confirmedRound: undefined)
      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: pendingTxId,
          confirmed: false,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 5_000_000,
          amountAlgo: 5,
          network: 'testnet'
        })
      });

      const pendingRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: pendingTxId
        });

      expect(pendingRes.status).toBe(202);
      expect(pendingRes.body.code).toBe('TRANSACTION_PENDING');
      expect((await User.findById(emailUserId))?.paidAttempts.total).toBe(0);

      // 2. Algorand Network Outage (503)
      algorandService.configureForTesting({
        customTxFetcher: async () => {
          throw new AppError(
            'Algorand network verification service is temporarily unavailable.',
            503,
            'ALGORAND_NETWORK_UNAVAILABLE'
          );
        }
      });

      const outageRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: pendingTxId
        });

      expect(outageRes.status).toBe(503);
      expect(outageRes.body.code).toBe('ALGORAND_NETWORK_UNAVAILABLE');
      expect((await User.findById(emailUserId))?.paidAttempts.total).toBe(0);

      // 3. Transaction now confirms on-chain -> re-verification succeeds and unlocks 25 attempts!
      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: pendingTxId,
          confirmed: true,
          confirmedRound: 48120600,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 3_000_000,
          amountAlgo: 3,
          network: 'testnet'
        })
      });

      const confirmedRes = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: pendingTxId
        });

      expect(confirmedRes.status).toBe(200);
      expect(confirmedRes.body.status).toBe('verified');
      expect((await User.findById(emailUserId))?.paidAttempts.total).toBe(35);
    });
  });

  // =========================================================================
  // 4. DUPLICATE REPLAY & CONCURRENCY STRESS TEST (SECTION 46 MANDATORY)
  // =========================================================================
  describe('4. Duplicate Transaction Prevention & Concurrency Stress Test', () => {
    it('prevents duplicate verification of the same transaction ID across multiple intents', async () => {
      const intent1 = (
        await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${emailUserToken}`)
          .send({ planId: 'starter' })
      ).body.paymentIntent;

      const intent2 = (
        await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${emailUserToken}`)
          .send({ planId: 'starter' })
      ).body.paymentIntent;

      const sharedTxId = 'SHAREDTXIDALGORANDTESTNETPAYMENTVERIFICATION234567';

      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: sharedTxId,
          confirmed: true,
          confirmedRound: 48120700,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 3_000_000,
          amountAlgo: 3,
          network: 'testnet'
        })
      });

      // First verification succeeds
      const firstVerify = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent1.intentId,
          transactionId: sharedTxId
        });
      expect(firstVerify.status).toBe(200);
      expect((await User.findById(emailUserId))?.paidAttempts.total).toBe(35);

      // Second verification using the SAME transactionId on intent2 must be rejected (409)
      const secondVerify = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent2.intentId,
          transactionId: sharedTxId
        });
      expect(secondVerify.status).toBe(409);
      expect(secondVerify.body.code).toBe('DUPLICATE_TRANSACTION');

      // Total attempts unlocked must remain 35, NEVER 70!
      expect((await User.findById(emailUserId))?.paidAttempts.total).toBe(35);
    });

    it('guarantees ONE transaction record and ONE attempt unlock under 8 concurrent verification requests', async () => {
      const intent = (
        await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${emailUserToken}`)
          .send({ planId: 'master' }) // 8 ALGO (< 9 ALGO) -> 150 attempts
      ).body.paymentIntent;

      const concurrentTxId = 'CONCURRENTTXIDALGORANDTESTNETPAYMENTVERIFICATION234';

      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: concurrentTxId,
          confirmed: true,
          confirmedRound: 48120800,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 8_000_000,
          amountAlgo: 8,
          network: 'testnet'
        })
      });

      // Fire 8 simultaneous requests with the exact same transactionId
      const responses = await Promise.all(
        Array.from({ length: 8 }).map(() =>
          request(app)
            .post('/api/payments/verify')
            .set('Authorization', `Bearer ${emailUserToken}`)
            .send({
              paymentIntentId: intent.intentId,
              transactionId: concurrentTxId,
              walletAddress: addressC
            })
        )
      );

      const successResponses = responses.filter(r => r.status === 200);
      const conflictResponses = responses.filter(r => r.status === 409);

      // Mandatory assertion: Exactly 1 request succeeded and 7 were rejected as duplicates
      expect(successResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(7);

      // Mandatory assertion: Exactly 1 transaction record in DB
      const txCount = await PaymentTransaction.countDocuments({
        transactionId: concurrentTxId
      });
      expect(txCount).toBe(1);

      // Mandatory assertion: User attempts unlocked ONCE (150, not 1200)
      const userAfterConcurrency = await User.findById(emailUserId);
      expect(userAfterConcurrency?.paidAttempts.total).toBe(150);
    });
  });

  // =========================================================================
  // 5. TRANSACTION HISTORY & ADMIN RBAC AUTHORIZATION
  // =========================================================================
  describe('5. Transaction History & Admin Authorization', () => {
    it('enforces owner-only access on payment history/lookup and allows admin filtering', async () => {
      const intent = (
        await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${emailUserToken}`)
          .send({ planId: 'starter' })
      ).body.paymentIntent;

      const historyTxId = 'HISTORYTXIDALGORANDTESTNETPAYMENTVERIFICATION23456';

      algorandService.configureForTesting({
        customTxFetcher: async () => ({
          txId: historyTxId,
          confirmed: true,
          confirmedRound: 48120900,
          txType: 'pay',
          sender: addressC,
          receiver: treasuryAddress,
          amountMicroAlgos: 5_000_000,
          amountAlgo: 5,
          network: 'testnet'
        })
      });

      await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          paymentIntentId: intent.intentId,
          transactionId: historyTxId
        });

      // 1. Owner can view their own history
      const historyRes = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${emailUserToken}`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.transactions.length).toBe(1);
      expect(historyRes.body.transactions[0].transactionId).toBe(historyTxId);

      // 2. Second student CANNOT inspect User 1's transaction by ID (403 Forbidden)
      const forbiddenLookup = await request(app)
        .get(`/api/payments/${historyTxId}`)
        .set('Authorization', `Bearer ${secondUserToken}`);
      expect(forbiddenLookup.status).toBe(403);

      // 3. Student CANNOT access admin transactions endpoint (403 Forbidden)
      const studentAdminAttempt = await request(app)
        .get('/api/payments/admin/transactions')
        .set('Authorization', `Bearer ${emailUserToken}`);
      expect(studentAdminAttempt.status).toBe(403);

      // 4. Platform Admin CAN filter transactions by walletAddress, status, and network
      const adminListRes = await request(app)
        .get(`/api/payments/admin/transactions?walletAddress=${addressC}&status=verified&network=testnet`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminListRes.status).toBe(200);
      expect(adminListRes.body.total).toBeGreaterThanOrEqual(1);
      expect(adminListRes.body.transactions[0].transactionId).toBe(historyTxId);
    });
  });

  // =========================================================================
  // 6. PREMIUM PLAN MANAGEMENT & STRICT < 9 ALGO PRICING ENFORCEMENT
  // =========================================================================
  describe('6. Premium Plan Management & Strict < 9 ALGO Pricing Enforcement', () => {
    it('strictly enforces 0 < price < 9 ALGO and rejects any plan at 9 ALGO or higher', async () => {
      // 1. Attempt to create a plan at 9 ALGO -> REJECT
      const reject9Res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          planId: 'plan-nine',
          name: 'Invalid 9 ALGO Plan',
          price: 9,
          attempts: 50
        });
      expect(reject9Res.status).toBe(400);
      expect(reject9Res.body.code).toBe('INVALID_PLAN_PRICE');

      // 2. Attempt to create a plan at 10 ALGO -> REJECT
      const reject10Res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          planId: 'plan-ten',
          name: 'Invalid 10 ALGO Plan',
          price: 10,
          attempts: 60
        });
      expect(reject10Res.status).toBe(400);
      expect(reject10Res.body.code).toBe('INVALID_PLAN_PRICE');

      // 3. Attempt to create a plan at 0 ALGO or negative -> REJECT
      const reject0Res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          planId: 'plan-zero',
          name: 'Invalid Zero Plan',
          price: 0,
          attempts: 10
        });
      expect(reject0Res.status).toBe(400);
      expect(reject0Res.body.code).toBe('INVALID_PLAN_PRICE');

      // 4. Student cannot create plans (403 Forbidden)
      const studentAttempt = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${emailUserToken}`)
        .send({
          planId: 'student-plan',
          name: 'Student Created Plan',
          price: 4,
          attempts: 20
        });
      expect(studentAttempt.status).toBe(403);
    });

    it('admin can create, update, toggle active status, and list plans complying with 0 < price < 9 ALGO', async () => {
      await Plan.deleteOne({ planId: 'custom-boost' });
      // 1. Admin creates a valid plan priced at 4.5 ALGO
      const createRes = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          planId: 'custom-boost',
          name: 'Placement Boost Pack',
          description: 'Special speed boost for algorithm review',
          price: 4.5,
          attempts: 40,
          features: ['40 Unlocked Attempts', 'Speed Run Analysis']
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.plan.planId).toBe('custom-boost');
      expect(createRes.body.plan.price).toBe(4.5);
      expect(createRes.body.plan.attempts).toBe(40);

      // 2. Admin updates the plan attempts and price (to 6 ALGO < 9 ALGO)
      const updateRes = await request(app)
        .put('/api/admin/plans/custom-boost')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 6,
          attempts: 55
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.plan.price).toBe(6);
      expect(updateRes.body.plan.attempts).toBe(55);

      // 3. Admin attempts to update price to 9.5 ALGO -> REJECT
      const badUpdateRes = await request(app)
        .put('/api/admin/plans/custom-boost')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 9.5 });
      expect(badUpdateRes.status).toBe(400);
      expect(badUpdateRes.body.code).toBe('INVALID_PLAN_PRICE');

      // 4. Admin toggles active status
      const toggleRes = await request(app)
        .patch('/api/admin/plans/custom-boost/status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.plan.active).toBe(false);

      // Reactivate for student visibility
      await request(app)
        .patch('/api/admin/plans/custom-boost/status')
        .set('Authorization', `Bearer ${adminToken}`);

      // 5. Verify all active plans returned to public/student have price < 9 ALGO
      const publicPlansRes = await request(app).get('/api/payments/plans');
      expect(publicPlansRes.status).toBe(200);
      for (const p of publicPlansRes.body.plans) {
        expect(p.priceAlgo).toBeGreaterThan(0);
        expect(p.priceAlgo).toBeLessThan(9);
      }
    });
  });
});
