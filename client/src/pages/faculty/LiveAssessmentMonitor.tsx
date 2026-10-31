import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Activity,
  ShieldAlert,
  Clock,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Users
} from 'lucide-react';

export const LiveAssessmentMonitor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    searchParams.get('assessmentId') || ''
  );
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const fetchLiveData = () => {
    if (!selectedAssessmentId) return;
    setIsRefreshing(true);
    api.get(`/assessments/${selectedAssessmentId}/live-monitor`)
      .then(res => {
        if (res.data.success) {
          setLiveStudents(res.data.liveStudents);
        }
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000); // 10-second polling
    return () => clearInterval(interval);
  }, [selectedAssessmentId]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E5F2EB] text-[#4C765D] text-xs font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-[#E5F2EB] animate-ping" />
            Live Proctoring Active
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Live Assessment Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time student progress tracking & suspicious activity indicators (telemetry events)
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
            variant="outline"
            size="sm"
            onClick={fetchLiveData}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Feed
          </Button>
        </div>
      </div>

      {/* Proctoring Banner */}
      <div className="p-4 rounded-xl bg-[#EAF1F9]/60 border border-[#CFE2DC] text-xs text-[#3C648E] flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#3C648E] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Responsible Assessment Monitoring Policy:</span>
          <p className="text-[11px] text-[#3C648E]/80 leading-relaxed">
            Telemetry logs track tab switches, window minimization, and fullscreen toggles as "Suspicious activity indicators". These signals indicate possible distractions or interruptions and should be corroborated before taking academic action.
          </p>
        </div>
      </div>

      {/* Live Students Feed Table */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-600" />
              Active Examinees ({liveStudents.length})
            </span>
            <Badge variant="blue">Auto-updating every 10s</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                <th className="pb-3">Student Name</th>
                <th className="pb-3">Roll / ID</th>
                <th className="pb-3">Progress</th>
                <th className="pb-3">Integrity Score</th>
                <th className="pb-3">Suspicious Activity Indicators</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liveStudents.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 font-semibold text-gray-900">{item.student?.name || 'Student'}</td>
                  <td className="py-3 font-mono text-gray-500">{item.student?.studentId || 'Not assigned'}</td>
                  <td className="py-3">
                    <div className="space-y-1 w-36">
                      <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                        <span>{item.answeredCount} / {item.totalQuestions} Questions</span>
                        <span>{item.progressPercentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#EAF1F9] rounded-full"
                          style={{ width: `${item.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={`font-bold ${
                        item.integrityScore >= 90
                          ? 'text-[#4C765D]'
                          : item.integrityScore >= 70
                          ? 'text-[#8A7047]'
                          : 'text-[#A36162]'
                      }`}
                    >
                      {item.integrityScore}%
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {item.suspiciousEventCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F8F2E4] border border-[#E9DAB5] text-[#8A7047] font-medium">
                          <AlertTriangle className="w-3 h-3 text-[#8A7047]" />
                          {item.suspiciousEventCount} Indicator Events
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#4C765D] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4C765D]" /> No infractions
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <Badge variant="green">In Progress</Badge>
                  </td>
                </tr>
              ))}
              {liveStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No students currently taking this assessment in active sessions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
