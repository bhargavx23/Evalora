import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { PracticeSession, IPracticeSession } from '../../models/PracticeSession.js';
import { Question, IQuestion } from '../../models/Question.js';
import { User } from '../../models/User.js';
import {
  PDF_COLORS,
  drawHeaderBanner,
  drawSectionHeading,
  drawStatCards,
  drawTable,
  drawPageFooters
} from './sharedTheme.js';

export interface PerformanceAnalysisData {
  reportId: string;
  attemptId: string;
  generatedAt: string;
  user: {
    name: string;
    email: string;
  };
  session: {
    topic: string;
    subtopic?: string;
    difficulty: string;
    type: string;
    completedAt?: string;
    startedAt?: string;
  };
  summary: {
    overallScore: number;
    totalQuestions: number;
    scoreString: string;
    accuracyPercentage: number;
    questionsAttempted: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    totalTimeSeconds: number;
    timeFormatted: string;
    avgTimePerQuestionSeconds: number;
  };
  categoryAnalysis: Array<{
    category: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracyPercentage: number;
    scoreString: string;
  }>;
  topicAnalysis: Array<{
    topic: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracyPercentage: number;
    scoreString: string;
  }>;
  difficultyAnalysis: Array<{
    difficulty: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracyPercentage: number;
  }>;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
  questions: Array<{
    index: number;
    title: string;
    description: string;
    category: string;
    topic: string;
    difficulty: string;
    type: string;
    result: 'Correct' | 'Incorrect' | 'Unanswered';
    timeSpentSeconds: number;
    userAnswerText?: string;
    correctAnswerText?: string;
    explanation?: string;
    codingVerdict?: string;
    testCasesPassed?: number;
    totalTestCases?: number;
  }>;
}

export class PerformanceReportService {
  /**
   * Loads session, questions, and compiles comprehensive data-driven performance metrics.
   */
  async compileReportData(
    sessionId: string,
    requestingUserId: string,
    isAdmin: boolean = false
  ): Promise<PerformanceAnalysisData> {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      throw { statusCode: 400, message: 'Invalid practice session ID format.', code: 'INVALID_ID' };
    }

    const session = await PracticeSession.findById(sessionId).lean();
    if (!session) {
      throw { statusCode: 404, message: 'Practice session not found.', code: 'NOT_FOUND' };
    }

    // Security check: only session owner or platform admin can view/download
    if (!isAdmin && session.studentId.toString() !== requestingUserId) {
      throw { statusCode: 403, message: 'Access denied. You do not own this practice session.', code: 'FORBIDDEN' };
    }

    const user = await User.findById(session.studentId).select('name email').lean();
    const studentName = user?.name || 'Student Candidate';
    const studentEmail = user?.email || 'student@evalora.io';

    // Bulk-load questions
    const questionDocs = await Question.find({ _id: { $in: session.questionIds } }).lean();
    const questionMap = new Map<string, any>();
    for (const q of questionDocs) {
      questionMap.set(q._id.toString(), q);
    }

    const answersMap = new Map<string, any>();
    for (const ans of session.answers || []) {
      if (ans && ans.questionId) {
        answersMap.set(ans.questionId.toString(), ans);
      }
    }

    const totalQuestions = session.totalQuestions || session.questionIds?.length || 0;
    let questionsAttempted = 0;
    let correctCount = 0;
    let totalTimeSeconds = session.timeTakenSeconds || 0;

    const categoryMap = new Map<string, { total: number; correct: number; incorrect: number }>();
    const topicMap = new Map<string, { total: number; correct: number; incorrect: number }>();
    const difficultyMap = new Map<string, { total: number; correct: number; incorrect: number }>([
      ['easy', { total: 0, correct: 0, incorrect: 0 }],
      ['medium', { total: 0, correct: 0, incorrect: 0 }],
      ['hard', { total: 0, correct: 0, incorrect: 0 }]
    ]);

    const compiledQuestions: PerformanceAnalysisData['questions'] = [];

    // Question-level examination
    let questionIndex = 1;
    for (const qId of session.questionIds || []) {
      const q = questionMap.get(qId.toString());
      if (!q) continue;

      const ans = answersMap.get(qId.toString());
      const category = q.category || 'General';
      const topic = q.topic || 'General';
      const difficulty = (q.difficulty || 'medium').toLowerCase();

      // Ensure category and topic entries
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { total: 0, correct: 0, incorrect: 0 });
      }
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { total: 0, correct: 0, incorrect: 0 });
      }
      if (!difficultyMap.has(difficulty)) {
        difficultyMap.set(difficulty, { total: 0, correct: 0, incorrect: 0 });
      }

      const catEntry = categoryMap.get(category)!;
      const topEntry = topicMap.get(topic)!;
      const diffEntry = difficultyMap.get(difficulty)!;

      catEntry.total += 1;
      topEntry.total += 1;
      diffEntry.total += 1;

      let result: 'Correct' | 'Incorrect' | 'Unanswered' = 'Unanswered';
      let userAnswerText: string | undefined;
      let correctAnswerText: string | undefined;
      const timeSpent = ans?.timeSpentSeconds ? Math.max(0, Number(ans.timeSpentSeconds)) : 0;

      // Determine correct answer text
      if (q.type === 'coding') {
        correctAnswerText = 'Verified reference solution passing sandboxed test cases.';
      } else {
        const correctOpt = (q.options || []).find((o: any) => o.isCorrect);
        correctAnswerText = correctOpt ? correctOpt.text : undefined;
      }

      if (ans) {
        if (q.type === 'coding') {
          if (ans.codeSubmission?.code) {
            questionsAttempted += 1;
            if (ans.isCorrect) {
              result = 'Correct';
              correctCount += 1;
              catEntry.correct += 1;
              topEntry.correct += 1;
              diffEntry.correct += 1;
            } else {
              result = 'Incorrect';
              catEntry.incorrect += 1;
              topEntry.incorrect += 1;
              diffEntry.incorrect += 1;
            }
            userAnswerText = `Language: ${ans.codeSubmission.language || 'Code'}, Verdict: ${ans.codeSubmission.verdict || 'EVALUATED'} (${ans.codeSubmission.testCasesPassed || 0}/${ans.codeSubmission.totalTestCases || 0} passed)`;
          }
        } else {
          const selectedOptionIds = ans.selectedOptionIds || [];
          if (selectedOptionIds.length > 0) {
            questionsAttempted += 1;
            const chosenOpts = (q.options || []).filter((o: any) => selectedOptionIds.includes(o.id));
            userAnswerText = chosenOpts.map((o: any) => o.text).join(', ') || 'Option ' + selectedOptionIds.join(', ');

            if (ans.isCorrect) {
              result = 'Correct';
              correctCount += 1;
              catEntry.correct += 1;
              topEntry.correct += 1;
              diffEntry.correct += 1;
            } else {
              result = 'Incorrect';
              catEntry.incorrect += 1;
              topEntry.incorrect += 1;
              diffEntry.incorrect += 1;
            }
          }
        }
      }

      compiledQuestions.push({
        index: questionIndex++,
        title: q.title || `Question ${questionIndex - 1}`,
        description: q.description || '',
        category,
        topic,
        difficulty,
        type: q.type || 'mcq',
        result,
        timeSpentSeconds: timeSpent,
        userAnswerText: result !== 'Unanswered' ? userAnswerText : undefined,
        correctAnswerText,
        explanation: q.explanation || undefined,
        codingVerdict: ans?.codeSubmission?.verdict,
        testCasesPassed: ans?.codeSubmission?.testCasesPassed,
        totalTestCases: ans?.codeSubmission?.totalTestCases
      });
    }

    const incorrectCount = questionsAttempted - correctCount;
    const unansweredCount = Math.max(0, totalQuestions - questionsAttempted);
    const accuracyPercentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const avgTimePerQuestionSeconds =
      totalQuestions > 0 ? Math.round(totalTimeSeconds / totalQuestions) : 0;

    const mins = Math.floor(totalTimeSeconds / 60);
    const secs = totalTimeSeconds % 60;
    const timeFormatted = `${mins}m ${secs}s`;

    // Category Analysis
    const categoryAnalysis = Array.from(categoryMap.entries()).map(([cat, stat]) => ({
      category: cat,
      total: stat.total,
      correct: stat.correct,
      incorrect: stat.total - stat.correct,
      accuracyPercentage: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      scoreString: `${stat.correct}/${stat.total}`
    }));

    // Topic Analysis
    const topicAnalysis = Array.from(topicMap.entries()).map(([top, stat]) => ({
      topic: top,
      total: stat.total,
      correct: stat.correct,
      incorrect: stat.total - stat.correct,
      accuracyPercentage: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      scoreString: `${stat.correct}/${stat.total}`
    }));

    // Difficulty Analysis
    const difficultyAnalysis = ['easy', 'medium', 'hard']
      .filter(diff => (difficultyMap.get(diff)?.total || 0) > 0)
      .map(diff => {
        const stat = difficultyMap.get(diff)!;
        return {
          difficulty: diff.charAt(0).toUpperCase() + diff.slice(1),
          total: stat.total,
          correct: stat.correct,
          incorrect: stat.total - stat.correct,
          accuracyPercentage: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
        };
      });

    // Derive data-driven Strengths
    const strengths: string[] = [];
    for (const top of topicAnalysis) {
      if (top.accuracyPercentage >= 75 && top.total >= 1) {
        strengths.push(`High accuracy (${top.accuracyPercentage}%) in ${top.topic}`);
      }
    }
    for (const diff of difficultyAnalysis) {
      if (diff.accuracyPercentage >= 75) {
        strengths.push(`Strong performance in ${diff.difficulty}-difficulty problems (${diff.accuracyPercentage}%)`);
      }
    }
    if (avgTimePerQuestionSeconds > 0 && avgTimePerQuestionSeconds <= 60) {
      strengths.push(`Efficient problem-solving pace (average ${avgTimePerQuestionSeconds}s per question)`);
    }
    if (strengths.length === 0) {
      strengths.push(`Completed all ${questionsAttempted} attempted questions across ${topicAnalysis.length} topic(s).`);
    }

    // Derive data-driven Areas to Improve
    const areasToImprove: string[] = [];
    for (const top of topicAnalysis) {
      if (top.accuracyPercentage < 65) {
        areasToImprove.push(`${top.topic} accuracy is currently ${top.accuracyPercentage}% (${top.scoreString})`);
      }
    }
    for (const diff of difficultyAnalysis) {
      if (diff.accuracyPercentage < 60) {
        areasToImprove.push(`Performance on ${diff.difficulty}-level challenges (${diff.accuracyPercentage}%)`);
      }
    }
    if (unansweredCount > 0) {
      areasToImprove.push(`${unansweredCount} question(s) left unanswered due to time management`);
    }
    if (areasToImprove.length === 0) {
      areasToImprove.push('Maintain high accuracy on higher question volumes and strict time constraints');
    }

    // Derive data-driven Actionable Recommendations
    const recommendations: string[] = [];
    const weakTopics = topicAnalysis.filter(t => t.accuracyPercentage < 65);
    if (weakTopics.length > 0) {
      weakTopics.forEach((wt, idx) => {
        recommendations.push(
          `Revise foundational principles and solve targeted medium-level sets in ${wt.topic}.`
        );
      });
    }
    const hardDiff = difficultyAnalysis.find(d => d.difficulty.toLowerCase() === 'hard');
    if (hardDiff && hardDiff.accuracyPercentage < 70) {
      recommendations.push('Gradually attempt more Hard-difficulty questions to build competitive problem-solving resilience.');
    }
    if (accuracyPercentage >= 80) {
      recommendations.push('Excellent mastery demonstrated. Proceed to timed mock assessments and comprehensive multi-section tests.');
    } else {
      recommendations.push('Review the detailed explanations below for each missed problem before starting your next practice set.');
    }

    const reportId = `EV-REP-${sessionId.toString().slice(-8).toUpperCase()}`;

    return {
      reportId,
      attemptId: sessionId.toString(),
      generatedAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      user: {
        name: studentName,
        email: studentEmail
      },
      session: {
        topic: session.topic,
        subtopic: session.subtopic,
        difficulty: session.difficulty,
        type: session.type,
        completedAt: session.completedAt ? new Date(session.completedAt).toLocaleDateString() : undefined,
        startedAt: session.startedAt ? new Date(session.startedAt).toLocaleDateString() : undefined
      },
      summary: {
        overallScore: correctCount,
        totalQuestions,
        scoreString: `${correctCount} / ${totalQuestions}`,
        accuracyPercentage,
        questionsAttempted,
        correctCount,
        incorrectCount,
        unansweredCount,
        totalTimeSeconds,
        timeFormatted,
        avgTimePerQuestionSeconds
      },
      categoryAnalysis,
      topicAnalysis,
      difficultyAnalysis,
      strengths,
      areasToImprove,
      recommendations,
      questions: compiledQuestions
    };
  }

  /**
   * Generates a professionally designed, multi-page vector PDF buffer.
   */
  async generatePdf(data: PerformanceAnalysisData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Evalora Performance Analysis Report - ${data.session.topic}`,
          Author: 'Evalora Assessment Platform',
          Subject: 'Candidate Performance Analysis Report'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const margin = 40;
      const contentWidth = doc.page.width - margin * 2;

      // 1. Header Banner
      drawHeaderBanner(doc, {
        kicker: 'Performance Analysis Report',
        title: data.session.topic,
        subtitle: `Candidate: ${data.user.name} (${data.user.email})`,
        metaLines: [
          { label: 'Report ID', value: data.reportId },
          { label: 'Date', value: data.generatedAt },
          { label: 'Format', value: data.session.type.toUpperCase() },
          { label: 'Level', value: data.session.difficulty.toUpperCase() }
        ]
      });

      // 2. Executive Performance Summary Stat Cards
      drawSectionHeading(doc, 'Executive Performance Summary', 'High-level metric overview across accuracy, volume, and time.');

      const statCards = [
        {
          label: 'Overall Score',
          value: data.summary.scoreString,
          sublabel: `${data.summary.totalQuestions} Questions Total`,
          color: PDF_COLORS.dark
        },
        {
          label: 'Accuracy',
          value: `${data.summary.accuracyPercentage}%`,
          sublabel: data.summary.accuracyPercentage >= 75 ? 'Strong Proficiency' : 'Reinforcement Needed',
          color: data.summary.accuracyPercentage >= 75 ? PDF_COLORS.success : PDF_COLORS.primary
        },
        {
          label: 'Correct',
          value: data.summary.correctCount,
          sublabel: `${data.summary.incorrectCount} Incorrect`,
          color: PDF_COLORS.success
        },
        {
          label: 'Unanswered',
          value: data.summary.unansweredCount,
          sublabel: `${data.summary.questionsAttempted} Attempted`,
          color: data.summary.unansweredCount > 0 ? PDF_COLORS.warning : PDF_COLORS.textMuted
        },
        {
          label: 'Time Taken',
          value: data.summary.timeFormatted,
          sublabel: `~${data.summary.avgTimePerQuestionSeconds}s / question`,
          color: PDF_COLORS.dark
        }
      ];

      drawStatCards(doc, statCards);

      // 3. Category & Topic Breakdown Tables
      if (data.categoryAnalysis.length > 0) {
        drawSectionHeading(doc, 'Category-wise Performance Analysis');
        drawTable(
          doc,
          [
            { title: 'Category', key: 'category', width: 180 },
            { title: 'Questions', key: 'total', width: 85, align: 'center' },
            { title: 'Correct', key: 'correct', width: 80, align: 'center' },
            { title: 'Incorrect', key: 'incorrect', width: 85, align: 'center' },
            { title: 'Accuracy', key: 'accuracyString', width: 85, align: 'right' }
          ],
          data.categoryAnalysis.map(c => ({
            ...c,
            accuracyString: `${c.accuracyPercentage}%`
          })),
          { highlightFirstCol: true }
        );
      }

      if (data.topicAnalysis.length > 0) {
        drawSectionHeading(doc, 'Topic-wise Mastery');
        drawTable(
          doc,
          [
            { title: 'Topic', key: 'topic', width: 220 },
            { title: 'Questions', key: 'total', width: 75, align: 'center' },
            { title: 'Correct', key: 'correct', width: 75, align: 'center' },
            { title: 'Score', key: 'scoreString', width: 75, align: 'center' },
            { title: 'Accuracy', key: 'accuracyString', width: 70, align: 'right' }
          ],
          data.topicAnalysis.map(t => ({
            ...t,
            accuracyString: `${t.accuracyPercentage}%`
          })),
          { highlightFirstCol: true }
        );
      }

      // 4. Difficulty Breakdown
      if (data.difficultyAnalysis.length > 0) {
        drawSectionHeading(doc, 'Difficulty-level Performance');
        drawTable(
          doc,
          [
            { title: 'Difficulty', key: 'difficulty', width: 180 },
            { title: 'Total Questions', key: 'total', width: 110, align: 'center' },
            { title: 'Correct', key: 'correct', width: 110, align: 'center' },
            { title: 'Accuracy', key: 'accuracyString', width: 115, align: 'right' }
          ],
          data.difficultyAnalysis.map(d => ({
            ...d,
            accuracyString: `${d.accuracyPercentage}%`
          })),
          { highlightFirstCol: true }
        );
      }

      // 5. Strengths & Weak Areas Grid
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }

      drawSectionHeading(doc, 'Diagnostic Insights: Strengths & Growth Areas');

      const colWidth = (contentWidth - 14) / 2;
      const boxY = doc.y;

      // Strengths Box (Left)
      doc.save();
      doc
        .roundedRect(margin, boxY, colWidth, 120, 6)
        .fillAndStroke(PDF_COLORS.successBg, '#A7F3D0');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.success)
        .text('YOUR STRENGTHS', margin + 12, boxY + 10, { characterSpacing: 0.5 });

      let strengthY = boxY + 28;
      for (const s of data.strengths.slice(0, 4)) {
        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.success)
          .text('•', margin + 12, strengthY, { width: 10 });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(PDF_COLORS.dark)
          .text(s, margin + 24, strengthY, { width: colWidth - 36, ellipsis: true });
        strengthY += 18;
      }
      doc.restore();

      // Areas to Improve Box (Right)
      const rightX = margin + colWidth + 14;
      doc.save();
      doc
        .roundedRect(rightX, boxY, colWidth, 120, 6)
        .fillAndStroke(PDF_COLORS.warningBg, '#FDE68A');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.warning)
        .text('AREAS TO IMPROVE', rightX + 12, boxY + 10, { characterSpacing: 0.5 });

      let weakY = boxY + 28;
      for (const w of data.areasToImprove.slice(0, 4)) {
        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.warning)
          .text('•', rightX + 12, weakY, { width: 10 });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(PDF_COLORS.dark)
          .text(w, rightX + 24, weakY, { width: colWidth - 36, ellipsis: true });
        weakY += 18;
      }
      doc.restore();

      doc.y = boxY + 130;

      // 6. Actionable Next Steps
      drawSectionHeading(doc, 'Recommended Next Steps');
      doc.save();
      doc
        .roundedRect(margin, doc.y, contentWidth, 20 + data.recommendations.length * 18, 6)
        .fillAndStroke(PDF_COLORS.brandPurpleLight, PDF_COLORS.borderAccent);

      let recY = doc.y + 10;
      data.recommendations.forEach((rec, idx) => {
        doc
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.primaryDark)
          .text(`${idx + 1}.`, margin + 12, recY, { width: 16 });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(PDF_COLORS.dark)
          .text(rec, margin + 30, recY, { width: contentWidth - 42 });
        recY += 18;
      });
      doc.restore();
      doc.y = recY + 12;

      // 7. Question-Level Analysis (New Page for clean presentation)
      doc.addPage();
      drawSectionHeading(
        doc,
        'Detailed Question-Level Analysis',
        'Review exact question stems, candidate responses, verified solutions, and conceptual explanations.'
      );

      for (const q of data.questions) {
        // Check if question fits on page or need page break
        if (doc.y > doc.page.height - 130) {
          doc.addPage();
        }

        const qStartY = doc.y;
        const resultColor =
          q.result === 'Correct'
            ? PDF_COLORS.success
            : q.result === 'Incorrect'
              ? PDF_COLORS.danger
              : PDF_COLORS.textMuted;

        const resultBg =
          q.result === 'Correct'
            ? PDF_COLORS.successBg
            : q.result === 'Incorrect'
              ? PDF_COLORS.dangerBg
              : PDF_COLORS.lightBg;

        // Card Box
        doc.save();
        doc
          .roundedRect(margin, qStartY, contentWidth, 8, 4)
          .fill(resultColor);

        // Header row
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.dark)
          .text(`Q${q.index}. ${q.title}`, margin + 10, qStartY + 14, { width: 360 });

        // Result Badge on Right
        doc
          .roundedRect(doc.page.width - margin - 85, qStartY + 11, 75, 16, 4)
          .fillAndStroke(resultBg, resultColor);

        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor(resultColor)
          .text(q.result.toUpperCase(), doc.page.width - margin - 85, qStartY + 15, {
            width: 75,
            align: 'center'
          });

        let lineY = qStartY + 32;

        // Category / Topic / Time sub-line
        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor(PDF_COLORS.textSecondary)
          .text(
            `Category: ${q.category}  •  Topic: ${q.topic}  •  Difficulty: ${q.difficulty.toUpperCase()}  •  Time: ${q.timeSpentSeconds}s`,
            margin + 10,
            lineY
          );

        lineY += 14;

        // Question Description / Stem
        if (q.description) {
          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(PDF_COLORS.dark)
            .text(q.description, margin + 10, lineY, { width: contentWidth - 20 });
          lineY = doc.y + 6;
        }

        // Answers breakdown
        if (q.result === 'Incorrect' && q.userAnswerText) {
          doc
            .fontSize(8)
            .font('Helvetica-Bold')
            .fillColor(PDF_COLORS.danger)
            .text('Your Answer:', margin + 10, lineY, { width: 75 });

          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(PDF_COLORS.dark)
            .text(q.userAnswerText, margin + 90, lineY, { width: contentWidth - 100 });
          lineY = doc.y + 4;
        }

        if (q.correctAnswerText) {
          doc
            .fontSize(8)
            .font('Helvetica-Bold')
            .fillColor(PDF_COLORS.success)
            .text('Correct Answer:', margin + 10, lineY, { width: 80 });

          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(PDF_COLORS.dark)
            .text(q.correctAnswerText, margin + 95, lineY, { width: contentWidth - 105 });
          lineY = doc.y + 4;
        }

        // Explanation Box
        if (q.explanation) {
          doc
            .fontSize(7.5)
            .font('Helvetica-Bold')
            .fillColor(PDF_COLORS.primaryDark)
            .text('Explanation:', margin + 10, lineY, { width: 65 });

          doc
            .fontSize(7.5)
            .font('Helvetica')
            .fillColor(PDF_COLORS.textSecondary)
            .text(q.explanation, margin + 80, lineY, { width: contentWidth - 90 });
          lineY = doc.y + 6;
        }

        // Bottom separator
        doc
          .strokeColor(PDF_COLORS.borderSubtle)
          .lineWidth(0.5)
          .moveTo(margin, lineY + 4)
          .lineTo(margin + contentWidth, lineY + 4)
          .stroke();

        doc.restore();
        doc.y = lineY + 12;
      }

      // Draw page footers with page numbers across all buffered pages
      drawPageFooters(doc, {
        documentId: data.reportId,
        documentType: 'PERFORMANCE REPORT'
      });

      doc.end();
    });
  }
}

export const performanceReportService = new PerformanceReportService();
