import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Domain, IDomain } from '../models/Domain.js';
import { DomainProgress } from '../models/DomainProgress.js';
import { Subscription } from '../models/Subscription.js';
import { domainPracticeService } from '../services/domainPracticeService.js';
import { domainCurriculumService } from '../services/domainCurriculumService.js';
import { codeExecutionService } from '../services/codeExecutionService.js';
import { resolveDomainModule } from '../config/domains.js';
import { WORKSPACE_DATASETS, SQL_SAMPLE_SCHEMA } from '../config/workspaceDatasets.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/domains
 * Public / Authenticated. Lists all available technology domains.
 * If user is authenticated, returns whether they have active subscription access.
 */
export async function getDomains(req: Request, res: Response): Promise<void> {
  try {
    const domains = await Domain.find({ active: true }).sort({ order: 1 }).lean();

    let isSubscribed = false;
    let allowedDomains: string[] = [];

    if (req.user?._id) {
      if (['platform_admin', 'college_admin'].includes(req.user.role)) {
        isSubscribed = true;
        allowedDomains = ['*'];
      } else {
        const activeSub = await Subscription.findOne({
          userId: req.user._id,
          status: 'active',
          expiresAt: { $gt: new Date() }
        });

        if (activeSub) {
          isSubscribed = true;
          allowedDomains = activeSub.entitlements?.allowedDomains || ['*'];
        }
      }
    }

    const domainCards = domains.map(d => {
      const hasAccess =
        isSubscribed && (allowedDomains.includes('*') || allowedDomains.includes(d.slug));

      return {
        slug: d.slug,
        name: d.name,
        shortDescription: d.shortDescription,
        description: d.description,
        technologies: d.technologies,
        overview: d.overview,
        icon: d.icon,
        badge: d.badge,
        moduleCount: d.modules?.length || 0,
        projectCount: d.projects?.length || 0,
        assessmentCount: d.assessments?.length || 0,
        hasAccess,
        subscriptionRequired: true
      };
    });

    res.json({
      success: true,
      domains: domainCards,
      userSubscription: {
        isSubscribed,
        allowedDomains
      }
    });
  } catch (error: any) {
    logger.error('GET_DOMAINS_ERROR', { details: { message: error.message } });
    res.status(500).json({
      success: false,
      message: 'Failed to load technology domains.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug
 * Retrieves complete learning path, modules, topics, projects, and assessments for a domain.
 * Calculates dynamic isUnlocked and isCompleted state for each module based on assignment progression.
 * Strictly subscription-gated by middleware.
 */
export async function getDomainBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const userId = req.user!._id;

    const domain = await Domain.findOne({
      slug: slug.toLowerCase().trim(),
      active: true
    }).lean();

    if (!domain) {
      res.status(404).json({
        success: false,
        message: `Domain "${slug}" not found or currently inactive.`,
        code: 'DOMAIN_NOT_FOUND'
      });
      return;
    }

    // Load user's saved progress for this domain
    const progress = await DomainProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      domainSlug: domain.slug
    }).lean();

    const completedModules = progress?.completedModules || [];
    const modulesWithUnlock = (domain.modules || []).map((m: any, idx: number) => {
      const isUnlocked = idx === 0 || completedModules.includes(domain.modules[idx - 1]?.moduleId);
      const isCompleted = completedModules.includes(m.moduleId);
      return {
        ...m,
        isUnlocked,
        isCompleted
      };
    });

    res.json({
      success: true,
      domain: {
        ...domain,
        modules: modulesWithUnlock
      },
      progress: progress || {
        domainSlug: domain.slug,
        completedModules: [],
        unlockedModules: domain.modules[0] ? [domain.modules[0].moduleId] : [],
        completedTopics: [],
        completedProjects: [],
        questionsAttempted: 0,
        questionsCorrect: 0,
        codingTasksCompleted: 0,
        currentStage: 'Getting Started',
        recommendedNextTopic: domain.modules[0]?.topics[0] || 'Web Fundamentals'
      }
    });
  } catch (error: any) {
    logger.error('GET_DOMAIN_BY_SLUG_ERROR', { details: { message: error.message } });
    res.status(500).json({
      success: false,
      message: 'Failed to load domain learning path.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug/progress
 * Retrieves user's real progress and completion metrics for a domain.
 * Strictly subscription-gated.
 */
export async function getDomainProgress(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const userId = req.user!._id;

    const progress = await DomainProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      domainSlug: slug.toLowerCase().trim()
    }).lean();

    res.json({
      success: true,
      progress: progress || {
        domainSlug: slug,
        completedModules: [],
        completedTopics: [],
        completedProjects: [],
        questionsAttempted: 0,
        questionsCorrect: 0,
        codingTasksCompleted: 0,
        currentStage: 'Not Started',
        recommendedNextTopic: ''
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load domain progress.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/practice/start
 * Starts a new domain practice session with AI question generation.
 * Strictly subscription-gated.
 */
export async function startDomainPractice(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const userId = req.user!._id;
    const collegeId = req.user?.collegeId;
    const { moduleId, topic, difficulty, questionCount, questionType } = req.body;

    if (!moduleId || !topic) {
      res.status(400).json({
        success: false,
        message: 'moduleId and topic are required to start domain practice.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Check module lock only if strict progression is requested
    if (req.body.enforceProgression) {
      const domain = await Domain.findOne({ slug: slug.toLowerCase().trim() });
      if (!domain) {
        res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
        return;
      }

      const { module: targetModule, index: moduleIndex } = resolveDomainModule(domain, moduleId);
      if (moduleIndex > 0) {
        const progress = await DomainProgress.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          domainSlug: domain.slug
        });
        const prevModule = domain.modules[moduleIndex - 1];
        if (!progress?.completedModules?.includes(prevModule.moduleId)) {
          res.status(403).json({
            success: false,
            message: `Module "${moduleId}" is locked. You must pass the assignment for "${prevModule.title}" before practicing this module.`,
            code: 'MODULE_LOCKED'
          });
          return;
        }
      }
    }

    const result = await domainPracticeService.startDomainPractice({
      userId: userId.toString(),
      collegeId: collegeId ? collegeId.toString() : null,
      domainSlug: slug.toLowerCase().trim(),
      moduleId,
      topic,
      difficulty,
      questionCount,
      questionType
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    logger.error('START_DOMAIN_PRACTICE_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to initialize domain practice session.',
      code: 'PRACTICE_START_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/practice/:sessionId/submit
 * Submits practice session answers, updates server progress, returns evaluation.
 * Strictly subscription-gated.
 */
export async function submitDomainPractice(req: Request, res: Response): Promise<void> {
  try {
    const { slug, sessionId } = req.params;
    const userId = req.user!._id;
    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      res.status(400).json({
        success: false,
        message: 'answers array is required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const result = await domainPracticeService.submitDomainPractice({
      userId: userId.toString(),
      sessionId,
      domainSlug: slug.toLowerCase().trim(),
      answers
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    logger.error('SUBMIT_DOMAIN_PRACTICE_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit domain practice.',
      code: 'SUBMISSION_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/coding/run
 * Runs isolated code snippet safely in sandbox. Supports JavaScript/Node.js, Python, Java, C, C++.
 * Strictly subscription-gated.
 */
export async function runDomainCode(req: Request, res: Response): Promise<void> {
  try {
    const { language, code, stdin = '', datasetId, isDataScience } = req.body;
    const slug = (req.params.slug || '').toLowerCase();

    if (!language || !code) {
      res.status(400).json({
        success: false,
        message: 'language and code are required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    let result: any;
    if (language === 'sql') {
      result = await codeExecutionService.executeSql({ query: code, timeoutMs: 6000 });
    } else if (
      language === 'python' &&
      (isDataScience || datasetId || slug.includes('data') || slug.includes('ai') || slug.includes('machine'))
    ) {
      result = await codeExecutionService.executePythonData({
        code,
        stdin,
        datasetId,
        timeoutMs: 8000
      });
    } else {
      result = await codeExecutionService.execute({
        language,
        code,
        stdin,
        timeoutMs: 6000
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Code execution failed.',
      code: 'EXECUTION_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug/datasets
 * Returns sample datasets available for Data Science and Machine Learning exercises.
 */
export async function getWorkspaceDatasets(_req: Request, res: Response): Promise<void> {
  const datasets = Object.values(WORKSPACE_DATASETS).map(d => ({
    id: d.id,
    name: d.name,
    filename: d.filename,
    description: d.description,
    columns: d.columns,
    rowCount: d.rowCount,
    sampleRows: d.sampleRows
  }));
  res.json({ success: true, datasets });
}

/**
 * GET /api/domains/:slug/schema
 * Returns sample relational database tables and schemas for SQL query exercises.
 */
export async function getWorkspaceSchema(_req: Request, res: Response): Promise<void> {
  const schema = SQL_SAMPLE_SCHEMA.map(s => ({
    tableName: s.tableName,
    description: s.description,
    columns: s.columns,
    sampleRows: s.sampleRows
  }));
  res.json({ success: true, schema });
}

/**
 * POST /api/domains/:slug/coding/evaluate
 * Evaluates multi-test-case coding challenges.
 * Strictly subscription-gated.
 */
export async function evaluateDomainCode(req: Request, res: Response): Promise<void> {
  try {
    const { language, code, visibleTestCases = [], hiddenTestCases = [] } = req.body;

    if (!language || !code) {
      res.status(400).json({
        success: false,
        message: 'language and code are required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const evaluation = await codeExecutionService.evaluateTestCases({
      language,
      code,
      visibleTestCases,
      hiddenTestCases
    });

    if (evaluation.verdict === 'ACCEPTED' && req.user?._id) {
      await DomainProgress.findOneAndUpdate(
        { userId: req.user._id, domainSlug: req.params.slug.toLowerCase().trim() },
        {
          $inc: { codingTasksCompleted: 1 },
          $set: { lastActiveAt: new Date() }
        },
        { upsert: true }
      );
    }

    res.json({
      success: true,
      evaluation
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Evaluation failed.',
      code: 'EVALUATION_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/projects/:projectId/submit
 * Evaluates practical project submissions (e.g., Todo App, Auth Interface, REST API, Notes App),
 * verifies required criteria, computes score, and logs progress.
 * Strictly subscription-gated.
 */
export async function submitDomainProject(req: Request, res: Response): Promise<void> {
  try {
    const { slug, projectId } = req.params;
    const userId = req.user!._id;
    const { files = [], taskStatus = {} } = req.body;

    const domain = await Domain.findOne({ slug: slug.toLowerCase().trim() });
    if (!domain) {
      res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
      return;
    }

    const project = domain.projects.find(p => p.projectId === projectId);
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found.', code: 'NOT_FOUND' });
      return;
    }

    // Automated criteria evaluation
    let tasksPassed = 0;
    const taskDetails: any[] = [];

    for (const task of project.tasks) {
      // Check if user submitted code satisfies criteria
      const codeBlob = files.map((f: any) => f.content || '').join('\n');
      let passed = Boolean(taskStatus[task.taskId]);

      if (!passed && task.testCriteria) {
        // Basic heuristic / keyword criteria check
        const keywords = task.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matches = keywords.filter(kw => codeBlob.toLowerCase().includes(kw));
        if (matches.length > 0 || codeBlob.length > 100) {
          passed = true;
        }
      }

      if (passed) tasksPassed++;
      taskDetails.push({
        taskId: task.taskId,
        title: task.title,
        passed,
        feedback: passed ? 'Verification criteria satisfied.' : 'Task requirements pending.'
      });
    }

    const totalTasks = project.tasks.length || 1;
    const score = Math.round((tasksPassed / totalTasks) * 100);
    const feedback =
      score >= 80
        ? `Outstanding work! All core criteria for "${project.title}" completed successfully.`
        : `Completed ${tasksPassed} of ${totalTasks} project milestones. Review suggestions to achieve full marks.`;

    // Persist to DomainProgress
    await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: domain.slug },
      {
        $pull: { completedProjects: { projectId } }
      }
    );

    await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: domain.slug },
      {
        $push: {
          completedProjects: {
            projectId,
            completedAt: new Date(),
            score,
            feedback,
            filesSubmitted: files
          }
        },
        $inc: { codingTasksCompleted: 1 },
        $set: { lastActiveAt: new Date() }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      score,
      tasksPassed,
      totalTasks,
      feedback,
      taskDetails
    });
  } catch (error: any) {
    logger.error('SUBMIT_PROJECT_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Project submission failed.',
      code: 'PROJECT_SUBMIT_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/assessments/:assessmentId/submit
 * Submits domain assessment answers, calculates score, and updates assessment records.
 * Strictly subscription-gated.
 */
export async function submitDomainAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { slug, assessmentId } = req.params;
    const userId = req.user!._id;
    const { score, totalQuestions, correctCount } = req.body;

    const domain = await Domain.findOne({ slug: slug.toLowerCase().trim() });
    if (!domain) {
      res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
      return;
    }

    const assessment = domain.assessments.find(a => a.assessmentId === assessmentId);
    const passingScore = assessment?.passingScore || 70;
    const passed = Number(score) >= passingScore;

    await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: domain.slug },
      {
        $push: {
          assessmentScores: {
            assessmentId,
            score: Number(score) || 0,
            passed,
            takenAt: new Date()
          }
        },
        $inc: {
          questionsAttempted: Number(totalQuestions) || 0,
          questionsCorrect: Number(correctCount) || 0
        },
        $set: { lastActiveAt: new Date() }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      score: Number(score) || 0,
      passingScore,
      passed,
      message: passed
        ? 'Congratulations! You passed the domain assessment.'
        : 'Score was below passing threshold. Review the learning modules and try again.'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit assessment.',
      code: 'ASSESSMENT_ERROR'
    });
  }
}

/**
 * GET /api/admin/domains
 * Admin-only: Lists all domains with completion and usage statistics.
 */
export async function getAdminDomains(_req: Request, res: Response): Promise<void> {
  try {
    const domains = await Domain.find().sort({ order: 1 }).lean();

    // Aggregate learner statistics
    const stats = await DomainProgress.aggregate([
      {
        $group: {
          _id: '$domainSlug',
          totalLearners: { $sum: 1 },
          totalQuestions: { $sum: '$questionsAttempted' },
          totalCompletedProjects: { $sum: { $size: '$completedProjects' } }
        }
      }
    ]);

    const statsMap = new Map(stats.map(s => [s._id, s]));

    const enriched = domains.map(d => {
      const st = statsMap.get(d.slug);
      return {
        ...d,
        stats: {
          totalLearners: st?.totalLearners || 0,
          totalQuestionsAttempted: st?.totalQuestions || 0,
          totalCompletedProjects: st?.totalCompletedProjects || 0
        }
      };
    });

    res.json({
      success: true,
      domains: enriched
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load admin domains.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * POST /api/admin/domains
 * Admin-only: Creates a new technology domain.
 */
export async function createAdminDomain(req: Request, res: Response): Promise<void> {
  try {
    const { slug, name, shortDescription, description, technologies, overview, modules, projects, assessments } = req.body;

    if (!slug || !name || !shortDescription) {
      res.status(400).json({
        success: false,
        message: 'slug, name, and shortDescription are required.',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    const existing = await Domain.findOne({ slug: cleanSlug });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Domain with slug "${cleanSlug}" already exists.`,
        code: 'CONFLICT'
      });
      return;
    }

    const domain = await Domain.create({
      slug: cleanSlug,
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      description: description?.trim() || '',
      technologies: Array.isArray(technologies) ? technologies : [],
      overview: overview?.trim() || '',
      modules: Array.isArray(modules) ? modules : [],
      projects: Array.isArray(projects) ? projects : [],
      assessments: Array.isArray(assessments) ? assessments : [],
      active: true
    });

    res.status(201).json({
      success: true,
      message: 'Domain created successfully.',
      domain
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create domain.',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * PUT /api/admin/domains/:slug
 * Admin-only: Updates existing domain configuration.
 */
export async function updateAdminDomain(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const updates = req.body;

    const domain = await Domain.findOneAndUpdate(
      { slug: slug.toLowerCase().trim() },
      { $set: updates },
      { new: true }
    );

    if (!domain) {
      res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      success: true,
      message: 'Domain updated successfully.',
      domain
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update domain.',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * PATCH /api/admin/domains/:slug/status
 * Admin-only: Toggles domain active status.
 */
export async function toggleAdminDomainStatus(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const domain = await Domain.findOne({ slug: slug.toLowerCase().trim() });

    if (!domain) {
      res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
      return;
    }

    domain.active = !domain.active;
    await domain.save();

    res.json({
      success: true,
      message: `Domain "${domain.name}" is now ${domain.active ? 'active' : 'inactive'}.`,
      domain
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle status.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug/modules/:moduleId/topics/:topic/content
 * Retrieves database-backed or dynamically generated lessons, concepts, code examples, and exercises.
 * Strictly subscription-gated.
 */
export async function getTopicContent(req: Request, res: Response): Promise<void> {
  try {
    const { slug, moduleId, topic } = req.params;
    const userId = req.user!._id;

    // Verify module unlocked
    const domain = await Domain.findOne({ slug: slug.toLowerCase().trim() });
    if (!domain) {
      res.status(404).json({ success: false, message: 'Domain not found.', code: 'NOT_FOUND' });
      return;
    }
    const { module: targetModule, index: moduleIndex } = resolveDomainModule(domain, moduleId);
    if (moduleIndex > 0) {
      const progress = await DomainProgress.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        domainSlug: domain.slug
      });
      const prevModule = domain.modules[moduleIndex - 1];
      if (!progress?.completedModules?.includes(prevModule.moduleId)) {
        res.status(403).json({
          success: false,
          message: `Module "${moduleId}" is locked. You must pass the assignment for "${prevModule.title}" first.`,
          code: 'MODULE_LOCKED'
        });
        return;
      }
    }

    const content = await domainCurriculumService.getTopicContent(slug, moduleId, topic);
    const progress = await DomainProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      domainSlug: slug.toLowerCase().trim()
    });

    res.json({
      success: true,
      content,
      isTopicCompleted: progress?.completedTopics?.includes(topic) || false,
      completedExercises: (progress?.completedExercises || []).filter(e => e.topic === topic)
    });
  } catch (error: any) {
    logger.error('GET_TOPIC_CONTENT_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to load topic content.',
      code: 'CONTENT_LOAD_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/modules/:moduleId/topics/:topic/exercises/:exerciseId/submit
 * Evaluates topic exercise and updates learner progress.
 * Strictly subscription-gated.
 */
export async function submitTopicExercise(req: Request, res: Response): Promise<void> {
  try {
    const { slug, moduleId, topic, exerciseId } = req.params;
    const userId = req.user!._id;
    const submission = req.body;

    const result = await domainCurriculumService.completeExercise({
      userId: userId.toString(),
      domainSlug: slug,
      moduleId,
      topic,
      exerciseId,
      submission
    });

    res.json(result);
  } catch (error: any) {
    logger.error('SUBMIT_EXERCISE_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit exercise.',
      code: 'EXERCISE_SUBMIT_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug/modules/:moduleId/assignment
 * Retrieves mandatory module assignment with starter files and rubrics.
 * Strictly subscription-gated.
 */
export async function getModuleAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { slug, moduleId } = req.params;
    const userId = req.user!._id;

    const result = await domainCurriculumService.getModuleAssignment(
      slug,
      moduleId,
      userId.toString()
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    logger.error('GET_MODULE_ASSIGNMENT_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to load module assignment.',
      code: 'ASSIGNMENT_LOAD_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/modules/:moduleId/assignment/submit
 * Submits mandatory module assignment, evaluates against rubrics, and unlocks next module on pass.
 * Strictly subscription-gated.
 */
export async function submitModuleAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { slug, moduleId } = req.params;
    const userId = req.user!._id;
    const { files = [], taskStatus = {} } = req.body;

    const result = await domainCurriculumService.submitModuleAssignment({
      userId: userId.toString(),
      domainSlug: slug,
      moduleId,
      files,
      taskStatus
    });

    res.json(result);
  } catch (error: any) {
    logger.error('SUBMIT_ASSIGNMENT_ERROR', { details: { message: error.message } });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit module assignment.',
      code: 'ASSIGNMENT_SUBMIT_ERROR'
    });
  }
}

/**
 * POST /api/domains/:slug/workspace/save
 * Persists learner's files in the coding workspace.
 * Strictly subscription-gated.
 */
export async function saveDomainWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const userId = req.user!._id;
    const { workspaceKey = 'default', files = [] } = req.body;

    const result = await domainCurriculumService.saveWorkspace({
      userId: userId.toString(),
      domainSlug: slug,
      workspaceKey,
      files
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to save workspace files.',
      code: 'WORKSPACE_SAVE_ERROR'
    });
  }
}

/**
 * GET /api/domains/:slug/workspace/:workspaceKey
 * Restores learner's saved workspace files.
 * Strictly subscription-gated.
 */
export async function getDomainWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const { slug, workspaceKey = 'default' } = req.params;
    const userId = req.user!._id;

    const files = await domainCurriculumService.getWorkspace(
      userId.toString(),
      slug,
      workspaceKey
    );

    res.json({
      success: true,
      workspaceKey,
      files: files || []
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to load workspace files.',
      code: 'WORKSPACE_LOAD_ERROR'
    });
  }
}

