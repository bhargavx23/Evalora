import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import {
  User,
  AuthChallenge,
  QrAuthSession,
  PaymentIntent,
  PaymentTransaction,
  PracticeSession,
  PracticeQuestionHistory,
  AssessmentAttempt,
  Submission,
  StudentProfile,
  StudentSkill,
  Resume,
  SuspiciousActivity,
  CodeSimilarityResult,
  AuditLog,
  Question,
  College,
  Department
} from '../models/index.js';

export async function resetDevDatabase(): Promise<void> {
  console.log('[DevReset] Starting controlled development database reset...');

  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  // 1. Clean development test records
  console.log('[DevReset] Clearing dummy development users and authentication sessions...');
  const genuineEmails = [ENV.EVALORA_ADMIN_EMAIL, 'qwerty1234567890siva@gmail.com'];
  const dummyUsers = await User.find({ email: { $nin: genuineEmails } }).lean();
  const dummyUserIds = dummyUsers.map(u => u._id);

  await Promise.all([
    User.deleteMany({ _id: { $in: dummyUserIds } }),
    AuthChallenge.deleteMany({ userId: { $in: dummyUserIds } }),
    QrAuthSession.deleteMany({ userId: { $in: dummyUserIds } }),
    PaymentIntent.deleteMany({ userId: { $in: dummyUserIds } }),
    PaymentTransaction.deleteMany({ userId: { $in: dummyUserIds } }),
    PracticeSession.deleteMany({ userId: { $in: dummyUserIds } }),
    PracticeQuestionHistory.deleteMany({ userId: { $in: dummyUserIds } }),
    AssessmentAttempt.deleteMany({ studentId: { $in: dummyUserIds } }),
    Submission.deleteMany({ studentId: { $in: dummyUserIds } }),
    StudentProfile.deleteMany({ userId: { $in: dummyUserIds } }),
    StudentSkill.deleteMany({ userId: { $in: dummyUserIds } }),
    Resume.deleteMany({ userId: { $in: dummyUserIds } }),
    SuspiciousActivity.deleteMany({ studentId: { $in: dummyUserIds } }),
    CodeSimilarityResult.deleteMany({ $or: [{ studentAId: { $in: dummyUserIds } }, { studentBId: { $in: dummyUserIds } }] }),
    AuditLog.deleteMany({ userId: { $in: dummyUserIds } })
  ]);

  // Keep colleges & departments clean or reset them ready for new organization registrations
  // We can remove test colleges so colleges register fresh via /college-register
  await College.deleteMany({});
  await Department.deleteMany({});

  // Mark preserved seed questions as platform-wide global questions (collegeId: null)
  await Question.updateMany({}, { $set: { collegeId: null } });

  const questionCount = await Question.countDocuments();
  console.log(`[DevReset] Preserved ${questionCount} questions in the global question bank.`);

  // 2. Ensure initial authorized Evalora administrator exists
  const adminEmail = ENV.EVALORA_ADMIN_EMAIL;
  const adminWallet = ENV.EVALORA_ADMIN_WALLET;
  const defaultPasswordHash = await bcrypt.hash('Evalora@Admin2026!', 10);

  let initialAdmin = await User.findOne({ email: adminEmail });
  if (!initialAdmin) {
    console.log(`[DevReset] Seeding initial authorized admin: ${adminEmail}`);
    initialAdmin = await User.create({
      name: 'Evalora Administrator',
      email: adminEmail,
      passwordHash: defaultPasswordHash,
      role: 'admin',
      collegeId: null,
      walletAddress: adminWallet,
      wallets: [
        {
          address: adminWallet,
          walletType: 'pera',
          network: 'algorand',
          verified: true,
          linkedAt: new Date(),
          lastUsedAt: new Date()
        }
      ],
      authProviders: ['password', 'wallet'],
      emailVerified: true,
      status: 'active',
      plan: 'enterprise',
      freeAttempts: { total: 1000, used: 0 },
      paidAttempts: { total: 1000, used: 0 }
    });
  }

  // 3. Record first Audit Log entry
  await AuditLog.create({
    userId: initialAdmin._id,
    action: 'SYSTEM_DATABASE_RESET',
    resource: 'DATABASE',
    resourceId: 'dev_reset',
    details: {
      adminEmail: initialAdmin.email,
      adminWallet,
      questionsRetained: questionCount,
      timestamp: new Date().toISOString()
    }
  });

  console.log('[DevReset] Database reset successfully complete.');
  console.log(`[DevReset] Admin Account: ${initialAdmin.email} | Role: ${initialAdmin.role} | Wallet: ${adminWallet}`);
}

// Allow standalone execution: npx tsx src/utils/resetDevDatabase.ts
if (process.argv[1]?.includes('resetDevDatabase')) {
  resetDevDatabase()
    .then(() => disconnectDB())
    .catch((err) => {
      console.error('[DevReset] Error during reset:', err);
      process.exit(1);
    });
}
