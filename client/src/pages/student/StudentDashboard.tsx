import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  FileCheck2,
  Layers,
  Play,
  PlayCircle,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<any[]>([]);
  const [adaptiveData, setAdaptiveData] = useState<any>(null);
  const [domainsData, setDomainsData] = useState<any[]>([]);
  const [primaryProgress, setPrimaryProgress] = useState<any>(null);
  const [isStartingAdaptive, setIsStartingAdaptive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = () => {
    return Promise.all([
      api.get("/analytics/student").catch(() => ({ data: { success: false } })),
      api.get("/assessments").catch(() => ({ data: { success: false } })),
      api.get("/practice/history").catch(() => ({ data: { success: false } })),
      api.get("/adaptive/recommendations").catch(() => ({ data: { success: false } })),
      api.get("/domains").catch(() => ({ data: { success: false } })),
      api.get("/domains/mern-stack/progress").catch(() => ({ data: { success: false } }))
    ]).then(([analyticsRes, assessmentsRes, practiceRes, adaptiveRes, domainsRes, progressRes]) => {
      if (analyticsRes.data.success)
        setAnalytics(analyticsRes.data.analytics);
      if (assessmentsRes.data.success)
        setAssessments(assessmentsRes.data.assessments);
      if (practiceRes.data.success)
        setPracticeHistory(practiceRes.data.sessions || []);
      if (adaptiveRes.data.success)
        setAdaptiveData(adaptiveRes.data);
      if (domainsRes.data.success)
        setDomainsData(domainsRes.data.domains || []);
      if (progressRes.data.success)
        setPrimaryProgress(progressRes.data.progress);
    });
  };

  useEffect(() => {
    fetchDashboardData().finally(() => setIsLoading(false));

    const interval = setInterval(fetchDashboardData, 20000);

    const handleFocus = () => {
      fetchDashboardData();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Student";
  const upcomingAssessment = assessments.find(
    (a) =>
      a.status === "published" &&
      (!a.userAttempt || a.userAttempt.status === "in_progress")
  );
  const activePracticeSession = practiceHistory.find(
    (s) => s.status === "in_progress"
  );

  const freeRemaining = Math.max(
    0,
    (user?.freeAttempts?.total ?? 10) - (user?.freeAttempts?.used ?? 0)
  );
  const paidRemaining = Math.max(
    0,
    (user?.paidAttempts?.total ?? 0) - (user?.paidAttempts?.used ?? 0)
  );
  const remainingAttempts = freeRemaining + paidRemaining;

  const completedPracticeSessions = practiceHistory.filter(
    (s) => s.status === "completed"
  );
  const totalQuestionsSolved = completedPracticeSessions.reduce(
    (sum, s) => sum + (s.correctCount ?? s.score ?? 0),
    0
  );
  const practiceAccuracy =
    completedPracticeSessions.length > 0
      ? Math.round(
          completedPracticeSessions.reduce(
            (sum, s: any) => sum + (s.accuracyPercentage ?? s.accuracy ?? 0),
            0
          ) / completedPracticeSessions.length
        )
      : analytics?.overallScore ?? 0;

  const topicPerformance = (analytics?.topicPerformance || []).slice(0, 5);
  const recentActivity = analytics?.recentActivity || [];

  const scoreColor = (score: number) => {
    if (score >= 75) return "#78A88F";
    if (score >= 50) return "#7779C5";
    return "#C6A466";
  };

  const handleStartAdaptiveSession = async () => {
    try {
      setIsStartingAdaptive(true);
      const res = await api.post("/adaptive/start-session", { count: 5 });
      if (res.data.success && res.data.session?._id) {
        navigate(`/practice/${res.data.session._id}/room`);
      }
    } catch (err: any) {
      console.error("Failed to start adaptive practice session:", err);
      navigate("/practice");
    } finally {
      setIsStartingAdaptive(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-shell">
        <div>
          <div className="page-kicker">Student Workspace</div>
          <h1 className="page-title">Loading your dashboard</h1>
        </div>
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header Hierarchy (Section 36) */}
      <header className="flex flex-col justify-between gap-5 border-b border-[#E9E7F0] pb-7 md:flex-row md:items-end">
        <div>
          <p className="page-kicker">Student Overview</p>
          <h1 className="page-title display-heading text-4xl sm:text-5xl text-[#49465B]">
            Welcome back, {firstName}
          </h1>
          <p className="page-copy">
            Continue your practice and track your progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate("/practice")}
            icon={<Play className="h-4 w-4" />}
          >
            Start Practice
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              if (activePracticeSession) {
                navigate(`/practice/${activePracticeSession._id}/room`);
              } else if (upcomingAssessment) {
                navigate(`/assessments/${upcomingAssessment._id}/room`);
              } else {
                navigate("/practice");
              }
            }}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Resume Session
          </Button>
        </div>
      </header>

      {/* 4 Primary Overview Cards (Section 36) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Questions Solved",
            value: String(totalQuestionsSolved),
            sub: "Verified correct answers",
            icon: CheckCircle2,
          },
          {
            label: "Accuracy",
            value: `${practiceAccuracy}%`,
            sub: "Across evaluated sessions",
            icon: Target,
          },
          {
            label: "Practice Sessions",
            value: String(practiceHistory.length),
            sub: `${completedPracticeSessions.length} completed`,
            icon: Layers,
          },
          {
            label: "Remaining Attempts",
            value: String(remainingAttempts),
            sub: `${freeRemaining} free • ${paidRemaining} unlocked`,
            icon: Timer,
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-[14px] border border-[#E9E7F0] bg-white p-5 shadow-[0_1px_3px_rgba(82,77,119,0.04)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#777486]">
                  {metric.label}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0EFF9] text-[#7779C5]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-[#49465B]">
                {metric.value}
              </div>
              <div className="mt-1 text-xs text-[#777486]">{metric.sub}</div>
            </div>
          );
        })}
      </section>

      {/* Recommended Practice & Upcoming Assessment */}
      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        {/* Upcoming Assessment */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#49465B]">
                  Institutional Assessments
                </h2>
                <p className="text-xs text-[#777486]">
                  Assigned evaluations that can be started or resumed
                </p>
              </div>
              <Badge variant="purple">{assessments.length} assigned</Badge>
            </div>
          }
        >
          {upcomingAssessment ? (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="text-lg font-semibold text-[#49465B]">
                    {upcomingAssessment.title}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#777486]">
                    {upcomingAssessment.description}
                  </p>
                </div>
                <Badge
                  variant={
                    upcomingAssessment.userAttempt?.status === "in_progress"
                      ? "amber"
                      : "green"
                  }
                >
                  {upcomingAssessment.userAttempt?.status === "in_progress"
                    ? "Resumable"
                    : "Ready"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-[#777486]">Duration</div>
                  <div className="mt-1 font-semibold text-[#49465B]">
                    {upcomingAssessment.durationMinutes} min
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#777486]">Total Marks</div>
                  <div className="mt-1 font-semibold text-[#49465B]">
                    {upcomingAssessment.totalMarks}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#777486]">Sections</div>
                  <div className="mt-1 font-semibold text-[#49465B]">
                    {upcomingAssessment.sections?.length ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#777486]">Due Date</div>
                  <div className="mt-1 font-semibold text-[#49465B]">
                    {new Date(upcomingAssessment.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/assessments/${upcomingAssessment._id}/room`)
                }
                icon={<ArrowRight className="h-4 w-4" />}
              >
                {upcomingAssessment.userAttempt?.status === "in_progress"
                  ? "Resume Assessment"
                  : "Start Assessment"}
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<FileCheck2 className="h-8 w-8" />}
              title="No active institutional assessments"
              description="Practice any combination of DSA, Aptitude, Reasoning, or Coding while waiting for your next scheduled exam."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/assessments")}
                >
                  Browse Assessments
                </Button>
              }
            />
          )}
        </Card>

        {/* Adaptive Recommended Practice */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-[#7779C5]" />
                  <h2 className="text-sm font-semibold text-[#49465B]">
                    Adaptive Practice System
                  </h2>
                </div>
                <p className="text-xs text-[#777486]">
                  Personalized questions adapting to your performance
                </p>
              </div>
              {adaptiveData?.adaptiveProfile && (
                <Badge
                  variant={
                    adaptiveData.adaptiveProfile.statusLabel === "Improving"
                      ? "green"
                      : adaptiveData.adaptiveProfile.statusLabel === "Review Weak Topics"
                      ? "amber"
                      : "purple"
                  }
                >
                  {adaptiveData.adaptiveProfile.statusLabel}
                </Badge>
              )}
            </div>
          }
        >
          {adaptiveData?.adaptiveProfile ? (
            <div className="space-y-4">
              {/* Adaptive Status & Difficulty Callout */}
              <div className="rounded-xl border border-[#D6D8F8] bg-[#F0EFF9]/50 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[#7779C5]">
                    Current Level: {adaptiveData.adaptiveProfile.currentDifficulty.toUpperCase()}
                  </span>
                  <span className="text-[#777486]">
                    Recent Accuracy: {adaptiveData.adaptiveProfile.recentAccuracy}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#333340]">
                  {adaptiveData.adaptiveProfile.statusReason}
                </p>
              </div>

              {/* Recommended Questions List */}
              {adaptiveData.recommendations && adaptiveData.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#777486]">
                    Recommended for You
                  </div>
                  <div className="space-y-2">
                    {adaptiveData.recommendations.slice(0, 3).map((q: any) => (
                      <div
                        key={q.questionId}
                        className="rounded-lg border border-[#E9E7F0] bg-white p-2.5 transition-colors hover:border-[#7779C5]/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[#49465B]">
                              {q.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#777486]">
                              {q.topic} • {q.reason}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {q.isFresh && (
                              <Badge variant="blue" size="sm">
                                48h Fresh
                              </Badge>
                            )}
                            <Badge
                              variant={
                                q.difficulty === "easy"
                                  ? "green"
                                  : q.difficulty === "hard"
                                  ? "amber"
                                  : "purple"
                              }
                              size="sm"
                            >
                              {q.difficulty}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                className="w-full"
                variant="primary"
                disabled={isStartingAdaptive}
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => {
                  if (adaptiveData?.activeSession?.resumable) {
                    navigate(`/practice/${adaptiveData.activeSession.sessionId}/room`);
                  } else {
                    handleStartAdaptiveSession();
                  }
                }}
              >
                {isStartingAdaptive
                  ? "Preparing Session..."
                  : adaptiveData?.activeSession?.resumable
                  ? "Resume Active Session"
                  : `Start Adaptive Practice (${adaptiveData.adaptiveProfile.currentDifficulty.toUpperCase()})`}
              </Button>
            </div>
          ) : analytics?.weakestTopic?.topic ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#D6D8F8] bg-[#F0EFF9]/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#7779C5]">
                  Focus Topic
                </div>
                <div className="mt-1 text-xl font-semibold text-[#49465B]">
                  {analytics.weakestTopic.topic}
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-[#777486]">Current Mastery</span>
                  <span className="font-semibold text-[#49465B]">
                    {analytics.weakestTopic.score}%
                  </span>
                </div>
                <ProgressBar
                  value={analytics.weakestTopic.score}
                  color={scoreColor(analytics.weakestTopic.score)}
                />
              </div>
              <Button
                className="w-full"
                variant="primary"
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() =>
                  navigate(
                    `/practice?topic=${encodeURIComponent(
                      analytics.weakestTopic.topic
                    )}&difficulty=medium&count=10`
                  )
                }
              >
                Start Recommended Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#7779C5]">
                  Starter Recommendation
                </div>
                <div className="mt-1 text-base font-semibold text-[#49465B]">
                  DSA (Arrays) + Quantitative Aptitude
                </div>
                <p className="mt-1 text-xs text-[#777486]">
                  Build your baseline skill profile with a balanced 10-question
                  adaptive practice set.
                </p>
              </div>
              <Button
                className="w-full"
                variant="primary"
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate("/practice")}
              >
                Create Practice Session
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* Standalone Code Execution Visualizer */}
      <section>
        <Card>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-1">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge variant="amber" size="sm">PREMIUM TOOL</Badge>
                <Badge variant="blue" size="sm">
                  <Cpu className="h-3 w-3 text-[#7779C5]" />
                  Independent Feature
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-[#49465B]">
                Step-by-Step Code Execution Visualizer
              </h2>
              <p className="text-sm text-[#777486] leading-relaxed">
                Execute and explore code behavior line-by-line with genuine runtime execution traces. 
                Inspect variable states, call stacks, loop iterations, and array mutations in real time—without starting an assignment or lesson.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-[#777486]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E9F3ED]" />
                  JavaScript &amp; Python support
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E9F3ED]" />
                  Pre-seeded Algorithm Library
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E9F3ED]" />
                  Deterministic Runtime Traces
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
              <Button
                variant="primary"
                onClick={() => navigate("/code-visualizer")}
                icon={<PlayCircle className="h-4 w-4" />}
              >
                Launch Visualizer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/subscription")}
              >
                View Premium Entitlements
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Technology Domain Career Tracks & Real Progress */}
      <section className="space-y-4">
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#7779C5]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#49465B]">
                    Technology Career Domain Progress
                  </h2>
                  <p className="text-xs text-[#777486]">
                    Sequential topic learning, hands-on code workspaces &amp; mandatory module milestones
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/domains")}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Browse All Domains
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-5">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <Badge variant="blue" size="sm">Active Track</Badge>
                  <span className="text-xs text-[#777486] font-medium">
                    {primaryProgress?.completedModules?.length || 0} Modules Completed
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#49465B]">
                  MERN Stack &amp; Full-Stack Development
                </h3>
                <p className="text-xs text-[#777486]">
                  {primaryProgress?.recommendedNextTopic
                    ? `Recommended next topic: ${primaryProgress.recommendedNextTopic}`
                    : `Complete topic lessons and pass mandatory assignments to unlock subsequent modules.`}
                </p>
                <div className="flex items-center gap-4 pt-1 text-2xs text-[#777486]">
                  <span>
                    <strong>Topics Mastered:</strong> {primaryProgress?.completedTopics?.length || 0}
                  </span>
                  <span>
                    <strong>Stage:</strong> {primaryProgress?.currentStage || 'Getting Started'}
                  </span>
                  <span>
                    <strong>Assignments Passed:</strong>{' '}
                    {(primaryProgress?.assignmentAttempts || []).filter((a: any) => a.passed).length}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/domains/mern-stack")}
                  icon={<BookOpen className="h-4 w-4" />}
                >
                  Resume Learning Path
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/domains/mern-stack/workspace")}
                  icon={<Code2 className="h-4 w-4 text-[#7779C5]" />}
                >
                  Open Coding Workspace
                </Button>
              </div>
            </div>

            {/* Quick Domain Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-[#777486] text-2xs uppercase tracking-wider">
                Explore Tracks:
              </span>
              {(domainsData || []).slice(0, 5).map((d: any) => (
                <button
                  key={d.slug}
                  onClick={() => navigate(`/domains/${d.slug}`)}
                  className="rounded-lg border border-[#E9E7F0] bg-white px-3 py-1 text-xs font-medium text-[#49465B] hover:border-[#7779C5] hover:text-[#7779C5] transition-colors shadow-2xs"
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Performance Summary & Score Progression */}
      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#49465B]">
                Performance Summary
              </span>
              <button
                type="button"
                onClick={() => navigate("/skills")}
                className="text-xs font-semibold text-[#7779C5] hover:text-[#555780]"
              >
                Full Skill Profile
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Overall", analytics?.overallScore],
                ["Coding", analytics?.codingScore],
                ["Aptitude", analytics?.aptitudeScore],
                ["Technical", analytics?.technicalScore],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-3.5"
                >
                  <div className="text-xs text-[#777486]">
                    {label as string}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#49465B]">
                    {value != null ? `${value}%` : "—"}
                  </div>
                </div>
              ))}
            </div>

            {topicPerformance.length > 0 ? (
              <div className="space-y-3 pt-1">
                {topicPerformance.map((topic: any) => (
                  <div key={topic.topic}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-[#49465B]">
                        {topic.topic}
                      </span>
                      <span className="font-semibold text-[#777486]">
                        {topic.score}%
                      </span>
                    </div>
                    <ProgressBar
                      value={topic.score}
                      color={scoreColor(topic.score)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#E9E7F0] bg-[#F8F7FC] p-4 text-xs text-[#777486]">
                Topic-level proficiency bars appear automatically after your
                first completed session.
              </p>
            )}
          </div>
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#49465B]">
                Accuracy Progression
              </span>
              <span className="text-xs text-[#777486]">Recent sessions</span>
            </div>
          }
        >
          {analytics?.scoreTrends?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.scoreTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#777486" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#777486" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #E9E7F0",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#7779C5"
                    strokeWidth={2.5}
                    fill="#F0EFF9"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="No progression trend yet"
              description="Complete practice sessions or assessments to visualize your accuracy trend over time."
            />
          )}
        </Card>
      </section>

      {/* Recent Activity */}
      <Card
        padding="none"
        header={
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#49465B]">
              Recent Activity
            </h2>
            <span className="text-xs text-[#777486]">
              Practice sessions & assessments
            </span>
          </div>
        }
      >
        {recentActivity.length > 0 || practiceHistory.length > 0 ? (
          <div className="divide-y divide-[#E9E7F0]">
            {(recentActivity.length > 0
              ? recentActivity
              : practiceHistory.slice(0, 5).map((s: any) => ({
                  title: `${s.topic || "Custom Practice"} (${s.difficulty || "Mixed"})`,
                  date: s.createdAt,
                  score: s.accuracy ?? 0,
                  passed: (s.accuracy ?? 0) >= 60,
                  type: "practice",
                }))
            ).map((item: any, index: number) => (
              <div
                key={`${item.title}-${index}`}
                className="flex items-center justify-between px-6 py-3.5 text-sm hover:bg-[#F8F7FC] transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EFF9] text-[#7779C5]">
                    {item.type === "assessment" ? (
                      <FileCheck2 className="h-4 w-4" />
                    ) : (
                      <Code2 className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-[#49465B]">
                      {item.title}
                    </div>
                    <div className="text-xs text-[#777486]">
                      {item.date
                        ? new Date(item.date).toLocaleDateString()
                        : "Recent session"}
                    </div>
                  </div>
                </div>
                <Badge variant={item.passed ? "green" : "purple"}>
                  {item.score}%
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="No completed activity yet"
              description="Your recent practice sessions and assessment results will appear here."
            />
          </div>
        )}
      </Card>
    </div>
  );
};
