import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../context/ToastContext";
import { triggerBlobDownload } from "../../utils/downloadFile";
import { PerformanceReportModal } from "../../components/reports/PerformanceReportModal";
import {
  CheckCircle2,
  Target,
  ArrowRight,
  BookOpen,
  Layers3,
  AlertTriangle,
  Download,
  FileText,
  Loader2,
} from "lucide-react";

export const PracticeResults: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState<any>(location.state?.session || null);
  const [reviewQuestions, setReviewQuestions] = useState<any[]>(
    location.state?.reviewQuestions || []
  );
  const [isLoading, setIsLoading] = useState<boolean>(!session && Boolean(id));

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!session && id) {
      setIsLoading(true);
      api
        .get(`/practice/${id}/result`)
        .then((res) => {
          if (res.data?.success && res.data?.session) {
            setSession(res.data.session);
            setReviewQuestions(res.data.reviewQuestions || []);
          }
        })
        .catch(() => {
          // If session not completed or doesn't exist
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, session]);

  if (isLoading) {
    return (
      <div className="text-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#007AFF] mx-auto" />
        <p className="text-sm text-[#6E6E73]">Loading practice evaluation results...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="display-heading text-2xl text-[#1D1D1F]">
          No recent practice results found
        </h2>
        <Button variant="primary" onClick={() => navigate("/practice")}>
          Start a Practice Session
        </Button>
      </div>
    );
  }

  const accuracy = session.accuracyPercentage || 0;
  const minutes = Math.floor((session.timeTakenSeconds || 0) / 60);
  const seconds = (session.timeTakenSeconds || 0) % 60;
  const sections = session.sections || [];
  const weakSections = sections.filter((sec: any) => {
    const secAcc =
      sec.count > 0 ? Math.round(((sec.correctCount || 0) / sec.count) * 100) : 0;
    return secAcc < 60;
  });

  const handleDownloadReportPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await api.get(`/practice/${session._id}/report/pdf`, {
        responseType: "blob",
      });
      const safeTopic = (session.topic || "Practice").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Evalora-Performance-Report-${safeTopic}-${session._id.slice(-8)}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success("Performance report PDF downloaded successfully.");
    } catch {
      toast.error("Failed to download performance report PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Completion Header (Section 40) */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#E5F1FF] text-[#007AFF] flex items-center justify-center mx-auto border border-[#D6D8F8]">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="display-heading text-4xl text-[#1D1D1F]">
          Practice Session Complete
        </h1>
        <p className="text-sm text-[#6E6E73]">
          Your responses for{" "}
          <span className="font-semibold text-[#1D1D1F]">{session.topic}</span>{" "}
          have been evaluated and your skill profile is updated.
        </p>
      </div>

      {/* Performance Analysis Action Card */}
      <Card pastelAccent="purple" className="border-[#CFE2DC] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#007AFF]" />
              <h3 className="text-sm font-bold text-[#1D1D1F]">
                Performance Analysis
              </h3>
              <Badge variant="purple">Official Report</Badge>
            </div>
            <p className="text-xs text-[#6E6E73] max-w-xl">
              Generate and download your complete academic and placement-readiness diagnostic report, featuring category-wise mastery, topic strengths, areas to improve, and question-level review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportModalOpen(true)}
              icon={<BookOpen className="w-4 h-4" />}
            >
              View Analysis
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadReportPdf}
              isLoading={isDownloadingPdf}
              icon={<Download className="w-4 h-4" />}
            >
              {isDownloadingPdf ? "Generating PDF..." : "Download Performance Report"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Primary Metrics Grid: Overall Score, Accuracy, Time Taken */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card pastelAccent="mint">
          <div className="text-center space-y-1">
            <div className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
              Overall Score
            </div>
            <div className="text-3xl font-semibold text-[#1D1D1F]">
              {session.correctCount} / {session.totalQuestions}
            </div>
            <div className="text-xs text-[#6E6E73]">Questions Solved</div>
          </div>
        </Card>

        <Card pastelAccent="blue">
          <div className="text-center space-y-1">
            <div className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
              Accuracy
            </div>
            <div className="text-3xl font-semibold text-[#007AFF]">
              {accuracy}%
            </div>
            <div className="text-xs text-[#6E6E73]">
              {accuracy >= 75 ? "Strong mastery" : "Continue practicing"}
            </div>
          </div>
        </Card>

        <Card pastelAccent="purple">
          <div className="text-center space-y-1">
            <div className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
              Time Taken
            </div>
            <div className="text-3xl font-semibold text-[#1D1D1F]">
              {minutes}m {seconds}s
            </div>
            <div className="text-xs text-[#6E6E73]">Total Duration</div>
          </div>
        </Card>
      </div>

      {/* Section-wise Breakdown */}
      {sections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-[#007AFF]" />
            Section-wise Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {sections.map((sec: any, i: number) => {
              const secAccuracy =
                sec.count > 0
                  ? Math.round(((sec.correctCount || 0) / sec.count) * 100)
                  : 0;
              return (
                <div
                  key={i}
                  className="p-4 rounded-[14px] border border-[#D2D2D7] bg-white space-y-2.5 shadow-[0_1px_3px_rgba(82,77,119,0.04)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      {sec.topic || sec.category}
                    </span>
                    <Badge variant="purple">{sec.difficulty}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6E6E73]">
                    <span>
                      Score:{" "}
                      <strong className="text-[#1D1D1F]">
                        {sec.correctCount || 0} / {sec.count}
                      </strong>
                    </span>
                    <span>
                      Accuracy:{" "}
                      <strong className="text-[#1D1D1F]">{secAccuracy}%</strong>
                    </span>
                  </div>
                  <div className="w-full bg-[#F5F5F7] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#007AFF] h-1.5 rounded-full"
                      style={{ width: `${secAccuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weak-Area Summary & Next Practice Recommendation */}
      <Card
        pastelAccent={accuracy < 60 ? "rose" : "mint"}
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#007AFF]" /> Weak-Area Summary
              &amp; Next Practice Recommendation
            </span>
            <Badge variant={accuracy < 60 ? "amber" : "green"}>
              {accuracy < 60 ? "Reinforcement Recommended" : "Proficiency Strong"}
            </Badge>
          </div>
        }
      >
        <div className="space-y-3">
          {weakSections.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[#896D45] bg-[#F8F3E8] border border-[#E8D9B9] rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-[#896D45] shrink-0" />
              <span>
                Focus areas identified:{" "}
                <strong>
                  {weakSections
                    .map((s: any) => s.topic || s.category)
                    .join(", ")}
                </strong>
              </span>
            </div>
          )}

          <p className="text-sm text-[#6E6E73] leading-relaxed">
            {accuracy < 60
              ? `You achieved ${accuracy}% accuracy on ${session.topic}. We recommend a targeted session on foundational concepts to strengthen your accuracy.`
              : `Excellent work! With ${accuracy}% accuracy on ${session.topic}, you are ready to advance to higher-difficulty problems or combine additional sections.`}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(
                  `/practice?topic=${encodeURIComponent(
                    session.topic
                  )}&difficulty=${accuracy < 60 ? "easy" : "hard"}&count=10`
                )
              }
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Start Recommended Practice
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/skills")}
            >
              View Skill Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* Question Review & Explanations */}
      {reviewQuestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#007AFF]" />
            Question Review & Explanations
          </h3>

          <div className="space-y-3">
            {reviewQuestions.map((q: any, idx: number) => (
              <Card key={q._id}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1D1D1F]">
                      Q{idx + 1}. {q.title}
                    </span>
                    <Badge variant="purple">{q.difficulty}</Badge>
                  </div>

                  <p className="text-xs text-[#6E6E73] leading-relaxed">
                    {q.description}
                  </p>

                  {q.explanation && (
                    <div className="p-3.5 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F]">
                      <span className="font-semibold text-[#007AFF]">
                        Explanation:{" "}
                      </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {session?._id && (
        <PerformanceReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          sessionId={session._id}
        />
      )}
    </div>
  );
};
