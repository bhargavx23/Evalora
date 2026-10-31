import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AlgoPaymentPanel } from '../../features/payment/AlgoPaymentPanel';
import {
  Compass,
  ArrowLeft,
  BookOpen,
  Code2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  FileCheck2,
  Lock,
  Layers,
  Award,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { TopicLessonModal } from './TopicLessonModal';

export const DomainLearningPath: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [domain, setDomain] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [isSubscriptionLocked, setIsSubscriptionLocked] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'modules' | 'projects' | 'assessments'>('modules');
  const [selectedTopicLesson, setSelectedTopicLesson] = useState<{
    moduleId: string;
    topic: string;
  } | null>(null);

  const fetchDomainData = async () => {
    if (!slug) return;
    try {
      setIsLoading(true);
      setIsSubscriptionLocked(false);
      const res = await api.get(`/domains/${slug}`);
      if (res.data.success) {
        setDomain(res.data.domain);
        setProgress(res.data.progress);

        // Auto-expand the first module by default
        if (res.data.domain?.modules?.length > 0) {
          setExpandedModules({ [res.data.domain.modules[0].moduleId]: true });
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setIsSubscriptionLocked(true);
      } else {
        toast.error('Failed to load domain learning path.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomainData();
  }, [slug]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const completedTopicsList = progress?.completedTopics || [];
  const allTopicsCount =
    domain?.modules?.reduce((acc: number, m: any) => acc + (m.topics?.length || 0), 0) || 1;
  const progressPercent = Math.min(
    100,
    Math.round((completedTopicsList.length / allTopicsCount) * 100)
  );

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
          <p className="text-sm font-medium text-[#6E6E73]">Loading domain curriculum...</p>
        </div>
      </div>
    );
  }

  // Subscription-gated paywall fallback
  if (isSubscriptionLocked) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="rounded-2xl border border-[#E8D9B9] bg-[#F8F3E8]/60 p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F8F3E8] text-[#896D45]">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">Premium Subscription Required</h2>
          <p className="mt-2 text-sm text-[#6E6E73]">
            Domain-based technical preparation and practical coding workspaces require an active,
            verified subscription on Algorand (&lt; 9 ALGO).
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full sm:w-auto px-6 py-2.5"
            >
              Unlock with Pera Wallet
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/domains')}
              className="w-full sm:w-auto"
            >
              Back to Domains
            </Button>
          </div>
        </div>

        {isPaymentModalOpen && (
          <AlgoPaymentPanel
            onClose={() => setIsPaymentModalOpen(false)}
            onSuccess={() => {
              setIsPaymentModalOpen(false);
              toast.success('Subscription verified!');
              fetchDomainData();
            }}
          />
        )}
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Domain not found.</p>
        <Button onClick={() => navigate('/domains')} className="mt-4">
          Browse Domains
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
        <Link to="/domains" className="hover:text-[#007AFF] flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          <span>All Domains</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1D1D1F]">{domain.name}</span>
      </div>

      {/* Hero Header */}
      <div className="rounded-2xl bg-white border border-[#D2D2D7] p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue">
                {domain.badge || 'Full Track'}
              </Badge>
              <Badge variant="green">
                <CheckCircle2 className="h-3.5 w-3.5" /> Subscribed Access
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1D1D1F]">
              {domain.name}
            </h1>
            <p className="text-sm md:text-base text-[#6E6E73]">{domain.description || domain.shortDescription}</p>

            {/* Tech badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(domain.technologies || []).map((t: string) => (
                <span
                  key={t}
                  className="rounded-md bg-[#F5F5F7] px-2.5 py-1 text-xs font-medium text-[#1D1D1F]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Code Workspace button */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <Button
              variant="primary"
              onClick={() => navigate(`/domains/${domain.slug}/workspace`)}
              icon={<Code2 className="h-4 w-4" />}
            >
              Open Code Workspace
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const firstModule = domain.modules?.[0];
                const firstTopic = firstModule?.topics?.[0] || 'Fundamentals';
                navigate(`/domains/${domain.slug}/practice?module=${firstModule?.moduleId}&topic=${encodeURIComponent(firstTopic)}`);
              }}
              icon={<Code2 className="h-4 w-4 text-[#007AFF]" />}
            >
              Practice Session
            </Button>
          </div>
        </div>

        {/* Progress Tracker Bar */}
        <div className="mt-8 border-t border-[#D2D2D7] pt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-[#1D1D1F]">Track Progress</span>
            <span className="font-bold text-[#007AFF]">{progressPercent}% Completed</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
            <div
              className="h-full rounded-full bg-[#007AFF] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6E6E73]">
            <span>
              {completedTopicsList.length} of {allTopicsCount} topics mastered
            </span>
            <span>
              <strong>Current Stage:</strong> {progress?.currentStage || 'Getting Started'}
            </span>
            {progress?.recommendedNextTopic && (
              <span className="text-[#007AFF] font-medium">
                <strong>Next recommended:</strong> {progress.recommendedNextTopic}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D2D2D7]">
        <button
          onClick={() => setActiveTab('modules')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'modules'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Learning Modules ({domain.modules?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'projects'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Practical Projects ({domain.projects?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('assessments')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'assessments'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Assessments &amp; Certification ({domain.assessments?.length || 0})
        </button>
      </div>

      {/* Tab 1: Structured Modules */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {(domain.modules || []).map((m: any, index: number) => {
            const isUnlocked = m.isUnlocked !== false;
            const isExpanded = Boolean(expandedModules[m.moduleId]);
            const moduleTopics: string[] = m.topics || [];
            const completedCount = moduleTopics.filter((t) => completedTopicsList.includes(t)).length;
            const isAllTopicsComplete = completedCount === moduleTopics.length && moduleTopics.length > 0;
            const isModulePassed = (progress?.completedModules || []).includes(m.moduleId);
            const passedAssignmentAttempt = (progress?.assignmentAttempts || []).find(
              (a: any) => a.moduleId === m.moduleId && a.passed
            );

            return (
              <div
                key={m.moduleId}
                className={`overflow-hidden rounded-xl border bg-white shadow-xs transition-all ${
                  !isUnlocked ? 'border-gray-200 opacity-80' : 'border-gray-200'
                }`}
              >
                {/* Module Header Bar */}
                <div
                  onClick={() => {
                    if (isUnlocked) toggleModule(m.moduleId);
                    else toast.info(`Pass Module ${index} Assignment to unlock "${m.title}".`);
                  }}
                  className={`flex items-center justify-between p-5 transition-colors ${
                    !isUnlocked
                      ? 'bg-gray-100/60 cursor-not-allowed'
                      : 'cursor-pointer hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                        !isUnlocked
                          ? 'bg-[#F5F5F7] text-[#6E6E73]'
                          : isModulePassed
                          ? 'bg-[#E6F6F0] text-[#527565]'
                          : 'bg-[#E5F1FF] text-[#0056CC]'
                      }`}
                    >
                      {!isUnlocked ? (
                        <Lock className="h-4 w-4" />
                      ) : isModulePassed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        `0${index + 1}`
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#1D1D1F]">{m.title}</h3>
                        {!isUnlocked && (
                          <Badge variant="neutral" size="sm">Locked</Badge>
                        )}
                        {isModulePassed && (
                          <Badge variant="green" size="sm">Passed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#6E6E73] mt-0.5">{m.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline-block rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-xs font-medium text-[#6E6E73]">
                      {completedCount}/{moduleTopics.length} topics
                    </span>
                    {isUnlocked &&
                      (isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-[#6E6E73]" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-[#6E6E73]" />
                      ))}
                  </div>
                </div>

                {/* Module Body (Topics list, Learn modals & Mandatory Assignment) */}
                {isUnlocked && isExpanded && (
                  <div className="border-t border-[#D2D2D7] bg-[#F5F5F7]/40 p-5 space-y-6">
                    {/* Topics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {moduleTopics.map((topicName) => {
                        const isDone = completedTopicsList.includes(topicName);

                        return (
                          <div
                            key={topicName}
                            className="flex items-center justify-between rounded-lg border border-[#D2D2D7] bg-white p-3.5 shadow-2xs hover:border-[#CFE2DC] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                  isDone
                                    ? 'bg-[#E5F2EB] text-white'
                                    : 'border border-[#D2D2D7] text-transparent'
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-medium text-[#1D1D1F] truncate">
                                {topicName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTopicLesson({ moduleId: m.moduleId, topic: topicName });
                                }}
                                className="flex items-center gap-1 rounded-md bg-[#E5F1FF] px-2 py-1 text-xs font-semibold text-[#0056CC] hover:bg-[#E1E5FF] transition-colors"
                              >
                                <BookOpen className="h-3 w-3" />
                                <span>Learn</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/domains/${domain.slug}/practice?module=${m.moduleId}&topic=${encodeURIComponent(
                                      topicName
                                    )}`
                                  );
                                }}
                                className="flex items-center gap-1 rounded-md bg-[#F5F5F7] px-2 py-1 text-xs font-medium text-[#1D1D1F] hover:bg-[#D2D2D7] transition-colors"
                              >
                                <Code2 className="h-3 w-3 text-[#007AFF]" />
                                <span>Practice</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mandatory Module Assignment Card */}
                    <div
                      className={`rounded-xl border p-4 sm:p-5 transition-all ${
                        isModulePassed
                          ? 'bg-[#E6F6F0]/40 border-[#C3E8D8]'
                          : isAllTopicsComplete
                          ? 'bg-[#E5F1FF]/50 border-[#CFE2DC] ring-2 ring-[#007AFF]/15'
                          : 'bg-[#F5F5F7] border-[#D2D2D7] opacity-90'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              isModulePassed
                                ? 'bg-[#E6F6F0] text-[#527565]'
                                : isAllTopicsComplete
                                ? 'bg-[#E5F1FF] text-[#0056CC]'
                                : 'bg-[#F5F5F7] text-[#6E6E73]'
                            }`}
                          >
                            {isModulePassed ? (
                              <Award className="h-5 w-5" />
                            ) : !isAllTopicsComplete ? (
                              <Lock className="h-5 w-5" />
                            ) : (
                              <FileCheck2 className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-3xs font-bold uppercase tracking-wider text-[#6E6E73]">
                                Mandatory Module Milestone
                              </span>
                              {isModulePassed && (
                                <Badge variant="green" size="sm">
                                  Passed ({passedAssignmentAttempt?.score || 100}%)
                                </Badge>
                              )}
                              {!isModulePassed && !isAllTopicsComplete && (
                                <Badge variant="amber" size="sm">
                                  Locked ({completedCount}/{moduleTopics.length} topics)
                                </Badge>
                              )}
                              {!isModulePassed && isAllTopicsComplete && (
                                <Badge variant="blue" size="sm">
                                  Ready to Take
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-[#1D1D1F] mt-0.5">
                              Module {index + 1} Assignment: {m.title}
                            </h4>
                            <p className="text-xs text-[#6E6E73] mt-0.5">
                              {isModulePassed
                                ? `Completed with verified passing grade. Next module is unlocked.`
                                : isAllTopicsComplete
                                ? `All topics complete! Pass this assignment with ≥70% score to unlock Module ${index + 2}.`
                                : `Complete all ${moduleTopics.length} topics in this module to unlock the mandatory assignment.`}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 w-full sm:w-auto">
                          {isModulePassed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/domains/${domain.slug}/workspace?moduleId=${m.moduleId}&assignment=true`
                                )
                              }
                              className="w-full sm:w-auto text-xs"
                            >
                              <span>Review Assignment</span>
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          ) : isAllTopicsComplete ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/domains/${domain.slug}/workspace?moduleId=${m.moduleId}&assignment=true`
                                )
                              }
                              className="w-full sm:w-auto text-xs"
                            >
                              <Code2 className="h-3.5 w-3.5 mr-1.5" />
                              <span>Start Assignment Workspace</span>
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled
                              variant="outline"
                              className="w-full sm:w-auto text-xs opacity-60 cursor-not-allowed"
                            >
                              <Lock className="h-3.5 w-3.5 mr-1.5" />
                              <span>Complete Topics First</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Practical Projects */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(domain.projects || []).map((p: any) => {
            const isCompleted = progress?.completedProjects?.some(
              (cp: any) => cp.projectId === p.projectId
            );

            return (
              <div
                key={p.projectId}
                className="flex flex-col justify-between rounded-xl border border-[#D2D2D7] bg-white p-6 shadow-xs hover:border-[#CFE2DC] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        p.difficulty === 'hard'
                          ? 'bg-[#FDECEC] text-[#9A646D]'
                          : p.difficulty === 'medium'
                          ? 'bg-[#FEF7E6] text-[#896D45]'
                          : 'bg-[#E6F6F0] text-[#527565]'
                      }`}
                    >
                      {p.difficulty}
                    </span>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#527565]">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-[#1D1D1F]">{p.title}</h3>
                  <p className="mt-2 text-sm text-[#6E6E73]">{p.description}</p>

                  <div className="mt-4 space-y-2">
                    <span className="text-xs font-semibold text-[#6E6E73] uppercase">
                      Milestones ({p.tasks?.length || 0} tasks):
                    </span>
                    <ul className="space-y-1.5 text-xs text-[#1D1D1F]">
                      {(p.tasks || []).map((t: any) => (
                        <li key={t.taskId} className="flex items-start gap-2">
                          <span className="text-[#007AFF] font-bold">•</span>
                          <span>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D2D2D7]">
                  <Button
                    variant="primary"
                    onClick={() =>
                      navigate(`/domains/${domain.slug}/projects/${p.projectId}`)
                    }
                    icon={<Code2 className="h-4 w-4" />}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <span>Open Project Workspace</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Domain Assessments */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          {(domain.assessments || []).map((a: any) => {
            const pastAttempt = progress?.assessmentScores?.find(
              (s: any) => s.assessmentId === a.assessmentId
            );

            return (
              <div
                key={a.assessmentId}
                className="flex flex-col md:flex-row items-start md:items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-xs gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#E5F1FF] px-2.5 py-0.5 text-xs font-bold text-[#0056CC]">
                      Certification Assessment
                    </span>
                    {pastAttempt && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          pastAttempt.passed
                            ? 'bg-[#E5F2EB] text-[#527565]'
                            : 'bg-[#F8EDEF] text-[#9A646D]'
                        }`}
                      >
                        Score: {pastAttempt.score}% ({pastAttempt.passed ? 'PASSED' : 'RETRY'})
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{a.title}</h3>
                  <p className="text-sm text-gray-600">{a.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {a.durationMinutes} Minutes
                    </span>
                    <span>Passing Score: {a.passingScore}%</span>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    navigate(
                      `/domains/${domain.slug}/assessment/${a.assessmentId}`
                    )
                  }
                  className="w-full md:w-auto bg-[#E5F1FF] hover:bg-[#E5F1FF] text-white font-semibold shrink-0"
                >
                  <Award className="h-4 w-4 mr-2" />
                  <span>Start Assessment</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Topic Lesson & Interactive Exercises Modal */}
      {selectedTopicLesson && (
        <TopicLessonModal
          isOpen={Boolean(selectedTopicLesson)}
          onClose={() => setSelectedTopicLesson(null)}
          domainSlug={domain.slug}
          moduleId={selectedTopicLesson.moduleId}
          topic={selectedTopicLesson.topic}
          onTopicCompleted={() => {
            fetchDomainData();
          }}
        />
      )}
    </div>
  );
};
