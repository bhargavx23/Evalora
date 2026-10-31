import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  HelpCircle,
  Award
} from 'lucide-react';

export const DomainPracticeSession: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const moduleId = searchParams.get('module') || 'mern-m1-web-fundamentals';
  const topic = searchParams.get('topic') || 'Web Fundamentals';

  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  useEffect(() => {
    const startSession = async () => {
      try {
        setIsLoading(true);
        const res = await api.post(`/domains/${slug}/practice/start`, {
          moduleId,
          topic,
          difficulty: 'medium',
          questionCount: 5
        });

        if (res.data.success) {
          setSession(res.data.session);
          setQuestions(res.data.questions || []);
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          toast.error('Subscription required to access domain practice.');
          navigate('/domains');
        } else {
          toast.error('Failed to start practice session.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    startSession();
  }, [slug, moduleId, topic]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (isCompleted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmit = async () => {
    if (!session?._id) return;
    setIsSubmitting(true);
    try {
      const payloadAnswers = questions.map((q) => ({
        questionId: q._id,
        selectedOptionIds: selectedAnswers[q._id] ? [selectedAnswers[q._id]] : []
      }));

      const res = await api.post(`/domains/${slug}/practice/${session._id}/submit`, {
        answers: payloadAnswers
      });

      if (res.data.success) {
        setEvaluationResult(res.data);
        setIsCompleted(true);
        toast.success(`Practice completed! Score: ${res.data.session?.score}%`);
      }
    } catch {
      toast.error('Failed to submit practice answers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#3C648E]" />
        <p className="text-sm font-medium text-gray-500">
          Generating AI question session for {topic}...
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No questions available for this topic.</p>
        <Button onClick={() => navigate(`/domains/${slug}`)} className="mt-4">
          Back to Curriculum
        </Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const reviewQuestion = evaluationResult?.reviewQuestions?.find(
    (rq: any) => rq._id === currentQ._id
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <Link
          to={`/domains/${slug}`}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#3C648E]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Practice</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#EAF1F9] px-3 py-1 text-xs font-bold text-[#3C648E]">
            {topic}
          </span>
          <span className="text-xs text-gray-400">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      {/* Results Banner if completed */}
      {isCompleted && (
        <div className="rounded-2xl border border-[#C8DFD1] bg-[#E5F2EB]/80 p-6 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E5F2EB] text-[#527565]">
            <Award className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Session Completed!</h2>
          <p className="text-sm text-gray-600 mt-1">
            You scored <strong>{evaluationResult?.session?.score}%</strong> (
            {evaluationResult?.session?.correctCount} / {questions.length} correct)
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              onClick={() => navigate(`/domains/${slug}`)}
              className="bg-[#EAF1F9] hover:bg-[#EAF1F9] text-white font-semibold text-sm"
            >
              Return to Learning Path
            </Button>
          </div>
        </div>
      )}

      {/* Question Card */}
      <Card className="p-6 md:p-8 space-y-6 border-gray-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase font-semibold tracking-wider">
              {currentQ.category || 'Domain Track'}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600 capitalize">
              {currentQ.difficulty}
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">{currentQ.title}</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{currentQ.description}</p>
        </div>

        {/* Options List with proper radio state */}
        <div className="space-y-3 pt-2">
          {(currentQ.options || []).map((opt: any) => {
            const isSelected = selectedAnswers[currentQ._id] === opt.id;
            const reviewOpt = reviewQuestion?.options?.find((o: any) => o.id === opt.id);
            const isCorrectOption = reviewOpt?.isCorrect;

            let optStyle = 'border-gray-200 bg-white text-gray-800 hover:border-[#CFE2DC]';
            if (isSelected) {
              optStyle = 'border-[#CFE2DC] bg-[#EAF1F9]/50 text-[#3C648E] font-medium shadow-xs';
            }
            if (isCompleted) {
              if (isCorrectOption) {
                optStyle = 'border-[#C8DFD1] bg-[#E5F2EB] text-[#527565] font-semibold';
              } else if (isSelected && !isCorrectOption) {
                optStyle = 'border-[#E8CFD2] bg-[#F8EDEF] text-[#9A646D]';
              }
            }

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectOption(currentQ._id, opt.id)}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 text-sm transition-all ${optStyle}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? 'border-[#CFE2DC] bg-[#EAF1F9] text-white'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span>{opt.text}</span>
                </div>
                {isCompleted && isCorrectOption && (
                  <span className="text-xs font-bold text-[#527565]">Correct Answer</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation Card in review mode */}
        {isCompleted && reviewQuestion?.explanation && (
          <div className="mt-4 rounded-xl border border-[#CFE2DC] bg-[#EAF1F9]/60 p-4 text-xs text-gray-700">
            <strong className="block text-[#3C648E] font-bold mb-1">Concept Explanation:</strong>
            {reviewQuestion.explanation}
          </div>
        )}
      </Card>

      {/* Bottom Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
          className="flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Previous</span>
        </Button>

        <div className="flex items-center gap-2">
          {currentIndex < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="bg-[#EAF1F9] hover:bg-[#EAF1F9] text-white flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            !isCompleted && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#E5F2EB] hover:bg-[#E5F2EB] text-white font-bold px-6"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answers'}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
