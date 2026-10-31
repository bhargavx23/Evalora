import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import {
  BookOpen,
  Code2,
  CheckCircle2,
  Clock,
  HelpCircle,
  X,
  Play,
  Lightbulb,
  ExternalLink,
  Loader2,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Compass,
  ArrowRight
} from 'lucide-react';
import { IDomainTopicContent, ITopicExercise, ITopicLesson } from '../../shared/types';

interface TopicLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainSlug: string;
  moduleId: string;
  topic: string;
  onTopicCompleted: () => void;
}

// ---------------------------------------------------------
// Interactive Beginner Code Example Component
// ---------------------------------------------------------
const InteractiveCodeExample: React.FC<{
  example: {
    title: string;
    code: string;
    language: string;
    explanation: string;
    lineByLineExplanation?: Array<{
      line: string | number;
      explanation: string;
    }> | string[];
    expectedResult?: string;
  };
}> = ({ example }) => {
  const [copied, setCopied] = useState(false);
  const [userCode, setUserCode] = useState(example.code);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setUserCode(example.code);
    setShowPreview(false);
  }, [example.code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setUserCode(example.code);
  };

  const lang = (example.language || '').toLowerCase();
  const isWebCode = lang.includes('html') || lang.includes('css') || lang.includes('javascript') || lang.includes('react');

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs">
      {/* Code Card Header */}
      <div className="flex items-center justify-between bg-[#F5F5F7] px-4 py-2.5 text-xs text-[#1D1D1F]">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[#A5B4FC] shrink-0" />
          <span className="font-semibold text-[#5B586D]">{example.title}</span>
          <span className="uppercase text-3xs font-bold text-[#A5B4FC] bg-[#007AFF]/20 px-2 py-0.5 rounded border border-[#007AFF]/40">
            {example.language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isWebCode && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-2xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#D2D2D7] px-2.5 py-1 rounded transition-colors"
            >
              <Play className="h-3 w-3 text-[#719B84]" />
              <span>{showPreview ? 'View Code' : 'Try / Live Preview'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-2xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#D2D2D7] px-2.5 py-1 rounded transition-colors"
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#719B84]" />
                <span className="text-[#719B84] font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-[#8490A2]" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor or Live Preview */}
      {showPreview && isWebCode ? (
        <div className="border-b border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Interactive Live Output</span>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-[#007AFF] hover:text-[#0056CC] text-2xs font-semibold"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to Example</span>
            </button>
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-4 min-h-[110px] overflow-auto shadow-inner">
            <iframe
              title="Example Preview"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:12px;color:#D2D2D7;line-height:1.5;}</style></head><body>${userCode}</body></html>`}
              className="w-full h-32 border-0 bg-transparent"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      ) : (
        <div className="bg-[#F5F5F7] p-4 text-xs font-mono overflow-x-auto leading-relaxed text-[#5B586D] border-b border-[#D2D2D7]">
          <pre><code>{userCode}</code></pre>
        </div>
      )}

      {/* Explanation Banner */}
      <div className="bg-slate-50/80 px-4 py-3 text-xs text-slate-600 border-b border-slate-100 flex items-start gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-[#8A7047] shrink-0 mt-0.5" />
        <p className="leading-relaxed">{example.explanation}</p>
      </div>

      {/* Line-by-Line Breakdown Table */}
      {example.lineByLineExplanation && example.lineByLineExplanation.length > 0 && (
        <div className="bg-white p-4 border-b border-slate-100">
          <h5 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-[#007AFF]" />
            <span>Line-by-Line Breakdown</span>
          </h5>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden text-xs">
            {example.lineByLineExplanation.map((item: any, lIdx: number) => {
              const lineNum = typeof item === 'object' && item?.line !== undefined ? item.line : lIdx + 1;
              const text = typeof item === 'object' && item?.explanation !== undefined ? item.explanation : String(item);
              return (
                <div key={lIdx} className="flex items-start gap-3 p-2.5 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E5F1FF] font-mono text-3xs font-bold text-[#0056CC] border border-[#CFE2DC]">
                    {lineNum}
                  </span>
                  <span className="text-slate-700 leading-relaxed">{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expected Result Visual Card */}
      {example.expectedResult && (
        <div className="bg-slate-50/60 p-4">
          <h5 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#4C765D]" />
            <span>Expected Result</span>
          </h5>
          <div className="rounded-lg border border-[#C6DFD2]/80 bg-[#E5F2EB]/50 p-3 text-xs text-[#4C765D] font-medium">
            {example.expectedResult}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// Main TopicLessonModal Component
// ---------------------------------------------------------
export const TopicLessonModal: React.FC<TopicLessonModalProps> = ({
  isOpen,
  onClose,
  domainSlug,
  moduleId,
  topic,
  onTopicCompleted
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [content, setContent] = useState<IDomainTopicContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [exerciseResults, setExerciseResults] = useState<Record<string, { passed: boolean; feedback: string }>>({});
  const [submittingExId, setSubmittingExId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'exercises'>('lessons');
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !domainSlug || !moduleId || !topic) return;

    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setContent(null);
        setExerciseResults({});
        setSelectedAnswers({});
        setExpandedHints({});

        const res = await api.get(
          `/domains/${domainSlug}/modules/${moduleId}/topics/${encodeURIComponent(topic)}/content`
        );
        if (res.data.success && res.data.content) {
          setContent(res.data.content);

          // Mark already completed exercises
          if (res.data.completedExercises?.length > 0) {
            const resultsMap: Record<string, { passed: boolean; feedback: string }> = {};
            res.data.completedExercises.forEach((ce: any) => {
              resultsMap[ce.exerciseId] = { passed: true, feedback: 'Completed previously' };
            });
            setExerciseResults(resultsMap);
          }
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load topic lessons.');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [isOpen, domainSlug, moduleId, topic]);

  if (!isOpen) return null;

  const handleSelectOption = (exerciseId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [exerciseId]: optionId
    }));
  };

  const toggleHints = (exerciseId: string) => {
    setExpandedHints((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  const handleVerifyExercise = async (ex: ITopicExercise) => {
    setSubmittingExId(ex.exerciseId);
    try {
      const selectedOptionId = selectedAnswers[ex.exerciseId];
      const res = await api.post(
        `/domains/${domainSlug}/modules/${moduleId}/topics/${encodeURIComponent(topic)}/exercises/${ex.exerciseId}/submit`,
        {
          selectedOptionId,
          code: ex.starterCode
        }
      );

      if (res.data.success) {
        setExerciseResults((prev) => ({
          ...prev,
          [ex.exerciseId]: {
            passed: res.data.passed,
            feedback: res.data.feedback
          }
        }));

        if (res.data.passed) {
          toast.success('Exercise completed!');
          if (res.data.topicCompleted) {
            toast.success(`Topic "${topic}" mastered! Progress updated.`);
            onTopicCompleted();
          }
        } else {
          toast.warning(res.data.feedback);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed.');
    } finally {
      setSubmittingExId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#625E75]/35 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAFBFD] shadow-2xl overflow-hidden border border-slate-200 text-slate-800">
        
        {/* Peaceful Light Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F1FF] text-[#007AFF] border border-[#CFE2DC]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xs font-bold uppercase tracking-wider text-[#0056CC] bg-[#E5F1FF] px-2.5 py-0.5 rounded-full border border-[#CFE2DC]">
                  Topic Learning
                </span>
                {content?.estimatedMinutes && (
                  <span className="flex items-center gap-1 text-3xs font-medium text-slate-500">
                    <Clock className="h-3 w-3" /> {content.estimatedMinutes} mins
                  </span>
                )}
                {content?.difficulty && (
                  <span className="text-3xs font-semibold capitalize text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {content.difficulty}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{topic}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#8490A2] hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-[#D2D2D7] bg-white px-6">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'lessons'
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Lessons &amp; Concepts</span>
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'exercises'
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Practical Exercises ({content?.exercises?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
                <p className="text-xs font-medium text-[#6E6E73]">Loading verified lesson content...</p>
              </div>
            </div>
          ) : !content ? (
            <p className="text-center text-sm text-[#6E6E73] py-12">No content available for this topic.</p>
          ) : activeTab === 'lessons' ? (
            /* Tab 1: Progressive Beginner Lessons */
            <div className="space-y-6">
              {/* Topic Overview Banner */}
              <div className="rounded-xl bg-white border border-[#D2D2D7] p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E5F1FF] text-[#007AFF]">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0056CC] mb-1">
                      Topic Overview
                    </h4>
                    <p className="text-sm leading-relaxed text-[#1D1D1F]">{content.overview}</p>
                  </div>
                </div>
              </div>

              {/* Lesson Items */}
              {content.lessons.map((lesson, lIdx) => (
                <div key={lesson.lessonId || lIdx} className="space-y-4 rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-xs">
                  {/* Lesson Heading */}
                  <div className="border-b border-[#D2D2D7] pb-3">
                    <span className="text-3xs font-bold uppercase tracking-wider text-[#0056CC] bg-[#E5F1FF] px-2.5 py-0.5 rounded-full border border-[#CFE2DC]">
                      Step {lIdx + 1}
                    </span>
                    <h3 className="text-base font-bold text-[#1D1D1F] mt-1 flex items-center gap-2">
                      {lesson.title}
                    </h3>
                  </div>

                  {/* 1. What is it? */}
                  <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F] mb-1.5 flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-[#007AFF]" />
                      <span>1. What is it?</span>
                    </h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-[#1D1D1F]">
                      {lesson.whatIsIt || lesson.concept}
                    </p>
                  </div>

                  {/* 2. Why do we need it? */}
                  {(lesson.whyNeeded || lesson.realWorldAnalogy) && (
                    <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F] mb-1.5 flex items-center gap-1.5">
                        <Lightbulb className="h-4 w-4 text-[#8A7047]" />
                        <span>2. Why do we need it?</span>
                      </h4>
                      <p className="text-xs sm:text-sm leading-relaxed text-[#1D1D1F]">
                        {lesson.whyNeeded || `Understanding ${lesson.title} provides the foundation for building real-world web applications and scalable software systems.`}
                      </p>
                    </div>
                  )}

                  {/* 3. Syntax Breakdown / Rules */}
                  {lesson.syntaxBreakdown && (
                    <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F] mb-2 flex items-center gap-1.5">
                        <Code2 className="h-4 w-4 text-[#007AFF]" />
                        <span>3. Syntax &amp; Fundamental Rules</span>
                      </h4>
                      {Array.isArray(lesson.syntaxBreakdown) ? (
                        <div className="space-y-2">
                          {lesson.syntaxBreakdown.map((item: any, sIdx: number) => (
                            <div key={sIdx} className="flex items-start gap-3 rounded-lg border border-[#D2D2D7] bg-white p-2.5 text-xs">
                              <code className="rounded bg-[#E5F1FF] px-2 py-0.5 font-mono text-3xs font-bold text-[#0056CC] shrink-0 border border-[#CFE2DC]">
                                {typeof item === 'object' && item?.element ? item.element : String(item)}
                              </code>
                              <span className="text-[#1D1D1F]">
                                {typeof item === 'object' && item?.explanation ? item.explanation : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm leading-relaxed text-slate-700 font-mono bg-white p-3 rounded-lg border border-slate-200/80">
                          {String(lesson.syntaxBreakdown)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 4. Small Beginner-Friendly Code Examples */}
                  {lesson.codeExamples?.map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-2 pt-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Play className="h-3.5 w-3.5 text-[#4C765D]" />
                        <span>4. Beginner Example: {ex.title}</span>
                      </h4>
                      <InteractiveCodeExample example={ex} />
                    </div>
                  ))}

                  {/* 5. Mental Model / Real-World Analogy */}
                  {lesson.realWorldAnalogy && (
                    <div className="flex items-start gap-3 rounded-xl bg-[#F8F3E8]/70 border border-[#E9DAB5]/70 p-4 text-xs text-[#8A7047]">
                      <Lightbulb className="h-4 w-4 shrink-0 text-[#8A7047] mt-0.5" />
                      <div>
                        <strong className="font-semibold block text-[#8A7047] mb-0.5">Real-World Mental Model</strong>
                        <p className="leading-relaxed">{lesson.realWorldAnalogy}</p>
                      </div>
                    </div>
                  )}

                  {/* 6. Key Takeaways */}
                  {lesson.keyTakeaways?.length > 0 && (
                    <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                        Key Takeaways
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-600">
                        {lesson.keyTakeaways.map((point, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#4C765D] shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Tab 2: Practical Exercises */
            <div className="space-y-6">
              {content.exercises.map((ex, idx) => {
                const result = exerciseResults[ex.exerciseId];
                const isSubmitting = submittingExId === ex.exerciseId;

                return (
                  <div
                    key={ex.exerciseId}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-3xs font-bold uppercase text-slate-600">
                            Exercise {idx + 1}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-3xs font-semibold capitalize ${
                              ex.type === 'coding' ? 'bg-[#E5F1FF] text-[#0056CC]' : 'bg-[#E5F2EB] text-[#4C765D]'
                            }`}
                          >
                            {ex.type.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{ex.title}</h4>
                      </div>

                      {result?.passed && (
                        <span className="flex items-center gap-1 rounded-full bg-[#E5F2EB] border border-[#C6DFD2] px-2.5 py-1 text-2xs font-bold text-[#4C765D]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{ex.instruction}</p>

                    {/* Hints Accordion */}
                    {ex.hints && ex.hints.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleHints(ex.exerciseId)}
                          className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[#8A7047] hover:text-[#8A7047] bg-[#F8F3E8] hover:bg-[#F8F3E8]/80 px-2.5 py-1 rounded-md border border-[#E9DAB5]/80 transition-colors"
                        >
                          <Lightbulb className="h-3 w-3 text-[#8A7047]" />
                          <span>{expandedHints[ex.exerciseId] ? 'Hide Hints' : `Need a Hint? (${ex.hints.length})`}</span>
                        </button>
                        {expandedHints[ex.exerciseId] && (
                          <div className="mt-2 space-y-1.5 rounded-lg border border-[#E9DAB5] bg-[#F8F3E8]/50 p-3 text-xs text-[#8A7047]">
                            {ex.hints.map((hint, hIdx) => (
                              <div key={hIdx} className="flex items-start gap-2">
                                <span className="font-bold text-[#8A7047]">•</span>
                                <span>{hint}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Multiple Choice Options */}
                    {ex.type === 'knowledge_check' && ex.options && (
                      <div className="space-y-2 pt-1">
                        {ex.options.map((opt) => {
                          const isSelected = selectedAnswers[ex.exerciseId] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleSelectOption(ex.exerciseId, opt.id)}
                              className={`w-full text-left rounded-lg p-3 text-xs transition-all border flex items-center justify-between ${
                                isSelected
                                  ? 'border-[#007AFF] bg-[#E5F1FF]/60 text-[#1D1D1F] font-semibold'
                                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-slate-800'
                              }`}
                            >
                              <span>{opt.text}</span>
                              <div
                                className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-[#007AFF] bg-[#007AFF] text-[#1D1D1F]' : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Starter Code Preview for Coding Challenge */}
                    {ex.type === 'coding' && ex.starterCode && (
                      <div className="rounded-lg overflow-hidden border border-[#D2D2D7] bg-[#F5F5F7] p-3 text-xs font-mono text-[#5B586D]">
                        <pre>
                          <code>{ex.starterCode}</code>
                        </pre>
                      </div>
                    )}

                    {/* Result Feedback */}
                    {result && (
                      <div
                        className={`rounded-lg p-3 text-xs border ${
                          result.passed
                            ? 'bg-[#E5F2EB] border-[#C6DFD2] text-[#4C765D]'
                            : 'bg-[#F8F3E8] border-[#E9DAB5] text-[#8A7047]'
                        }`}
                      >
                        <p>{result.feedback}</p>
                      </div>
                    )}

                    {/* Exercise Actions */}
                    <div className="flex items-center justify-between pt-2">
                      {ex.type === 'coding' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            navigate(
                              `/domains/${domainSlug}/workspace?moduleId=${moduleId}&topic=${encodeURIComponent(
                                topic
                              )}&exerciseId=${ex.exerciseId}`
                            );
                          }}
                          icon={<Code2 className="h-3.5 w-3.5" />}
                        >
                          <span>Solve in Code Workspace</span>
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleVerifyExercise(ex)}
                          disabled={!selectedAnswers[ex.exerciseId] || isSubmitting}
                          isLoading={isSubmitting}
                        >
                          <span>Verify Answer</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peaceful Footer */}
        <div className="flex items-center justify-between border-t border-[#D2D2D7] bg-white px-6 py-3.5 text-xs">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {activeTab === 'lessons' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveTab('exercises')}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              <span>Go to Exercises</span>
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                onTopicCompleted();
                onClose();
              }}
              icon={<Check className="h-4 w-4" />}
            >
              <span>Done &amp; Save Progress</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
