import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/ui/Button";
import { CodingOutputPanel } from "../../components/coding/CodingOutputPanel";
import { Badge, DifficultyBadge } from "../../components/ui/Badge";
import { LogoMark } from "../../components/ui/LogoMark";
import {
  Clock,
  Play,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  Save,
  RotateCcw,
  ArrowLeft,
  X,
  Code2,
  AlertTriangle,
} from "lucide-react";
import { CodingLanguage } from "../../shared/types";
import { DEFAULT_STARTER_CODES } from "../../shared/constants";

export const PracticeRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState<any>(location.state?.session || null);
  const [questions, setQuestions] = useState<any[]>(
    location.state?.questions || []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Student answers state: questionId -> answer payload
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Coding states
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [customInput, setCustomInput] = useState("");
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState("results");

  useEffect(() => {
    if (questions.length === 0 && id) {
      api
        .get(`/practice/${id}`)
        .then((res) => {
          if (res.data.success) {
            setSession(res.data.session);
            setQuestions(res.data.questions || []);
            if (Array.isArray(res.data.session?.answers)) {
              const restored: Record<string, any> = {};
              for (const ans of res.data.session.answers) {
                restored[String(ans.questionId)] = ans;
              }
              setAnswersMap(restored);
            }
          }
        })
        .catch(() => navigate("/practice"));
    }
  }, [id, questions.length, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQ = questions[currentIndex];

  useEffect(() => {
    if (!currentQ) return;
    const currentAns = answersMap[currentQ._id];
    if (currentQ.type === "coding") {
      const savedCode = currentAns?.codeSubmission?.code;
      const savedLang = currentAns?.codeSubmission?.language || "python";
      const starterCode =
        currentQ.codingDetails?.starterCode?.[savedLang] ||
        DEFAULT_STARTER_CODES[
          savedLang as keyof typeof DEFAULT_STARTER_CODES
        ] ||
        "";
      setLanguage(savedLang);
      setCode(savedCode?.trim() ? savedCode : starterCode);
    }
    setExecutionResult(null);
  }, [currentIndex, currentQ]);

  const handleOptionSelect = (optionId: string) => {
    const prev = answersMap[currentQ._id]?.selectedOptionIds || [];
    let updated: string[];
    if (currentQ.type === "multiple_select") {
      updated = prev.includes(optionId)
        ? prev.filter((id: string) => id !== optionId)
        : [...prev, optionId];
    } else {
      updated = [optionId];
    }

    setAnswersMap((m) => ({
      ...m,
      [currentQ._id]: {
        questionId: currentQ._id,
        selectedOptionIds: updated,
        timeSpentSeconds: 30,
      },
    }));
  };

  const handleSaveCurrentResponse = () => {
    if (!currentQ) return;
    if (currentQ.type === "coding") {
      setAnswersMap((m) => ({
        ...m,
        [currentQ._id]: {
          questionId: currentQ._id,
          codeSubmission: {
            language,
            code,
            verdict:
              m[currentQ._id]?.codeSubmission?.verdict || "saved_draft",
            testCasesPassed:
              m[currentQ._id]?.codeSubmission?.testCasesPassed || 0,
            totalTestCases:
              m[currentQ._id]?.codeSubmission?.totalTestCases || 0,
          },
          timeSpentSeconds: 45,
        },
      }));
    }
    toast.success("Response saved for this question.");
  };

  const handleResetCode = () => {
    if (!currentQ) return;
    const starterCode =
      currentQ.codingDetails?.starterCode?.[language] ||
      DEFAULT_STARTER_CODES[language] ||
      "";
    setCode(starterCode);
    toast.info(`Reset ${language} starter code.`);
  };

  const handleRunCustomCode = async () => {
    const sourceCode = code.trim()
      ? code
      : currentQ.codingDetails?.starterCode?.[language] ||
        DEFAULT_STARTER_CODES[language];
    if (!sourceCode?.trim()) {
      toast.warning("Add code before running it.");
      return;
    }
    if (!code.trim()) setCode(sourceCode);
    setIsExecuting(true);
    setActiveCodeTab("output");
    try {
      const res = await api.post("/submissions/run", {
        language,
        code: sourceCode,
        stdin:
          customInput.trim() ||
          currentQ.codingDetails?.visibleTestCases?.[0]?.input ||
          "",
      });
      if (res.data.success) {
        setExecutionResult(res.data.result);
      }
    } catch {
      toast.error("Code execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTestCode = async () => {
    const sourceCode = code.trim()
      ? code
      : currentQ.codingDetails?.starterCode?.[language] ||
        DEFAULT_STARTER_CODES[language];
    if (!sourceCode?.trim()) {
      toast.warning("Add code before submitting.");
      return;
    }
    if (!code.trim()) setCode(sourceCode);
    setIsExecuting(true);
    setActiveCodeTab("results");
    try {
      const res = await api.post("/submissions/evaluate", {
        questionId: currentQ._id,
        language,
        code: sourceCode,
        practiceId: id,
      });

      if (res.data.success) {
        const result = res.data.result;
        setExecutionResult(result);

        // Auto-save the evaluated code submission
        setAnswersMap((m) => ({
          ...m,
          [currentQ._id]: {
            questionId: currentQ._id,
            codeSubmission: {
              language,
              code: sourceCode,
              verdict: result.verdict,
              testCasesPassed: result.passedCount,
              totalTestCases: result.totalTestCases,
            },
            timeSpentSeconds: 60,
          },
        }));

        if (result.passedCount === result.totalTestCases) {
          toast.success(
            `All ${result.totalTestCases} test cases passed!`
          );
        } else {
          toast.info(
            `${result.passedCount}/${result.totalTestCases} test cases passed.`
          );
        }
      }
    } catch {
      toast.error("Test evaluation failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCompletePractice = async () => {
    setIsSubmitting(true);
    try {
      handleSaveCurrentResponse();

      const answersPayload = Object.values(answersMap);
      const res = await api.post(`/practice/${id}/submit`, {
        answers: answersPayload,
        timeTakenSeconds: elapsedSeconds,
      });

      if (res.data.success) {
        toast.success("Practice session submitted!");
        navigate(`/practice/${id}/results`, {
          state: {
            session: res.data.session,
            reviewQuestions: res.data.reviewQuestions,
          },
        });
      }
    } catch (err: any) {
      if (err.response?.data?.code === "SESSION_ALREADY_COMPLETED") {
        toast.info("Session already submitted. Viewing results.");
        navigate(`/practice/${id}/results`, {
          state: {
            session: err.response.data.session,
            reviewQuestions: err.response.data.reviewQuestions,
          },
        });
      } else {
        toast.error(
          err.response?.data?.message || "Failed to submit practice"
        );
      }
    } finally {
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  if (!currentQ) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-surface-neutral">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent mx-auto" />
          <p className="text-xs text-text-secondary">Loading practice room...</p>
        </div>
      </div>
    );
  }

  const currentSelectedOptions =
    answersMap[currentQ._id]?.selectedOptionIds || [];
  const savedCount = Object.keys(answersMap).length;

  return (
    <div className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-neutral/90 px-3 py-2 sm:flex-nowrap sm:px-6">
        {/* Left: Brand + Section + Question Counter */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-white px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-neutral hover:text-text-primary"
            title="Exit practice"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="h-4 w-px bg-border-subtle hidden sm:block" />

          <Badge className="hidden sm:inline-flex" variant="purple" size="sm">
            {currentQ.category || "Practice"}
          </Badge>

          <span className="max-w-[30vw] truncate text-xs font-semibold text-text-primary sm:max-w-none">
            {currentQ.topic}
          </span>

          <span className="hidden text-border-subtle sm:inline">•</span>

          <span className="shrink-0 text-[11px] font-medium text-text-secondary sm:text-xs">
            <span className="sm:hidden">Q{currentIndex + 1}/{questions.length}</span>
            <span className="hidden sm:inline">Question {currentIndex + 1} of {questions.length}</span>
          </span>
        </div>

        {/* Right: Palette Toggle + Timer + Submit Button */}
        <div className="flex w-full min-w-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-3">
          <button
            type="button"
            onClick={() => setIsNavigatorOpen((prev) => !prev)}
            className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
              isNavigatorOpen
                ? "border-brand-primary bg-brand-light text-brand-primary"
                : "border-border-subtle bg-white text-text-secondary hover:text-text-primary"
            }`}
          >
            <List className="h-3.5 w-3.5 text-brand-primary" />
            <span>
              <span className="sm:hidden">{savedCount}/{questions.length}</span>
              <span className="hidden sm:inline">{savedCount}/{questions.length} Saved</span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-white px-2.5 py-1.5 font-mono text-[11px] font-semibold text-text-primary shadow-2xs sm:px-3 sm:text-xs">
            <Clock className="w-3.5 h-3.5 text-brand-primary" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSubmitConfirm(true)}
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            <span className="sm:hidden">Submit</span>
            <span className="hidden sm:inline">Submit Practice</span>
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Collapsible Question Palette Sidebar */}
        {isNavigatorOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-64 max-w-[86vw] shrink-0 flex-col justify-between border-r border-border-subtle bg-surface-neutral/95 p-4 shadow-xl backdrop-blur-sm transition-all duration-200 animate-in slide-in-from-left-4 ease-out lg:static lg:z-auto lg:max-w-none lg:bg-surface-neutral/70 lg:shadow-none lg:backdrop-blur-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Question Palette
                </span>
                <button
                  type="button"
                  onClick={() => setIsNavigatorOpen(false)}
                  className="rounded-lg p-1 text-text-muted hover:bg-surface-neutral hover:text-text-primary transition-colors active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {questions.map((q, idx) => {
                  const isAttempted = !!answersMap[q._id];
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q._id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-xl border text-xs flex items-center justify-center transition-all duration-150 active:scale-95 ${
                        isCurrent
                          ? "ring-2 ring-brand-primary font-bold text-brand-primary bg-white border-brand-primary shadow-xs"
                          : isAttempted
                            ? "bg-brand-light text-brand-dark border-brand-accent/50 font-semibold"
                            : "bg-white text-text-secondary border-border-subtle hover:text-text-primary hover:border-brand-accent/30"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border-subtle bg-white p-3 text-[11px] text-text-secondary leading-relaxed">
              <div className="flex items-center gap-2 mb-1 text-text-primary font-semibold">
                <span className="h-2 w-2 rounded-full bg-brand-primary" />
                <span>Adaptive Practice</span>
              </div>
              Saved answers dynamically update your skill proficiency and recommendations.
            </div>
          </aside>
        )}

        {/* Content Area */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          {currentQ.type === "coding" ? (
            /* Coding Split Workspace (LeetCode Style) */
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-12 lg:overflow-hidden">
              {/* Left Panel: Problem Description, Input/Output Format, Sample Test Cases, Constraints */}
              <div className="shrink-0 space-y-5 border-b border-border-subtle bg-white p-5 sm:p-6 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <DifficultyBadge difficulty={currentQ.difficulty} />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {currentQ.subtopic || currentQ.topic}
                  </span>
                </div>

                <h2 className="font-serif text-xl font-medium tracking-tight text-text-primary">
                  {currentQ.title}
                </h2>

                <div className="text-xs sm:text-sm text-text-primary whitespace-pre-line leading-relaxed">
                  {currentQ.description}
                </div>

                {(currentQ.codingDetails?.inputFormat ||
                  currentQ.codingDetails?.outputFormat) && (
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {currentQ.codingDetails?.inputFormat && (
                      <div className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-3.5 text-xs">
                        <div className="font-semibold text-text-primary mb-1">
                          Input Format
                        </div>
                        <div className="text-text-secondary leading-relaxed">
                          {currentQ.codingDetails.inputFormat}
                        </div>
                      </div>
                    )}
                    {currentQ.codingDetails?.outputFormat && (
                      <div className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-3.5 text-xs">
                        <div className="font-semibold text-text-primary mb-1">
                          Output Format
                        </div>
                        <div className="text-text-secondary leading-relaxed">
                          {currentQ.codingDetails.outputFormat}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentQ.codingDetails?.examples?.map(
                  (ex: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-4 text-xs space-y-2"
                    >
                      <span className="font-semibold text-text-primary block">
                        Sample Test Case #{idx + 1}
                      </span>
                      <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-white p-3 font-mono text-xs text-text-primary leading-relaxed">
                        <strong>Input:</strong> {ex.input}
                        {"\n"}
                        <strong>Output:</strong> {ex.output}
                      </pre>
                    </div>
                  )
                )}

                {currentQ.codingDetails?.constraints && (
                  <div className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-4 text-xs">
                    <div className="font-semibold text-text-primary mb-1">
                      Constraints
                    </div>
                    <div className="font-mono text-xs text-text-secondary whitespace-pre-line leading-relaxed">
                      {currentQ.codingDetails.constraints}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Code Editor, Language Selector, Run & Submit, Output Console */}
              <div className="flex min-h-[500px] min-w-0 flex-col overflow-hidden bg-surface-neutral lg:col-span-7 lg:min-h-0">
                {/* Editor Header Toolbar */}
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-white px-4 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text-secondary">
                      Language:
                    </span>
                    <select
                      value={language}
                      onChange={(e) => {
                        const newLang = e.target.value as CodingLanguage;
                        setLanguage(newLang);
                        setCode(
                          currentQ.codingDetails?.starterCode?.[newLang] ||
                            DEFAULT_STARTER_CODES[newLang] ||
                            ""
                        );
                      }}
                      className="rounded-lg border border-border-subtle bg-surface-neutral px-3 py-1.5 font-medium text-text-primary focus:border-brand-primary focus:outline-none"
                    >
                      <option value="python">Python 3</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                      <option value="java">Java 25</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleResetCode}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-neutral hover:text-text-primary"
                      title="Reset code to default template"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunCustomCode}
                      isLoading={isExecuting}
                      icon={<Play className="w-3.5 h-3.5 text-brand-primary" />}
                    >
                      Run Code
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleTestCode}
                      isLoading={isExecuting}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      Submit Code
                    </Button>
                  </div>
                </div>

                {/* Monaco Editor Container */}
                <div className="flex-1 min-h-[220px] bg-white">
                  <Editor
                    height="100%"
                    language={
                      language === "c" || language === "cpp" ? "cpp" : language
                    }
                    value={code}
                    theme="light"
                    onChange={(val) => setCode(val || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      scrollBeyondLastLine: false,
                      tabSize: 4,
                      lineNumbersMinChars: 3,
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>

                {/* Output Console Panel */}
                <div className="h-64 shrink-0">
                  <CodingOutputPanel
                    result={executionResult}
                    activeTab={activeCodeTab}
                    onTabChange={setActiveCodeTab}
                    customInput={customInput}
                    onCustomInputChange={setCustomInput}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* MCQ / Multiple Choice Question Interface */
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 bg-surface-neutral/40">
              <div
                key={currentQ?._id || currentIndex}
                className="mx-auto w-full max-w-3xl rounded-2xl border border-border-subtle bg-white p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in-50 duration-200 ease-out"
              >
                <div className="flex items-center justify-between">
                  <DifficultyBadge difficulty={currentQ.difficulty} />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {currentQ.subtopic || currentQ.topic}
                  </span>
                </div>

                <h2 className="font-serif text-xl font-medium tracking-tight text-text-primary leading-snug">
                  {currentQ.title}
                </h2>
                <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                  {currentQ.description}
                </p>

                <div className="space-y-3 pt-2">
                  {currentQ.options?.map((opt: any) => {
                    const isSelected = currentSelectedOptions.includes(opt.id);
                    const isMulti = currentQ.type === "multiple_select";

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`group w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between transition-all duration-150 ease-out active:scale-[0.99] ${
                          isSelected
                            ? "bg-[#EAF1F9] border-[#5288B8] text-[#3C4B63] font-semibold shadow-xs ring-1 ring-[#5288B8]/30"
                            : "bg-white border-[#E0E5EF] hover:border-[#CFE2DC] hover:bg-[#F7F8FC] text-[#3C4B63]"
                        }`}
                      >
                        <span className="leading-relaxed">{opt.text}</span>
                        <div
                          className={`w-5 h-5 flex items-center justify-center shrink-0 ml-3 transition-all duration-150 border ${
                            isMulti ? "rounded-md" : "rounded-full"
                          } ${
                            isSelected
                              ? "border-[#5288B8] bg-[#5288B8] text-white shadow-xs"
                              : "border-[#D0DDD7] bg-white group-hover:border-[#5288B8]"
                          }`}
                        >
                          {isSelected && (
                            isMulti ? (
                              <Check className="w-3.5 h-3.5 text-white stroke-[3] animate-in zoom-in-75 duration-100" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-75 duration-100" />
                            )
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <footer className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-border-subtle bg-white px-4 sm:px-6">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>

            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveCurrentResponse}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                Save Response
              </Button>

              {currentIndex < questions.length - 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSubmitConfirm(true)}
                isLoading={isSubmitting}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Submit
              </Button>
            </div>
          </footer>
        </main>
      </div>

      {/* Confirmation Modal: Submit Session */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Submit Practice Session?
                </h3>
                <p className="text-xs text-text-secondary">
                  Ready to calculate your score and review detailed solutions.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-neutral p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Total Questions:</span>
                <span className="font-semibold text-text-primary">
                  {questions.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Answers Saved:</span>
                <span className="font-semibold text-[#4C765D]">
                  {savedCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Unattempted:</span>
                <span className="font-semibold text-[#8A7047]">
                  {questions.length - savedCount}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Continue Practice
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleCompletePractice}
              >
                Yes, Submit Practice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Exit Session */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F3E8] text-[#8A7047]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Exit Practice Session?
                </h3>
                <p className="text-xs text-text-secondary">
                  Your saved answers will remain available to resume later.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExitConfirm(false)}
              >
                Stay
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/practice")}
              >
                Exit to Practice Builder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
