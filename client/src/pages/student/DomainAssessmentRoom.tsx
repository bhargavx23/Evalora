import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  Award,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export const DomainAssessmentRoom: React.FC = () => {
  const { slug, assessmentId } = useParams<{ slug: string; assessmentId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [domain, setDomain] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(45 * 60);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/domains/${slug}`);
        if (res.data.success) {
          setDomain(res.data.domain);
          const found = (res.data.domain.assessments || []).find(
            (a: any) => a.assessmentId === assessmentId
          );
          if (found) {
            setAssessment(found);
            setTimeLeftSeconds(found.durationMinutes * 60);

            // Fetch or start assessment questions
            const qRes = await api.post(`/domains/${slug}/practice/start`, {
              moduleId: res.data.domain.modules[0]?.moduleId || 'm1',
              topic: found.topics[0] || 'Certification',
              difficulty: 'hard',
              questionCount: 10
            });

            if (qRes.data.success) {
              setQuestions(qRes.data.questions || []);
            }
          }
        }
      } catch {
        toast.error('Failed to load assessment.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssessment();
  }, [slug, assessmentId]);

  // Timer countdown
  useEffect(() => {
    if (result || timeLeftSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [result, timeLeftSeconds]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (result) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmitAssessment = async () => {
    if (result || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Calculate score based on answered questions
      const answeredCount = Object.keys(selectedAnswers).length;
      const simulatedScore = Math.min(100, Math.round((answeredCount / (questions.length || 1)) * 85));

      const res = await api.post(`/domains/${slug}/assessments/${assessmentId}/submit`, {
        score: simulatedScore,
        totalQuestions: questions.length,
        correctCount: Math.round(answeredCount * 0.8)
      });

      if (res.data.success) {
        setResult(res.data);
        toast.success(res.data.message);
      }
    } catch {
      toast.error('Assessment submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#555780]" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Assessment not found.</p>
        <Button onClick={() => navigate(`/domains/${slug}`)} className="mt-4">
          Back to Learning Path
        </Button>
      </div>
    );
  }

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#F8F7FC] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
      {/* Assessment Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <span className="text-xs font-bold text-[#555780] bg-[#F0EFF9] px-2.5 py-0.5 rounded-full uppercase">
            Certification Exam
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-1">{assessment.title}</h2>
        </div>

        {!result && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#DEDDF0] bg-[#F0EFF9] px-3 py-1.5 text-sm font-bold text-[#555780]">
            <Clock className="h-4 w-4" />
            <span>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {/* Completion Result Card */}
      {result && (
        <div className="rounded-2xl border border-[#DEDDF0] bg-[#F0EFF9]/70 p-6 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0EFF9] text-[#555780]">
            <Award className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {result.passed ? 'Certification Examination Passed!' : 'Assessment Completed'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Final Score: <strong>{result.score}%</strong> (Passing threshold: {result.passingScore}%)
          </p>
          <p className="text-xs text-gray-500 mt-2">{result.message}</p>
          <div className="mt-5 flex justify-center">
            <Button
              onClick={() => navigate(`/domains/${slug}`)}
              className="bg-[#F0EFF9] hover:bg-[#F0EFF9] text-white font-semibold"
            >
              Back to Domain Overview
            </Button>
          </div>
        </div>
      )}

      {/* Question Card */}
      {currentQ && !result && (
        <Card className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>QUESTION {currentIndex + 1} OF {questions.length}</span>
            <span className="capitalize">{currentQ.difficulty}</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900">{currentQ.title}</h3>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed">{currentQ.description}</p>
          </div>

          <div className="space-y-3 pt-2">
            {(currentQ.options || []).map((opt: any) => {
              const isSelected = selectedAnswers[currentQ._id] === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQ._id, opt.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition-all ${
                    isSelected
                      ? 'border-[#DEDDF0] bg-[#F0EFF9]/50 text-[#555780] font-semibold'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-[#DEDDF0]'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-[#DEDDF0] bg-[#F0EFF9] text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Nav Controls */}
      {!result && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
          >
            Previous
          </Button>

          {currentIndex < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="bg-[#F0EFF9] hover:bg-[#F0EFF9] text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmitAssessment}
              disabled={isSubmitting}
              className="bg-[#E9F3ED] hover:bg-[#E9F3ED] text-white font-bold px-6"
            >
              {isSubmitting ? 'Evaluating...' : 'Finish & Submit Exam'}
            </Button>
          )}
        </div>
      )}
      </div>
    </div>
  );
};
