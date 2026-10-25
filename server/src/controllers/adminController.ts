import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  User,
  College,
  Department,
  Question,
  Assessment,
  AssessmentAttempt,
  PaymentTransaction,
  AuditLog,
  PracticeSession,
  Submission
} from '../models/index.js';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/admin/overview
 * Centralized system metrics for the Admin Dashboard.
 */
export async function getAdminOverview(req: Request, res: Response): Promise<void> {
  try {
    const [
      totalUsers,
      totalStudents,
      totalFaculty,
      totalCollegeAdmins,
      totalColleges,
      activeColleges,
      totalQuestions,
      codingQuestions,
      dsaQuestions,
      aptitudeQuestions,
      reasoningQuestions,
      totalAssessments,
      publishedAssessments,
      totalTransactions,
      verifiedTransactions,
      recentAuditLogs
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'college_admin' }),
      College.countDocuments(),
      College.countDocuments({ status: 'active' }),
      Question.countDocuments(),
      Question.countDocuments({ type: 'coding' }),
      Question.countDocuments({ category: { $regex: /^dsa/i } }),
      Question.countDocuments({ category: { $regex: /^aptitude/i } }),
      Question.countDocuments({ category: { $regex: /^reasoning/i } }),
      Assessment.countDocuments(),
      Assessment.countDocuments({ status: 'published' }),
      PaymentTransaction.countDocuments(),
      PaymentTransaction.countDocuments({ status: 'verified' }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'name email role')
    ]);

    // Aggregate ALGO payment volume
    const volumeAgg = await PaymentTransaction.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: null, totalAlgo: { $sum: '$amount' } } }
    ]);
    const totalAlgoVolume = volumeAgg[0]?.totalAlgo || 0;

    res.json({
      success: true,
      metrics: {
        users: {
          total: totalUsers,
          students: totalStudents,
          faculty: totalFaculty,
          collegeAdmins: totalCollegeAdmins
        },
        organizations: {
          total: totalColleges,
          active: activeColleges
        },
        questions: {
          total: totalQuestions,
          coding: codingQuestions,
          dsa: dsaQuestions,
          aptitude: aptitudeQuestions,
          reasoning: reasoningQuestions
        },
        assessments: {
          total: totalAssessments,
          published: publishedAssessments
        },
        payments: {
          totalTransactions,
          verifiedTransactions,
          totalAlgoVolume,
          treasuryWallet: ENV.EVALORA_ADMIN_WALLET
        },
        system: {
          network: ENV.ALGORAND_NETWORK || 'testnet',
          adminEmail: ENV.EVALORA_ADMIN_EMAIL,
          adminWallet: ENV.EVALORA_ADMIN_WALLET
        },
        recentAuditLogs
      }
    });
  } catch (error: any) {
    logger.error('ADMIN_OVERVIEW_ERROR', { details: { message: error.message } });
    res.status(500).json({ success: false, message: 'Failed to load admin overview metrics.' });
  }
}

/**
 * GET /api/admin/users
 * Paginated list of users with search, role, and status filtering.
 */
export async function getAdminUsers(req: Request, res: Response): Promise<void> {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    const filter: any = {};

    if (role && role !== 'all') {
      filter.role = role;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } },
        { walletAddress: { $regex: q, $options: 'i' } },
        { 'wallets.address': { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .populate('collegeId', 'name code')
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch users.' });
  }
}

/**
 * GET /api/admin/users/:id
 * Detailed profile, activity, and payment history for a user.
 */
export async function getAdminUserDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID.' });
      return;
    }

    const user = await User.findById(id)
      .select('-passwordHash')
      .populate('collegeId', 'name code status')
      .populate('departmentId', 'name code');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const [recentPractice, recentAttempts, transactions] = await Promise.all([
      PracticeSession.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5).lean(),
      AssessmentAttempt.find({ studentId: user._id })
        .populate('assessmentId', 'title')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      PaymentTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      success: true,
      user,
      activity: {
        recentPractice,
        recentAttempts,
        transactions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Suspends or reactivates a user account with audit logging.
 */
export async function updateAdminUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be active or suspended.' });
      return;
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (targetUser.role === 'admin' || targetUser.email === ENV.EVALORA_ADMIN_EMAIL) {
      res.status(400).json({ success: false, message: 'Cannot change status of the primary admin account.' });
      return;
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    if (status === 'suspended') {
      targetUser.authTokenVersion = (targetUser.authTokenVersion || 0) + 1;
    }
    await targetUser.save();

    await AuditLog.create({
      userId: req.user?._id,
      action: status === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      resource: 'USER',
      resourceId: targetUser._id.toString(),
      details: {
        targetUserEmail: targetUser.email,
        targetUserName: targetUser.name,
        previousStatus,
        newStatus: status,
        reason: reason || 'Admin action'
      }
    });

    res.json({
      success: true,
      message: `User ${targetUser.email} has been ${status === 'suspended' ? 'suspended' : 'reactivated'}.`,
      user: {
        _id: targetUser._id,
        status: targetUser.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * DELETE /api/admin/users/:id
 * Permanently deletes a user account with validation & audit logging.
 */
export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (targetUser.role === 'admin' || targetUser.email === ENV.EVALORA_ADMIN_EMAIL) {
      res.status(400).json({ success: false, message: 'The primary admin account cannot be deleted.' });
      return;
    }

    await Promise.all([
      User.deleteOne({ _id: targetUser._id }),
      PracticeSession.deleteMany({ userId: targetUser._id }),
      AssessmentAttempt.deleteMany({ studentId: targetUser._id })
    ]);

    await AuditLog.create({
      userId: req.user?._id,
      action: 'USER_DELETED',
      resource: 'USER',
      resourceId: targetUser._id.toString(),
      details: {
        deletedUserEmail: targetUser.email,
        deletedUserName: targetUser.name,
        deletedUserRole: targetUser.role
      }
    });

    res.json({ success: true, message: `User account ${targetUser.email} permanently deleted.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/organizations
 * Overview of all onboarded institutions and universities.
 */
export async function getAdminOrganizations(req: Request, res: Response): Promise<void> {
  try {
    const { search, status } = req.query;
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { contactEmail: { $regex: q, $options: 'i' } },
        { domain: { $regex: q, $options: 'i' } }
      ];
    }

    const colleges = await College.find(filter).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      colleges.map(async (col) => {
        const [studentCount, facultyCount, departmentCount, assessmentCount] = await Promise.all([
          User.countDocuments({ collegeId: col._id, role: 'student' }),
          User.countDocuments({ collegeId: col._id, role: 'faculty' }),
          Department.countDocuments({ collegeId: col._id }),
          Assessment.countDocuments({ collegeId: col._id })
        ]);
        return {
          ...col,
          studentCount,
          facultyCount,
          departmentCount,
          assessmentCount
        };
      })
    );

    res.json({ success: true, organizations: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PATCH /api/admin/organizations/:id/status
 * Toggles an organization's active/suspended status with audit logging.
 */
export async function toggleAdminOrganizationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const college = await College.findById(id);
    if (!college) {
      res.status(404).json({ success: false, message: 'Organization not found.' });
      return;
    }

    const newStatus = college.status === 'active' ? 'suspended' : 'active';
    college.status = newStatus;
    await college.save();

    await AuditLog.create({
      userId: req.user?._id,
      collegeId: college._id,
      action: newStatus === 'active' ? 'ORGANIZATION_ACTIVATED' : 'ORGANIZATION_SUSPENDED',
      resource: 'COLLEGE',
      resourceId: college._id.toString(),
      details: {
        collegeName: college.name,
        collegeCode: college.code,
        status: newStatus
      }
    });

    res.json({
      success: true,
      message: `Organization ${college.name} is now ${newStatus}.`,
      status: newStatus
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * DELETE /api/admin/organizations/:id
 * Permanently deletes an organization and cleans up linked departments.
 */
export async function deleteAdminOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const college = await College.findById(id);
    if (!college) {
      res.status(404).json({ success: false, message: 'Organization not found.' });
      return;
    }

    await Promise.all([
      College.deleteOne({ _id: college._id }),
      Department.deleteMany({ collegeId: college._id }),
      User.updateMany({ collegeId: college._id }, { $set: { collegeId: null, departmentId: null } })
    ]);

    await AuditLog.create({
      userId: req.user?._id,
      action: 'ORGANIZATION_DELETED',
      resource: 'COLLEGE',
      resourceId: college._id.toString(),
      details: {
        collegeName: college.name,
        collegeCode: college.code
      }
    });

    res.json({ success: true, message: `Organization ${college.name} deleted.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/questions
 * Filtered, paginated Question Bank inspection for Administrator.
 */
export async function getAdminQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { search, category, topic, difficulty, type, page = 1, limit = 20 } = req.query;
    const filter: any = {};

    if (category && category !== 'all') {
      filter.category = { $regex: new RegExp(`^${category}`, 'i') };
    }
    if (topic && topic !== 'all') {
      filter.topic = topic;
    }
    if (difficulty && difficulty !== 'all') {
      filter.difficulty = difficulty;
    }
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { statement: { $regex: q, $options: 'i' } },
        { topic: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(filter)
    ]);

    res.json({
      success: true,
      questions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/admin/questions
 * Creates a new question (Coding, MCQ, Aptitude, Reasoning, DSA) with full verification.
 */
export async function createAdminQuestion(req: Request, res: Response): Promise<void> {
  try {
    const {
      title,
      statement,
      type = 'mcq',
      category = 'DSA',
      topic,
      difficulty = 'medium',
      marks = 10,
      negativeMarks = 0,
      options,
      codingProblem,
      supportedLanguages,
      starterCodes,
      testCases,
      constraints,
      inputFormat,
      outputFormat,
      explanation
    } = req.body;

    if (!title || !statement || !topic) {
      res.status(400).json({ success: false, message: 'Title, statement, and topic are required.' });
      return;
    }

    const question = await Question.create({
      creatorId: req.user?._id,
      collegeId: null, // Global question
      title: title.trim(),
      statement: statement.trim(),
      type,
      category: category.trim(),
      topic: topic.trim(),
      difficulty,
      marks: Number(marks) || 10,
      negativeMarks: Number(negativeMarks) || 0,
      options: options || [],
      codingProblem: codingProblem || {
        description: statement.trim(),
        inputFormat,
        outputFormat,
        constraints: constraints || [],
        examples: [],
        testCases: testCases || [],
        supportedLanguages: supportedLanguages || ['python', 'cpp', 'java', 'c'],
        starterCode: starterCodes || {}
      },
      explanation: explanation?.trim()
    });

    await AuditLog.create({
      userId: req.user?._id,
      action: 'QUESTION_CREATED',
      resource: 'QUESTION',
      resourceId: question._id.toString(),
      details: {
        title: question.title,
        type: question.type,
        category: question.category,
        topic: question.topic,
        difficulty: question.difficulty
      }
    });

    res.status(201).json({ success: true, message: 'Question created successfully.', question });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /api/admin/questions/:id
 * Updates an existing question.
 */
export async function updateAdminQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const question = await Question.findByIdAndUpdate(id, req.body, { new: true });
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found.' });
      return;
    }

    await AuditLog.create({
      userId: req.user?._id,
      action: 'QUESTION_UPDATED',
      resource: 'QUESTION',
      resourceId: question._id.toString(),
      details: { title: question.title, category: question.category }
    });

    res.json({ success: true, message: 'Question updated successfully.', question });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * DELETE /api/admin/questions/:id
 * Deletes a question from the question bank with audit logging.
 */
export async function deleteAdminQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const question = await Question.findByIdAndDelete(id);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found.' });
      return;
    }

    await AuditLog.create({
      userId: req.user?._id,
      action: 'QUESTION_DELETED',
      resource: 'QUESTION',
      resourceId: question._id.toString(),
      details: { title: question.title, category: question.category }
    });

    res.json({ success: true, message: 'Question deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/practice/config
 * System-level practice engine settings and category topics.
 */
export async function getAdminPracticeConfig(_req: Request, res: Response): Promise<void> {
  try {
    const categories = [
      { id: 'dsa', name: 'Data Structures & Algorithms', topics: ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Recursion', 'Dynamic Programming'] },
      { id: 'aptitude', name: 'Quantitative Aptitude', topics: ['Percentages', 'Profit and Loss', 'Time and Work', 'Number Systems', 'Verbal Ability'] },
      { id: 'reasoning', name: 'Logical Reasoning', topics: ['Logical Reasoning', 'Blood Relations', 'Syllogisms', 'Direction Sense', 'Puzzles'] },
      { id: 'coding', name: 'Coding & Sandboxed Execution', topics: ['Arrays', 'Strings', 'Dynamic Programming', 'Graphs', 'Trees'] },
      { id: 'placement', name: 'Placement & Technical Core', topics: ['DBMS', 'Operating Systems', 'Computer Networks', 'OOP'] }
    ];

    res.json({
      success: true,
      config: {
        categories,
        defaultFreeAttempts: 10,
        aiReplenishmentEnabled: ENV.AI_AUTO_REPLENISH,
        geminiModel: ENV.GEMINI_MODEL,
        freshQuestionRule: 'Avoid previously attempted questions where sufficient fresh pool exists'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/assessments
 * Overview of all platform assessments.
 */
export async function getAdminAssessments(req: Request, res: Response): Promise<void> {
  try {
    const { search, status } = req.query;
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      filter.title = { $regex: search.trim(), $options: 'i' };
    }

    const assessments = await Assessment.find(filter)
      .populate('collegeId', 'name code')
      .populate('creatorId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      assessments.map(async (ass) => {
        const attemptCount = await AssessmentAttempt.countDocuments({ assessmentId: ass._id });
        return {
          ...ass,
          attemptCount
        };
      })
    );

    res.json({ success: true, assessments: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PATCH /api/admin/assessments/:id/status
 * Toggles an assessment's publication status with audit logging.
 */
export async function toggleAdminAssessmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      res.status(404).json({ success: false, message: 'Assessment not found.' });
      return;
    }

    const newStatus = assessment.status === 'published' ? 'draft' : 'published';
    assessment.status = newStatus;
    await assessment.save();

    await AuditLog.create({
      userId: req.user?._id,
      collegeId: assessment.collegeId || undefined,
      action: 'ASSESSMENT_STATUS_TOGGLED',
      resource: 'ASSESSMENT',
      resourceId: assessment._id.toString(),
      details: { title: assessment.title, status: newStatus }
    });

    res.json({
      success: true,
      message: `Assessment "${assessment.title}" status changed to ${newStatus}.`,
      status: newStatus
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/payments
 * Full inspection of Algorand payments, wallets, and verification records.
 */
export async function getAdminPayments(req: Request, res: Response): Promise<void> {
  try {
    const { search, status, page = 1, limit = 25 } = req.query;
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { transactionId: { $regex: q, $options: 'i' } },
        { walletAddress: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PaymentTransaction.countDocuments(filter)
    ]);

    res.json({
      success: true,
      treasuryWallet: ENV.EVALORA_ADMIN_WALLET,
      network: ENV.ALGORAND_NETWORK || 'testnet',
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/audit-logs
 * System-wide audit log trail for governance and security reviews.
 */
export async function getAdminAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { action, limit = 50 } = req.query;
    const filter: any = {};

    if (action && typeof action === 'string') {
      filter.action = action;
    }

    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
