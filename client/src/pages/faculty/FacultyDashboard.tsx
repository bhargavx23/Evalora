import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck2,
  BookOpen,
  Bot,
  Activity,
  Users,
  BarChart3,
  ArrowRight,
  ShieldAlert,
  PlusCircle,
  Clock,
  Layers
} from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/analytics/batch').catch(() => ({ data: { success: false } })),
      api.get('/assessments').catch(() => ({ data: { success: false } })),
      api.get('/questions?limit=1').catch(() => ({ data: { success: false } }))
    ])
      .then(([batchRes, assRes, qRes]) => {
        if (batchRes.data.success) {
          setStats(batchRes.data.stats);
        } else {
          setLoadError('Unable to load batch analytics.');
        }
        if (assRes.data.success) {
          setAssessments(assRes.data.assessments);
          const published = assRes.data.assessments.find((a: any) => a.status === 'published');
          if (published) {
            api.get(`/assessments/${published._id}/live-monitor`)
              .then(liveRes => {
                if (liveRes.data.success) {
                  setLiveStudents(liveRes.data.liveStudents || []);
                }
              })
              .catch(() => {});
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const publishedAssessments = assessments.filter(a => a.status === 'published');

  return (
    <div className="space-y-8 py-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Faculty Command Center</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Faculty workspace{typeof user?.collegeId === 'object' && user.collegeId?.name ? ` for ${user.collegeId.name}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/faculty/ai-generator')}
            icon={<Bot className="w-3.5 h-3.5 text-[#7779C5]" />}
          >
            AI Question Generator
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/faculty/assessments/new')}
            icon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            Create Assessment
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      {loadError && (
        <div className="rounded-lg border border-[#E8D9B9] bg-[#F8F3E8] px-3 py-2 text-xs font-medium text-[#896D45]">
          {loadError}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card pastelAccent="blue">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Active Assessments
            </div>
            <div className="text-2xl font-bold text-[#555780]">{publishedAssessments.length}</div>
            <div className="text-[10px] text-gray-400">Published to students</div>
          </div>
        </Card>

        <Card pastelAccent="mint">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Class Average
            </div>
            <div className="text-2xl font-bold text-[#527565]">{stats?.classAverage != null ? `${stats.classAverage}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">Median: {stats?.median != null ? `${stats.median}%` : 'Not enough data'}</div>
          </div>
        </Card>

        <Card pastelAccent="purple">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Question Bank
            </div>
            <div className="text-2xl font-bold text-[#555780]">{assessments.reduce((total, ass) => total + (ass.sections || []).reduce((sum: number, section: any) => sum + (section.questions?.length || 0), 0), 0)}</div>
            <div className="text-[10px] text-gray-400">Questions in listed assessments</div>
          </div>
        </Card>

        <Card pastelAccent="rose">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Pass Rate
            </div>
            <div className="text-2xl font-bold text-[#9A646D]">{stats?.passRate != null ? `${stats.passRate}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">Across current batch</div>
          </div>
        </Card>
      </div>

      {/* Live Proctoring & Active Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Assessments */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-[#555780]" />
                  Current Department Assessments
                </span>
                <button
                  onClick={() => navigate('/faculty/assessments')}
                  className="text-[11px] text-[#555780] font-semibold hover:underline"
                >
                  View All ({assessments.length})
                </button>
              </div>
            }
          >
            <div className="divide-y divide-gray-100">
              {assessments.slice(0, 3).map(ass => (
                <div key={ass._id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">{ass.title}</span>
                        <Badge variant={ass.status === 'published' ? 'green' : 'amber'}>
                          {ass.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{ass.description}</p>
                    </div>

                    <span className="text-xs font-bold text-[#555780] bg-[#F0EFF9] px-2 py-0.5 rounded border border-[#DEDDF0] shrink-0">
                      {ass.totalMarks} Marks
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>{ass.durationMinutes} mins</span>
                      <span>&bull;</span>
                      <span>{ass.stats?.totalAttempts ?? 0} Submissions</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/faculty/live-monitor?assessmentId=${ass._id}`)}
                        className="text-[#555780] hover:text-[#555780] font-medium"
                      >
                        Live Monitor
                      </button>
                      <span>&bull;</span>
                      <button
                        onClick={() => navigate(`/faculty/similarity?assessmentId=${ass._id}`)}
                        className="text-[#9A646D] hover:text-[#9A646D] font-medium"
                      >
                        Plagiarism
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Live Proctoring Signals Card */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            pastelAccent="rose"
            header={
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#9A646D]" />
                  Live Proctoring Signals
                </span>
                <Badge variant="rose">Real-Time</Badge>
              </div>
            }
          >
            <div className="space-y-3">
              {liveStudents.slice(0, 2).map(item => (
                <div key={item.attemptId || item._id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-gray-800">
                    <span>{item.student?.name || 'Student'}</span>
                    <span className="text-[#527565]">{item.integrityScore ?? 'N/A'}{item.integrityScore != null ? '% Integrity' : ''}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Progress: {item.answeredQuestions ?? 0}/{item.totalQuestions ?? 0} Questions
                  </div>
                </div>
              ))}
              {liveStudents.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-500">
                  <div className="font-semibold text-gray-800">No live attempts right now</div>
                  <div className="mt-1">Proctoring signals will appear after students start an active assessment.</div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate('/faculty/live-monitor')}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Open Full Proctoring Feed
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Batch Topic Weaknesses & Quality Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#555780]" />
                Batch Topic Proficiency Heatmap
              </span>
              <button
                onClick={() => navigate('/faculty/batch-analytics')}
                className="text-[11px] text-[#555780] font-semibold hover:underline"
              >
                Detailed Analytics
              </button>
            </div>
          }
        >
          <div className="space-y-3 pt-1">
            {(stats?.topicPerformance || []).slice(0, 5).map((t: any) => (
              <div key={t.topic} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-800">{t.topic}</span>
                  <span className="font-bold text-gray-900">{t.average}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.average}%`,
                      backgroundColor: t.average < 50 ? '#CB888F' : t.average < 75 ? '#C6A466' : '#78A88F'
                    }}
                  />
                </div>
              </div>
            ))}
            {(!stats?.topicPerformance || stats.topicPerformance.length === 0) && (
              <div className="py-8 text-center text-xs text-gray-500">
                <div className="font-semibold text-gray-800">No topic analytics yet</div>
                <div className="mt-1">Topic proficiency appears after students submit evaluated assessments.</div>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Question Quality Alerts */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#896D45]" />
                Question Quality Alerts
              </span>
              <button
                onClick={() => navigate('/faculty/question-analytics')}
                className="text-[11px] text-[#555780] font-semibold hover:underline"
              >
                Review Bank
              </button>
            </div>
          }
        >
          <div className="space-y-2.5">
            <div className="py-8 text-center text-xs text-gray-500">
              <div className="font-semibold text-gray-800">Open question analytics for real quality flags</div>
              <div className="mt-1">Alerts are generated only from stored question attempts.</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
