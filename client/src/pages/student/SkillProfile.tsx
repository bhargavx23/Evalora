import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Clock,
  Download,
  FileText,
} from "lucide-react";
import { triggerBlobDownload } from "../../utils/downloadFile";
import { PerformanceReportModal } from "../../components/reports/PerformanceReportModal";
import { useToast } from "../../context/ToastContext";

export const SkillProfile: React.FC = () => {
  const toast = useToast();
  const [skillsData, setSkillsData] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [selectedReportSessionId, setSelectedReportSessionId] = useState<string | null>(null);
  const [, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const handleDownloadSessionPdf = async (sessionId: string, topic?: string) => {
    try {
      const res = await api.get(`/practice/${sessionId}/report/pdf`, {
        responseType: "blob",
      });
      const safeTopic = (topic || "Practice").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Evalora-Performance-Report-${safeTopic}-${sessionId.slice(-8)}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success("Performance report PDF downloaded.");
    } catch {
      toast.error("Failed to download report PDF.");
    }
  };

  useEffect(() => {
    Promise.all([
      api
        .get("/practice/skill-profile")
        .catch(() => ({ data: { success: false } })),
      api.get("/practice/history").catch(() => ({ data: { success: false } })),
    ])
      .then(([skillRes, historyRes]) => {
        if (skillRes.data.success) {
          setSkillsData(skillRes.data);
        }
        if (historyRes.data.success) {
          setRecentSessions((historyRes.data.sessions || []).slice(0, 5));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getBarColor = (score: number) => {
    if (score >= 75) return "#78A88F";
    if (score >= 50) return "#7779C5";
    return "#C6A466";
  };

  const skills = skillsData?.skills || [];
  const strongAreas = skillsData?.categories?.strongAreas || [];
  const needsImprovement = skillsData?.categories?.needsImprovement || [];
  const recommendations = skillsData?.recommendations;

  return (
    <div className="page-shell space-y-8">
      {/* Header (Section 41) */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E9E7F0] pb-6">
        <div>
          <p className="page-kicker">Progress & Analytics</p>
          <h1 className="page-title display-heading text-4xl text-[#49465B]">
            Skill Profile & Topic Mastery
          </h1>
          <p className="page-copy">
            Category performance, topic-wise accuracy, recent sessions, and
            targeted practice recommendations.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => navigate("/practice")}
          icon={<Target className="w-4 h-4" />}
        >
          Start Targeted Practice
        </Button>
      </header>

      {/* Skill-Gap Diagnostics Card */}
      {recommendations && (
        <Card pastelAccent="purple">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#555780] flex items-center gap-1.5 uppercase tracking-wider">
                <Target className="w-4 h-4 text-[#7779C5]" />
                Adaptive Skill-Gap Diagnostics
              </span>
              <Badge variant="purple">Placement Readiness</Badge>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#49465B]">
                Recommended focus: {recommendations.primaryWeakArea} &{" "}
                {recommendations.secondaryWeakArea}
              </h3>
              <p className="text-sm text-[#777486] leading-relaxed max-w-3xl">
                {recommendations.summary}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E9E7F0]">
              <div className="text-xs font-semibold text-[#777486] mb-2.5 uppercase tracking-wider">
                Recommended Practice Sequence
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {recommendations.recommendedSequence?.map(
                  (step: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#F8F7FC] border border-[#E9E7F0] text-xs font-medium text-[#49465B] flex items-center gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#F0EFF9] text-[#555780] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{step}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#777486]">
                {recommendations.actionPlan}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(
                    `/practice?topic=${encodeURIComponent(
                      recommendations.primaryWeakArea
                    )}&difficulty=easy&count=10`
                  )
                }
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Practice Weak Topic
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Topic-wise Accuracy Breakdown */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#49465B] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#7779C5]" />
              Topic-wise Accuracy Breakdown
            </span>
            <span className="text-xs text-[#777486]">
              {skills.length} Topics Evaluated
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          {skills.length > 0 ? (
            skills.map((s: any) => (
              <div key={s.topic} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#49465B]">
                      {s.topic}
                    </span>
                    <Badge
                      variant={
                        s.scorePercentage >= 75
                          ? "green"
                          : s.scorePercentage >= 50
                            ? "purple"
                            : "amber"
                      }
                    >
                      {s.difficultyLevel?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#777486] text-[11px]">
                      {s.totalCorrect}/{s.totalAttempted} Solved
                    </span>
                    <span className="font-semibold text-[#49465B] w-9 text-right">
                      {s.scorePercentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-[#F8F7FC] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${s.scorePercentage}%`,
                      backgroundColor: getBarColor(s.scorePercentage),
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#777486] py-4 text-center">
              Complete a practice session to unlock topic-wise accuracy metrics.
            </p>
          )}
        </div>
      </Card>

      {/* Strong Topics vs Weak Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          pastelAccent="mint"
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#49465B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#527565]" />
                Strong Topics (&ge; 75%)
              </span>
              <Badge variant="green">{strongAreas.length} Topics</Badge>
            </div>
          }
        >
          <div className="space-y-2.5">
            {strongAreas.map((item: any) => (
              <div
                key={item.topic}
                className="p-3.5 bg-[#F8F7FC] rounded-xl border border-[#E9E7F0] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#49465B]">
                    {item.topic}
                  </div>
                  <div className="text-[11px] text-[#777486]">
                    Streak: {item.consecutiveSuccessCount ?? 0} consecutive
                    successes
                  </div>
                </div>
                <span className="text-base font-semibold text-[#527565]">
                  {item.scorePercentage}%
                </span>
              </div>
            ))}
            {strongAreas.length === 0 && (
              <p className="text-xs text-[#777486] text-center py-4">
                No topics above 75% accuracy yet.
              </p>
            )}
          </div>
        </Card>

        <Card
          pastelAccent="rose"
          header={
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#49465B] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#896D45]" />
                Weak Topics (&lt; 50%)
              </span>
              <Badge variant="amber">{needsImprovement.length} Topics</Badge>
            </div>
          }
        >
          <div className="space-y-2.5">
            {needsImprovement.map((item: any) => (
              <div
                key={item.topic}
                className="p-3.5 bg-[#F8F7FC] rounded-xl border border-[#E9E7F0] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#49465B]">
                    {item.topic}
                  </div>
                  <div className="text-[11px] text-[#777486]">
                    Recommended for targeted reinforcement
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/practice?topic=${encodeURIComponent(
                        item.topic
                      )}&difficulty=easy&count=10`
                    )
                  }
                >
                  Practice ({item.scorePercentage}%)
                </Button>
              </div>
            ))}
            {needsImprovement.length === 0 && (
              <p className="text-xs text-[#777486] text-center py-4">
                All evaluated topics are at 50% or higher!
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Sessions (Section 41) */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#49465B] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7779C5]" />
              Recent Practice Sessions
            </span>
            <span className="text-xs text-[#777486]">Latest 5 sessions</span>
          </div>
        }
      >
        {recentSessions.length > 0 ? (
          <div className="divide-y divide-[#E9E7F0]">
            {recentSessions.map((sec: any) => (
              <div
                key={sec._id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-xs"
              >
                <div>
                  <div className="font-semibold text-[#49465B]">
                    {sec.topic || "Custom Multi-Section Practice"}
                  </div>
                  <div className="text-[#777486]">
                    {sec.totalQuestions || 10} questions •{" "}
                    {sec.createdAt
                      ? new Date(sec.createdAt).toLocaleDateString()
                      : "Recent"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="purple">{sec.accuracy ?? 0}% accuracy</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedReportSessionId(sec._id)}
                    icon={<FileText className="w-3.5 h-3.5" />}
                    title="View Detailed Analysis"
                  >
                    Report
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadSessionPdf(sec._id, sec.topic)}
                    icon={<Download className="w-3.5 h-3.5" />}
                    title="Download PDF Report"
                  >
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#777486] text-center py-4">
            No recent practice sessions recorded yet.
          </p>
        )}
      </Card>

      <PerformanceReportModal
        isOpen={Boolean(selectedReportSessionId)}
        onClose={() => setSelectedReportSessionId(null)}
        sessionId={selectedReportSessionId || ""}
      />
    </div>
  );
};
