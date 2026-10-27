import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, DifficultyBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  BookOpen,
  PlusCircle,
  Bot,
  Search,
  Filter,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Code2
} from 'lucide-react';
import { TOPICS } from '../../shared/constants';

export const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected question modal
  const [inspectQuestion, setInspectQuestion] = useState<any>(null);

  const fetchQuestions = (overridePage?: number, overrideQuery?: string) => {
    setIsLoading(true);
    const p = overridePage ?? page;
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
    const params = new URLSearchParams();
    if (selectedTopic) params.append('topic', selectedTopic);
    if (selectedDifficulty) params.append('difficulty', selectedDifficulty);
    if (selectedType) params.append('type', selectedType);
    if (selectedStatus) params.append('status', selectedStatus);
    if (q.trim()) params.append('search', q.trim());
    params.append('page', p.toString());
    params.append('limit', '15');

    api.get(`/questions?${params.toString()}`)
      .then(res => {
        if (res.data.success) {
          setQuestions(res.data.questions || []);
          setTotal(res.data.pagination?.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedTopic, selectedDifficulty, selectedType, selectedStatus, page]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    fetchQuestions(1, '');
  };

  const handleResetAllFilters = () => {
    setSelectedTopic('');
    setSelectedDifficulty('');
    setSelectedType('');
    setSelectedStatus('');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    selectedTopic || selectedDifficulty || selectedType || selectedStatus || searchQuery
  );

  const totalPages = Math.max(1, Math.ceil(total / 15));

  const handleApprove = async (qId: string) => {
    try {
      const res = await api.post(`/questions/${qId}/approve`);
      if (res.data.success) {
        toast.success('Question approved into verified bank!');
        fetchQuestions();
        if (inspectQuestion?._id === qId) {
          setInspectQuestion(null);
        }
      }
    } catch {
      toast.error('Failed to approve question');
    }
  };

  const handleDelete = async (qId: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.delete(`/questions/${qId}`);
      toast.success('Question removed');
      fetchQuestions();
      setInspectQuestion(null);
    } catch {
      toast.error('Failed to delete question');
    }
  };

  return (
    <div className="page-shell">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E9E7F0] pb-6">
        <div>
          <div className="page-kicker">Faculty Question Repository</div>
          <h1 className="page-title mt-1">Question Bank</h1>
          <p className="page-copy">
            Curate, organize, filter, and evaluate assessment questions across all core domains
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/faculty/ai-generator')}
            icon={<Bot className="w-3.5 h-3.5 text-[#7779C5]" />}
          >
            AI Question Generator
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/faculty/questions/new')}
            icon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            New Question
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <Card>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9895A8] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search questions by title, description, or tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchQuestions(1);
                  }
                }}
                className="w-full pl-10 pr-9 py-2.5 text-xs border border-[#E9E7F0] rounded-xl focus:outline-none focus:border-[#7779C5] focus:ring-2 focus:ring-[#7779C5]/15 text-[#49465B] bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-3 text-[#9895A8] hover:text-[#49465B]"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPage(1);
                  fetchQuestions(1);
                }}
              >
                Search
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAllFilters}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <select
              value={selectedTopic}
              onChange={e => {
                setSelectedTopic(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-[#E9E7F0] rounded-xl bg-[#F8F7FC] text-[#49465B] focus:border-[#7779C5] focus:outline-none"
            >
              <option value="">All Topics</option>
              {TOPICS.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={e => {
                setSelectedDifficulty(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-[#E9E7F0] rounded-xl bg-[#F8F7FC] text-[#49465B] focus:border-[#7779C5] focus:outline-none"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <select
              value={selectedType}
              onChange={e => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-[#E9E7F0] rounded-xl bg-[#F8F7FC] text-[#49465B] focus:border-[#7779C5] focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="coding">Coding Problem</option>
              <option value="mcq">MCQ</option>
              <option value="multiple_select">Multiple Select</option>
              <option value="true_false">True/False</option>
            </select>

            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-[#E9E7F0] rounded-xl bg-[#F8F7FC] text-[#49465B] focus:border-[#7779C5] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="verified">Verified Bank</option>
              <option value="draft">AI Drafts</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Questions Table */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#49465B]">
              Showing Questions ({questions.length} of {total})
            </span>
            <div className="flex items-center gap-2 text-xs text-[#777486]">
              <span>Page {page} of {totalPages}</span>
            </div>
          </div>
        }
        footer={
          totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#777486]">
                Displaying 15 items per page
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  icon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E9E7F0] text-[#9895A8] font-semibold uppercase text-[10px] tracking-wider">
                <th className="pb-3">Title</th>
                <th className="pb-3">Topic / Subtopic</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Difficulty</th>
                <th className="pb-3">Marks</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E7F0]">
              {questions.map(q => (
                <tr key={q._id} className="hover:bg-[#F8F7FC] transition-colors">
                  <td className="py-3 font-semibold text-[#49465B] max-w-xs truncate">
                    {q.title}
                  </td>
                  <td className="py-3 text-[#777486]">
                    <div className="font-medium text-[#49465B]">{q.topic}</div>
                    <div className="text-[10px] text-[#9895A8]">{q.subtopic || 'General'}</div>
                  </td>
                  <td className="py-3">
                    <Badge variant={q.type === 'coding' ? 'purple' : 'blue'}>
                      {q.type === 'coding' ? 'Coding' : q.type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <DifficultyBadge difficulty={q.difficulty} />
                  </td>
                  <td className="py-3 font-semibold text-[#49465B]">{q.marks || 1}</td>
                  <td className="py-3">
                    <Badge variant={q.status === 'verified' ? 'green' : 'amber'}>
                      {q.status === 'verified' ? 'Verified' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectQuestion(q)}
                        className="p-1.5 text-[#777486] hover:text-[#7779C5] hover:bg-[#F0EFF9] rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {q.status === 'draft' && (
                        <button
                          onClick={() => handleApprove(q._id)}
                          className="p-1.5 text-[#527565] hover:bg-[#E9F3ED] rounded-lg transition-colors"
                          title="Approve to Verified Bank"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(q._id)}
                        className="p-1.5 text-[#777486] hover:text-[#9A646D] hover:bg-[#F8EDEF] rounded-lg transition-colors"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && questions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#777486] text-xs">
                    No questions found matching your criteria. Try adjusting filters or search terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Modal */}
      {inspectQuestion && (
        <Modal
          isOpen={!!inspectQuestion}
          onClose={() => setInspectQuestion(null)}
          title={inspectQuestion.title}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Badge variant={inspectQuestion.status === 'verified' ? 'green' : 'amber'}>
                  Status: {inspectQuestion.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {inspectQuestion.status === 'draft' && (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => handleApprove(inspectQuestion._id)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#527565]" />}
                  >
                    Approve to Bank
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setInspectQuestion(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue">{inspectQuestion.category}</Badge>
              <Badge variant="purple">{inspectQuestion.topic}</Badge>
              <DifficultyBadge difficulty={inspectQuestion.difficulty} />
              <span className="text-[#777486]">• Marks: {inspectQuestion.marks || 1}</span>
            </div>

            <div className="rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-3 text-xs leading-relaxed text-[#49465B]">
              {inspectQuestion.description}
            </div>

            {inspectQuestion.type === 'coding' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#E9E7F0] bg-[#49465B] p-4 text-[#5B586D] font-mono text-xs">
                  <div className="text-slate-400 text-[10px] mb-2 border-b border-white/10 pb-1">
                    Reference Solution ({inspectQuestion.codingDetails?.language || 'python'})
                  </div>
                  <pre className="overflow-x-auto leading-relaxed">
                    {inspectQuestion.codingDetails?.referenceSolution || '// No reference solution provided'}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#777486]">
                  <div>
                    <span className="font-semibold text-[#49465B]">Visible Test Cases: </span>
                    {inspectQuestion.codingDetails?.visibleTestCases?.length || 0}
                  </div>
                  <div>
                    <span className="font-semibold text-[#49465B]">Hidden Test Cases: </span>
                    {inspectQuestion.codingDetails?.hiddenTestCases?.length || 0}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="font-semibold text-[#49465B]">Options:</h4>
                <div className="space-y-1.5">
                  {inspectQuestion.options?.map((opt: any) => (
                    <div
                      key={opt.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        opt.isCorrect
                          ? 'bg-[#E9F3ED] border-[#C8DFD1] font-semibold text-[#527565]'
                          : 'bg-white border-[#E9E7F0] text-[#49465B]'
                      }`}
                    >
                      <span>{opt.text}</span>
                      {opt.isCorrect && <Badge variant="green">Correct Answer</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inspectQuestion.explanation && (
              <div className="p-3.5 bg-[#F0EFF9] rounded-xl border border-[#DEDDF0] text-xs text-[#555780]">
                <span className="font-semibold">Explanation: </span>
                {inspectQuestion.explanation}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
