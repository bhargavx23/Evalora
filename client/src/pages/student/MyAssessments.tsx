import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FileCheck2,
  Clock,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Search,
  X
} from 'lucide-react';

export const MyAssessments: React.FC = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedForInstructions, setSelectedForInstructions] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/assessments')
      .then(res => {
        if (res.data.success) {
          setAssessments(res.data.assessments || []);
        }
      })
      .catch(() => setLoadError('Unable to load assigned assessments. Try again.'))
      .finally(() => setIsLoading(false));
  }, []);

  const matchesSearch = (item: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  };

  const availableAssessments = assessments
    .filter(a => !a.userAttempt || a.userAttempt.status === 'in_progress')
    .filter(matchesSearch);

  const completedAssessments = assessments
    .filter(a => a.userAttempt && a.userAttempt.status !== 'in_progress')
    .filter(matchesSearch);

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D2D2D7] pb-6">
        <div>
          <div className="page-kicker">Student Portal</div>
          <h1 className="page-title mt-1">Assigned Assessments</h1>
          <p className="page-copy">
            Formal institution examinations assigned to your batch and department
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7]">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'available'
                ? 'bg-white text-[#0056CC] shadow-xs font-semibold'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            Available ({availableAssessments.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-[#007AFF] shadow-xs font-semibold'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            Completed ({completedAssessments.length})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#9895A8] absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Filter assessments by title or topic..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2 text-xs border border-[#D2D2D7] rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 text-[#1D1D1F] bg-white transition-all shadow-[0_1px_2px_rgba(82,77,119,0.02)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-[#9895A8] hover:text-[#1D1D1F]"
            title="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-[#E8D9B9] bg-[#F8F3E8] px-4 py-3 text-xs font-medium text-[#896D45]">
          {loadError}
        </div>
      )}

      {activeTab === 'available' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {availableAssessments.map(ass => {
            const isInProgress = ass.userAttempt?.status === 'in_progress';

            return (
              <Card key={ass._id} pastelAccent={isInProgress ? 'amber' : 'blue'}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant={isInProgress ? 'amber' : 'blue'}>
                        {isInProgress ? 'In Progress (Resumable)' : 'Ready to Take'}
                      </Badge>
                      <h3 className="text-base font-semibold text-[#1D1D1F] mt-2">{ass.title}</h3>
                    </div>
                    <span className="text-xs font-semibold text-[#0056CC] bg-[#E5F1FF] border border-[#CFE2DC] px-2.5 py-1 rounded-lg shrink-0">
                      {ass.totalMarks} Marks
                    </span>
                  </div>

                  <p className="text-xs text-[#6E6E73] line-clamp-2 leading-relaxed">{ass.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[#6E6E73] pt-2 border-t border-[#D2D2D7]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#9895A8]" />
                      <span>{ass.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#9895A8]" />
                      <span>{ass.sections?.length ?? 0} Sections</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#9895A8]" />
                      <span>Due: {new Date(ass.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#9895A8]" />
                      <span>Proctored</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#D2D2D7]">
                    <button
                      onClick={() => setSelectedForInstructions(ass)}
                      className="text-xs text-[#6E6E73] hover:text-[#1D1D1F] font-medium underline"
                    >
                      View Instructions
                    </button>

                    <Button
                      variant={isInProgress ? 'warm' : 'primary'}
                      size="sm"
                      onClick={() => navigate(`/assessments/${ass._id}/room`)}
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      {isInProgress ? 'Resume Attempt' : 'Start Assessment'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {!isLoading && availableAssessments.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-[#D2D2D7] text-xs text-[#6E6E73] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#527565] mx-auto" />
              <p className="text-sm font-semibold text-[#1D1D1F]">
                {searchQuery ? 'No Matching Assessments Found' : 'No Pending Assessments'}
              </p>
              <p>
                {searchQuery
                  ? 'Try modifying your search query.'
                  : 'You have completed all assigned assessments for your department.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {completedAssessments.map(ass => (
            <Card key={ass._id} pastelAccent="mint">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="green">Completed & Evaluated</Badge>
                    <h3 className="text-base font-semibold text-[#1D1D1F] mt-2">{ass.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-bold text-[#527565]">
                      {ass.userAttempt?.totalScore} / {ass.totalMarks}
                    </span>
                    <div className="text-[10px] text-[#6E6E73] font-medium">
                      ({ass.userAttempt?.percentage}%)
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[#6E6E73]">Submitted On</div>
                    <div className="font-semibold text-[#1D1D1F]">
                      {ass.userAttempt?.submittedAt ? new Date(ass.userAttempt.submittedAt).toLocaleString() : 'Submitted'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#6E6E73]">Integrity Score</div>
                    <div className="font-semibold text-[#527565]">
                      {ass.userAttempt?.integrityScore != null ? `${ass.userAttempt.integrityScore}%` : 'Not available'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/results')}
                  >
                    View Result Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {!isLoading && completedAssessments.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-[#D2D2D7] text-xs text-[#6E6E73] space-y-2">
              <FileCheck2 className="w-8 h-8 text-[#9895A8] mx-auto" />
              <p className="text-sm font-semibold text-[#1D1D1F]">No Completed Assessments</p>
              <p>Completed examinations and test results will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* Instructions Modal */}
      {selectedForInstructions && (
        <Modal
          isOpen={!!selectedForInstructions}
          onClose={() => setSelectedForInstructions(null)}
          title={`Instructions: ${selectedForInstructions.title}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[#6E6E73]">Timer commences immediately on start</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const id = selectedForInstructions._id;
                  setSelectedForInstructions(null);
                  navigate(`/assessments/${id}/room`);
                }}
              >
                Agree & Start Assessment
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-[#1D1D1F] leading-relaxed">
            <div className="p-3.5 bg-[#E5F1FF] rounded-xl border border-[#CFE2DC] text-[#0056CC] font-medium">
              Assessment Duration: {selectedForInstructions.durationMinutes} minutes &bull; Total Marks: {selectedForInstructions.totalMarks}
            </div>

            <div>
              <h4 className="font-semibold text-[#1D1D1F] mb-1">General Rules:</h4>
              <p className="whitespace-pre-line text-[#6E6E73]">
                {selectedForInstructions.instructions || 'Answer all questions within the designated duration.'}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-[#1D1D1F] mb-1">Anti-Cheating & Integrity Monitoring:</h4>
              <ul className="list-disc pl-5 space-y-1 text-[#6E6E73]">
                <li>Fullscreen mode is strictly monitored throughout the session.</li>
                <li>Tab switches and window minimization events are logged to the faculty proctoring dashboard.</li>
                <li>Copying and pasting text is disabled during the exam.</li>
                <li>Answers are continuously auto-saved to the server to prevent data loss.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
