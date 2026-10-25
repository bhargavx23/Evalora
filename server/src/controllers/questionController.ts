import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Question } from '../models/Question.js';
import { aiQuestionService } from '../services/aiQuestionService.js';
import { DifficultyLevel } from '../shared/types.js';

function sanitizeQuestionObjForStudent(obj: Record<string, any>): Record<string, any> {
  if (obj.options) {
    obj.options = obj.options.map((o: any) => ({ id: o.id, text: o.text }));
  }
  if (obj.codingDetails) {
    obj.codingDetails = { ...obj.codingDetails };
    delete obj.codingDetails.hiddenTestCases;
    delete obj.codingDetails.referenceSolution;
  }
  delete obj.explanation;
  delete obj.source;
  delete obj.createdBy;
  delete obj.generationProvider;
  delete obj.generationModel;
  delete obj.validationStatus;
  delete obj.normalizedHash;
  delete obj.generatedAt;
  delete obj.validatedAt;
  delete obj.rejectionReason;
  return obj;
}

export async function getQuestions(req: Request, res: Response): Promise<void> {
  try {
    const {
      topic,
      subtopic,
      difficulty,
      type,
      status,
      source,
      generationProvider,
      validationStatus,
      search,
      page = '1',
      limit = '20'
    } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    const filter: any = {};

    // Multi-tenant: show questions created for this college or global questions (collegeId: null)
    if (req.user?.role === 'platform_admin') {
      // Platform admin sees all
    } else if (req.user?.collegeId) {
      filter.$or = [
        { collegeId: new mongoose.Types.ObjectId(req.user.collegeId) },
        { collegeId: null }
      ];
    } else {
      filter.collegeId = null;
    }

    if (topic) filter.topic = topic;
    if (subtopic) filter.subtopic = subtopic;
    if (difficulty) filter.difficulty = difficulty;
    if (type) filter.type = type;

    if (req.user?.role !== 'student') {
      if (source) filter.source = source;
      if (generationProvider) filter.generationProvider = generationProvider;
      if (validationStatus) filter.validationStatus = validationStatus;
    }

    if (status && req.user?.role !== 'student') {
      filter.status = status;
    } else if (req.user?.role === 'student') {
      // Students only see verified and validated questions
      filter.status = 'verified';
      filter.validationStatus = {
        $nin: ['generated', 'validating', 'rejected', 'disabled', 'pending_execution']
      };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search as string, 'i')] } }
      ];
    }

    const total = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('creatorId', 'name email');

    // Strip private test cases, answers, and internal AI provenance if user is a student
    const sanitized = questions.map(q => {
      const obj: any = q.toObject();
      if (req.user?.role === 'student') {
        return sanitizeQuestionObjForStudent(obj);
      }
      return obj;
    });

    res.json({
      success: true,
      questions: sanitized,
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

export async function getQuestionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const question = await Question.findById(id).populate('creatorId', 'name email');

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    const obj: any = question.toObject();

    // Security check: if student, strip answer key, hidden test cases, and internal AI metadata
    if (req.user?.role === 'student') {
      sanitizeQuestionObjForStudent(obj);
    }

    res.json({ success: true, question: obj });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, message: 'Invalid format for parameter: id', code: 'INVALID_ID' });
      return;
    }
    res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
  }
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const collegeId = req.user?.collegeId ? new mongoose.Types.ObjectId(req.user.collegeId) : null;

    const question = await Question.create({
      ...body,
      collegeId: req.user?.role === 'platform_admin' ? (body.collegeId || null) : collegeId,
      creatorId: new mongoose.Types.ObjectId(req.user!._id),
      status: body.status || 'verified'
    });

    res.status(201).json({ success: true, message: 'Question created successfully', question });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const question = await Question.findById(id);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    // Tenant check
    if (req.user?.role !== 'platform_admin' && question.collegeId && question.collegeId.toString() !== req.user?.collegeId) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this question.' });
      return;
    }

    Object.assign(question, updates);
    await question.save();

    res.json({ success: true, message: 'Question updated successfully', question });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    if (req.user?.role !== 'platform_admin' && question.collegeId && question.collegeId.toString() !== req.user?.collegeId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    await Question.findByIdAndDelete(id);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function generateAIQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { category, topic, subtopic, difficulty, type, count = 3, publishValidated = false } = req.body;

    if (!topic || !difficulty || !type) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Topic, difficulty, and type are required'
      });
      return;
    }

    const result = await aiQuestionService.generateAndValidateQuestions({
      category,
      topic,
      subtopic,
      difficulty: difficulty as DifficultyLevel,
      type: (String(type).toLowerCase() === 'coding' ? 'coding' : 'mcq') as 'mcq' | 'coding',
      count: Math.min(Math.max(1, Number(count) || 3), 10),
      collegeId: req.user?.collegeId || null,
      creatorId: req.user?._id || null,
      callerKey: req.user?._id || 'faculty',
      publishValidated: Boolean(publishValidated)
    });

    if (!result.success) {
      if (
        result.code === 'AI_GENERATION_UNAVAILABLE' ||
        result.code === 'RATE_LIMIT_EXCEEDED' ||
        result.code === 'VALIDATION_REJECTED_ALL'
      ) {
        try {
          const fallbackFilter: any = {
            $or: [
              { topic: new RegExp(String(topic).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
              { category: new RegExp(`^${String(category || topic).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            ],
            type: String(type).toLowerCase() === 'coding' ? 'coding' : 'mcq'
          };
          const poolQuestions = await Question.find(fallbackFilter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(count) || 3, 10))
            .lean();

          if (poolQuestions.length > 0) {
            res.json({
              success: true,
              code: 'FALLBACK_POOL',
              message: `Served ${poolQuestions.length} draft question(s) from question bank (AI service temporarily busy).`,
              drafts: poolQuestions,
              questions: poolQuestions,
              telemetry: {
                requestedCount: Number(count) || 3,
                generatedCount: poolQuestions.length,
                validatedCount: poolQuestions.length,
                rejectedCount: 0,
                duplicateCount: 0,
                pendingExecutionCount: 0,
                durationMs: 0
              }
            });
            return;
          }
        } catch {
          // Ignore and continue to error response
        }
      }

      const statusMap: Record<string, number> = {
        INVALID_INPUT: 400,
        RATE_LIMIT_EXCEEDED: 429,
        VALIDATION_REJECTED_ALL: 422,
        AI_GENERATION_UNAVAILABLE: 503
      };
      const status = statusMap[result.code] || 503;
      res.status(status).json({
        success: false,
        code: result.code,
        message: result.message,
        requestedCount: result.requestedCount,
        generatedCount: result.generatedCount,
        validatedCount: result.validatedCount,
        rejectedCount: result.rejectedCount,
        duplicateCount: result.duplicateCount
      });
      return;
    }

    res.json({
      success: true,
      code: result.code,
      message: `Generated and validated ${result.questions.length} question(s).`,
      drafts: result.questions,
      questions: result.questions,
      telemetry: {
        requestedCount: result.requestedCount,
        generatedCount: result.generatedCount,
        validatedCount: result.validatedCount,
        rejectedCount: result.rejectedCount,
        duplicateCount: result.duplicateCount,
        pendingExecutionCount: result.pendingExecutionCount,
        durationMs: result.durationMs
      }
    });
  } catch {
    res.status(503).json({
      success: false,
      code: 'AI_GENERATION_UNAVAILABLE',
      message: 'Fresh questions could not be generated at this time.'
    });
  }
}

export async function getAIGenerationMetrics(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    metrics: aiQuestionService.getMetrics()
  });
}

export async function approveQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    question.status = 'verified';
    question.validationStatus = 'validated';
    question.validatedAt = new Date();
    await question.save();

    res.json({ success: true, message: 'Question approved into verified bank', question });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
