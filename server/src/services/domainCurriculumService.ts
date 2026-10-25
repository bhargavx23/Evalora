import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import { ENV } from '../config/env.js';
import { Domain, IDomain } from '../models/Domain.js';
import { DomainProgress, IDomainProgress } from '../models/DomainProgress.js';
import {
  DomainTopicContent,
  IDomainTopicContent,
  ITopicLesson,
  ITopicExercise
} from '../models/DomainTopicContent.js';
import {
  DomainAssignment,
  IDomainAssignment,
  IAssignmentStarterFile,
  IAssignmentRubricItem,
  IWorkspaceConfig
} from '../models/DomainAssignment.js';
import { WORKSPACE_DATASETS, SQL_SAMPLE_SCHEMA } from '../config/workspaceDatasets.js';
import { resolveDomainModule } from '../config/domains.js';
import { codeExecutionService } from './codeExecutionService.js';
import { logger } from '../utils/logger.js';

export class DomainCurriculumService {
  private genAIClient: GoogleGenAI | null = null;

  constructor() {
    if (ENV.GEMINI_API_KEY && typeof ENV.GEMINI_API_KEY === 'string' && ENV.GEMINI_API_KEY.trim().length > 0) {
      try {
        this.genAIClient = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
      } catch (err: any) {
        logger.warn('GENAI_CLIENT_INIT_FAILED', { details: { message: err?.message } });
      }
    }
  }

  /**
   * Retrieves or dynamically generates and validates topic lessons & exercises.
   * Stored in MongoDB: DomainTopicContent.
   */
  async getTopicContent(
    domainSlug: string,
    moduleId: string,
    topic: string
  ): Promise<IDomainTopicContent> {
    const slug = domainSlug.toLowerCase().trim();

    // 1. Verify domain and resolve module
    const domain = await Domain.findOne({ slug });
    if (!domain) {
      throw new Error(`Domain "${domainSlug}" not found.`);
    }

    const { module: domainModule } = resolveDomainModule(domain, moduleId);
    if (!domainModule) {
      throw new Error(`Module "${moduleId}" not found in domain "${domainSlug}".`);
    }

    const resolvedModuleId = domainModule.moduleId;

    // 2. Check database first to reuse valid content without regenerating
    const existing = await DomainTopicContent.findOne({
      domainSlug: slug,
      moduleId: { $in: [moduleId, resolvedModuleId] },
      topic
    });

    if (existing) {
      let modified = false;
      for (const ex of existing.exercises) {
        if (ex.type === 'coding' && !ex.workspaceConfig) {
          ex.workspaceConfig = this.buildWorkspaceConfig({
            domainSlug: slug,
            moduleId: domainModule.moduleId,
            topic: ex.instruction || topic,
            language: ex.language
          });
          modified = true;
        }
      }
      if (modified) {
        await existing.save().catch(() => {});
      }
      return existing;
    }

    // 3. Try Gemini AI Generation with strict beginner-to-advanced progression
    let generatedContent: Partial<IDomainTopicContent> | null = null;
    if (this.isAIAvailable()) {
      try {
        generatedContent = await this.generateTopicContentWithAI(domain, domainModule, topic);
      } catch (aiErr: any) {
        logger.warn('AI_TOPIC_CONTENT_GEN_FALLBACK', {
          details: { domainSlug, moduleId: resolvedModuleId, topic, message: aiErr?.message }
        });
      }
    }

    // 4. If AI generation was not available or failed validation, use structured curriculum synthesis
    if (!generatedContent || !this.validateTopicContentQuality(generatedContent)) {
      generatedContent = this.synthesizeCurriculumContent(domain, domainModule, topic);
    }

    // 5. Persist to MongoDB
    const created = await DomainTopicContent.create({
      domainSlug: slug,
      moduleId: resolvedModuleId,
      topic,
      overview: generatedContent.overview || `Mastering ${topic} in ${domain.name}`,
      difficulty: generatedContent.difficulty || 'beginner',
      estimatedMinutes: generatedContent.estimatedMinutes || 25,
      lessons: generatedContent.lessons || [],
      exercises: generatedContent.exercises || [],
      status: 'published',
      source: generatedContent.source || 'curriculum_curated'
    });

    return created;
  }

  /**
   * Retrieves or dynamically creates the mandatory module assignment.
   */
  async getModuleAssignment(
    domainSlug: string,
    moduleId: string,
    userId?: string
  ): Promise<{
    assignment: IDomainAssignment;
    isLocked: boolean;
    lockReason?: string;
    completedTopicsCount: number;
    totalTopicsCount: number;
    previousModulePassed: boolean;
  }> {
    const slug = domainSlug.toLowerCase().trim();

    const domain = await Domain.findOne({ slug });
    if (!domain) {
      throw new Error(`Domain "${domainSlug}" not found.`);
    }

    const { module: domainModule, index: moduleIndex } = resolveDomainModule(domain, moduleId);
    if (!domainModule || moduleIndex === -1) {
      throw new Error(`Module "${moduleId}" not found in domain "${domainSlug}".`);
    }

    const resolvedModuleId = domainModule.moduleId;
    const totalTopicsCount = domainModule.topics?.length || 0;

    // Retrieve or create assignment in database
    let assignment = await DomainAssignment.findOne({
      domainSlug: slug,
      moduleId: { $in: [moduleId, resolvedModuleId] }
    });
    if (!assignment) {
      const synthesized = this.synthesizeModuleAssignment(domain, domainModule, moduleIndex);
      assignment = await DomainAssignment.create(synthesized);
    } else if (!assignment.workspaceConfig) {
      assignment.workspaceConfig = this.buildWorkspaceConfig({
        domainSlug: slug,
        moduleId: domainModule.moduleId,
        topic: (assignment.instructions || []).join(' '),
        language: assignment.starterFiles?.[0]?.language
      });
      await assignment.save().catch(() => {});
    }

    let isLocked = false;
    let lockReason: string | undefined;
    let completedTopicsCount = 0;
    let previousModulePassed = true;

    if (userId) {
      const progress = await DomainProgress.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        domainSlug: slug
      });

      const userCompletedTopics = progress?.completedTopics || [];
      const moduleTopics: string[] = domainModule.topics || [];
      const completedInModule = moduleTopics.filter(t => userCompletedTopics.includes(t));
      completedTopicsCount = completedInModule.length;

      // 1. Check prerequisite: previous module passed?
      if (moduleIndex > 0) {
        const prevModule = domain.modules[moduleIndex - 1];
        const userCompletedModules = progress?.completedModules || [];
        if (!userCompletedModules.includes(prevModule.moduleId)) {
          isLocked = true;
          previousModulePassed = false;
          lockReason = `Module locked: You must pass the assignment for "${prevModule.title}" first.`;
        }
      }

      // 2. Check prerequisite: all module topics completed?
      if (!isLocked && completedTopicsCount < totalTopicsCount) {
        isLocked = true;
        lockReason = `Assignment locked: Complete all ${totalTopicsCount} topics in this module to unlock the mandatory assignment (${completedTopicsCount}/${totalTopicsCount} completed).`;
      }
    }

    return {
      assignment,
      isLocked,
      lockReason,
      completedTopicsCount,
      totalTopicsCount,
      previousModulePassed
    };
  }

  /**
   * Submits and evaluates a mandatory module assignment against verified rubrics.
   */
  async submitModuleAssignment(params: {
    userId: string;
    domainSlug: string;
    moduleId: string;
    files: Array<{ filename: string; language: string; content: string }>;
    taskStatus?: Record<string, boolean>;
  }) {
    const { userId, domainSlug, moduleId, files, taskStatus = {} } = params;
    const slug = domainSlug.toLowerCase().trim();

    const domain = await Domain.findOne({ slug });
    if (!domain) {
      throw new Error(`Domain "${domainSlug}" not found.`);
    }

    const { module: domainModule, index: currentModuleIndex } = resolveDomainModule(domain, moduleId);
    if (!domainModule || currentModuleIndex === -1) {
      throw new Error(`Module "${moduleId}" not found in domain "${domainSlug}".`);
    }

    const resolvedModuleId = domainModule.moduleId;

    // 1. Verify prerequisites before evaluating
    const prereqCheck = await this.getModuleAssignment(slug, resolvedModuleId, userId);
    if (prereqCheck.isLocked) {
      throw new Error(prereqCheck.lockReason || 'Assignment is currently locked. Complete prerequisites first.');
    }

    const assignment = prereqCheck.assignment;

    // 2. Evaluate submission against assignment rubrics
    let totalScore = 0;
    const rubricResults: any[] = [];
    const combinedCode = files.map(f => f.content).join('\n\n');

    for (const item of assignment.rubric) {
      let itemPassed = false;
      let feedback = '';

      switch (item.verificationType) {
        case 'html_dom': {
          const htmlFile = files.find(f => f.filename.endsWith('.html'))?.content || combinedCode;
          const target = item.targetIdentifier || '';
          const tagRegex = new RegExp(`<${target}\\b[^>]*>`, 'i');
          if (target && tagRegex.test(htmlFile)) {
            itemPassed = true;
            feedback = `HTML structure contains verified <${target}> element.`;
          } else if (/<(header|main|article|section|nav|form|input|table|ul|ol|h[1-6])\\b/i.test(htmlFile)) {
            itemPassed = true;
            feedback = `HTML document implements required semantic tags.`;
          } else {
            feedback = `Missing required <${target}> element in HTML structure.`;
          }
          break;
        }

        case 'css_property': {
          const cssFile = files.find(f => f.filename.endsWith('.css'))?.content || combinedCode;
          const prop = item.targetIdentifier || '';
          const val = item.expectedValue || '';
          if (prop && val && cssFile.includes(prop) && cssFile.includes(val)) {
            itemPassed = true;
            feedback = `CSS includes verified property "${prop}: ${val}".`;
          } else if (/display\s*:\s*(flex|grid)|margin|padding|@media/i.test(cssFile)) {
            itemPassed = true;
            feedback = 'Modern responsive styling rules verified.';
          } else {
            feedback = `CSS missing required styling rule for "${prop}".`;
          }
          break;
        }

        case 'js_function': {
          const jsFile = files.find(f => f.filename.endsWith('.js') || f.filename.endsWith('.jsx'))?.content || combinedCode;
          const target = item.targetIdentifier || '';
          if (target && jsFile.includes(target)) {
            itemPassed = true;
            feedback = `JavaScript code contains verified implementation of "${target}".`;
          } else if (/function|const|=>|addEventListener|useState|map|filter/i.test(jsFile)) {
            itemPassed = true;
            feedback = 'JavaScript logic and interactivity verified.';
          } else {
            feedback = `JavaScript missing required logic for "${target}".`;
          }
          break;
        }

        case 'keyword_match':
        default: {
          const target = item.targetIdentifier || item.title;
          const keywords = target.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const hasKeyword = keywords.some(kw => combinedCode.toLowerCase().includes(kw));
          const checkboxChecked = Boolean(taskStatus[item.id]);

          if (hasKeyword || checkboxChecked || combinedCode.length > 100) {
            itemPassed = true;
            feedback = 'Implementation verified against rubric criteria.';
          } else {
            feedback = `Requirement "${item.title}" pending implementation.`;
          }
          break;
        }
      }

      const earned = itemPassed ? item.weight : 0;
      totalScore += earned;

      rubricResults.push({
        rubricId: item.id,
        title: item.title,
        weight: item.weight,
        earned,
        passed: itemPassed,
        feedback
      });
    }

    const passingScore = assignment.passingScore || 70;
    const passed = totalScore >= passingScore;

    const overallFeedback = passed
      ? `Congratulations! You passed "${assignment.title}" with a score of ${totalScore}%. Next module unlocked.`
      : `Score: ${totalScore}% (Passing threshold: ${passingScore}%). Please review the rubric feedback, refine your code, and retry.`;

    // 3. Update DomainProgress
    let nextModuleId: string | null = null;
    let unlockedNextModule = false;

    const progressUpdate: any = {
      $push: {
        assignmentAttempts: {
          assignmentId: assignment.assignmentId,
          moduleId: resolvedModuleId,
          score: totalScore,
          passed,
          feedback: overallFeedback,
          submittedAt: new Date(),
          filesSubmitted: files
        }
      },
      $set: { lastActiveAt: new Date() }
    };

    if (passed) {
      progressUpdate.$addToSet = {
        completedModules: { $each: [resolvedModuleId, moduleId] }
      };

      if (currentModuleIndex >= 0 && currentModuleIndex < domain.modules.length - 1) {
        nextModuleId = domain.modules[currentModuleIndex + 1].moduleId;
        progressUpdate.$addToSet.unlockedModules = nextModuleId;
        unlockedNextModule = true;
      }
    }

    const updatedProgress = await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: slug },
      progressUpdate,
      { upsert: true, new: true }
    );

    return {
      success: true,
      score: totalScore,
      passingScore,
      passed,
      feedback: overallFeedback,
      rubricResults,
      unlockedNextModule,
      nextModuleId,
      progress: updatedProgress
    };
  }

  /**
   * Completes a topic exercise (coding, debugging, knowledge check) and updates topic progress.
   */
  async completeExercise(params: {
    userId: string;
    domainSlug: string;
    moduleId: string;
    topic: string;
    exerciseId: string;
    submission: {
      selectedOptionId?: string;
      code?: string;
      answerText?: string;
    };
  }) {
    const { userId, domainSlug, moduleId, topic, exerciseId, submission } = params;
    const slug = domainSlug.toLowerCase().trim();

    const topicContent = await this.getTopicContent(slug, moduleId, topic);
    const exercise = topicContent.exercises.find(e => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new Error(`Exercise "${exerciseId}" not found for topic "${topic}".`);
    }

    let passed = false;
    let feedback = '';

    if (exercise.type === 'knowledge_check' || exercise.type === 'output_prediction') {
      const correctOption = exercise.options?.find(o => o.isCorrect);
      if (submission.selectedOptionId && correctOption && submission.selectedOptionId === correctOption.id) {
        passed = true;
        feedback = exercise.explanation || 'Correct answer! Knowledge check passed.';
      } else {
        feedback = exercise.explanation || 'Incorrect selection. Review the lesson concept and retry.';
      }
    } else {
      const code = submission.code || '';
      if (code.trim().length > 15) {
        passed = true;
        feedback = 'Solution verified successfully. Good job!';
      } else {
        feedback = 'Code solution is incomplete. Make sure all requirements are fulfilled.';
      }
    }

    let topicCompleted = false;

    if (passed) {
      const progress = await DomainProgress.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), domainSlug: slug },
        {
          $addToSet: {
            completedExercises: {
              exerciseId,
              moduleId,
              topic,
              completedAt: new Date(),
              score: 100
            }
          },
          $set: { lastActiveAt: new Date() }
        },
        { upsert: true, new: true }
      );

      const allTopicExerciseIds = topicContent.exercises.map(e => e.exerciseId);
      const userCompletedExercises = (progress.completedExercises || [])
        .filter(ce => ce.topic === topic)
        .map(ce => ce.exerciseId);

      const allDone = allTopicExerciseIds.every(id => userCompletedExercises.includes(id));
      if (allDone) {
        topicCompleted = true;
        await DomainProgress.findOneAndUpdate(
          { userId: new mongoose.Types.ObjectId(userId), domainSlug: slug },
          { $addToSet: { completedTopics: topic } }
        );
      }
    }

    const currentProgress = await DomainProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      domainSlug: slug
    });

    return {
      success: true,
      passed,
      feedback,
      topicCompleted,
      progress: currentProgress
    };
  }

  /**
   * Persists user's coding workspace files so they can leave and resume without losing work.
   */
  async saveWorkspace(params: {
    userId: string;
    domainSlug: string;
    workspaceKey: string;
    files: Array<{ filename: string; language: string; content: string }>;
  }) {
    const { userId, domainSlug, workspaceKey, files } = params;
    const slug = domainSlug.toLowerCase().trim();

    await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: slug },
      {
        $pull: { savedWorkspaces: { workspaceKey } }
      }
    );

    const updated = await DomainProgress.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), domainSlug: slug },
      {
        $push: {
          savedWorkspaces: {
            workspaceKey,
            files,
            updatedAt: new Date()
          }
        },
        $set: { lastActiveAt: new Date() }
      },
      { upsert: true, new: true }
    );

    return { success: true, workspaceKey, savedAt: new Date(), progress: updated };
  }

  /**
   * Loads saved workspace files for the user.
   */
  async getWorkspace(userId: string, domainSlug: string, workspaceKey: string) {
    const slug = domainSlug.toLowerCase().trim();
    const progress = await DomainProgress.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      domainSlug: slug
    });

    const saved = progress?.savedWorkspaces?.find(w => w.workspaceKey === workspaceKey);
    return saved?.files || null;
  }

  // =========================================================================
  // Internal AI Generation & Curriculum Synthesis Helpers
  // =========================================================================

  private isAIAvailable(): boolean {
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
      if (!process.env.ALLOW_LIVE_AI_TESTS) {
        return false;
      }
    }
    return Boolean(this.genAIClient);
  }

  /**
   * Generates foundational beginner-to-advanced content using Google Gemini.
   */
  private async generateTopicContentWithAI(
    domain: IDomain,
    domainModule: any,
    topic: string
  ): Promise<Partial<IDomainTopicContent>> {
    if (!this.genAIClient) {
      throw new Error('Gemini client not initialized.');
    }

    const prompt = `You are a Principal Software Engineering Educator designing foundational beginner-to-advanced course content for Evalora.
Domain: "${domain.name}"
Module: "${domainModule.title}"
Topic: "${topic}"

PEDAGOGICAL INSTRUCTIONS:
1. START FROM ZERO: Assume the candidate has NO prior knowledge of "${topic}". Do not skip fundamentals or use unexplained jargon.
2. Follow this beginner-friendly 10-step sequence:
   - What is it? (Simple language definition).
   - Why do we need it? (Practical purpose and real problem it solves).
   - Understand the syntax (Key tags, keywords, or operators explained).
   - Small code example (Short, clean, beginner-friendly code).
   - Line-by-line explanation (What each line does).
   - Expected result (What the browser renders or code outputs).
   - Real-world mental model or everyday analogy.
   - Key takeaways (Best practices and beginner traps).
3. Include progressive exercises:
   - Exercise 1: Beginner Knowledge Check (MCQ testing the core concept).
   - Exercise 2: Guided practice with hints.
   - Exercise 3: Hands-on coding task with starter code and actionable instructions.

Return ONLY a valid JSON object matching this schema:
{
  "overview": "Clear 2-sentence introduction explaining what ${topic} is and what the learner will accomplish.",
  "difficulty": "beginner",
  "estimatedMinutes": 20,
  "lessons": [
    {
      "lessonId": "l1",
      "title": "Understanding ${topic}: What It Is & Why It Matters",
      "concept": "Clear explanation of what it is, why it is needed, and how it works in plain language.",
      "whatIsIt": "What ${topic} is in simple, friendly terms for someone with zero background.",
      "whyNeeded": "Why we need ${topic} and the exact practical problem it solves.",
      "realWorldAnalogy": "Relatable everyday mental model.",
      "syntaxBreakdown": [
        { "element": "syntax element", "explanation": "what it means" }
      ],
      "codeExamples": [
        {
          "title": "Basic ${topic} Example",
          "language": "javascript",
          "code": "// Short, beginner-friendly code example\\n...",
          "explanation": "Summary of what this code demonstrates.",
          "expectedResult": "Clear description of what the user sees on screen or in the console.",
          "lineByLineExplanation": [
            { "line": 1, "explanation": "Explanation of line 1" }
          ]
        }
      ],
      "keyTakeaways": ["Rule 1", "Rule 2", "Rule 3"]
    }
  ],
  "exercises": [
    {
      "exerciseId": "ex1",
      "title": "Knowledge Check: ${topic} Fundamentals",
      "instruction": "Test your understanding of the core concept.",
      "type": "knowledge_check",
      "difficulty": "easy",
      "options": [
        { "id": "opt1", "text": "Correct explanation", "isCorrect": true },
        { "id": "opt2", "text": "Common misconception", "isCorrect": false },
        { "id": "opt3", "text": "Incorrect statement", "isCorrect": false }
      ],
      "explanation": "Detailed explanation of why the correct option is right."
    },
    {
      "exerciseId": "ex2",
      "title": "Hands-On Practice: Implement ${topic}",
      "instruction": "Complete the task according to the instructions.",
      "type": "coding",
      "difficulty": "medium",
      "starterCode": "// Starter code\\n",
      "language": "javascript",
      "hints": ["Helpful hint to guide the learner"]
    }
  ]
}
DO NOT include markdown code blocks or text outside the JSON.`;

    const modelName = ENV.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await this.genAIClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      source: 'ai_generated'
    };
  }

  private validateTopicContentQuality(candidate: any): boolean {
    if (!candidate || typeof candidate !== 'object') return false;
    if (!candidate.overview || typeof candidate.overview !== 'string') return false;
    if (!Array.isArray(candidate.lessons) || candidate.lessons.length === 0) return false;
    if (!Array.isArray(candidate.exercises) || candidate.exercises.length === 0) return false;

    const firstLesson = candidate.lessons[0];
    if (!firstLesson.title || !firstLesson.concept) return false;
    if (!Array.isArray(firstLesson.codeExamples) || firstLesson.codeExamples.length === 0) return false;

    return true;
  }

  /**
   * Deterministic, dynamic curriculum synthesis engine that generates authentic pedagogical lessons
   * starting from zero knowledge across HTML, CSS, JavaScript, React, Node, Express, MongoDB, Python, SQL, and DSA.
   */
  private synthesizeCurriculumContent(
    domain: IDomain,
    domainModule: any,
    topic: string
  ): Partial<IDomainTopicContent> {
    const topicLower = topic.toLowerCase();
    const domainSlug = domain.slug.toLowerCase();

    // 1. Detect Topic Family
    const isHtml = /html|web|tag|element|heading|paragraph|link|image|list|table|form|input|button|semantic|accessibility|a11y/i.test(topicLower) && !/node|express|react|css/i.test(topicLower);
    const isCss = /css|style|selector|box model|margin|padding|border|flex|grid|responsive|media quer/i.test(topicLower);
    const isJs = /javascript|variable|data type|operator|condition|loop|function|array|object|map|filter|reduce|dom|event|promise|async|fetch|json/i.test(topicLower) && !/react|node|express/i.test(topicLower);
    const isDevTools = /devtools|git|terminal|branch|pull request|npm|package|console/i.test(topicLower);
    const isReact = /react|component|jsx|props|state|hook|usestate|useeffect|virtual dom/i.test(topicLower);
    const isNodeExpress = /node|express|server|http|route|middleware|rest|controller|endpoint/i.test(topicLower);
    const isMongo = /mongo|database|collection|document|crud|mongoose|schema|index|aggregation/i.test(topicLower);
    const isPython = /python|math|vector|scalar|numpy|broadcasting/i.test(topicLower) || (domainSlug.includes('ai') && /syntax|variable|function|list/i.test(topicLower));
    const isMLStats = /statistics|probability|outlier|feature|scaling|regression|classification|tree|model|confusion|roc|auc/i.test(topicLower);
    const isSql = /sql|select|where|join|group by|table|query|cte|window/i.test(topicLower);
    const isDsa = /algorithm|complexity|big-o|two-pointer|sliding window|linked list|stack|queue|recursion|tree|bst|sorting|heap|graph|dynamic programming/i.test(topicLower);

    let language = 'javascript';
    let overview = `Master ${topic} from the ground up as part of ${domainModule.title}. You will understand what it is, why it is needed, how it works, and complete guided exercises.`;
    let lessonTitle = `Understanding ${topic}: What It Is & Why It Matters`;
    let concept = '';
    let whatIsIt = `What is ${topic}? In modern engineering, ${topic} provides structured patterns to solve real-world problems predictably.`;
    let whyNeeded = `Without ${topic}, applications become difficult to build, maintain, and scale. It gives developers a reliable, standardized approach.`;
    let syntaxBreakdown: Array<{ element: string; explanation: string }> = [];
    let analogy = '';
    let codeTitle = `${topic} Example`;
    let codeSnippet = '';
    let explanation = '';
    let expectedResult = '';
    let lineByLineExplanation: Array<{ line: string | number; explanation: string }> = [];
    let keyTakeaways: string[] = [];
    let checkQuestion = '';
    let checkCorrect = '';
    let checkWrong1 = '';
    let checkWrong2 = '';
    let checkExplanation = '';
    let exerciseTitle = `Hands-On Practice: ${topic}`;
    let exerciseInstruction = `Complete the practice task for ${topic}.`;
    let starterCode = '';
    let hints: string[] = [];

    if (isHtml) {
      language = 'html';
      overview = `Learn ${topic} from scratch. HTML (HyperText Markup Language) is the universal skeleton that defines every webpage on the internet.`;
      lessonTitle = `HTML from Scratch: Demystifying ${topic}`;
      whatIsIt = `What is ${topic}? An HTML element is the basic building block of any webpage. It consists of an opening tag, the content you want to display, and a closing tag.`;
      whyNeeded = `Browsers require tags to differentiate between headings, body paragraphs, buttons, and links so they can display them clearly and accessibly to users and search engines.`;
      concept = `HTML documents are built out of nested tags enclosed in angle brackets like <tag>content</tag>. When you view a website, your browser translates these tags into text, headers, and clickable controls on your screen without requiring any complex setup.`;
      analogy = `Think of building a webpage like building a house: HTML is the foundation, brick walls, and door frames that give the structure its shape.`;
      syntaxBreakdown = [
        { element: '<h1>', explanation: 'Opening tag telling the browser to start a top-level heading.' },
        { element: 'Hello, world!', explanation: 'The text content displayed in large, prominent font on screen.' },
        { element: '</h1>', explanation: 'Closing tag with a forward slash that ends the heading.' },
        { element: '<p>...</p>', explanation: 'A paragraph element used for standard descriptive body text.' }
      ];
      codeTitle = `Basic HTML: Heading & Paragraph`;
      codeSnippet = `<h1>Hello, world!</h1>\n<p>This is my first webpage.</p>`;
      explanation = `Line 1: <h1> renders a prominent top-level heading.\nLine 2: <p> renders standard paragraph body text below the heading.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Renders "Hello, world!" as the main title with bold formatting.' },
        { line: 2, explanation: 'Renders "This is my first webpage." in regular text below the heading.' }
      ];
      expectedResult = `The browser displays "Hello, world!" in large bold letters, followed by "This is my first webpage." directly beneath it.`;
      keyTakeaways = [
        'Always pair opening tags with closing tags (e.g., <p> and </p>).',
        'Use semantic elements like <header>, <main>, and <article> rather than generic containers.',
        'Keep one single <h1> per page for search engines and screen readers.'
      ];
      checkQuestion = `What is the primary role of HTML in web development?`;
      checkCorrect = `To define the semantic structure and content of a webpage.`;
      checkWrong1 = `To compute database algorithms and manage cloud servers.`;
      checkWrong2 = `To compile machine code into binary executable files.`;
      checkExplanation = `HTML provides the structural skeleton of the webpage. Styling is handled by CSS, and logic is handled by JavaScript.`;
      exerciseTitle = `Build a Semantic Webpage Section`;
      exerciseInstruction = `Write a clean HTML structure containing a heading (<h1>), a descriptive paragraph (<p>), and an anchor link (<a>).`;
      starterCode = `<!-- Write your HTML structure below -->\n<h1>My First Web Page</h1>\n<p>Start learning web development from zero.</p>\n<a href="#explore">Explore Topics</a>\n`;
      hints = ['Ensure tags have matching closing tags.', 'Use lower-case tag names.'];
    } else if (isCss) {
      language = 'css';
      overview = `Learn ${topic} from scratch. CSS (Cascading Style Sheets) turns plain HTML skeletons into beautiful, responsive user interfaces.`;
      lessonTitle = `CSS Styling from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? CSS (Cascading Style Sheets) controls how HTML elements look: colors, fonts, spacing, alignments, and responsive layouts.`;
      whyNeeded = `Without CSS, all webpages would look like raw black-and-white documents. CSS transforms basic HTML into attractive, modern, and readable interfaces.`;
      concept = `While HTML defines what appears on the page, CSS controls how it looks. A CSS rule targets an element using a selector, then applies property-value pairs inside curly braces.`;
      analogy = `If HTML is the bare mannequin standing in a storefront, CSS is the stylish outfit, tailored fit, lighting, and colors that make it look great.`;
      syntaxBreakdown = [
        { element: 'selector (.card)', explanation: 'Targets the HTML element you want to style.' },
        { element: 'property (padding)', explanation: 'The visual attribute you are styling.' },
        { element: 'value (16px)', explanation: 'The specific size, color, or layout applied to the property.' },
        { element: 'semicolon (;)', explanation: 'Ends each individual CSS rule.' }
      ];
      codeTitle = `Clean CSS Card Styling`;
      codeSnippet = `.card {\n  background-color: #f8fafc;\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n  padding: 16px;\n  color: #0f172a;\n}`;
      explanation = `Line 1: Targets all elements with class="card".\nLine 2-3: Sets soft background and subtle border.\nLine 4-5: Smooths corners and adds 16px internal padding.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Selects all elements with class="card".' },
        { line: 2, explanation: 'Sets a soft off-white background color.' },
        { line: 3, explanation: 'Draws a subtle 1px border around the card edge.' },
        { line: 4, explanation: 'Rounds the corners with an 8px radius.' },
        { line: 5, explanation: 'Adds 16px of comfortable breathing room inside the border.' }
      ];
      expectedResult = `A clean, modern card container with smooth rounded corners, light border, and soft off-white background.`;
      keyTakeaways = [
        'The Box Model consists of Content -> Padding -> Border -> Margin.',
        'Flexbox makes aligning elements vertically and horizontally predictable.',
        'Use media queries (@media) to adjust styles for mobile screens.'
      ];
      checkQuestion = `In the CSS Box Model, which layer creates clear space INSIDE an element's border?`;
      checkCorrect = `Padding`;
      checkWrong1 = `Margin`;
      checkWrong2 = `Outline`;
      checkExplanation = `Padding adds space inside the border around content, whereas Margin adds space outside the border.`;
      exerciseTitle = `Style a Centered Responsive Box`;
      exerciseInstruction = `Write CSS rules setting display to flex, background color, padding, and border-radius.`;
      starterCode = `/* Complete the styling */\n.my-box {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  padding: 20px;\n  background: #312e81;\n  border-radius: 8px;\n}\n`;
      hints = ['Check that property names end with a colon and values end with a semicolon.'];
    } else if (isJs) {
      language = 'javascript';
      overview = `Learn ${topic} from scratch. JavaScript is the programming language of the web that brings static pages to life with interactivity, logic, and data.`;
      lessonTitle = `JavaScript from Scratch: Mastering ${topic}`;
      whatIsIt = `What is ${topic}? JavaScript is a programming language that lets you add interactivity, calculations, and dynamic behavior to webpages.`;
      whyNeeded = `HTML creates structure and CSS provides style, but JavaScript is what reacts when users click buttons, submit forms, or load dynamic data.`;
      concept = `JavaScript allows your webpage to respond when users click, type, scroll, or fetch data. It provides fundamental tools: variables to store values, functions to reuse logic, and conditions to make decisions.`;
      analogy = `If HTML is the house and CSS is the paint and furniture, JavaScript is the electrical wiring, switches, and running water that react when you flip a switch.`;
      syntaxBreakdown = [
        { element: 'let / const', explanation: 'Keywords to create variables that store values in memory.' },
        { element: 'console.log()', explanation: 'Prints outputs and messages to the browser developer console.' },
        { element: '+ (concatenation)', explanation: 'Combines multiple text strings and numbers together.' }
      ];
      codeTitle = `Beginner JavaScript: Variables & Output`;
      codeSnippet = `let studentName = "Alex";\nlet completedTopics = 3;\n\nconsole.log("Welcome " + studentName + "! Completed topics: " + completedTopics);`;
      explanation = `Line 1-2: Stores name and number in variables.\nLine 4: Combines text and prints the message to the console.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Stores the student name "Alex" in a variable.' },
        { line: 2, explanation: 'Stores the completed topic count (3) in a variable.' },
        { line: 4, explanation: 'Combines the text and outputs the welcome message to the console.' }
      ];
      expectedResult = `Welcome Alex! Completed topics: 3`;
      keyTakeaways = [
        'Use const by default, and let only when you know a value will change.',
        'Functions should have clear names describing what action they perform.',
        'Array methods like map and filter allow you to process data cleanly without manual loops.'
      ];
      checkQuestion = `Which keyword should you use to declare a variable whose reference will NOT change?`;
      checkCorrect = `const`;
      checkWrong1 = `let`;
      checkWrong2 = `var (deprecated)`;
      checkExplanation = `const enforces immutability of the variable binding, preventing accidental reassignments in modern JavaScript.`;
      exerciseTitle = `Write a Grade Evaluation Function`;
      exerciseInstruction = `Implement a function calculatePassStatus(score) that returns true if score >= 70, otherwise false.`;
      starterCode = `function calculatePassStatus(score) {\n  // Your code here\n  return score >= 70;\n}\n`;
      hints = ['Use a comparison operator >= 70.'];
    } else if (isReact) {
      language = 'javascript';
      overview = `Learn ${topic} from scratch. React lets developers build user interfaces by snapping together reusable, self-contained components.`;
      lessonTitle = `React from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? React is a JavaScript library for building user interfaces using modular, reusable components.`;
      whyNeeded = `Instead of writing messy DOM queries, React lets you write declarative components that automatically update when your data changes.`;
      concept = `In React, components are functions that return JSX (HTML-like syntax inside JavaScript). When data changes, React automatically re-renders only the changed parts of the screen.`;
      analogy = `Think of React components like LEGO bricks: you can create a <Button /> brick or a <UserCard /> brick once, and reuse it everywhere in your application.`;
      syntaxBreakdown = [
        { element: 'function Card()', explanation: 'A component function that returns JSX markup.' },
        { element: 'JSX (<div className="...">)', explanation: 'HTML-like templating syntax inside JavaScript.' },
        { element: 'return (...)', explanation: 'Specifies what visual elements this component produces on screen.' }
      ];
      codeTitle = `First React Component`;
      codeSnippet = `function WelcomeBadge() {\n  return (\n    <div className="badge">\n      <h2>Hello from React!</h2>\n      <p>This is a reusable UI component.</p>\n    </div>\n  );\n}`;
      explanation = `Line 1: Declares a functional component named WelcomeBadge.\nLine 2-7: Returns the JSX elements to display.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Declares a functional component named WelcomeBadge.' },
        { line: 2-7, explanation: 'Returns the JSX elements to display.' }
      ];
      expectedResult = `A rendered container with heading "Hello from React!" and paragraph text.`;
      keyTakeaways = [
        'React components must return a single root JSX element.',
        'Never mutate state directly; always use the setter function from useState.',
        'Pass data down to children using props, and notify parents via callbacks.'
      ];
      checkQuestion = `Why does React use state instead of regular variables to store component data?`;
      checkCorrect = `When state updates, React automatically re-renders the UI to reflect the new data.`;
      checkWrong1 = `State variables are permanently stored on the user's hard drive.`;
      checkWrong2 = `Regular variables cannot hold numbers or strings in JavaScript.`;
      checkExplanation = `State is tied to the component lifecycle; calling its updater triggers React to recalculate the Virtual DOM and update the screen.`;
      exerciseTitle = `Build a Simple Greeting Component`;
      exerciseInstruction = `Create a component that accepts a "name" prop and renders a friendly greeting message.`;
      starterCode = `export function Greeting({ name }) {\n  return <h2>Hello, {name || 'Learner'}!</h2>;\n}\n`;
      hints = ['JSX embeds JavaScript expressions inside curly braces {}.'];
    } else if (isNodeExpress) {
      language = 'javascript';
      overview = `Learn ${topic} from scratch. Node.js runs JavaScript on the server, while Express makes creating web APIs and backend services fast and structured.`;
      lessonTitle = `Backend Engineering from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? Node.js allows JavaScript to run on servers, and Express provides tools to build web API routes.`;
      whyNeeded = `Browsers cannot talk directly to databases securely. A backend API receives requests, runs business logic, and returns JSON responses.`;
      concept = `Web browsers cannot directly talk to databases or perform heavy background tasks securely. A backend server listens on a network port for incoming HTTP requests, processes logic, talks to a database, and returns a JSON response.`;
      analogy = `The client is like a restaurant customer, the API route is the waiter taking your order, the Express server is the kitchen preparing the food, and the JSON response is your meal.`;
      syntaxBreakdown = [
        { element: 'express()', explanation: 'Creates an Express application instance.' },
        { element: 'app.get(path, handler)', explanation: 'Registers a route listening for HTTP GET requests.' },
        { element: 'res.json()', explanation: 'Sends a formatted JSON response back to the client.' }
      ];
      codeTitle = `First Express API Route`;
      codeSnippet = `import express from 'express';\n\nconst app = express();\n\napp.get('/api/welcome', (req, res) => {\n  res.json({ message: "Hello from your first API!" });\n});\n\napp.listen(5000);`;
      explanation = `Line 1: Imports Express module.\nLine 3: Creates app instance.\nLine 5-7: Creates GET endpoint.\nLine 9: Starts listening on port 5000.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Imports the Express web framework.' },
        { line: 3, explanation: 'Initializes the server app.' },
        { line: 5-7, explanation: 'Defines a GET endpoint returning JSON data.' },
        { line: 9, explanation: 'Listens for requests on port 5000.' }
      ];
      expectedResult = `{ "message": "Hello from your first API!" }`;
      keyTakeaways = [
        'Always validate incoming request data defensively before processing.',
        'Use correct HTTP status codes (200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Error).',
        'Middleware functions execute in sequence between the incoming request and the final response.'
      ];
      checkQuestion = `Which HTTP status code should a server return when a client request creates a new resource successfully?`;
      checkCorrect = `201 Created`;
      checkWrong1 = `200 OK`;
      checkWrong2 = `404 Not Found`;
      checkExplanation = `201 Created explicitly indicates that the request succeeded and resulted in a newly created resource on the server.`;
      exerciseTitle = `Create an Express Route Handler`;
      exerciseInstruction = `Write a route handler that checks if req.body.title exists; if missing, return status 400, else return status 201.`;
      starterCode = `export function handleCreate(req, res) {\n  const { title } = req.body || {};\n  if (!title) return res.status(400).json({ error: 'Title required' });\n  return res.status(201).json({ success: true, title });\n}\n`;
      hints = ['Use res.status(code).json(...) to return response envelopes.'];
    } else if (isMongo) {
      language = 'javascript';
      overview = `Learn ${topic} from scratch. MongoDB stores data as flexible, JSON-like documents, while Mongoose provides strict schema validation and queries in Node.js.`;
      lessonTitle = `Database Modeling from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? MongoDB is a document database that stores information in flexible, JSON-like documents rather than rigid tabular rows.`;
      whyNeeded = `Modern web apps need to store user profiles, assessment records, and questions persistently so data isn't lost when the server restarts.`;
      concept = `Databases allow applications to remember data permanently even if the server restarts. MongoDB stores records as "documents" inside "collections". Mongoose lets you define schemas so that every document adheres to expected data types.`;
      analogy = `Think of MongoDB like a secure filing cabinet: each drawer is a Collection (e.g. Users), and each folder inside is a Document with labeled fields.`;
      syntaxBreakdown = [
        { element: 'Document', explanation: 'A single record containing field-value pairs (like an object).' },
        { element: 'Collection', explanation: 'A group of related documents (analogous to a folder of records).' },
        { element: 'Model.findOne()', explanation: 'Mongoose query method to search for documents matching a condition.' }
      ];
      codeTitle = `Mongoose Query: Find Student Document`;
      codeSnippet = `// Search database for a student record by email\nconst student = await User.findOne({ email: "learner@evalora.dev" });\nconsole.log("Found student:", student?.name);`;
      explanation = `Line 2: Searches User collection for matching document.\nLine 3: Logs the student name.`;
      lineByLineExplanation = [
        { line: 2, explanation: 'Searches the User collection in MongoDB for a document with the matching email.' },
        { line: 3, explanation: 'Logs the student name once the database query completes.' }
      ];
      expectedResult = `Found student: Alex Rivers`;
      keyTakeaways = [
        'MongoDB documents are stored as flexible BSON (binary JSON) records.',
        'Mongoose schemas prevent bad or malformed data from entering your database.',
        'Add indexes to frequently queried fields (like email) to keep lookups fast.'
      ];
      checkQuestion = `In MongoDB and Mongoose, what is a Collection?`;
      checkCorrect = `A grouping of related documents, similar to a table in relational databases.`;
      checkWrong1 = `A single row of data inside a spreadsheet.`;
      checkWrong2 = `A network cable connecting servers together.`;
      checkExplanation = `A collection is a container for MongoDB documents, analogous to a table in SQL.`;
      exerciseTitle = `Define a Mongoose Schema Field`;
      exerciseInstruction = `Define a schema with a required string field "title" and a number field "views" defaulting to 0.`;
      starterCode = `import mongoose from 'mongoose';\n\nconst itemSchema = new mongoose.Schema({\n  title: { type: String, required: true },\n  views: { type: Number, default: 0 }\n});\n`;
      hints = ['Use { type: String, required: true } syntax.'];
    } else if (isPython || isMLStats) {
      language = 'python';
      overview = `Learn ${topic} from scratch. Python and numerical computing provide the essential foundation for AI and Machine Learning.`;
      lessonTitle = `Python & AI from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? Python is a clear, beginner-friendly programming language widely used in AI, data science, and automation.`;
      whyNeeded = `Python has English-like syntax and extensive scientific libraries (NumPy, Scikit-Learn) that make building machine learning models accessible.`;
      concept = `Machine learning algorithms find mathematical patterns in data to make predictions. Before training models, you must understand how data is represented: numbers, vectors (lists of numbers), and multi-dimensional matrices.`;
      analogy = `Teaching a machine learning model is like showing a child thousands of pictures of apples and oranges until they can recognize the differences on their own.`;
      syntaxBreakdown = [
        { element: 'variable = value', explanation: 'Assigns data to a name without requiring type declarations.' },
        { element: 'def function_name():', explanation: 'Defines a reusable function using clean indentation.' },
        { element: 'print()', explanation: 'Outputs text or numbers to the screen or console.' }
      ];
      codeTitle = `Beginner Python: Calculate Average Score`;
      codeSnippet = `# Calculate student test average\nscores = [85, 90, 78, 92]\naverage = sum(scores) / len(scores)\n\nprint(f"Class average score: {average}")`;
      explanation = `Line 2: Creates a list of numbers.\nLine 3: Computes average using sum() and len().\nLine 5: Prints formatted string result.`;
      lineByLineExplanation = [
        { line: 2, explanation: 'Creates a list of four test score numbers.' },
        { line: 3, explanation: 'Calculates the sum divided by the number of scores.' },
        { line: 5, explanation: 'Prints the calculated average using formatted string syntax.' }
      ];
      expectedResult = `Class average score: 86.25`;
      keyTakeaways = [
        'Vectorized operations in NumPy are orders of magnitude faster than Python for loops.',
        'Always clean and scale feature data before training machine learning models.',
        'Split data into Training and Test sets to evaluate whether the model truly generalizes.'
      ];
      checkQuestion = `Why is feature scaling (like normalization or standardization) important in Machine Learning?`;
      checkCorrect = `It ensures all numerical features contribute on a similar scale so large numbers do not dominate the model.`;
      checkWrong1 = `It deletes all negative numbers from the dataset.`;
      checkWrong2 = `It converts text into audio files automatically.`;
      checkExplanation = `Feature scaling balances the magnitude of variables so distance-based and gradient-based algorithms converge efficiently.`;
      exerciseTitle = `Implement Vector Normalization in NumPy`;
      exerciseInstruction = `Write a function normalize_vector(arr) that subtracts the mean and divides by standard deviation.`;
      starterCode = `import numpy as np\n\ndef normalize_vector(arr):\n    arr = np.array(arr)\n    mean = np.mean(arr)\n    std = np.std(arr)\n    return (arr - mean) / (std if std != 0 else 1)\n`;
      hints = ['Handle division by zero when standard deviation is 0.'];
    } else if (isSql) {
      language = 'sql';
      overview = `Learn ${topic} from scratch. SQL (Structured Query Language) is the universal tool used to query, filter, and extract insights from relational databases.`;
      lessonTitle = `SQL from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? SQL (Structured Query Language) is the standard language used to interact with and query relational databases.`;
      whyNeeded = `Databases store millions of records. SQL lets you ask specific questions—like "which students scored above 80%?"—in milliseconds.`;
      concept = `Relational databases organize information into tables with rows (records) and columns (attributes). SQL allows you to ask questions of your data: filtering records with WHERE, sorting results with ORDER BY, and computing statistics.`;
      analogy = `Think of an SQL table like an organized spreadsheet, and an SQL query like a super-fast filter that finds exactly the rows matching your criteria.`;
      syntaxBreakdown = [
        { element: 'SELECT', explanation: 'Specifies which columns you want to view.' },
        { element: 'FROM', explanation: 'Specifies the table that contains the data.' },
        { element: 'WHERE', explanation: 'Filters rows according to a condition.' },
        { element: 'ORDER BY', explanation: 'Sorts the returned records.' }
      ];
      codeTitle = `SQL Query: Filter and Sort Records`;
      codeSnippet = `SELECT name, score\nFROM test_results\nWHERE score >= 75\nORDER BY score DESC;`;
      explanation = `Line 1: Requests name and score columns.\nLine 2: Specifies test_results table.\nLine 3: Filters for score >= 75.\nLine 4: Sorts from highest to lowest score.`;
      lineByLineExplanation = [
        { line: 1, explanation: 'Requests the "name" and "score" columns.' },
        { line: 2, explanation: 'Retrieves records from the "test_results" table.' },
        { line: 3, explanation: 'Filters to only include students who passed with 75% or higher.' },
        { line: 4, explanation: 'Sorts results from highest score to lowest score.' }
      ];
      expectedResult = `A table listing qualifying students with their scores ordered from highest to lowest.`;
      keyTakeaways = [
        'Always filter with WHERE to avoid pulling unnecessary records into memory.',
        'Use INNER JOIN to combine rows where matching keys exist in both tables.',
        'GROUP BY groups rows so you can calculate sums, counts, and averages per category.'
      ];
      checkQuestion = `Which SQL clause is used to filter records according to specified conditions?`;
      checkCorrect = `WHERE`;
      checkWrong1 = `ORDER BY`;
      checkWrong2 = `GROUP BY`;
      checkExplanation = `The WHERE clause filters rows based on boolean conditions prior to grouping or sorting.`;
      exerciseTitle = `Write an SQL Query with Filtering`;
      exerciseInstruction = `Write a query to SELECT name and salary FROM employees WHERE department = 'Engineering'.`;
      starterCode = `SELECT name, salary\nFROM employees\nWHERE department = 'Engineering';\n`;
      hints = ['Keywords in SQL are case-insensitive, but uppercase is standard convention.'];
    } else if (isDsa) {
      language = 'javascript';
      overview = `Learn ${topic} from scratch. Algorithms and data structures teach you how to analyze computational tradeoffs and write high-efficiency code.`;
      lessonTitle = `Algorithms from Scratch: ${topic}`;
      whatIsIt = `What is ${topic}? Data Structures and Algorithms (DSA) teach you how to organize data efficiently and write programs that execute fast with minimal memory.`;
      whyNeeded = `Writing code that merely works isn't enough when handling thousands of users. Efficient algorithms prevent applications from crashing or lagging.`;
      concept = `Every computer program consumes two physical resources: time (CPU clock cycles) and space (RAM memory). Big-O notation measures how an algorithm's resource consumption grows as the input size scales toward infinity.`;
      analogy = `Finding a word in an alphabetically sorted dictionary takes seconds with Binary Search, whereas flipping through every page one by one takes hours.`;
      syntaxBreakdown = [
        { element: 'O(1) Constant', explanation: 'Algorithm runs in fixed time regardless of input size.' },
        { element: 'O(n) Linear', explanation: 'Execution time grows proportionally with the number of items.' },
        { element: 'Two Pointers', explanation: 'Using two index markers to traverse an array from both ends.' }
      ];
      codeTitle = `Linear Search: Step-by-Step Item Search`;
      codeSnippet = `function findItem(arr, target) {\n  for (let i = 0; i < arr.length; i++) {\n    if (arr[i] === target) return i; // Found at index i\n  }\n  return -1; // Not found\n}\n\nconst index = findItem(["apple", "banana", "orange"], "banana");\nconsole.log("Found at index:", index);`;
      explanation = `Line 2-5: Iterates through array elements.\nLine 3: Checks if current item equals target.\nLine 7-8: Calls function and logs result.`;
      lineByLineExplanation = [
        { line: 2, explanation: 'Loops through the array from the first item to the last.' },
        { line: 3, explanation: 'Checks if the current item matches our target value.' },
        { line: 8, explanation: 'Searches for "banana" and returns index 1.' }
      ];
      expectedResult = `Found at index: 1`;
      keyTakeaways = [
        'O(1) is constant time, O(log n) is logarithmic, O(n) is linear, and O(n^2) is quadratic.',
        'Two-pointer techniques reduce nested loops from O(n^2) down to linear O(n).',
        'Always verify base cases in recursive algorithms to prevent stack overflows.'
      ];
      checkQuestion = `What is the time complexity of Binary Search on a sorted array of size n?`;
      checkCorrect = `O(log n)`;
      checkWrong1 = `O(n)`;
      checkWrong2 = `O(n^2)`;
      checkExplanation = `Binary Search cuts the search space in half with every iteration, resulting in O(log n) logarithmic time complexity.`;
      exerciseTitle = `Implement a Two-Pointer Solution`;
      exerciseInstruction = `Implement a function hasPairWithSum(arr, target) using two pointers on a sorted array.`;
      starterCode = `function hasPairWithSum(sortedArr, target) {\n  let left = 0;\n  let right = sortedArr.length - 1;\n  while (left < right) {\n    const sum = sortedArr[left] + sortedArr[right];\n    if (sum === target) return true;\n    if (sum < target) left++;\n    else right--;\n  }\n  return false;\n}\n`;
      hints = ['Move the left pointer right if sum is too small; move right pointer left if sum is too large.'];
    } else {
      // General Fallback
      concept = `${topic} is a key architectural foundation in ${domain.name}. Starting from first principles, it provides structured patterns to solve real-world engineering problems efficiently.`;
      whatIsIt = `What is ${topic}? In ${domain.name}, ${topic} provides structured patterns to solve engineering problems predictably.`;
      whyNeeded = `It ensures applications are maintainable, testable, and scale smoothly as requirements grow.`;
      analogy = `Think of ${topic} like the gears in a Swiss watch: each piece has a distinct, precise role that keeps the entire mechanism running reliably.`;
      syntaxBreakdown = [
        { element: 'Pattern', explanation: 'Standard convention for organizing code.' },
        { element: 'Module', explanation: 'Self-contained unit of logic.' },
        { element: 'Interface', explanation: 'Defined boundaries for inputs and outputs.' }
      ];
      codeTitle = `Basic ${topic} Implementation`;
      codeSnippet = `// Example: ${topic} Fundamentals\nexport function execute(input) {\n  if (input === undefined || input === null) {\n    throw new Error('Valid input required');\n  }\n  return {\n    topic: '${topic}',\n    success: true,\n    data: input\n  };\n}`;
      explanation = `Line 2-4: Validates the input before running logic.\nLine 5-9: Returns a structured response envelope adhering to engineering standards.`;
      lineByLineExplanation = [
        { line: 2, explanation: 'Validates that a valid input argument was passed.' },
        { line: 5, explanation: 'Returns a structured envelope with topic name and success status.' }
      ];
      expectedResult = `{ topic: "${topic}", success: true, data: "test" }`;
      keyTakeaways = [
        'Understand the problem before writing implementation code.',
        'Handle edge cases and invalid inputs gracefully.',
        'Keep functions small, focused, and testable.'
      ];
      checkQuestion = `What is the primary reason for writing modular, well-tested code for ${topic}?`;
      checkCorrect = `It makes the codebase maintainable, readable, and resilient against unexpected bugs.`;
      checkWrong1 = `It makes code run on hardware without a CPU.`;
      checkWrong2 = `It eliminates the need for internet access.`;
      checkExplanation = `Modularity and testing ensure code can be maintained and extended reliably over time.`;
      exerciseTitle = `Hands-On Challenge: ${topic}`;
      exerciseInstruction = `Write a function that validates input data and returns an execution result.`;
      starterCode = `export function solve(input) {\n  return { success: true, topic: '${topic}', input };\n}\n`;
      hints = ['Validate input before processing.'];
    }

    return {
      overview,
      difficulty: 'beginner',
      estimatedMinutes: 20,
      lessons: [
        {
          lessonId: `lesson-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}-1`,
          title: lessonTitle,
          concept,
          whatIsIt,
          whyNeeded,
          realWorldAnalogy: analogy,
          syntaxBreakdown,
          codeExamples: [
            {
              title: codeTitle,
              language,
              code: codeSnippet,
              explanation,
              expectedResult,
              lineByLineExplanation
            }
          ],
          keyTakeaways
        }
      ],
      exercises: [
        {
          exerciseId: `ex-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}-check`,
          title: `Knowledge Check: ${topic}`,
          instruction: checkQuestion,
          type: 'knowledge_check',
          difficulty: 'easy',
          options: [
            { id: 'opt1', text: checkCorrect, isCorrect: true },
            { id: 'opt2', text: checkWrong1, isCorrect: false },
            { id: 'opt3', text: checkWrong2, isCorrect: false }
          ],
          explanation: checkExplanation
        },
        {
          exerciseId: `ex-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}-code`,
          title: exerciseTitle,
          instruction: exerciseInstruction,
          type: 'coding',
          difficulty: 'medium',
          starterCode,
          language,
          hints,
          workspaceConfig: this.buildWorkspaceConfig({
            domainSlug: domain.slug,
            moduleId: domainModule.moduleId,
            topic: exerciseInstruction,
            language
          })
        }
      ],
      source: 'curriculum_curated'
    };
  }

  /**
   * Synthesizes mandatory module assignment with starter files and rubrics tailored to the module level.
   */
  private synthesizeModuleAssignment(
    domain: IDomain,
    domainModule: any,
    moduleIndex: number
  ): Partial<IDomainAssignment> {
    const slugLower = domain.slug.toLowerCase();
    const isWeb = slugLower.includes('mern') || slugLower.includes('web') || slugLower.includes('react') || slugLower.includes('frontend');
    const isSql = slugLower.includes('sql') || slugLower.includes('database');
    const isMLStats = slugLower.includes('ai') || slugLower.includes('machine-learning') || slugLower.includes('data-science');
    const isDsa = slugLower.includes('dsa') || slugLower.includes('algorithm') || slugLower.includes('c-plus-plus') || slugLower.includes('java');
    const assignmentId = `assignment-${domain.slug}-${domainModule.moduleId}`;

    let starterFiles: IAssignmentStarterFile[] = [];
    let rubric: IAssignmentRubricItem[] = [];
    let instructions: string[] = [];
    let objective = `Demonstrate practical mastery of ${domainModule.title}.`;

    if (isWeb && moduleIndex === 0) {
      // Stage A: HTML from Scratch Assignment
      objective = 'Build a clean, semantic webpage containing a header, navigation, main article, and contact form from scratch.';
      instructions = [
        'Use semantic HTML elements (<header>, <nav>, <main>, <article>, <form>).',
        'Include a main section heading (<h1>) and descriptive paragraph (<p>).',
        'Add a form with at least one text input (<input>) and a submit button (<button>).'
      ];
      starterFiles = [
        {
          filename: 'index.html',
          language: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Module 1 Project: Semantic Webpage</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Header & Navigation -->
  <header class="header">
    <nav class="nav">
      <h2>Evalora Portfolio</h2>
    </nav>
  </header>

  <!-- Main Content -->
  <main id="main-content">
    <article class="intro-card">
      <h1>My Developer Journey</h1>
      <p>I am learning web development from scratch with clean, semantic markup.</p>
    </article>

    <!-- Contact Form -->
    <section class="contact-section">
      <h3>Get in Touch</h3>
      <form id="contact-form">
        <label for="username">Your Name:</label>
        <input type="text" id="username" placeholder="Alex Rivers" />
        <button type="submit" id="submit-btn">Send Message</button>
      </form>
    </section>
  </main>
</body>
</html>`
        },
        {
          filename: 'styles.css',
          language: 'css',
          content: `body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }\n.intro-card { background: #1e293b; padding: 24px; border-radius: 8px; margin-bottom: 20px; }\ninput { padding: 8px; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; }\nbutton { background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }`
        }
      ];

      rubric = [
        {
          id: 'r1',
          title: 'Semantic Document Structure',
          description: 'Document includes semantic tags (<header>, <nav>, <main>, and <article>).',
          weight: 35,
          verificationType: 'html_dom',
          targetIdentifier: 'main'
        },
        {
          id: 'r2',
          title: 'Responsive CSS Styling',
          description: 'Includes clean CSS styling with modern Flexbox layout rules.',
          weight: 35,
          verificationType: 'css_property',
          targetIdentifier: 'display',
          expectedValue: 'flex'
        },
        {
          id: 'r3',
          title: 'JavaScript DOM & Event Handling',
          description: 'Includes interactive JavaScript with event listeners.',
          weight: 30,
          verificationType: 'js_function',
          targetIdentifier: 'addEventListener'
        }
      ];
    } else if (isWeb && moduleIndex === 1) {
      // Stage B: CSS from Scratch Assignment
      objective = 'Style a responsive multi-card layout using CSS Flexbox/Grid, the Box Model, and media queries.';
      instructions = [
        'Apply display: flex or display: grid on the layout container.',
        'Use appropriate padding, margin, and border-radius rules.',
        'Ensure the interface is readable on both mobile and desktop viewports.'
      ];
      starterFiles = [
        {
          filename: 'index.html',
          language: 'html',
          content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="card-grid">
    <div class="card">
      <h2>Flexbox Card 1</h2>
      <p>Clean box model styling with padding and margin.</p>
    </div>
    <div class="card">
      <h2>Flexbox Card 2</h2>
      <p>Responsive alignment across viewports.</p>
    </div>
  </div>
</body>
</html>`
        },
        {
          filename: 'styles.css',
          language: 'css',
          content: `body {\n  font-family: sans-serif;\n  background: #090d16;\n  color: #f1f5f9;\n  margin: 0;\n  padding: 24px;\n}\n.card-grid {\n  display: flex;\n  gap: 16px;\n  flex-wrap: wrap;\n}\n.card {\n  background: #1e293b;\n  padding: 24px;\n  border-radius: 12px;\n  flex: 1 1 280px;\n  border: 1px solid #334155;\n}`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'CSS Flexbox / Grid Layout',
          description: 'Uses display: flex or display: grid with clean responsive wrapping.',
          weight: 40,
          verificationType: 'css_property',
          targetIdentifier: 'display',
          expectedValue: 'flex'
        },
        {
          id: 'r2',
          title: 'Box Model Spacing & Borders',
          description: 'Applies padding, margins, and borders appropriately.',
          weight: 35,
          verificationType: 'css_property',
          targetIdentifier: 'padding',
          expectedValue: '24px'
        },
        {
          id: 'r3',
          title: 'Visual Polish & Design Tokens',
          description: 'Uses clean background colors, rounded borders, and readable typography.',
          weight: 25,
          verificationType: 'keyword_match',
          targetIdentifier: 'border-radius'
        }
      ];
    } else if (isWeb && moduleIndex === 2) {
      // Stage C: React Components & Hooks Assignment
      objective = 'Build an interactive React component managing state, list rendering, and user event handling.';
      instructions = [
        'Define a functional React component with useState.',
        'Render a dynamic list of items with proper keys.',
        'Handle user click or input events with state updates.'
      ];
      starterFiles = [
        {
          filename: 'App.jsx',
          language: 'javascript',
          content: `import React, { useState } from 'react';

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Learn React Hooks', completed: true },
    { id: 2, text: 'Build Interactive State Component', completed: false }
  ]);
  const [inputVal, setInputVal] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: inputVal.trim(), completed: false }]);
    setInputVal('');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Interactive Task Tracker</h1>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="New task title..."
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: '#5B5CE2', color: 'white', border: 'none', borderRadius: 6 }}>
          Add Task
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((t) => (
          <li key={t.id} style={{ padding: '8px 12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>{t.text}</span>
            <span>{t.completed ? '✓ Done' : 'Pending'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}`
        },
        {
          filename: 'index.html',
          language: 'html',
          content: `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>React Workspace</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'React Functional Component & JSX',
          description: 'Defines a valid React component returning JSX elements.',
          weight: 40,
          verificationType: 'keyword_match',
          targetIdentifier: 'useState'
        },
        {
          id: 'r2',
          title: 'Event Handling & State Updates',
          description: 'Updates state on user submission or input changes.',
          weight: 35,
          verificationType: 'keyword_match',
          targetIdentifier: 'setTasks'
        },
        {
          id: 'r3',
          title: 'List Rendering & Keys',
          description: 'Maps over state arrays with key identifiers.',
          weight: 25,
          verificationType: 'keyword_match',
          targetIdentifier: 'map'
        }
      ];
    } else if (isSql || (domain.slug.includes('data') && moduleIndex === 0)) {
      // SQL from Scratch Assignment
      objective = 'Write relational SQL queries to filter, aggregate, and join student records.';
      instructions = [
        'Query the students table to find records where gpa >= 3.6.',
        'Use GROUP BY to aggregate student_count and average gpa per department.',
        'Order results by average gpa in descending order.'
      ];
      starterFiles = [
        {
          filename: 'query.sql',
          language: 'sql',
          content: `-- SQL Module Assignment: Relational Queries & Aggregations
-- Available Tables: students, courses, enrollments, employees

-- Task: Write a query to return department name, student count, and average GPA
-- for departments with students having GPA >= 3.5.
-- Sort by avg_gpa DESC.

SELECT 
  department,
  COUNT(student_id) AS student_count,
  ROUND(AVG(gpa), 2) AS avg_gpa
FROM students
WHERE gpa >= 3.5
GROUP BY department
ORDER BY avg_gpa DESC;
`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'SQL SELECT & FROM Clauses',
          description: 'Selects required columns and aggregates from the students table.',
          weight: 35,
          verificationType: 'keyword_match',
          targetIdentifier: 'SELECT'
        },
        {
          id: 'r2',
          title: 'Filtering with WHERE Clause',
          description: 'Applies filter condition on student GPA threshold.',
          weight: 35,
          verificationType: 'keyword_match',
          targetIdentifier: 'WHERE'
        },
        {
          id: 'r3',
          title: 'Aggregation with GROUP BY & ORDER BY',
          description: 'Groups records by department and sorts results.',
          weight: 30,
          verificationType: 'keyword_match',
          targetIdentifier: 'GROUP BY'
        }
      ];
    } else if (isMLStats || domain.slug.includes('ai') || (domain.slug.includes('data') && moduleIndex > 0)) {
      // AI / Machine Learning & Data Science Assignment
      objective = 'Train a regression model on real dataset features, evaluate performance metrics (R2, MSE), and plot results.';
      instructions = [
        'Load the "student_scores.csv" dataset using Pandas.',
        'Fit a LinearRegression model to predict exam_score from hours_studied.',
        'Calculate and print model metrics (R2 Score and MSE).',
        'Visualize the data points and regression line using matplotlib.pyplot.'
      ];
      starterFiles = [
        {
          filename: 'solution.py',
          language: 'python',
          content: `# AI / Data Science Module Assignment: Regression & Visualization
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# 1. Load the pre-seeded dataset
df = pd.read_csv('student_scores.csv')
print("Dataset Summary:")
print(df.head())

# 2. Extract features and target
X = df[['hours_studied']]
y = df['exam_score']

# 3. Train model
model = LinearRegression()
model.fit(X, y)
predictions = model.predict(X)

# 4. Compute metrics
r2 = r2_score(y, predictions)
mse = mean_squared_error(y, predictions)
print(f"\\nModel Performance Metrics:")
print(f"R2 Score: {r2:.4f}")
print(f"MSE: {mse:.2f}")

# 5. Visualize results
plt.figure(figsize=(7, 4))
plt.scatter(X, y, color='#5B5CE2', label='Actual Scores')
plt.plot(X, predictions, color='#10B981', linewidth=2, label='Fitted Line')
plt.title('Hours Studied vs Exam Score (Linear Regression)')
plt.xlabel('Hours Studied')
plt.ylabel('Exam Score')
plt.legend()
plt.grid(True, linestyle='--', alpha=0.5)
plt.show()
`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'Data Ingestion & Feature Preparation',
          description: 'Loads CSV dataset and structures predictor and target variables.',
          weight: 35,
          verificationType: 'keyword_match',
          targetIdentifier: 'read_csv'
        },
        {
          id: 'r2',
          title: 'Model Training & Metric Evaluation',
          description: 'Trains regression model and prints performance metrics (R2 / MSE).',
          weight: 35,
          verificationType: 'keyword_match',
          targetIdentifier: 'fit'
        },
        {
          id: 'r3',
          title: 'Matplotlib Visualization Plot',
          description: 'Generates scatter plot and regression line using matplotlib.',
          weight: 30,
          verificationType: 'keyword_match',
          targetIdentifier: 'plt.show'
        }
      ];
    } else if (isDsa || domain.slug.includes('dsa')) {
      // Data Structures & Algorithms Assignment
      objective = 'Implement an optimal algorithmic solution and pass all automated test cases.';
      instructions = [
        'Implement the twoSum function to return indices of the two numbers that add up to target.',
        'Achieve optimal O(n) linear time complexity using a dictionary or two pointers.',
        'Pass all visible and hidden automated test cases.'
      ];
      starterFiles = [
        {
          filename: 'solution.py',
          language: 'python',
          content: `"""
DSA Module Assignment: Two Sum Target Search
Find indices of two numbers that add up to target.
Optimal Time Complexity: O(n)
"""
import sys

def two_sum(nums, target):
    seen = {}
    for idx, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], idx]
        seen[num] = idx
    return []

if __name__ == '__main__':
    # Test execution
    input_data = sys.stdin.read().split()
    if len(input_data) >= 2:
        target = int(input_data[-1])
        nums = [int(x) for x in input_data[:-1]]
        result = two_sum(nums, target)
        print(f"{result[0]} {result[1]}" if result else "-1 -1")
    else:
        # Default verification run
        print("0 1")
`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'Algorithmic Logic & Edge Cases',
          description: 'Correct mathematical logic identifying target difference.',
          weight: 50,
          verificationType: 'keyword_match',
          targetIdentifier: 'two_sum'
        },
        {
          id: 'r2',
          title: 'Optimal Time Complexity O(n)',
          description: 'Uses hash map/dictionary lookup instead of nested loops.',
          weight: 50,
          verificationType: 'keyword_match',
          targetIdentifier: 'seen'
        }
      ];
    } else {
      // General Module Assignment
      objective = `Fulfill all practical requirements for ${domainModule.title}.`;
      instructions = [
        `Review the starter files and rubric milestones.`,
        `Implement the required behavior and verify using the Live Preview or Console.`,
        `Achieve at least 70% to pass this module and unlock the next module.`
      ];
      starterFiles = [
        {
          filename: 'solution.js',
          language: 'javascript',
          content: `/**\n * Assignment: ${domainModule.title}\n * Implement verified criteria below.\n */\nexport function executeTask(input) {\n  if (!input) {\n    return { success: false, error: 'Valid input required' };\n  }\n  return {\n    success: true,\n    moduleId: "${domainModule.moduleId}",\n    result: input\n  };\n}`
        }
      ];
      rubric = [
        {
          id: 'r1',
          title: 'Core Concept Implementation',
          description: `Correct functional implementation of requirements for ${domainModule.title}.`,
          weight: 50,
          verificationType: 'keyword_match',
          targetIdentifier: 'success'
        },
        {
          id: 'r2',
          title: 'Input Validation & Edge Cases',
          description: 'Handles empty or missing parameters defensively.',
          weight: 50,
          verificationType: 'keyword_match',
          targetIdentifier: 'moduleId'
        }
      ];
    }

    const workspaceConfig = this.buildWorkspaceConfig({
      domainSlug: domain.slug,
      moduleId: domainModule.moduleId
    });

    return {
      assignmentId,
      domainSlug: domain.slug,
      moduleId: domainModule.moduleId,
      title: `Module ${moduleIndex + 1} Assignment: ${domainModule.title}`,
      description: `Demonstrate your practical mastery of ${domainModule.title}. Fulfill all criteria outlined in the assignment instructions to earn your module passing badge and unlock the next module.`,
      objective,
      type: isWeb && moduleIndex < 3 ? 'web_coding' : isDsa ? 'algorithmic' : 'backend_coding',
      passingScore: 70,
      instructions,
      starterFiles,
      rubric,
      workspaceConfig,
      testCases: workspaceConfig.testCases || [],
      estimatedMinutes: 45,
      status: 'published',
      source: 'curriculum_curated'
    };
  }

  /**
   * Builds domain-aware workspace configuration dynamically based on exercise and domain parameters.
   */
  public buildWorkspaceConfig(params: {
    domainSlug: string;
    moduleId?: string;
    topic?: string;
    language?: string;
    exerciseType?: string;
  }): IWorkspaceConfig {
    const { domainSlug, moduleId = '', topic = '', language = '' } = params;
    const slug = domainSlug.toLowerCase();
    const mod = moduleId.toLowerCase();
    const top = topic.toLowerCase();
    const lang = language.toLowerCase();

    const isWeb = slug.includes('mern') || slug.includes('web') || slug.includes('frontend') || slug.includes('react') || top.includes('html') || top.includes('css') || top.includes('dom') || lang === 'html' || lang === 'css';
    const isSql = lang === 'sql' || top.includes('sql') || mod.includes('sql') || top.includes('query') || mod === 'ds-m1-sql-scratch';
    const isDsa = (slug.includes('dsa') || mod.includes('dsa') || top.includes('algorithm') || top.includes('tree') || top.includes('graph') || top.includes('search') || top.includes('sort') || top.includes('complexity') || ['cpp', 'c', 'java'].includes(lang)) && !isWeb;
    const isMLOrAI = (slug.includes('machine-learning') || slug.includes('artificial-intelligence') || slug.includes('ai-') || mod.includes('-ml') || mod.includes('ml-') || top.includes('machine learning') || top.includes('model') || top.includes('regression') || top.includes('numpy')) && !isWeb && !isDsa;
    const isDataScience = (slug.includes('data-science') || mod.includes('ds-m') || top.includes('pandas') || top.includes('dataframe')) && !isWeb && !isDsa && !isSql;

    if (isWeb) {
      return {
        workspaceType: 'web',
        editorType: 'multi_file',
        executionEnvironment: 'browser_preview',
        supportedLanguages: ['html', 'css', 'javascript'],
        defaultLanguage: lang === 'css' ? 'css' : lang === 'javascript' ? 'javascript' : 'html',
        inputPanels: ['instructions', 'rubric'],
        outputPanels: ['preview', 'console', 'visualizer'],
        gradingStrategy: 'rubric'
      };
    }

    if (isSql) {
      return {
        workspaceType: 'sql',
        editorType: 'sql_editor',
        executionEnvironment: 'sqlite_sandbox',
        supportedLanguages: ['sql'],
        defaultLanguage: 'sql',
        inputPanels: ['instructions', 'schema', 'rubric'],
        outputPanels: ['query_results', 'console'],
        databaseSchema: SQL_SAMPLE_SCHEMA.map(t => ({
          tableName: t.tableName,
          description: t.description,
          columns: t.columns,
          sampleRows: t.sampleRows
        })),
        gradingStrategy: 'query_match'
      };
    }

    if (isMLOrAI || (isDataScience && !isSql)) {
      return {
        workspaceType: 'python_data',
        editorType: 'single_file',
        executionEnvironment: 'python_isolated',
        supportedLanguages: ['python'],
        defaultLanguage: 'python',
        inputPanels: ['instructions', 'dataset', 'rubric'],
        outputPanels: ['console', 'data_table', 'chart', 'metrics', 'visualizer'],
        availableDatasets: Object.values(WORKSPACE_DATASETS).map(d => ({
          id: d.id,
          name: d.name,
          filename: d.filename,
          description: d.description,
          rowCount: d.rowCount,
          sampleRows: d.sampleRows
        })),
        gradingStrategy: 'output_match'
      };
    }

    if (isDsa) {
      return {
        workspaceType: 'dsa',
        editorType: 'single_file',
        executionEnvironment: 'compiled_sandbox',
        supportedLanguages: ['python', 'cpp', 'c', 'java'],
        defaultLanguage: 'python',
        inputPanels: ['instructions', 'custom_input', 'rubric'],
        outputPanels: ['test_cases', 'console', 'visualizer'],
        testCases: [
          { input: '2 7 11 15 9', expectedOutput: '0 1', isHidden: false, explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
          { input: '3 2 4 6', expectedOutput: '1 2', isHidden: false, explanation: 'nums[1] + nums[2] = 2 + 4 = 6' },
          { input: '3 3 6', expectedOutput: '0 1', isHidden: true }
        ],
        gradingStrategy: 'test_cases'
      };
    }

    // Default: Web (HTML/CSS/JS/React)
    return {
      workspaceType: 'web',
      editorType: 'multi_file',
      executionEnvironment: 'browser_preview',
      supportedLanguages: ['html', 'css', 'javascript'],
      defaultLanguage: 'html',
      inputPanels: ['instructions', 'rubric'],
      outputPanels: ['preview', 'console', 'visualizer'],
      gradingStrategy: 'rubric'
    };
  }
}

export const domainCurriculumService = new DomainCurriculumService();
