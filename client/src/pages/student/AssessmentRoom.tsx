import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/ui/Button";
import { CodingOutputPanel } from "../../components/coding/CodingOutputPanel";
import {
  Badge,
  DifficultyBadge,
  VerdictBadge,
} from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import {
  Clock,
  ShieldAlert,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  Send,
  Maximize,
  AlertTriangle,
  RotateCcw,
  Check,
  Terminal,
  List,
} from "lucide-react";
import { CodingLanguage } from "../../shared/types";
import { DEFAULT_STARTER_CODES } from "../../shared/constants";

export const AssessmentRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Active answer states
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [isMarkedForReview, setIsMarkedForReview] = useState(false);

  // Code execution states
  const [customInput, setCustomInput] = useState("");
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<
    "problem" | "custom_input" | "results"
  >("problem");

  // Anti-cheating telemetry states
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showIntegrityWarning, setShowIntegrityWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [timeRemainingSeconds, setTimeRemainingSeconds] =
    useState<number>(3600);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // 1. Initialize or resume attempt
  useEffect(() => {
    if (!id) return;

    api
      .post(`/assessments/${id}/start`)
      .then((res) => {
        if (res.data.success) {
          setAttempt(res.data.attempt);
          setQuestions(res.data.questions);

          // Fetch full assessment rules
          api.get(`/assessments/${id}`).then((assRes) => {
            if (assRes.data.success) {
              setAssessment(assRes.data.assessment);
            }
          });

          // Calculate server timer
          const expires = new Date(res.data.attempt.expiresAt).getTime();
          const now = Date.now();
          const rem = Math.max(0, Math.floor((expires - now) / 1000));
          setTimeRemainingSeconds(rem);
        }
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Failed to start assessment",
        );
        navigate("/assessments");
      })
      .finally(() => setIsLoading(false));
  }, [id, navigate, toast]);

  // 2. Synchronized timer countdown
  useEffect(() => {
    if (timeRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true); // Auto-submit on expiration
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemainingSeconds]);

  // Format timer string MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 3. Sync current question state when index changes
  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    if (!currentQuestion || !attempt) return;

    const answer = attempt.answers?.find(
      (a: any) => a.questionId.toString() === currentQuestion._id.toString(),
    );

    if (answer) {
      setSelectedOptions(answer.selectedOptionIds || []);
      setIsMarkedForReview(!!answer.isMarkedForReview);
      if (currentQuestion.type === "coding") {
        const savedCode = answer.codeSubmission?.code;
        const savedLang = answer.codeSubmission?.language || "python";
        const starterCode =
          currentQuestion.codingDetails?.starterCode?.[savedLang] ||
          DEFAULT_STARTER_CODES[savedLang as keyof typeof DEFAULT_STARTER_CODES] ||
          "";
        setLanguage(savedLang);
        setCode(savedCode?.trim() ? savedCode : starterCode);
      }
    } else {
      setSelectedOptions([]);
      setIsMarkedForReview(false);
      if (currentQuestion.type === "coding") {
        setLanguage("python");
        setCode(currentQuestion.codingDetails?.starterCode?.python || DEFAULT_STARTER_CODES.python);
      }
    }
    setExecutionResult(null);
  }, [currentQuestionIndex, currentQuestion, attempt]);

  // 4. Autosave handler
  const saveCurrentAnswer = useCallback(
    async (
      overrideOptions?: string[],
      overrideCode?: string,
      overrideLang?: CodingLanguage,
      overrideReview?: boolean,
    ) => {
      if (!attempt || !currentQuestion) return;

      setIsSaving(true);
      try {
        const payload: any = {
          attemptId: attempt._id,
          questionId: currentQuestion._id,
          isMarkedForReview:
            overrideReview !== undefined ? overrideReview : isMarkedForReview,
        };

        if (currentQuestion.type === "coding") {
          payload.codeSubmission = {
            language: overrideLang || language,
            code: overrideCode !== undefined ? overrideCode : code,
          };
        } else {
          payload.selectedOptionIds =
            overrideOptions !== undefined ? overrideOptions : selectedOptions;
        }

        await api.post(`/assessments/${id}/autosave`, payload);

        // Update local attempt answer list
        setAttempt((prev: any) => {
          if (!prev) return prev;
          const updatedAnswers = [...prev.answers];
          const idx = updatedAnswers.findIndex(
            (a: any) =>
              a.questionId.toString() === currentQuestion._id.toString(),
          );
          if (idx !== -1) {
            if (payload.selectedOptionIds !== undefined) {
              updatedAnswers[idx].selectedOptionIds = payload.selectedOptionIds;
              updatedAnswers[idx].isAttempted =
                payload.selectedOptionIds.length > 0;
            }
            if (payload.codeSubmission !== undefined) {
              updatedAnswers[idx].codeSubmission = payload.codeSubmission;
              updatedAnswers[idx].isAttempted =
                payload.codeSubmission.code.trim().length > 0;
            }
            if (payload.isMarkedForReview !== undefined) {
              updatedAnswers[idx].isMarkedForReview = payload.isMarkedForReview;
            }
          }
          return { ...prev, answers: updatedAnswers };
        });
      } catch (err) {
        console.error("Autosave error", err);
      } finally {
        setIsSaving(false);
      }
    },
    [
      attempt,
      currentQuestion,
      id,
      isMarkedForReview,
      language,
      code,
      selectedOptions,
    ],
  );

  // 5. Anti-Cheating Telemetry Listeners
  useEffect(() => {
    if (!attempt || !id) return;

    const recordEvent = (type: string, details: string) => {
      api
        .post(`/assessments/${id}/integrity-event`, {
          attemptId: attempt._id,
          type,
          details,
        })
        .catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setWarningMessage(
          "Tab switch detected! Continued tab switches will be flagged to proctors.",
        );
        setShowIntegrityWarning(true);
        recordEvent(
          "tab_switch",
          "User switched browser tabs or minimized window",
        );
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setWarningMessage("Copying assessment content is restricted.");
      setShowIntegrityWarning(true);
      recordEvent("copy_attempt", "User attempted to copy content");
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (currentQuestion?.type !== "coding") {
        e.preventDefault();
        setWarningMessage("Pasting content is restricted.");
        setShowIntegrityWarning(true);
        recordEvent("paste_attempt", "User attempted to paste content");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [attempt, id, currentQuestion]);

  // Handle Option selection
  const handleOptionSelect = (optionId: string) => {
    let newSelection: string[];
    if (currentQuestion.type === "multiple_select") {
      newSelection = selectedOptions.includes(optionId)
        ? selectedOptions.filter((id) => id !== optionId)
        : [...selectedOptions, optionId];
    } else {
      newSelection = [optionId];
    }
    setSelectedOptions(newSelection);
    saveCurrentAnswer(newSelection);
  };

  // Handle Code Run (Custom input)
  const handleRunCode = async () => {
    const sourceCode = code.trim()
      ? code
      : currentQuestion.codingDetails?.starterCode?.[language] || DEFAULT_STARTER_CODES[language];
    if (!sourceCode?.trim()) {
      toast.warning("Add code before running it.");
      return;
    }
    if (!code.trim()) setCode(sourceCode);
    setIsExecuting(true);
    setActiveCodeTab("results");
    try {
      const res = await api.post("/submissions/run", {
        language,
        code: sourceCode,
        stdin:
          customInput ||
          currentQuestion.codingDetails?.visibleTestCases?.[0]?.input ||
          "",
      });
      if (res.data.success) {
        setExecutionResult(res.data.result);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Execution error");
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Code Submission (Evaluates against test cases)
  const handleEvaluateCode = async () => {
    const sourceCode = code.trim()
      ? code
      : currentQuestion.codingDetails?.starterCode?.[language] || DEFAULT_STARTER_CODES[language];
    if (!sourceCode?.trim()) {
      toast.warning("Add code before submitting it.");
      return;
    }
    if (!code.trim()) setCode(sourceCode);
    setIsExecuting(true);
    setActiveCodeTab("results");
    try {
      const res = await api.post("/submissions/evaluate", {
        questionId: currentQuestion._id,
        language,
        code: sourceCode,
        assessmentId: id,
      });
      if (res.data.success) {
        setExecutionResult(res.data.result);
        toast.success(
          `${res.data.result.passedCount}/${res.data.result.totalTestCases} Test Cases Passed`,
        );
        // Autosave answer
        saveCurrentAnswer(undefined, code, language);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Evaluation failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Final submit
  const handleFinalSubmit = async (auto = false) => {
    setIsSubmitting(true);
    try {
      // Save last question before submitting
      await saveCurrentAnswer();
      const res = await api.post(`/assessments/${id}/submit`, {
        attemptId: attempt._id,
      });
      if (res.data.success) {
        toast.success(
          auto
            ? "Time limit expired. Assessment auto-submitted."
            : "Assessment submitted successfully!",
        );
        navigate("/results");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  if (isLoading || !currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#DEDDF0] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500">
            Loading your secure assessment environment...
          </p>
        </div>
      </div>
    );
  }

  // Answer status for question palette
  const getQuestionStatus = (qId: string) => {
    const ans = attempt?.answers?.find(
      (a: any) => a.questionId.toString() === qId.toString(),
    );
    if (ans?.isMarkedForReview) return "review";
    if (ans?.isAttempted) return "answered";
    return "unanswered";
  };

  return (
    <div className="flex h-screen w-screen max-w-full flex-col overflow-hidden bg-white select-none">
      {/* Distraction-Free Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-[#FAFAF8] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-gray-900">
              {assessment?.title || "Assessment"}
            </span>
            <Badge variant="neutral">
              Q{currentQuestionIndex + 1} of {questions.length}
            </Badge>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 border-l border-gray-200 pl-4">
            <Save
              className={`w-3.5 h-3.5 ${isSaving ? "text-[#896D45] animate-spin" : "text-[#527565]"}`}
            />
            <span>{isSaving ? "Autosaving..." : "All changes saved"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 md:hidden"
            onClick={() => setIsPaletteOpen((prev) => !prev)}
            aria-expanded={isPaletteOpen}
          >
            <List className="h-3.5 w-3.5" />
            Questions
          </button>
          {/* Synchronized Timer */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold ${
              timeRemainingSeconds < 300
                ? "bg-[#F4D8D8] border-[#E8CFD2] text-[#9A646D] animate-pulse"
                : "bg-white border-gray-200 text-gray-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(timeRemainingSeconds)}</span>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowSubmitConfirm(true)}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Finish & Submit
          </Button>
        </div>
      </header>

      {/* Main Split Interface */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left Side / Question Palette Navigator */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-gray-200 bg-[#FAFAF8] p-4 md:flex">
          <div className="space-y-4">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Question Palette
            </div>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const status = getQuestionStatus(q._id);
                const isCurrent = idx === currentQuestionIndex;

                let btnStyle =
                  "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
                if (status === "answered") {
                  btnStyle =
                    "bg-[#DCEFE8] text-[#527565] border-[#C8DFD1] font-bold";
                } else if (status === "review") {
                  btnStyle =
                    "bg-[#F7E6B5] text-[#896D45] border-[#E8D9B9] font-bold";
                }

                if (isCurrent) {
                  btnStyle += " ring-2 ring-[#7779C5] font-extrabold";
                }

                return (
                  <button
                    key={q._id}
                    onClick={() => {
                      saveCurrentAnswer();
                      setCurrentQuestionIndex(idx);
                    }}
                    className={`h-9 rounded-lg border text-xs flex items-center justify-center transition-all ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-4 border-t border-gray-200 space-y-2 text-[11px] text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-[#DCEFE8] border border-[#C8DFD1]" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-[#F7E6B5] border border-[#E8D9B9]" />
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-white border border-gray-200" />
                <span>Not Visited</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 text-[11px] text-gray-400">
            Integrity Monitoring Active
          </div>
        </aside>

        {isPaletteOpen && (
          <div className="shrink-0 border-b border-gray-200 bg-[#FAFAF8] p-4 md:hidden">
            <div className="grid grid-cols-6 gap-2">
              {questions.map((q, idx) => {
                const status = getQuestionStatus(q._id);
                const isCurrent = idx === currentQuestionIndex;
                const statusStyle =
                  status === "answered"
                    ? "border-[#C8DFD1] bg-[#DDEFE7] text-[#527565]"
                    : status === "review"
                      ? "border-[#E8D9B9] bg-[#F4EAC5] text-[#896D45]"
                      : "border-stone-200 bg-white text-gray-700";
                return (
                  <button
                    key={q._id}
                    type="button"
                    onClick={() => {
                      saveCurrentAnswer();
                      setCurrentQuestionIndex(idx);
                      setIsPaletteOpen(false);
                    }}
                    className={`h-9 rounded-md border text-xs font-medium ${statusStyle} ${isCurrent ? "ring-2 ring-[#7779C5]" : ""}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Center / Question & Coding Workspace */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {currentQuestion.type === "coding" ? (
            /* Coding Split Workspace */
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-12 lg:overflow-hidden">
              {/* Problem Description Panel */}
              <div className="shrink-0 space-y-4 border-b border-gray-200 bg-white p-4 sm:p-6 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DifficultyBadge difficulty={currentQuestion.difficulty} />
                    <span className="text-xs font-semibold text-gray-500">
                      {currentQuestion.topic}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#555780] bg-[#F0EFF9] px-2 py-0.5 rounded border border-[#DEDDF0]">
                    {currentQuestion.marks || 15} Marks
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {currentQuestion.title}
                  </h2>
                  <div className="prose prose-sm text-xs text-gray-700 mt-2 whitespace-pre-line leading-relaxed">
                    {currentQuestion.description}
                  </div>
                </div>

                {currentQuestion.codingDetails?.inputFormat && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900">
                      Input Format:
                    </h4>
                    <pre className="p-2.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-800 border border-gray-200 whitespace-pre-wrap">
                      {currentQuestion.codingDetails.inputFormat}
                    </pre>
                  </div>
                )}

                {currentQuestion.codingDetails?.outputFormat && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900">
                      Output Format:
                    </h4>
                    <pre className="p-2.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-800 border border-gray-200 whitespace-pre-wrap">
                      {currentQuestion.codingDetails.outputFormat}
                    </pre>
                  </div>
                )}

                {currentQuestion.codingDetails?.examples?.map(
                  (ex: any, idx: number) => (
                    <div
                      key={idx}
                      className="space-y-1.5 p-3 rounded-lg bg-[#FAFAF8] border border-gray-200 text-xs"
                    >
                      <div className="font-bold text-gray-800">
                        Example {idx + 1}:
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-gray-500">Input:</span>
                          <div className="p-1.5 bg-white rounded border border-gray-200 mt-0.5 whitespace-pre-wrap">
                            {ex.input}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Output:</span>
                          <div className="p-1.5 bg-white rounded border border-gray-200 mt-0.5 whitespace-pre-wrap">
                            {ex.output}
                          </div>
                        </div>
                      </div>
                      {ex.explanation && (
                        <div className="text-[11px] text-gray-500 mt-1">
                          <span className="font-semibold">Explanation:</span>{" "}
                          {ex.explanation}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              {/* Editor & Execution Panel */}
              <div className="flex min-h-[520px] min-w-0 flex-col overflow-hidden bg-gray-50 lg:col-span-7 lg:min-h-0">
                {/* Editor Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600">
                      Language:
                    </span>
                    <select
                      value={language}
                      onChange={(e) => {
                        const newLang = e.target.value as CodingLanguage;
                        setLanguage(newLang);
                        const defaultCode =
                          currentQuestion.codingDetails?.starterCode?.[
                            newLang
                          ] || DEFAULT_STARTER_CODES[newLang];
                        setCode(defaultCode);
                        saveCurrentAnswer(undefined, defaultCode, newLang);
                      }}
                      className="px-2 py-1 bg-white border border-gray-300 rounded font-medium focus:ring-1 focus:ring-[#7779C5] focus:outline-none"
                    >
                      <option value="python">Python 3</option>
                      <option value="cpp">C++ (g++)</option>
                      <option value="c">C (gcc)</option>
                      <option value="java">Java 25</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunCode}
                      isLoading={isExecuting}
                      icon={<Play className="w-3.5 h-3.5 text-[#555780]" />}
                    >
                      Run Code
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={handleEvaluateCode}
                      isLoading={isExecuting}
                      icon={<Check className="w-3.5 h-3.5 text-[#527565]" />}
                    >
                      Submit Code
                    </Button>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-[250px] relative">
                  <Editor
                    height="100%"
                    language={
                      language === "c" || language === "cpp" ? "cpp" : language
                    }
                    value={code}
                    theme="light"
                    onChange={(val) => {
                      setCode(val || "");
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                    }}
                  />
                </div>

                <CodingOutputPanel
                  result={executionResult}
                  activeTab={activeCodeTab}
                  onTabChange={tab => setActiveCodeTab(tab as "results" | "problem" | "custom_input")}
                  customInput={customInput}
                  onCustomInputChange={setCustomInput}
                />
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DifficultyBadge difficulty={currentQuestion.difficulty} />
                    <span className="text-xs font-semibold text-gray-500">{currentQuestion.topic}</span>
                  </div>
                  <span className="rounded border border-[#DEDDF0] bg-[#F0EFF9] px-2.5 py-1 text-xs font-bold text-[#555780]">
                    {currentQuestion.marks || 1} Marks
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold leading-snug text-gray-900">{currentQuestion.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{currentQuestion.description}</p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {currentQuestion.options?.map((opt: any) => {
                    const isSelected = selectedOptions.includes(opt.id);
                    const isMulti = currentQuestion.type === "multiple_select";
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-xs transition-all duration-150 ${
                          isSelected
                            ? "border-[#7779C5] bg-[#F0EFF9] font-semibold text-[#49465B] shadow-xs ring-1 ring-[#7779C5]/30"
                            : "border-[#E9E7F0] bg-white text-[#49465B] hover:border-[#DEDDF0] hover:bg-[#F8F7FC]"
                        }`}
                      >
                        <span className="leading-relaxed">{opt.text}</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center shrink-0 ml-3 transition-all duration-150 border ${
                            isMulti ? "rounded-md" : "rounded-full"
                          } ${
                            isSelected
                              ? "border-[#7779C5] bg-[#7779C5] text-white shadow-xs"
                              : "border-[#D4D4E0] bg-white"
                          }`}
                        >
                          {isSelected && (
                            isMulti ? (
                              <Check className="h-3 w-3 text-white stroke-[3] animate-in zoom-in-75 duration-100" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-in zoom-in-75 duration-100" />
                            )
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuestionIndex === 0}
                onClick={() => {
                  saveCurrentAnswer();
                  setCurrentQuestionIndex((prev) => prev - 1);
                }}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>

              <button
                type="button"
                onClick={() => {
                  const nextReview = !isMarkedForReview;
                  setIsMarkedForReview(nextReview);
                  saveCurrentAnswer(
                    undefined,
                    undefined,
                    undefined,
                    nextReview,
                  );
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isMarkedForReview
                    ? "bg-[#F7E6B5] border-[#E8D9B9] text-[#896D45] font-bold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {isMarkedForReview
                  ? "★ Marked for Review"
                  : "☆ Mark for Review"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    saveCurrentAnswer();
                    setCurrentQuestionIndex((prev) => prev + 1);
                  }}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Save & Next
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowSubmitConfirm(true)}
                  icon={<Send className="w-4 h-4" />}
                >
                  Review & Submit Exam
                </Button>
              )}
            </div>
          </footer>
        </main>
      </div>

      {/* Integrity Violation Warning Modal */}
      {showIntegrityWarning && (
        <Modal
          isOpen={showIntegrityWarning}
          onClose={() => setShowIntegrityWarning(false)}
          title="Suspicious Activity Logged"
          footer={
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowIntegrityWarning(false)}
            >
              I Understand & Resume Assessment
            </Button>
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <div className="p-3 bg-[#F4D8D8]/50 rounded-xl border border-[#E8CFD2] text-[#9A646D] flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-[#9A646D] shrink-0" />
              <span>{warningMessage}</span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              This event has been documented on the faculty live proctoring
              dashboard. Please remain in fullscreen mode and avoid switching
              applications to preserve assessment integrity.
            </p>
          </div>
        </Modal>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <Modal
          isOpen={showSubmitConfirm}
          onClose={() => setShowSubmitConfirm(false)}
          title="Confirm Assessment Submission"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Continue Exam
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isSubmitting}
                onClick={() => handleFinalSubmit(false)}
              >
                Yes, Final Submit
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-gray-700">
            <p>
              Are you sure you want to submit? You cannot change your responses
              once submitted.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1 text-gray-600">
              <div>
                Total Questions:{" "}
                <span className="font-bold">{questions.length}</span>
              </div>
              <div>
                Answered:{" "}
                <span className="font-bold text-[#527565]">
                  {attempt?.answers?.filter((a: any) => a.isAttempted).length ||
                    0}
                </span>
              </div>
              <div>
                Marked for Review:{" "}
                <span className="font-bold text-[#896D45]">
                  {attempt?.answers?.filter((a: any) => a.isMarkedForReview)
                    .length || 0}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
