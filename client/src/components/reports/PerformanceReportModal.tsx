import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { triggerBlobDownload } from '../../utils/downloadFile';
import { useToast } from '../../context/ToastContext';
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Layers,
  BookOpen
} from 'lucide-react';

interface PerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export const PerformanceReportModal: React.FC<PerformanceReportModalProps> = ({
  isOpen,
  onClose,
  sessionId
}) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadReportData();
    }
  }, [isOpen, sessionId]);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/practice/${sessionId}/report/data`);
      if (res.data?.success) {
        setReport(res.data.report);
      } else {
        setError(res.data?.message || 'Unable to compile performance report.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get(`/practice/${sessionId}/report/pdf`, {
        responseType: 'blob'
      });
      const safeTopic = (report?.session?.topic || 'Practice').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Evalora-Performance-Report-${safeTopic}-${report?.reportId || sessionId}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success('Performance report PDF downloaded successfully.');
    } catch {
      toast.error('Failed to download PDF report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={report?.session?.topic ? `Performance Analysis — ${report.session.topic}` : 'Performance Analysis'}
      description={report ? `Candidate: ${report.user.name}  •  Report ID: ${report.reportId}` : 'Detailed session diagnostic report'}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#777486]">
            {report ? `Generated on ${report.generatedAt}` : ''}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} size="sm">
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              isLoading={isDownloading}
              icon={<Download className="w-4 h-4" />}
            >
              {isDownloading ? 'Generating PDF...' : 'Download Performance Report (PDF)'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-1">
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#7779C5] mx-auto" />
            <p className="text-xs text-[#777486]">Compiling comprehensive performance analytics...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#896D45] mx-auto" />
            <p className="text-sm font-semibold text-[#49465B]">{error}</p>
            <Button size="sm" variant="outline" onClick={loadReportData}>
              Retry Analysis
            </Button>
          </div>
        )}

        {report && !isLoading && (
          <>
            {/* Executive Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] space-y-1">
                <span className="text-[10px] font-semibold text-[#777486] uppercase tracking-wider">
                  Overall Score
                </span>
                <div className="text-2xl font-bold text-[#49465B]">{report.summary.scoreString}</div>
                <span className="text-[10px] text-[#777486]">{report.summary.totalQuestions} Questions Total</span>
              </div>

              <div className="p-3.5 rounded-xl border border-[#DEDDF0] bg-[#F0EFF9]/40 space-y-1">
                <span className="text-[10px] font-semibold text-[#7779C5] uppercase tracking-wider">
                  Accuracy
                </span>
                <div className="text-2xl font-bold text-[#7779C5]">{report.summary.accuracyPercentage}%</div>
                <span className="text-[10px] text-[#777486]">
                  {report.summary.accuracyPercentage >= 75 ? 'Strong Proficiency' : 'Reinforcement Needed'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-[#C8DFD1] bg-[#E9F3ED]/50 space-y-1">
                <span className="text-[10px] font-semibold text-[#527565] uppercase tracking-wider">
                  Attempted Breakdown
                </span>
                <div className="text-lg font-bold text-[#49465B] flex items-center gap-2">
                  <span className="text-[#527565]">{report.summary.correctCount} Correct</span>
                  <span className="text-[#9A646D]">/ {report.summary.incorrectCount} Missed</span>
                </div>
                <span className="text-[10px] text-[#777486]">{report.summary.unansweredCount} Unanswered</span>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] space-y-1">
                <span className="text-[10px] font-semibold text-[#777486] uppercase tracking-wider">
                  Time Taken
                </span>
                <div className="text-2xl font-bold text-[#49465B]">{report.summary.timeFormatted}</div>
                <span className="text-[10px] text-[#777486]">
                  ~{report.summary.avgTimePerQuestionSeconds}s / question
                </span>
              </div>
            </div>

            {/* Category-wise Breakdown Table */}
            {report.categoryAnalysis?.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-[#49465B] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#7779C5]" />
                  Category-wise Performance Analysis
                </h4>
                <div className="border border-[#E9E7F0] rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F0EFF9]/60 text-[#555780]">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left font-semibold">Category</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Questions</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[#527565]">Correct</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[#9A646D]">Incorrect</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9E7F0]">
                      {report.categoryAnalysis.map((cat: any, i: number) => (
                        <tr key={i} className="hover:bg-[#F8F7FC]">
                          <td className="px-3.5 py-2 font-medium text-[#49465B]">{cat.category}</td>
                          <td className="px-3 py-2 text-center text-[#777486]">{cat.total}</td>
                          <td className="px-3 py-2 text-center text-[#527565] font-semibold">{cat.correct}</td>
                          <td className="px-3 py-2 text-center text-[#9A646D] font-semibold">{cat.incorrect}</td>
                          <td className="px-3.5 py-2 text-right">
                            <span className="font-semibold text-[#49465B]">{cat.accuracyPercentage}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Topic & Difficulty Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Topic Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#49465B] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#7779C5]" />
                  Topic-wise Mastery
                </h4>
                <div className="border border-[#E9E7F0] rounded-xl p-3 space-y-2.5 bg-white">
                  {report.topicAnalysis?.map((top: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#49465B]">{top.topic}</span>
                        <span className="font-semibold text-[#7779C5]">{top.accuracyPercentage}% ({top.scoreString})</span>
                      </div>
                      <div className="w-full bg-[#E9E7F0] rounded-full h-1.5">
                        <div
                          className="bg-[#7779C5] h-1.5 rounded-full"
                          style={{ width: `${top.accuracyPercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#49465B] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#7779C5]" />
                  Difficulty-level Analysis
                </h4>
                <div className="border border-[#E9E7F0] rounded-xl p-3 space-y-2.5 bg-white">
                  {report.difficultyAnalysis?.map((diff: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#49465B]">{diff.difficulty}</span>
                        <span className="font-semibold text-[#49465B]">{diff.accuracyPercentage}% ({diff.correct}/{diff.total})</span>
                      </div>
                      <div className="w-full bg-[#E9E7F0] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            diff.accuracyPercentage >= 70 ? 'bg-[#E9F3ED]' : diff.accuracyPercentage >= 40 ? 'bg-[#F8F3E8]' : 'bg-[#F8EDEF]'
                          }`}
                          style={{ width: `${diff.accuracyPercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strengths & Growth Areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[#C8DFD1] bg-[#E9F3ED]/50 space-y-2">
                <span className="text-xs font-bold text-[#527565] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#527565]" />
                  Your Strengths
                </span>
                <ul className="space-y-1.5 text-xs text-[#49465B]">
                  {report.strengths?.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#527565] font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-[#E8D9B9] bg-[#F8F3E8]/50 space-y-2">
                <span className="text-xs font-bold text-[#896D45] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#896D45]" />
                  Areas to Improve
                </span>
                <ul className="space-y-1.5 text-xs text-[#49465B]">
                  {report.areasToImprove?.map((w: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#896D45] font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommended Next Steps */}
            {report.recommendations?.length > 0 && (
              <div className="p-4 rounded-xl border border-[#DEDDF0] bg-[#F0EFF9]/40 space-y-2">
                <span className="text-xs font-bold text-[#555780] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#7779C5]" />
                  Recommended Next Steps
                </span>
                <div className="space-y-1.5 text-xs text-[#49465B]">
                  {report.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="font-semibold text-[#7779C5]">{i + 1}.</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Question-Level Review */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-[#49465B] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#7779C5]" />
                Detailed Question-Level Review
              </h4>
              <div className="space-y-3">
                {report.questions?.map((q: any) => (
                  <div
                    key={q.index}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      q.result === 'Correct'
                        ? 'border-[#C8DFD1] bg-white'
                        : q.result === 'Incorrect'
                          ? 'border-[#E8CFD2] bg-white'
                          : 'border-[#E9E7F0] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#49465B]">
                        Q{q.index}. {q.title}
                      </span>
                      <Badge
                        variant={
                          q.result === 'Correct' ? 'green' : q.result === 'Incorrect' ? 'rose' : 'neutral'
                        }
                      >
                        {q.result}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-[#777486] flex items-center gap-3">
                      <span>Category: <strong>{q.category}</strong></span>
                      <span>Topic: <strong>{q.topic}</strong></span>
                      <span>Difficulty: <strong>{q.difficulty}</strong></span>
                      <span>Time: <strong>{q.timeSpentSeconds}s</strong></span>
                    </div>

                    {q.description && (
                      <p className="text-xs text-[#777486] leading-relaxed pt-1">{q.description}</p>
                    )}

                    {q.result === 'Incorrect' && q.userAnswerText && (
                      <div className="text-xs text-[#9A646D] bg-[#F8EDEF]/60 p-2 rounded-lg border border-[#E8CFD2]">
                        <span className="font-semibold">Your Answer: </span>
                        {q.userAnswerText}
                      </div>
                    )}

                    {q.correctAnswerText && (
                      <div className="text-xs text-[#527565] bg-[#E9F3ED]/60 p-2 rounded-lg border border-[#C8DFD1]">
                        <span className="font-semibold">Verified Correct Answer: </span>
                        {q.correctAnswerText}
                      </div>
                    )}

                    {q.explanation && (
                      <div className="text-[11px] text-[#49465B] bg-[#F8F7FC] p-2.5 rounded-lg border border-[#E9E7F0]">
                        <span className="font-semibold text-[#7779C5]">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
