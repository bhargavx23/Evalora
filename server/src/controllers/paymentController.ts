import crypto from 'node:crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getActivePlans, getPlanById } from '../config/plans.js';
import { ENV } from '../config/env.js';
import { Plan } from '../models/Plan.js';
import { PaymentIntent } from '../models/PaymentIntent.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { algorandService } from '../services/algorandService.js';
import { paymentReceiptService } from '../services/documents/paymentReceiptService.js';
import { logger } from '../utils/logger.js';

function sanitizeTransactionForUser(tx: any) {
  return {
    _id: tx._id,
    transactionId: tx.transactionId,
    receiptNumber: tx.receiptNumber,
    paymentIntentId: tx.paymentIntentId,
    planId: tx.planId,
    amount: tx.amount,
    currency: tx.currency,
    purpose: tx.purpose,
    status: tx.status,
    attemptsUnlocked: tx.attemptsUnlocked,
    walletAddress: tx.walletAddress,
    network: tx.network,
    blockchainRound: tx.blockchainRound,
    verifiedAt: tx.verifiedAt,
    failureReason: tx.failureReason,
    createdAt: tx.createdAt
  };
}

/**
 * GET /api/payments/plans
 * Returns server-authoritative ALGO practice plans and public network info.
 * Enforces that every returned plan costs strictly less than 9 ALGO.
 */
export async function getPaymentPlans(_req: Request, res: Response): Promise<void> {
  try {
    let plans: any[] = [];
    const dbPlans = await Plan.find({ active: true }).sort({ price: 1 }).lean();

    if (dbPlans && dbPlans.length > 0) {
      plans = dbPlans
        .filter((p: any) => typeof p.price === 'number' && p.price > 0 && p.price < 9)
        .map((p: any) => ({
          id: p.planId,
          planId: p.planId,
          name: p.name,
          description: p.description,
          price: p.price,
          priceAlgo: p.price,
          priceMicroAlgos: Math.round(p.price * 1_000_000),
          attempts: p.attempts,
          paidAttempts: p.attempts,
          currency: p.currency || 'ALGO',
          popular: p.popular || false,
          features: p.features || [],
          exclusions: p.exclusions || [],
          entitlements: p.entitlements || {
            domainPreparation: ['domain_pass', 'pro', 'master'].includes(p.planId),
            allowedDomains: ['*'],
            subscriptionDurationDays: p.planId === 'master' ? 90 : (['domain_pass', 'pro'].includes(p.planId) ? 30 : 0),
            unlimitedDomainPractice: ['domain_pass', 'pro', 'master'].includes(p.planId),
            aiAdaptivePractice: true,
            codeWorkspacesEnabled: ['domain_pass', 'pro', 'master'].includes(p.planId),
            performanceReportsPdf: true,
            priorityExecution: ['pro', 'master'].includes(p.planId)
          }
        }));
    }

    if (plans.length === 0) {
      plans = getActivePlans().filter(p => p.priceAlgo > 0 && p.priceAlgo < 9).map(p => ({
        id: p.id,
        planId: p.planId || p.id,
        name: p.name,
        description: p.description,
        price: p.priceAlgo,
        priceAlgo: p.priceAlgo,
        priceMicroAlgos: p.priceMicroAlgos,
        attempts: p.paidAttempts,
        paidAttempts: p.paidAttempts,
        currency: 'ALGO' as const,
        popular: p.popular || false,
        features: p.features,
        exclusions: p.exclusions || [],
        entitlements: p.entitlements
      }));
    }

    res.json({
      success: true,
      network: algorandService.getActiveNetwork(),
      currency: 'ALGO',
      receiverAddress: algorandService.getTreasuryWallet(),
      plans
    });
  } catch (error: any) {
    logger.error('GET_PAYMENT_PLANS_ERROR', { details: { message: error.message } });
    const fallbackPlans = getActivePlans().filter(p => p.priceAlgo > 0 && p.priceAlgo < 9);
    res.json({
      success: true,
      network: algorandService.getActiveNetwork(),
      currency: 'ALGO',
      receiverAddress: algorandService.getTreasuryWallet(),
      plans: fallbackPlans
    });
  }
}

/**
 * POST /api/payments/create-intent
 * Creates a server-controlled payment intent for unlocking practice attempts.
 * Strictly verifies the price is below 9 ALGO.
 */
export async function createPaymentIntent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const { planId } = req.body;
    if (!planId || typeof planId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'A valid planId is required to create a payment intent.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const cleanPlanId = planId.trim().toLowerCase();
    let plan: any = await Plan.findOne({ planId: cleanPlanId }).lean();
    if (!plan) {
      plan = getPlanById(cleanPlanId);
    }

    if (!plan || !plan.active) {
      res.status(400).json({
        success: false,
        message: `Invalid or inactive plan "${planId}".`,
        code: 'INVALID_PLAN'
      });
      return;
    }

    // Strict Pricing Rule: Every premium plan must cost strictly less than 9 ALGO
    const planPrice = typeof plan.price === 'number' ? plan.price : plan.priceAlgo;
    if (typeof planPrice !== 'number' || isNaN(planPrice) || planPrice <= 0 || planPrice >= 9) {
      res.status(400).json({
        success: false,
        message: 'Plan violates pricing policy: every premium plan must cost strictly greater than 0 and less than 9 ALGO (0 < price < 9 ALGO).',
        code: 'INVALID_PLAN_PRICE'
      });
      return;
    }

    const expectedReceiver = algorandService.getTreasuryWallet();
    if (!algorandService.isValidAddress(expectedReceiver)) {
      res.status(503).json({
        success: false,
        message: 'Payment destination wallet is not properly configured on the server.',
        code: 'PAYMENT_CONFIGURATION_ERROR'
      });
      return;
    }

    const intentId = `pi_${crypto.randomUUID().replace(/-/g, '')}`;
    const expiryMinutes = ENV.PAYMENT_INTENT_EXPIRY_MINUTES || 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const planAttempts = plan.attempts ?? plan.paidAttempts;
    const planMicroAlgos = Math.round(planPrice * 1_000_000);

    const intent = await PaymentIntent.create({
      intentId,
      userId: new mongoose.Types.ObjectId(userId),
      planId: plan.planId || plan.id,
      planName: plan.name,
      expectedAmountAlgo: planPrice,
      expectedAmountMicroAlgos: planMicroAlgos,
      currency: 'ALGO',
      expectedReceiver,
      paidAttemptsToUnlock: planAttempts,
      status: 'pending',
      expiresAt
    });

    logger.info('PAYMENT_INTENT_CREATED', {
      userId,
      details: {
        intentId: intent.intentId,
        planId: intent.planId,
        expectedAmountAlgo: intent.expectedAmountAlgo,
        paidAttemptsToUnlock: intent.paidAttemptsToUnlock
      }
    });

    const suggestedParams = await algorandService.getTransactionParams();

    res.status(201).json({
      success: true,
      message: 'Payment intent created.',
      paymentIntent: {
        intentId: intent.intentId,
        planId: intent.planId,
        planName: intent.planName,
        expectedAmount: intent.expectedAmountAlgo,
        expectedAmountMicroAlgos: intent.expectedAmountMicroAlgos,
        currency: intent.currency,
        expectedReceiver: intent.expectedReceiver,
        paidAttemptsToUnlock: intent.paidAttemptsToUnlock,
        network: algorandService.getActiveNetwork(),
        status: intent.status,
        expiresAt: intent.expiresAt,
        suggestedParams
      }
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create payment intent.',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}

/**
 * POST /api/payments/verify
 * Independently verifies an Algorand transaction on-chain and atomically unlocks paid practice attempts.
 */
export async function verifyPayment(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const { paymentIntentId, intentId, transactionId, walletAddress, signedTxn } = req.body;
    let cleanTxId = typeof transactionId === 'string' ? transactionId.trim() : '';
    const rawIntentId = paymentIntentId || intentId;
    const cleanIntentId = typeof rawIntentId === 'string' ? rawIntentId.trim() : '';

    let broadcastError: string | null = null;

    if (!cleanTxId && signedTxn && typeof signedTxn === 'string') {
      try {
        const rawBuffer = Buffer.from(signedTxn, 'base64');
        cleanTxId = await algorandService.submitRawTransaction(rawBuffer);
      } catch (submitErr: any) {
        broadcastError = submitErr?.message || 'Transaction submission failed.';
        logger.warn('RAW_TXN_BROADCAST_ERROR', { details: { message: submitErr?.message } });
      }
    } else if (signedTxn && typeof signedTxn === 'string') {
      // Opportunistically broadcast if not yet in pool
      try {
        const rawBuffer = Buffer.from(signedTxn, 'base64');
        await algorandService.submitRawTransaction(rawBuffer);
      } catch (submitErr: any) {
        const msg = String(submitErr?.message || '');
        if (!msg.toLowerCase().includes('already in pool')) {
          broadcastError = msg;
        }
        logger.warn('RAW_TXN_BROADCAST_ERROR', { details: { message: msg } });
      }
    }

    if (!cleanIntentId || !cleanTxId) {
      res.status(400).json({
        success: false,
        message: 'paymentIntentId and transactionId (or signedTxn) are required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (!algorandService.isValidTransactionId(cleanTxId)) {
      res.status(400).json({
        success: false,
        message: 'Malformed Algorand transaction ID.',
        code: 'INVALID_TRANSACTION_ID'
      });
      return;
    }

    if (walletAddress && !algorandService.isValidAddress(walletAddress)) {
      res.status(400).json({
        success: false,
        message: 'Invalid Algorand sender wallet address format.',
        code: 'INVALID_WALLET_ADDRESS'
      });
      return;
    }

    // 1. Load PaymentIntent and verify ownership
    const intent = await PaymentIntent.findOne({ intentId: cleanIntentId });
    if (!intent) {
      res.status(404).json({
        success: false,
        message: 'Payment intent not found.',
        code: 'PAYMENT_INTENT_NOT_FOUND'
      });
      return;
    }

    if (intent.userId.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to verify this payment intent.',
        code: 'FORBIDDEN'
      });
      return;
    }

    // 2. Check if transactionId was already verified previously (Replay Prevention)
    const existingTx = await PaymentTransaction.findOne({ transactionId: cleanTxId });
    if (existingTx && existingTx.status === 'verified') {
      res.status(409).json({
        success: false,
        message: 'This blockchain transaction has already been verified and processed.',
        code: 'DUPLICATE_TRANSACTION',
        transaction:
          existingTx.userId.toString() === userId
            ? sanitizeTransactionForUser(existingTx)
            : undefined
      });
      return;
    }

    if (intent.status === 'completed') {
      res.status(409).json({
        success: false,
        message: 'This payment intent has already been completed.',
        code: 'INTENT_ALREADY_COMPLETED'
      });
      return;
    }

    // 3. Check PaymentIntent expiration
    if (intent.expiresAt.getTime() < Date.now()) {
      intent.status = 'expired';
      await intent.save();
      res.status(400).json({
        success: false,
        message: 'Payment intent has expired. Please create a new payment intent.',
        code: 'PAYMENT_INTENT_EXPIRED'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User account not found.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const expectedSender = walletAddress?.trim() || user.walletAddress;

    // 4. Verify transaction directly against the Algorand network
    const verification = await algorandService.verifyPayment({
      txId: cleanTxId,
      expectedReceiver: intent.expectedReceiver,
      expectedAmountMicroAlgos: intent.expectedAmountMicroAlgos,
      expectedSender,
      expectedNetwork: algorandService.getActiveNetwork()
    });

    // Handle pending (unconfirmed) blockchain transaction or newly broadcast transaction
    if (
      verification.code === 'TRANSACTION_PENDING' ||
      (signedTxn && !broadcastError && verification.code === 'TRANSACTION_NOT_FOUND')
    ) {
      const pendingTx = await PaymentTransaction.findOneAndUpdate(
        { transactionId: cleanTxId, status: { $ne: 'verified' } },
        {
          $setOnInsert: {
            userId: user._id,
            walletAddress: verification.transaction?.sender || expectedSender || 'unknown',
            transactionId: cleanTxId,
            amount: verification.transaction?.amountAlgo || intent.expectedAmountAlgo,
            amountMicroAlgos:
              verification.transaction?.amountMicroAlgos || intent.expectedAmountMicroAlgos,
            currency: 'ALGO',
            purpose: 'PRACTICE_ATTEMPTS',
            planId: intent.planId,
            paymentIntentId: intent.intentId,
            receiverAddress: verification.transaction?.receiver || intent.expectedReceiver,
            network: verification.transaction?.network || algorandService.getActiveNetwork(),
            attemptsUnlocked: 0
          },
          $set: {
            status: 'pending',
            failureReason: verification.reason || 'Transaction submitted, awaiting block confirmation'
          }
        },
        { upsert: true, new: true }
      );

      res.status(202).json({
        success: false,
        status: 'pending',
        code: 'TRANSACTION_PENDING',
        message: 'Transaction is submitted and awaiting Algorand block confirmation.',
        transaction: sanitizeTransactionForUser(pendingTx)
      });
      return;
    }

    // Handle broadcast rejection (e.g. overspend, balance below min, fee)
    if (broadcastError && (!verification.valid || !verification.transaction)) {
      const isOverspend =
        broadcastError.includes('overspend') ||
        broadcastError.includes('below min') ||
        broadcastError.includes('balance');

      const userFriendlyMsg = isOverspend
        ? 'Your wallet has insufficient ALGO to cover the transaction amount plus Algorand minimum balance requirement (0.1 ALGO) and network fee (0.001 ALGO).'
        : `Algorand transaction submission rejected: ${broadcastError}`;

      intent.status = 'failed';
      await intent.save();

      res.status(400).json({
        success: false,
        status: 'failed',
        code: isOverspend ? 'INSUFFICIENT_FUNDS_FOR_FEE' : 'BROADCAST_REJECTED',
        message: userFriendlyMsg
      });
      return;
    }

    // Handle invalid or rejected transactions
    if (!verification.valid || !verification.transaction) {
      if (verification.code !== 'TRANSACTION_NOT_FOUND') {
        try {
          await PaymentTransaction.findOneAndUpdate(
            { transactionId: cleanTxId, status: { $ne: 'verified' } },
            {
              $set: {
                userId: user._id,
                walletAddress:
                  verification.transaction?.sender || expectedSender || 'unknown',
                transactionId: cleanTxId,
                amount: verification.transaction?.amountAlgo ?? 0,
                amountMicroAlgos: verification.transaction?.amountMicroAlgos ?? 0,
                currency: 'ALGO',
                purpose: 'PRACTICE_ATTEMPTS',
                planId: intent.planId,
                paymentIntentId: intent.intentId,
                receiverAddress:
                  verification.transaction?.receiver || intent.expectedReceiver,
                network:
                  verification.transaction?.network || algorandService.getActiveNetwork(),
                blockchainRound: verification.transaction?.confirmedRound,
                attemptsUnlocked: 0,
                status: verification.status === 'failed' ? 'failed' : 'rejected',
                failureReason: verification.reason
              }
            },
            { upsert: true, new: true }
          );
        } catch {
          // Ignore duplicate key race on rejected log
        }
      }

      intent.status = 'failed';
      await intent.save();

      res.status(400).json({
        success: false,
        status: verification.status,
        code: verification.code,
        message: verification.reason || 'Blockchain transaction verification failed.'
      });
      return;
    }

    // 5. ATOMIC CLAIM & UNLOCK:
    // Use atomic compare-and-set with unique index on transactionId so concurrent requests
    // with the same transactionId can NEVER unlock attempts more than once.
    const txData = verification.transaction;
    let verifiedTxDoc;

    try {
      verifiedTxDoc = await PaymentTransaction.findOneAndUpdate(
        {
          transactionId: cleanTxId,
          status: { $ne: 'verified' }
        },
        {
          $set: {
            userId: user._id,
            walletAddress: txData.sender,
            transactionId: cleanTxId,
            amount: txData.amountAlgo,
            amountMicroAlgos: txData.amountMicroAlgos,
            currency: 'ALGO',
            purpose: 'PRACTICE_ATTEMPTS',
            planId: intent.planId,
            paymentIntentId: intent.intentId,
            receiverAddress: txData.receiver,
            network: txData.network,
            blockchainRound: txData.confirmedRound,
            attemptsUnlocked: intent.paidAttemptsToUnlock,
            status: 'verified',
            verifiedAt: new Date(),
            failureReason: undefined
          }
        },
        { upsert: true, new: true }
      );
    } catch (err: any) {
      if (err?.code === 11000) {
        res.status(409).json({
          success: false,
          message: 'This blockchain transaction has already been verified and processed.',
          code: 'DUPLICATE_TRANSACTION'
        });
        return;
      }
      throw err;
    }

    if (!verifiedTxDoc) {
      res.status(409).json({
        success: false,
        message: 'This blockchain transaction has already been verified and processed.',
        code: 'DUPLICATE_TRANSACTION'
      });
      return;
    }

    if (!verifiedTxDoc.receiptNumber) {
      verifiedTxDoc.receiptNumber = paymentReceiptService.generateReceiptNumber();
      await verifiedTxDoc.save();
    }

    // Atomically mark intent completed and unlock attempts on the User document
    await PaymentIntent.updateOne(
      { _id: intent._id },
      {
        $set: {
          status: 'completed',
          transactionId: cleanTxId,
          completedAt: new Date()
        }
      }
    );

    const targetPlanTier =
      intent.planId === 'master' ? 'enterprise' : 'pro';

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $inc: { 'paidAttempts.total': intent.paidAttemptsToUnlock },
        $set: { plan: targetPlanTier }
      },
      { new: true }
    );

    // Activate domain preparation subscription if entitled
    let planData: any = await Plan.findOne({ planId: intent.planId }).lean();
    if (!planData) {
      planData = getPlanById(intent.planId);
    }

    let subscriptionDoc: any = null;
    const hasDomainEntitlement = Boolean(
      planData?.entitlements?.domainPreparation ||
      ['domain_pass', 'pro', 'master'].includes(intent.planId)
    );

    if (hasDomainEntitlement) {
      const durationDays =
        planData?.entitlements?.subscriptionDurationDays ||
        (intent.planId === 'master' ? 90 : 30);

      const existingSub = await Subscription.findOne({
        userId: user._id,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).sort({ expiresAt: -1 });

      const baseDate = existingSub ? new Date(existingSub.expiresAt) : new Date();
      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const allowedDomains = planData?.entitlements?.allowedDomains?.length
        ? planData.entitlements.allowedDomains
        : ['*'];

      try {
        subscriptionDoc = await Subscription.create({
          userId: user._id,
          planId: intent.planId,
          planName: intent.planName,
          transactionId: cleanTxId,
          paymentIntentId: intent.intentId,
          status: 'active',
          startDate: new Date(),
          expiresAt,
          pricePaidAlgo: txData.amountAlgo,
          currency: 'ALGO',
          walletAddress: txData.sender || verifiedTxDoc.walletAddress || user.walletAddress || 'WALLET_PENDING',
          entitlements: {
            domainPreparation: true,
            allowedDomains,
            practiceAttempts: intent.paidAttemptsToUnlock,
            unlimitedDomainPractice: true,
            codeWorkspacesEnabled: true,
            codeVisualization: Boolean(planData?.entitlements?.codeVisualization)
          }
        });
      } catch (subErr: any) {
        if (subErr.code === 11000) {
          subscriptionDoc = await Subscription.findOne({ transactionId: cleanTxId });
        } else {
          throw subErr;
        }
      }

      logger.info('DOMAIN_SUBSCRIPTION_ACTIVATED', {
        userId: user._id.toString(),
        details: {
          planId: intent.planId,
          expiresAt: expiresAt.toISOString(),
          transactionId: cleanTxId
        }
      });
    }

    logger.info('ALGORAND_PAYMENT_VERIFIED_AND_UNLOCKED', {
      userId: user._id.toString(),
      email: user.email,
      details: {
        transactionId: cleanTxId,
        paymentIntentId: intent.intentId,
        planId: intent.planId,
        amountAlgo: txData.amountAlgo,
        attemptsUnlocked: intent.paidAttemptsToUnlock,
        newPaidAttemptsTotal: updatedUser?.paidAttempts?.total,
        subscriptionActivated: Boolean(subscriptionDoc)
      }
    });

    res.json({
      success: true,
      status: 'verified',
      message: `Payment verified on Algorand! Unlocked ${intent.paidAttemptsToUnlock} paid practice attempts${
        subscriptionDoc ? ' and activated your Domain Preparation subscription!' : '.'
      }`,
      attemptsUnlocked: intent.paidAttemptsToUnlock,
      paidAttempts: updatedUser?.paidAttempts,
      freeAttempts: updatedUser?.freeAttempts,
      plan: updatedUser?.plan,
      subscription: subscriptionDoc
        ? {
            active: true,
            planId: subscriptionDoc.planId,
            planName: subscriptionDoc.planName,
            expiresAt: subscriptionDoc.expiresAt,
            entitlements: subscriptionDoc.entitlements
          }
        : null,
      transaction: sanitizeTransactionForUser(verifiedTxDoc)
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Payment verification failed.',
      code: error.code || 'PAYMENT_VERIFICATION_ERROR'
    });
  }
}

/**
 * GET /api/payments/history
 * Returns the authenticated user's payment transaction history.
 */
export async function getPaymentHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const transactions = await PaymentTransaction.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      count: transactions.length,
      transactions: transactions.map(sanitizeTransactionForUser)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load payment history.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/payments/:id
 * Retrieves a specific payment transaction or payment intent.
 * Accessible only to the owner or an authorized admin.
 */
export async function getPaymentById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    const role = req.user?.role;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const { id } = req.params;
    const isAdmin = role === 'platform_admin' || role === 'college_admin';

    // Search in PaymentTransaction first (by transactionId, paymentIntentId, or _id)
    const txQuery: any = {
      $or: [{ transactionId: id }, { paymentIntentId: id }]
    };
    if (mongoose.Types.ObjectId.isValid(id)) {
      txQuery.$or.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    const tx = await PaymentTransaction.findOne(txQuery).lean();
    if (tx) {
      if (!isAdmin && tx.userId.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You do not own this payment record.',
          code: 'FORBIDDEN'
        });
        return;
      }

      res.json({
        success: true,
        type: 'transaction',
        payment: sanitizeTransactionForUser(tx)
      });
      return;
    }

    // Fallback: Check PaymentIntent
    const intentQuery: any = { $or: [{ intentId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      intentQuery.$or.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    const intent = await PaymentIntent.findOne(intentQuery).lean();
    if (!intent) {
      res.status(404).json({
        success: false,
        message: 'Payment record not found.',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (!isAdmin && intent.userId.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this payment intent.',
        code: 'FORBIDDEN'
      });
      return;
    }

    res.json({
      success: true,
      type: 'intent',
      payment: {
        intentId: intent.intentId,
        planId: intent.planId,
        planName: intent.planName,
        expectedAmount: intent.expectedAmountAlgo,
        currency: intent.currency,
        expectedReceiver: intent.expectedReceiver,
        paidAttemptsToUnlock: intent.paidAttemptsToUnlock,
        status: intent.status,
        transactionId: intent.transactionId,
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve payment details.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/payments/admin/transactions
 * Admin-only endpoint supporting filtering by user, wallet, transactionId, status, purpose, network, and date.
 */
export async function getAdminTransactions(req: Request, res: Response): Promise<void> {
  try {
    const {
      userId,
      walletAddress,
      transactionId,
      status,
      purpose,
      network,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      limit = '50',
      page = '1'
    } = req.query;

    const filter: any = {};

    if (userId && typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    if (walletAddress && typeof walletAddress === 'string') {
      filter.walletAddress = walletAddress.trim();
    }
    if (transactionId && typeof transactionId === 'string') {
      filter.transactionId = transactionId.trim();
    }
    if (status && typeof status === 'string') {
      filter.status = status.trim();
    }
    if (purpose && typeof purpose === 'string') {
      filter.purpose = purpose.trim();
    }
    if (network && typeof network === 'string') {
      filter.network = network.trim().toLowerCase();
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(String(startDate));
      if (endDate) filter.createdAt.$lte = new Date(String(endDate));
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .populate('userId', 'name email role collegeId walletAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PaymentTransaction.countDocuments(filter)
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      transactions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch admin transaction records.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/payments/admin/plans
 * Returns all plans (active & inactive) for admin management.
 */
export async function getAdminPlans(_req: Request, res: Response): Promise<void> {
  try {
    const plans = await Plan.find().sort({ price: 1 }).lean();
    res.json({
      success: true,
      plans
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch admin plans.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * POST /api/payments/admin/plans
 * Creates a new premium plan. Strictly enforces 0 < price < 9 ALGO.
 */
export async function createAdminPlan(req: Request, res: Response): Promise<void> {
  try {
    const { planId, name, description, price, attempts, popular, features, active } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Plan name is required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0 || numPrice >= 9) {
      res.status(400).json({
        success: false,
        message: 'Plan price must be strictly greater than 0 and less than 9 ALGO (0 < price < 9 ALGO).',
        code: 'INVALID_PLAN_PRICE'
      });
      return;
    }

    const numAttempts = Number(attempts);
    if (isNaN(numAttempts) || numAttempts < 1) {
      res.status(400).json({
        success: false,
        message: 'Attempts must be an integer greater than or equal to 1.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const slug = (planId && typeof planId === 'string' ? planId : name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    const existing = await Plan.findOne({ planId: slug });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Plan with ID "${slug}" already exists.`,
        code: 'CONFLICT'
      });
      return;
    }

    const newPlan = await Plan.create({
      planId: slug,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      price: numPrice,
      currency: 'ALGO',
      attempts: Math.floor(numAttempts),
      active: active !== undefined ? Boolean(active) : true,
      popular: Boolean(popular),
      features: Array.isArray(features) ? features.filter(f => typeof f === 'string' && f.trim()) : []
    });

    logger.info('ADMIN_PLAN_CREATED', {
      details: { planId: newPlan.planId, price: newPlan.price, attempts: newPlan.attempts }
    });

    res.status(201).json({
      success: true,
      message: 'Plan created successfully.',
      plan: newPlan
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create plan.',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * PUT /api/payments/admin/plans/:id
 * Updates an existing plan. Strictly enforces 0 < price < 9 ALGO if price is provided.
 */
export async function updateAdminPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, price, attempts, popular, features, active } = req.body;

    const query: any = { $or: [{ planId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    const plan = await Plan.findOne(query);
    if (!plan) {
      res.status(404).json({
        success: false,
        message: `Plan "${id}" not found.`,
        code: 'NOT_FOUND'
      });
      return;
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0 || numPrice >= 9) {
        res.status(400).json({
          success: false,
          message: 'Plan price must be strictly greater than 0 and less than 9 ALGO (0 < price < 9 ALGO).',
          code: 'INVALID_PLAN_PRICE'
        });
        return;
      }
      plan.price = numPrice;
    }

    if (attempts !== undefined) {
      const numAttempts = Number(attempts);
      if (isNaN(numAttempts) || numAttempts < 1) {
        res.status(400).json({
          success: false,
          message: 'Attempts must be at least 1.',
          code: 'VALIDATION_ERROR'
        });
        return;
      }
      plan.attempts = Math.floor(numAttempts);
    }

    if (name && typeof name === 'string') plan.name = name.trim();
    if (description !== undefined && typeof description === 'string') plan.description = description.trim();
    if (active !== undefined) plan.active = Boolean(active);
    if (popular !== undefined) plan.popular = Boolean(popular);
    if (Array.isArray(features)) plan.features = features.filter(f => typeof f === 'string' && f.trim());

    await plan.save();

    logger.info('ADMIN_PLAN_UPDATED', {
      details: { planId: plan.planId, price: plan.price, attempts: plan.attempts, active: plan.active }
    });

    res.json({
      success: true,
      message: 'Plan updated successfully.',
      plan
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update plan.',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * PATCH /api/payments/admin/plans/:id/status
 * Toggles active/inactive status for a plan.
 */
export async function toggleAdminPlanStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const query: any = { $or: [{ planId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    const plan = await Plan.findOne(query);
    if (!plan) {
      res.status(404).json({
        success: false,
        message: `Plan "${id}" not found.`,
        code: 'NOT_FOUND'
      });
      return;
    }

    plan.active = !plan.active;
    await plan.save();

    res.json({
      success: true,
      message: `Plan "${plan.name}" is now ${plan.active ? 'active' : 'inactive'}.`,
      plan
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle plan status.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/payments/receipt/:id
 * Retrieves compiled payment receipt data for an independently verified Algorand payment.
 */
export async function getPaymentReceiptData(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const isAdmin = req.user?.role === 'platform_admin';

    const receipt = await paymentReceiptService.compileReceiptData(id, userId, isAdmin);
    res.json({
      success: true,
      receipt
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to retrieve payment receipt.',
      code: error.code || 'RECEIPT_ERROR'
    });
  }
}

/**
 * GET /api/payments/receipt/:id/pdf
 * Generates and downloads a pixel-perfect, official PDF payment receipt for an Algorand transaction.
 */
export async function downloadPaymentReceiptPdf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const isAdmin = req.user?.role === 'platform_admin';

    const receipt = await paymentReceiptService.compileReceiptData(id, userId, isAdmin);
    const pdfBuffer = await paymentReceiptService.generatePdf(receipt);

    const filename = `Evalora-Payment-Receipt-${receipt.receiptNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to generate payment receipt PDF.',
      code: error.code || 'RECEIPT_ERROR'
    });
  }
}

/**
 * GET /api/payments/subscription/status
 * Returns current authenticated user's active subscription status, entitlements, and remaining days.
 */
export async function getUserSubscriptionStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    const activeSub = await Subscription.findOne({
      userId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ expiresAt: -1 });

    if (!activeSub) {
      res.json({
        success: true,
        subscribed: false,
        subscription: null
      });
      return;
    }

    const remainingMs = new Date(activeSub.expiresAt).getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    res.json({
      success: true,
      subscribed: true,
      subscription: {
        id: activeSub._id,
        planId: activeSub.planId,
        planName: activeSub.planName,
        status: activeSub.status,
        startDate: activeSub.startDate,
        expiresAt: activeSub.expiresAt,
        daysRemaining: remainingDays,
        entitlements: activeSub.entitlements,
        walletAddress: activeSub.walletAddress,
        transactionId: activeSub.transactionId
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load subscription status.',
      code: 'INTERNAL_ERROR'
    });
  }
}


