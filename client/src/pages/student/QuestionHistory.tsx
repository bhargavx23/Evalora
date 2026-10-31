import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { triggerBlobDownload } from '../../utils/downloadFile';
import { PerformanceReportModal } from '../../components/reports/PerformanceReportModal';
import {
  FileCheck2,
  Code2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  FileText,
  Download
} from 'lucide-react';

export const QuestionHistory: React.FC = () => {
  const toast = useToast();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'assessments' | 'practice'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReportSessionId, setSelectedReportSessionId] = useState<string | null>(null);

  const handleDownloadPracticePdf = async (sessionId: string, topic?: string) => {
    try {
      const res = await api.get(`/practice/${sessionId}/report/pdf`, {
        responseType: 'blob'
      });
      const safeTopic = (topic || 'Practice').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Evalora-Performance-Report-${safeTopic}-${sessionId.slice(-8)}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success('Performance report PDF downloaded.');
    } catch {
      toast.error('Failed to download performance report PDF.');
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/assessments').catch(() => ({ data: { success: false } })),
      api.get('/practice/history').catch(() => ({ data: { success: false } }))
    ])
      .then(([assRes, pracRes]) => {
        if (assRes.data.success) {
          const userAttempts = (assRes.data.assessments || [])
            .filter((a: any) => a.userAttempt)
            .map((a: any) => ({
              ...a.userAttempt,
              assessmentTitle: a.title,
              totalMarks: a.totalMarks
            }));
          setAttempts(userAttempts);
        }
        if (pracRes.data.success) {
          setPracticeHistory(pracRes.data.sessions || pracRes.data.history || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredAttempts = attempts.filter(att => {
    if (!searchQuery.trim()) return true;
    return att.assessmentTitle?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPractice = practiceHistory.filter(prac => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      prac.topic?.toLowerCase().includes(q) ||
      prac.difficulty?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-shell">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E5EF] pb-6">
        <div>
          <div className="page-kicker">Student Performance</div>
          <h1 className="page-title mt-1">Results & Attempt History</h1>
          <p className="page-copy">
            Detailed breakdown of all formal assessments and practice sessions evaluated on the platform
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EFF2F8] rounded-xl border border-[#E0E5EF] text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#3C4B63] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'assessments'
                ? 'bg-white text-[#3C648E] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Formal Exams ({attempts.length})
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'practice'
                ? 'bg-white text-[#5288B8] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Practice ({practiceHistory.length})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8490A2] absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by assessment title, practice topic, or difficulty..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2 text-xs border border-[#E0E5EF] rounded-xl focus:outline-none focus:border-[#5288B8] focus:ring-2 focus:ring-[#5288B8]/15 text-[#3C4B63] bg-white transition-all shadow-[0_1px_2px_rgba(82,77,119,0.02)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-[#8490A2] hover:text-[#3C4B63]"
            title="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Assessment Attempts Table */}
      {(activeTab === 'all' || activeTab === 'assessments') && (
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3C4B63] flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#5288B8]" />
                Formal Assessment Attempts ({filteredAttempts.length})
              </span>
              <Badge variant="blue">{attempts.length} Total Recorded</Badge>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E0E5EF] text-[#8490A2] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="pb-3">Assessment Title</th>
                  <th className="pb-3">Submitted At</th>
                  <th className="pb-3">Score / Total</th>
                  <th className="pb-3">Percentage</th>
                  <th className="pb-3">Integrity</th>
                  <th className="pb-3 text-right">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E5EF]">
                {filteredAttempts.map(att => (
                  <tr key={att._id} className="hover:bg-[#F7F8FC] transition-colors">
                    <td className="py-3 font-semibold text-[#3C4B63]">{att.assessmentTitle}</td>
                    <td className="py-3 text-[#748199]">
                      {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'In Progress'}
                    </td>
                    <td className="py-3 font-semibold text-[#3C4B63]">
                      {att.totalScore} / {att.maxScore || att.totalMarks}
                    </td>
                    <td className="py-3 font-semibold text-[#3C648E]">{att.percentage}%</td>
                    <td className="py-3">
                      <span className="text-[#4C765D] font-medium">
                        {att.integrityScore != null ? `${att.integrityScore}%` : '—'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {att.passed ? (
                        <Badge variant="green">Passed</Badge>
                      ) : (
                        <Badge variant="amber">Needs Review</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAttempts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#748199]">
                      {searchQuery ? 'No assessment records match your search query.' : 'No formal assessment attempts submitted yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Practice Sessions History */}
      {(activeTab === 'all' || activeTab === 'practice') && (
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3C4B63] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#D98768]" />
                Dynamic Practice Sessions ({filteredPractice.length})
              </span>
              <Badge variant="purple">{practiceHistory.length} Sessions Total</Badge>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E0E5EF] text-[#8490A2] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="pb-3">Topic</th>
                  <th className="pb-3">Difficulty</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Questions Solved</th>
                  <th className="pb-3">Accuracy</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E5EF]">
                {filteredPractice.map(prac => (
                  <tr key={prac._id} className="hover:bg-[#F7F8FC] transition-colors">
                    <td className="py-3 font-semibold text-[#3C4B63]">{prac.topic || 'Multi-Section Practice'}</td>
                    <td className="py-3">
                      <Badge variant={prac.difficulty === 'easy' ? 'green' : prac.difficulty === 'hard' ? 'rose' : 'amber'}>
                        {prac.difficulty || 'mixed'}
                      </Badge>
                    </td>
                    <td className="py-3 text-[#748199]">
                      {new Date(prac.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-[#3C4B63] font-medium">
                      {prac.correctCount ?? prac.score ?? 0} / {prac.totalQuestions ?? (prac.questions?.length || 10)}
                    </td>
                    <td className="py-3 font-semibold text-[#5288B8]">
                      {prac.accuracyPercentage != null ? `${prac.accuracyPercentage}%` : `${prac.accuracy ?? 0}%`}
                    </td>
                    <td className="py-3">
                      <Badge variant={prac.status === 'completed' ? 'green' : 'amber'}>
                        {prac.status === 'completed' ? 'Completed' : 'In Progress'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      {prac.status === 'completed' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedReportSessionId(prac._id)}
                            icon={<FileText className="w-3.5 h-3.5" />}
                            title="View Analysis"
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPracticePdf(prac._id, prac.topic)}
                            icon={<Download className="w-3.5 h-3.5" />}
                            title="Download PDF"
                          >
                            PDF
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#8490A2] italic">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPractice.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#748199]">
                      {searchQuery ? 'No practice sessions match your search query.' : 'No practice sessions recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PerformanceReportModal
        isOpen={Boolean(selectedReportSessionId)}
        onClose={() => setSelectedReportSessionId(null)}
        sessionId={selectedReportSessionId || ''}
      />
    </div>
  );
};
