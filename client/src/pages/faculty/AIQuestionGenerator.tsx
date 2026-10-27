import React, { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, DifficultyBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Edit,
  Eye,
  ArrowRight,
  BookOpen,
  Code2,
  Check,
  Trash2
} from 'lucide-react';
import { TOPICS } from '../../shared/constants';
import { DifficultyLevel } from '../../shared/types';

export const AIQuestionGenerator: React.FC = () => {
  const toast = useToast();

  const [topic, setTopic] = useState('Dynamic Programming');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [type, setType] = useState<'mcq' | 'coding'>('coding');
  const [count, setCount] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated draft questions
  const [draftQuestions, setDraftQuestions] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post('/questions/ai-generate', {
        topic,
        difficulty,
        type,
        count
      });

      if (res.data.success) {
        const questionsList = res.data.drafts || res.data.questions || [];
        toast.success(
          res.data.message ||
            `Generated ${questionsList.length} draft questions! Please review below.`
        );
        setDraftQuestions(questionsList);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await api.post(`/questions/${id}/approve`);
      if (res.data.success) {
        toast.success('Question approved and added to verified bank!');
        setDraftQuestions(prev => prev.filter(q => q._id !== id));
      }
    } catch {
      toast.error('Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.delete(`/questions/${id}`);
      toast.info('Draft question rejected and discarded');
      setDraftQuestions(prev => prev.filter(q => q._id !== id));
    } catch {
      toast.error('Rejection failed');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    try {
      const res = await api.put(`/questions/${editingQuestion._id}`, editingQuestion);
      if (res.data.success) {
        toast.success('Draft question updated');
        setDraftQuestions(prev =>
          prev.map(q => (q._id === editingQuestion._id ? editingQuestion : q))
        );
        setEditingQuestion(null);
      }
    } catch {
      toast.error('Save failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8E1F4] text-[#555780] text-xs font-semibold mb-2">
          <Bot className="w-3.5 h-3.5 text-[#7779C5]" />
          AI Curriculum Assistant (Draft Workflow)
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">AI Question Generator</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Generate structured assessment questions with starter code, constraints, test cases, and explanations. All AI content is created in Draft status for faculty review and verification.
        </p>
      </div>

      {/* Generator Configuration Form */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800">1. Generation Parameters</span>
            <Badge variant="purple">Google Gemini / Academic Engine</Badge>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Domain / Topic</label>
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {TOPICS.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Difficulty Level</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as DifficultyLevel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="easy">Easy (Foundational)</option>
              <option value="medium">Medium (Standard Placement)</option>
              <option value="hard">Hard (Advanced / Competitive)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Question Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="coding">Coding Challenge</option>
              <option value="mcq">Multiple Choice Question</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Number of Questions</label>
            <select
              value={count}
              onChange={e => setCount(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="1">1 Question</option>
              <option value="2">2 Questions</option>
              <option value="3">3 Questions</option>
              <option value="5">5 Questions</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] leading-5 text-gray-400">
            Strict human-in-the-loop review enabled. Drafts require faculty sign-off.
          </span>
          <Button
            variant="secondary"
            size="md"
            onClick={handleGenerate}
            isLoading={isGenerating}
            className="w-full justify-center sm:w-auto"
            icon={<Bot className="w-4 h-4 text-[#7779C5]" />}
          >
            {isGenerating ? 'Synthesizing Questions...' : 'Generate Draft Questions'}
          </Button>
        </div>
      </Card>

      {/* Review Section */}
      <div className="space-y-4">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-bold text-gray-900">
            <BookOpen className="w-4 h-4 text-[#555780]" />
            <span className="break-words">Generated Draft Review Pool ({draftQuestions.length})</span>
          </h3>
          {draftQuestions.length > 0 && (
            <Badge variant="amber">Pending Faculty Sign-off</Badge>
          )}
        </div>

        {draftQuestions.map((draft, idx) => (
          <Card key={draft._id} pastelAccent="purple" padding="sm">
            <div className="min-w-0 space-y-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DifficultyBadge difficulty={draft.difficulty} />
                    <Badge variant="purple">{draft.topic}</Badge>
                    <Badge variant="neutral">{draft.subtopic}</Badge>
                    <Badge variant="amber">Status: Draft</Badge>
                  </div>
                  <h4 className="mt-1 break-words text-base font-bold text-gray-900">{draft.title}</h4>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full min-w-0 justify-center px-2 sm:w-auto sm:px-3"
                    onClick={() => setEditingQuestion({ ...draft })}
                    icon={<Edit className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full min-w-0 justify-center px-2 sm:w-auto sm:px-3"
                    onClick={() => handleReject(draft._id)}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    className="col-span-2 w-full min-w-0 justify-center px-2 sm:col-span-1 sm:w-auto sm:px-3"
                    onClick={() => handleApprove(draft._id)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#527565]" />}
                  >
                    <span className="sm:hidden">Approve</span>
                    <span className="hidden sm:inline">Approve to Bank</span>
                  </Button>
                </div>
              </div>

              <div className="break-words rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 whitespace-pre-line">
                {draft.description}
              </div>

              {draft.type === 'coding' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-800">Test Cases:</span>
                    <div className="text-gray-600 text-[11px]">
                      Visible: {draft.codingDetails?.visibleTestCases?.length ?? 0} &bull; Hidden: {draft.codingDetails?.hiddenTestCases?.length ?? 0}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-800">Supported Languages:</span>
                    <div className="text-gray-600 text-[11px]">
                      C, C++, Python 3, Java 25
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-800">Options:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {draft.options?.map((opt: any) => (
                      <div
                        key={opt.id}
                        className={`flex min-w-0 items-start justify-between gap-2 rounded-lg border p-2 text-xs ${
                          opt.isCorrect
                            ? 'bg-[#DCEFE8] border-[#C8DFD1] font-bold text-[#527565]'
                            : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="min-w-0 flex-1 break-words leading-5">{opt.text}</span>
                        {opt.isCorrect && <Badge className="shrink-0" size="sm" variant="green">Correct</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {draft.explanation && (
                <div className="break-words rounded-lg border border-[#DEDDF0] bg-[#F0EFF9]/50 p-2.5 text-xs text-[#555780]">
                  <span className="font-bold">Explanation: </span>
                  {draft.explanation}
                </div>
              )}
            </div>
          </Card>
        ))}

        {draftQuestions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-xs text-gray-400 space-y-2">
            <Bot className="w-8 h-8 text-[#7779C5]/40 mx-auto" />
            <p className="font-semibold text-gray-700">No Drafts in Queue</p>
            <p>Configure parameters above and click "Generate Draft Questions" to begin.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingQuestion && (
        <Modal
          isOpen={!!editingQuestion}
          onClose={() => setEditingQuestion(null)}
          title="Edit Draft Question"
          maxWidth="xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setEditingQuestion(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={editingQuestion.title}
                onChange={e => setEditingQuestion({ ...editingQuestion, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                rows={4}
                value={editingQuestion.description}
                onChange={e => setEditingQuestion({ ...editingQuestion, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Explanation</label>
              <textarea
                rows={2}
                value={editingQuestion.explanation}
                onChange={e => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
