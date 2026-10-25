import mongoose from 'mongoose';
import { Domain } from '../models/Domain.js';
import { DomainProgress } from '../models/DomainProgress.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { PracticeQuestionHistory } from '../models/PracticeQuestionHistory.js';
import { Question, IQuestion } from '../models/Question.js';
import { resolveDomainModule } from '../config/domains.js';
import { aiQuestionService } from './aiQuestionService.js';
import { logger } from '../utils/logger.js';

export interface StartDomainPracticeParams {
  userId: string;
  collegeId?: string | null;
  domainSlug: string;
  moduleId: string;
  topic: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  questionCount?: number;
  questionType?: 'mcq' | 'coding' | 'mixed';
}

export interface SubmitDomainPracticeParams {
  userId: string;
  sessionId: string;
  domainSlug: string;
  answers: Array<{
    questionId: string;
    selectedOptionIds?: string[];
    codeSubmission?: {
      language: string;
      code: string;
      verdict?: string;
    };
    timeSpentSeconds?: number;
  }>;
}

export class DomainPracticeService {
  /**
   * Starts a subscription-validated domain practice session.
   * Generates or fetches non-repeated, AI-powered questions specifically aligned with the domain topic.
   */
  async startDomainPractice(params: StartDomainPracticeParams) {
    const {
      userId,
      collegeId,
      domainSlug,
      moduleId,
      topic,
      difficulty = 'medium',
      questionCount = 5,
      questionType = 'mcq'
    } = params;

    const count = Math.min(Math.max(1, questionCount), 20);

    // 1. Verify domain exists and contains module/topic
    const domain = await Domain.findOne({ slug: domainSlug, active: true });
    if (!domain) {
      throw new Error(`Domain "${domainSlug}" not found or inactive.`);
    }

    const { module: resolvedModule } = resolveDomainModule(domain, moduleId);
    const domainModule = resolvedModule || domain.modules.find(m => m.moduleId === moduleId);
    if (!domainModule) {
      throw new Error(`Module "${moduleId}" not found in domain "${domainSlug}".`);
    }

    // 2. Fetch previously attempted question IDs to ensure freshness
    const history = await PracticeQuestionHistory.find({
      studentId: new mongoose.Types.ObjectId(userId)
    }).select('questionId');
    const attemptedIds = new Set(history.map(h => h.questionId.toString()));

    // 3. Search database for existing questions for this domain & topic
    const regexTopic = new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const regexDomain = new RegExp(domain.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const existingQuestions = await Question.find({
      $or: [
        { topic: regexTopic },
        { subtopic: regexTopic },
        { category: regexDomain },
        { tags: { $in: [domainSlug, topic.toLowerCase()] } }
      ]
    }).lean();

    // Filter unattempted questions
    let selectedQuestions: any[] = existingQuestions.filter(q => !attemptedIds.has(q._id.toString()));

    // 4. If insufficient fresh questions exist, generate fresh ones via AI Question Service
    if (selectedQuestions.length < count && aiQuestionService.isAIAvailable()) {
      const needed = count - selectedQuestions.length;
      try {
        const aiResult = await aiQuestionService.generateAndValidateQuestions({
          topic,
          subtopic: `${domain.name} - ${domainModule.title}`,
          difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
          count: needed,
          type: questionType === 'coding' ? 'coding' : 'mcq',
          category: domain.name,
          creatorId: userId,
          callerKey: userId,
          publishValidated: true
        });

        if (aiResult.questions && aiResult.questions.length > 0) {
          selectedQuestions.push(...aiResult.questions);
        }
      } catch (aiErr: any) {
        logger.warn('DOMAIN_AI_GEN_FALLBACK', {
          details: {
            domainSlug,
            topic,
            message: aiErr?.message
          }
        });
      }
    }

    // If still insufficient, fill with existing questions rather than failing
    if (selectedQuestions.length < count && existingQuestions.length > 0) {
      const remainingPool = existingQuestions.filter(
        q => !selectedQuestions.some(sq => sq._id.toString() === q._id.toString())
      );
      selectedQuestions.push(...remainingPool.slice(0, count - selectedQuestions.length));
    }

    // If no questions in DB or AI at all, create deterministic domain starter questions
    if (selectedQuestions.length < count) {
      const fallbackQuestions = await this.seedFallbackDomainQuestions({
        domain,
        domainModule,
        topic,
        userId,
        count: count - selectedQuestions.length
      });
      selectedQuestions.push(...fallbackQuestions);
    }

    // Limit to requested count
    const finalQuestions = selectedQuestions.slice(0, count);
    const questionIds = finalQuestions.map(q => q._id);

    // 5. Persist the session
    const session = await PracticeSession.create({
      studentId: new mongoose.Types.ObjectId(userId),
      collegeId: collegeId ? new mongoose.Types.ObjectId(collegeId) : null,
      topic: `${domain.name}: ${topic}`,
      subtopic: domainModule.title,
      difficulty,
      questionCount: finalQuestions.length,
      type: questionType,
      questionIds,
      answers: [],
      score: 0,
      accuracyPercentage: 0,
      totalQuestions: finalQuestions.length,
      correctCount: 0,
      timeTakenSeconds: 0,
      startedAt: new Date(),
      status: 'active',
      sections: [
        {
          category: domain.name,
          topic,
          difficulty,
          count: finalQuestions.length,
          questionIds
        }
      ]
    });

    // Strip sensitive isCorrect flags before sending to student
    const sanitizedQuestions = finalQuestions.map(q => ({
      _id: q._id,
      title: q.title,
      description: q.description,
      type: q.type,
      difficulty: q.difficulty,
      category: q.category || domain.name,
      topic: q.topic || topic,
      options: (q.options || []).map((o: any) => ({
        id: o.id,
        text: o.text
      })),
      codingDetails: q.codingDetails
        ? {
            supportedLanguages: q.codingDetails.supportedLanguages,
            starterCode: q.codingDetails.starterCode,
            inputFormat: q.codingDetails.inputFormat,
            outputFormat: q.codingDetails.outputFormat,
            visibleTestCases: q.codingDetails.visibleTestCases
          }
        : undefined
    }));

    return {
      session: {
        _id: session._id,
        domainSlug,
        moduleId,
        topic,
        difficulty,
        questionCount: finalQuestions.length,
        status: session.status,
        startedAt: session.startedAt
      },
      questions: sanitizedQuestions
    };
  }

  /**
   * Submits domain practice answers, computes score and accuracy,
   * updates DomainProgress, and logs attempted question history.
   */
  async submitDomainPractice(params: SubmitDomainPracticeParams) {
    const { userId, sessionId, domainSlug, answers } = params;

    const session = await PracticeSession.findOne({
      _id: sessionId,
      studentId: new mongoose.Types.ObjectId(userId)
    });

    if (!session) {
      throw new Error('Practice session not found or unauthorized.');
    }

    if (session.status === 'completed') {
      return {
        session,
        alreadySubmitted: true
      };
    }

    const questions = await Question.find({ _id: { $in: session.questionIds } });
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    let correctCount = 0;
    const evaluatedAnswers: any[] = [];
    const historyInserts: any[] = [];

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      let isCorrect = false;

      if (q.type === 'mcq' || q.type === 'multiple_select' || q.type === 'true_false') {
        const correctOptionIds = (q.options || [])
          .filter((o: any) => o.isCorrect)
          .map((o: any) => o.id)
          .sort();

        const selected = (ans.selectedOptionIds || []).slice().sort();
        isCorrect =
          correctOptionIds.length === selected.length &&
          correctOptionIds.every((id, idx) => id === selected[idx]);
      } else if (q.type === 'coding') {
        isCorrect = ans.codeSubmission?.verdict === 'ACCEPTED';
      }

      if (isCorrect) correctCount++;

      evaluatedAnswers.push({
        questionId: q._id,
        selectedOptionIds: ans.selectedOptionIds || [],
        codeSubmission: ans.codeSubmission,
        isCorrect,
        timeSpentSeconds: ans.timeSpentSeconds || 0
      });

      historyInserts.push({
        studentId: new mongoose.Types.ObjectId(userId),
        questionId: q._id,
        topic: q.topic || session.topic,
        difficulty: q.difficulty,
        isCorrect,
        timeSpentSeconds: ans.timeSpentSeconds || 0,
        attemptedAt: new Date()
      });
    }

    const total = session.questionIds.length || 1;
    const accuracyPercentage = Math.round((correctCount / total) * 100);
    const score = Math.round((correctCount / total) * 100);

    session.answers = evaluatedAnswers;
    session.correctCount = correctCount;
    session.score = score;
    session.accuracyPercentage = accuracyPercentage;
    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    // Log question history asynchronously
    if (historyInserts.length > 0) {
      PracticeQuestionHistory.insertMany(historyInserts, { ordered: false }).catch(() => {});
    }

    // Update DomainProgress
    const domain = await Domain.findOne({ slug: domainSlug });
    if (domain) {
      const progress = await DomainProgress.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        domainSlug
      });

      const currentTopics = progress ? progress.completedTopics : [];
      const cleanTopic = session.topic.replace(/^.*:\s*/, '');
      const updatedTopics = Array.from(new Set([...currentTopics, cleanTopic]));

      // Determine current stage & next recommended topic
      let nextTopic = '';
      for (const m of domain.modules) {
        const uncompleted = m.topics.find(t => !updatedTopics.includes(t));
        if (uncompleted) {
          nextTopic = uncompleted;
          break;
        }
      }

      await DomainProgress.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), domainSlug },
        {
          $inc: {
            questionsAttempted: total,
            questionsCorrect: correctCount
          },
          $set: {
            completedTopics: updatedTopics,
            recommendedNextTopic: nextTopic,
            currentStage: `${updatedTopics.length} of ${domain.modules.reduce(
              (acc, m) => acc + m.topics.length,
              0
            )} topics completed`,
            lastActiveAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    return {
      session,
      reviewQuestions: questions.map(q => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        explanation: q.explanation,
        options: q.options,
        type: q.type,
        difficulty: q.difficulty
      }))
    };
  }

  /**
   * Deterministic domain starter questions seeded when fresh AI questions are offline.
   */
  private async seedFallbackDomainQuestions(params: {
    domain: any;
    domainModule: any;
    topic: string;
    userId: string;
    count?: number;
  }): Promise<any[]> {
    const { domain, domainModule, topic, userId, count = 3 } = params;

    // Use database-backed topic content dynamically synthesized or AI-generated
    const { domainCurriculumService } = await import('./domainCurriculumService.js');
    const topicContent = await domainCurriculumService.getTopicContent(
      domain.slug,
      domainModule.moduleId,
      topic
    );

    const questionsToCreate: any[] = [];

    // Map topic exercises to practice questions
    for (const ex of topicContent.exercises) {
      if (ex.type === 'knowledge_check' || ex.type === 'output_prediction') {
        questionsToCreate.push({
          title: ex.title,
          description: ex.instruction,
          type: 'mcq',
          difficulty: ex.difficulty || 'medium',
          category: domain.name,
          topic,
          subtopic: domainModule.title,
          options: ex.options || [
            { id: 'opt1', text: 'Valid architectural principle', isCorrect: true },
            { id: 'opt2', text: 'Invalid anti-pattern', isCorrect: false }
          ],
          explanation: ex.explanation || `Core concept validation for ${topic}.`,
          tags: [domain.slug, domainModule.moduleId, topic.toLowerCase()],
          creatorId: new mongoose.Types.ObjectId(userId),
          createdBy: 'ai',
          source: 'domain_curriculum'
        });
      }
    }

    // If still need more, generate from lessons
    if (questionsToCreate.length < count && topicContent.lessons.length > 0) {
      const lesson = topicContent.lessons[0];
      questionsToCreate.push({
        title: `Core Concept: ${lesson.title}`,
        description: `Regarding ${topic}: ${lesson.concept.slice(0, 150)}... Which pattern best adheres to best practices?`,
        type: 'mcq',
        difficulty: 'medium',
        category: domain.name,
        topic,
        subtopic: domainModule.title,
        options: [
          { id: 'opt1', text: `Enforce defensive schema validation and clear lifecycle boundaries.`, isCorrect: true },
          { id: 'opt2', text: `Bypass error boundaries and rely on global mutations.`, isCorrect: false }
        ],
        explanation: lesson.keyTakeaways[0] || `Understanding ${topic} requires proper lifecycle management.`,
        tags: [domain.slug, domainModule.moduleId, topic.toLowerCase()],
        creatorId: new mongoose.Types.ObjectId(userId),
        createdBy: 'ai',
        source: 'domain_curriculum'
      });
    }

    const toInsert = questionsToCreate.slice(0, Math.max(count, 1));
    const inserted = await Question.insertMany(toInsert);
    return inserted;
  }
}

export const domainPracticeService = new DomainPracticeService();
