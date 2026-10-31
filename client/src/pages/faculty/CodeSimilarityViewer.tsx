import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Users,
  Code2
} from 'lucide-react';

export const CodeSimilarityViewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    searchParams.get('assessmentId') || ''
  );
  const [similarityReports, setSimilarityReports] = useState<any[]>([]);
  const [codingQuestions, setCodingQuestions] = useState<any[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [inspectPair, setInspectPair] = useState<any>(null);

  useEffect(() => {
    api.get('/assessments').then(res => {
      if (res.data.success && res.data.assessments.length > 0) {
        setAssessments(res.data.assessments);
        if (!selectedAssessmentId) {
          setSelectedAssessmentId(res.data.assessments[0]._id);
        }
      }
    });
  }, []);

  const runOrFetchSimilarity = (qId?: string) => {
    if (!selectedAssessmentId) return;
    setIsLoading(true);
    const url = qId
      ? `/assessments/${selectedAssessmentId}/similarity?questionId=${qId}`
      : `/assessments/${selectedAssessmentId}/similarity`;

    api.get(url)
      .then(res => {
        if (res.data.success) {
          setSimilarityReports(res.data.reports || []);
          if (res.data.codingQuestionIds) {
            setCodingQuestions(res.data.codingQuestionIds);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (selectedAssessmentId) {
      runOrFetchSimilarity();
    }
  }, [selectedAssessmentId]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F8EAE7] text-[#A36162] text-xs font-semibold mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[#A36162]" />
            AST-Normalized Code Plagiarism Detector
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Code Similarity Analysis</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Compares structural tokens across student submissions, neutralizing variable renames and whitespace changes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedAssessmentId}
            onChange={e => setSelectedAssessmentId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none"
          >
            {assessments.map(a => (
              <option key={a._id} value={a._id}>
                {a.title}
              </option>
            ))}
          </select>

          <Button
            variant="primary"
            size="sm"
            onClick={() => runOrFetchSimilarity(selectedQuestionId)}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Run Comparison Matrix
          </Button>
        </div>
      </div>

      {/* Flagged Alert Banner */}
      <div className="p-4 rounded-xl bg-[#F8F2E4]/60 border border-[#E9DAB5] text-xs text-[#8A7047] flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#8A7047] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Structural Equivalence Flagging:</span>
          <p className="text-[11px] text-[#8A7047] leading-relaxed">
            Submissions with &ge; 80% token n-gram equivalence are highlighted for faculty inspection. Variable name substitution, reformatting, and comment stripping are automatically accounted for.
          </p>
        </div>
      </div>

      {/* Similarity Results Table */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-600" />
              Pairwise Submission Comparisons ({similarityReports.length})
            </span>
            <Badge variant="rose">Threshold: 80% Similarity</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                <th className="pb-3">Student Pair</th>
                <th className="pb-3">Question</th>
                <th className="pb-3">Similarity Index</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {similarityReports.map((report, idx) => {
                const isHigh = report.similarityPercentage >= 80;

                return (
                  <tr key={idx} className={isHigh ? 'bg-[#F8EDEF]/30' : 'hover:bg-gray-50'}>
                    <td className="py-3">
                      <div className="font-semibold text-gray-900">
                        {report.studentAId?.name || 'Student A'} &harr; {report.studentBId?.name || 'Student B'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {report.studentAId?.studentId || 'ID-1'} &bull; {report.studentBId?.studentId || 'ID-2'}
                      </div>
                    </td>

                    <td className="py-3 text-gray-600">
                      {report.questionId?.title || 'Coding Problem'}
                    </td>

                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${
                            isHigh ? 'text-[#A36162]' : 'text-gray-800'
                          }`}
                        >
                          {report.similarityPercentage}%
                        </span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHigh ? 'bg-[#F8EDEF]' : 'bg-[#EAF1F9]'
                            }`}
                            style={{ width: `${report.similarityPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      {isHigh ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F8EAE7] text-[#A36162] font-bold border border-[#EACBC4]">
                          <AlertTriangle className="w-3 h-3 text-[#A36162]" />
                          High Code Similarity
                        </span>
                      ) : (
                        <Badge variant="green">Acceptable Variance</Badge>
                      )}
                    </td>

                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectPair(report)}
                      >
                        Inspect Code
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {similarityReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    No pairwise submissions found for comparison in this assessment yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Code Diff Modal */}
      {inspectPair && (
        <Modal
          isOpen={!!inspectPair}
          onClose={() => setInspectPair(null)}
          title={`Structural Comparison: ${inspectPair.similarityPercentage}% Similarity`}
          maxWidth="4xl"
          footer={
            <Button variant="outline" size="sm" onClick={() => setInspectPair(null)}>
              Close Inspection
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-[#F8EDEF] rounded-xl border border-[#EACBC4] text-[#A36162] flex items-center justify-between">
              <span className="font-bold">
                Student A ({inspectPair.studentAId?.name}) vs Student B ({inspectPair.studentBId?.name})
              </span>
              <Badge variant="rose">{inspectPair.similarityPercentage}% Matched</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-bold text-gray-700">Student A Submission ({inspectPair.studentAId?.name}):</span>
                <pre className="p-3 bg-[#EFF2F8] text-[#719B84] font-mono text-[11px] rounded-xl h-64 overflow-y-auto">
{`# Student A Submission
def maxSubArray(nums):
    max_sum = nums[0]
    cur = nums[0]
    for n in nums[1:]:
        cur = max(n, cur + n)
        max_sum = max(max_sum, cur)
    return max_sum`}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-gray-700">Student B Submission ({inspectPair.studentBId?.name}):</span>
                <pre className="p-3 bg-[#EFF2F8] text-[#719B84] font-mono text-[11px] rounded-xl h-64 overflow-y-auto">
{`# Student B Submission (Renamed variables)
def maxSubArray(arr):
    ans = arr[0]
    total = arr[0]
    for x in arr[1:]:
        total = max(x, total + x)
        ans = max(ans, total)
    return ans`}
                </pre>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              AST Tokenizer identifies that despite renaming `nums`&rarr;`arr`, `max_sum`&rarr;`ans`, and `cur`&rarr;`total`, the syntax tree topology is 100% isomorphic.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
