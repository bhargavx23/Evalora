import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck2,
  PlusCircle,
  Activity,
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Search,
  X,
  Filter
} from 'lucide-react';

export const AssessmentManager: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const fetchAssessments = () => {
    setIsLoading(true);
    api.get('/assessments')
      .then(res => {
        if (res.data.success) {
          setAssessments(res.data.assessments || []);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handlePublish = async (id: string) => {
    try {
      const res = await api.post(`/assessments/${id}/publish`);
      if (res.data.success) {
        toast.success('Assessment published successfully to students!');
        fetchAssessments();
      }
    } catch {
      toast.error('Failed to publish assessment');
    }
  };

  const filteredAssessments = assessments
    .filter(ass => {
      if (statusFilter === 'all') return true;
      return ass.status === statusFilter;
    })
    .filter(ass => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ass.title?.toLowerCase().includes(q) ||
        ass.description?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="page-shell">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E5EF] pb-6">
        <div>
          <div className="page-kicker">Faculty Portal</div>
          <h1 className="page-title mt-1">Assessment Management</h1>
          <p className="page-copy">
            Create, schedule, monitor live attempts, and evaluate student examinations
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/faculty/assessments/new')}
          icon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Create Assessment
        </Button>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8490A2] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search assessments by title..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs border border-[#E0E5EF] rounded-xl focus:outline-none focus:border-[#5288B8] focus:ring-2 focus:ring-[#5288B8]/15 text-[#3C4B63] bg-white transition-all shadow-[0_1px_2px_rgba(82,77,119,0.02)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-[#8490A2] hover:text-[#3C4B63]"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-[#EFF2F8] rounded-xl border border-[#E0E5EF] text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-[#3C4B63] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            All ({assessments.length})
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'published'
                ? 'bg-white text-[#4C765D] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Published
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'draft'
                ? 'bg-white text-[#8A7047] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Drafts
          </button>
        </div>
      </div>

      {/* Assessments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAssessments.map(ass => (
          <Card key={ass._id} pastelAccent={ass.status === 'published' ? 'blue' : 'amber'}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ass.status === 'published' ? 'green' : 'amber'}>
                      {ass.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                    <span className="text-xs text-[#748199]">
                      {ass.sections?.length ?? 0} Sections
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[#3C4B63] mt-1.5">{ass.title}</h3>
                </div>
                <span className="text-xs font-semibold text-[#3C648E] bg-[#EAF1F9] px-2.5 py-1 rounded-lg border border-[#CFE2DC]">
                  {ass.totalMarks} Marks
                </span>
              </div>

              <p className="text-xs text-[#748199] line-clamp-2 leading-relaxed">{ass.description}</p>

              <div className="grid grid-cols-2 gap-2 text-xs text-[#748199] pt-2 border-t border-[#E0E5EF]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8490A2]" />
                  <span>{ass.durationMinutes} Minutes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#8490A2]" />
                  <span>Ends: {new Date(ass.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#8490A2]" />
                  <span>{ass.stats?.totalAttempts || 0} Submissions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#8490A2]" />
                  <span>{ass.stats?.inProgressAttempts || 0} Active Now</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E0E5EF]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/faculty/live-monitor?assessmentId=${ass._id}`)}
                    className="text-xs font-semibold text-[#5288B8] hover:underline flex items-center gap-1"
                  >
                    <Activity className="w-3.5 h-3.5" /> Monitor Live
                  </button>
                  <span className="text-[#E0E5EF]">&bull;</span>
                  <button
                    onClick={() => navigate(`/faculty/similarity?assessmentId=${ass._id}`)}
                    className="text-xs font-semibold text-[#A36162] hover:underline flex items-center gap-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Reports
                  </button>
                </div>

                {ass.status === 'draft' ? (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => handlePublish(ass._id)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#4C765D]" />}
                  >
                    Publish Now
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-[#4C765D] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Available to Students
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && filteredAssessments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-[#E0E5EF] text-xs text-[#748199] space-y-2">
          <FileCheck2 className="w-8 h-8 text-[#8490A2] mx-auto" />
          <p className="text-sm font-semibold text-[#3C4B63]">
            {searchQuery ? 'No Assessments Match Your Search' : 'No Assessments Found'}
          </p>
          <p>
            {searchQuery
              ? 'Try modifying your filter keyword or resetting filters.'
              : 'Create your first assessment to schedule exams for student cohorts.'}
          </p>
        </div>
      )}
    </div>
  );
};
