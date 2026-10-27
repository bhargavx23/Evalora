import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  Users,
  Building2,
  HelpCircle,
  FileCheck2,
  Wallet,
  Shield,
  History,
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  Power,
  Filter,
  Code2,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  Settings,
  ShieldAlert
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'users'
  | 'organizations'
  | 'questions'
  | 'practice'
  | 'assessments'
  | 'payments'
  | 'audit-logs';

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Overview metrics state
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Users Tab state
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);

  // Organizations Tab state
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Questions Tab state
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState('all');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState('all');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionFormData, setQuestionFormData] = useState<any>({
    title: '',
    statement: '',
    type: 'mcq',
    category: 'DSA',
    topic: 'Arrays',
    difficulty: 'medium',
    marks: 10,
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    testCases: [
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: true }
    ],
    explanation: ''
  });

  // Practice Config state
  const [practiceConfig, setPracticeConfig] = useState<any>(null);

  // Assessments Tab state
  const [assessments, setAssessments] = useState<any[]>([]);
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);

  // Payments Tab state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Premium Plans Management state
  const [adminPlans, setAdminPlans] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    planId: '',
    name: '',
    description: '',
    price: 3,
    attempts: 25,
    active: true,
    popular: false,
    features: ''
  });

  // Audit Logs Tab state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Confirmation Modal state for destructive actions
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionLabel: 'Confirm',
    onConfirm: async () => {}
  });

  // Load Overview Data on mount or when tab becomes 'overview'
  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverview();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'organizations') {
      loadOrganizations();
    } else if (activeTab === 'questions') {
      loadQuestions();
    } else if (activeTab === 'practice') {
      loadPracticeConfig();
    } else if (activeTab === 'assessments') {
      loadAssessments();
    } else if (activeTab === 'payments') {
      loadPayments();
      loadAdminPlans();
    } else if (activeTab === 'audit-logs') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const loadOverview = async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await api.get('/admin/overview');
      if (res.data.success) {
        setMetrics(res.data.metrics);
      }
    } catch {
      toast.error('Failed to load platform overview metrics.');
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const params: any = {};
      if (userSearch.trim()) params.search = userSearch.trim();
      if (userRoleFilter !== 'all') params.role = userRoleFilter;
      if (userStatusFilter !== 'all') params.status = userStatusFilter;

      const res = await api.get('/admin/users', { params });
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch {
      toast.error('Failed to load user list.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      const params: any = {};
      if (orgSearch.trim()) params.search = orgSearch.trim();
      const res = await api.get('/admin/organizations', { params });
      if (res.data.success) {
        setOrganizations(res.data.organizations || []);
      }
    } catch {
      toast.error('Failed to load organization list.');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const loadQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const params: any = {};
      if (questionSearch.trim()) params.search = questionSearch.trim();
      if (questionCategoryFilter !== 'all') params.category = questionCategoryFilter;
      if (questionDifficultyFilter !== 'all') params.difficulty = questionDifficultyFilter;
      const res = await api.get('/admin/questions', { params });
      if (res.data.success) {
        setQuestions(res.data.questions || []);
      }
    } catch {
      toast.error('Failed to load questions.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const loadPracticeConfig = async () => {
    try {
      const res = await api.get('/admin/practice/config');
      if (res.data.success) {
        setPracticeConfig(res.data.config);
      }
    } catch {
      toast.error('Failed to load practice engine settings.');
    }
  };

  const loadAssessments = async () => {
    setIsLoadingAssessments(true);
    try {
      const params: any = {};
      if (assessmentSearch.trim()) params.search = assessmentSearch.trim();
      const res = await api.get('/admin/assessments', { params });
      if (res.data.success) {
        setAssessments(res.data.assessments || []);
      }
    } catch {
      toast.error('Failed to load assessments.');
    } finally {
      setIsLoadingAssessments(false);
    }
  };

  const loadPayments = async () => {
    setIsLoadingPayments(true);
    try {
      const params: any = {};
      if (paymentSearch.trim()) params.search = paymentSearch.trim();
      const res = await api.get('/admin/payments', { params });
      if (res.data.success) {
        setPayments(res.data.transactions || []);
      }
    } catch {
      toast.error('Failed to load payment transactions.');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const loadAdminPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const res = await api.get('/admin/plans');
      if (res.data.success) {
        setAdminPlans(res.data.plans || []);
      }
    } catch {
      toast.error('Failed to load premium practice plans.');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const handleOpenCreatePlan = () => {
    setIsEditingPlan(false);
    setPlanFormData({
      planId: '',
      name: '',
      description: '',
      price: 3,
      attempts: 25,
      active: true,
      popular: false,
      features: 'Unlocked Practice Attempts, AI Question Replenishment'
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: any) => {
    setIsEditingPlan(true);
    setPlanFormData({
      planId: plan.planId || plan.id,
      name: plan.name,
      description: plan.description || '',
      price: plan.price ?? plan.priceAlgo,
      attempts: plan.attempts ?? plan.paidAttempts,
      active: plan.active,
      popular: plan.popular || false,
      features: Array.isArray(plan.features) ? plan.features.join(', ') : ''
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(planFormData.price);
    if (isNaN(priceNum) || priceNum >= 9 || priceNum <= 0) {
      toast.error('Plan price must be strictly greater than 0 and less than 9 ALGO (0 < price < 9 ALGO).');
      return;
    }
    const attemptsNum = Number(planFormData.attempts);
    if (isNaN(attemptsNum) || attemptsNum < 1) {
      toast.error('Attempts must be at least 1.');
      return;
    }

    try {
      const payload = {
        ...planFormData,
        price: priceNum,
        attempts: Math.floor(attemptsNum),
        features: planFormData.features
          ? planFormData.features.split(',').map((f) => f.trim()).filter(Boolean)
          : []
      };

      if (isEditingPlan) {
        const res = await api.put(`/admin/plans/${planFormData.planId}`, payload);
        if (res.data.success) {
          toast.success('Plan updated successfully.');
          setIsPlanModalOpen(false);
          loadAdminPlans();
        }
      } else {
        const res = await api.post('/admin/plans', payload);
        if (res.data.success) {
          toast.success('New premium plan created.');
          setIsPlanModalOpen(false);
          loadAdminPlans();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save plan.');
    }
  };

  const handleTogglePlanStatus = async (plan: any) => {
    try {
      const planKey = plan.planId || plan.id;
      const res = await api.patch(`/admin/plans/${planKey}/status`);
      if (res.data.success) {
        toast.success(res.data.message);
        loadAdminPlans();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle plan status.');
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.get('/admin/audit-logs');
      if (res.data.success) {
        setAuditLogs(res.data.logs || []);
      }
    } catch {
      toast.error('Failed to load audit logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Actions for User Management
  const handleToggleUserStatus = (u: any) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    setConfirmModal({
      isOpen: true,
      title: `${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} Account`,
      message: `Are you sure you want to ${nextStatus === 'suspended' ? 'suspend' : 'reactivate'} ${u.name} (${u.email})?`,
      actionLabel: nextStatus === 'suspended' ? 'Suspend User' : 'Reactivate User',
      onConfirm: async () => {
        try {
          const res = await api.patch(`/admin/users/${u._id}/status`, { status: nextStatus });
          if (res.data.success) {
            toast.success(res.data.message);
            loadUsers();
            if (selectedUserDetail?._id === u._id) {
              setSelectedUserDetail({ ...selectedUserDetail, status: nextStatus });
            }
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Failed to update user status.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteUser = (u: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Account',
      message: `Are you sure you want to permanently delete ${u.name} (${u.email})? This action cannot be undone.`,
      actionLabel: 'Delete Permanently',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/admin/users/${u._id}`);
          if (res.data.success) {
            toast.success(res.data.message);
            setIsUserDetailOpen(false);
            loadUsers();
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Failed to delete user.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenUserDetail = async (userId: string) => {
    try {
      const res = await api.get(`/admin/users/${userId}`);
      if (res.data.success) {
        setSelectedUserDetail(res.data);
        setIsUserDetailOpen(true);
      }
    } catch {
      toast.error('Failed to load user profile details.');
    }
  };

  // Actions for Organization Management
  const handleToggleOrgStatus = async (org: any) => {
    try {
      const res = await api.patch(`/admin/organizations/${org._id}/status`);
      if (res.data.success) {
        toast.success(res.data.message);
        loadOrganizations();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle status.');
    }
  };

  const handleDeleteOrg = (org: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Institution',
      message: `Are you sure you want to permanently remove ${org.name} (${org.code}) and all associated academic departments?`,
      actionLabel: 'Delete Institution',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/admin/organizations/${org._id}`);
          if (res.data.success) {
            toast.success(res.data.message);
            loadOrganizations();
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Failed to delete institution.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Actions for Question Management
  const handleCreateQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/questions', questionFormData);
      if (res.data.success) {
        toast.success('Question added to Question Bank.');
        setIsQuestionModalOpen(false);
        loadQuestions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create question.');
    }
  };

  const handleDeleteQuestion = (q: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Question',
      message: `Are you sure you want to delete "${q.title}" from the question bank?`,
      actionLabel: 'Delete Question',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/admin/questions/${q._id}`);
          if (res.data.success) {
            toast.success('Question removed.');
            loadQuestions();
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Failed to delete question.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Actions for Assessment Management
  const handleToggleAssessmentStatus = async (ass: any) => {
    try {
      const res = await api.patch(`/admin/assessments/${ass._id}/status`);
      if (res.data.success) {
        toast.success(res.data.message);
        loadAssessments();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update assessment status.');
    }
  };

  return (
    <div className="admin-portal min-w-0 space-y-6 break-words pb-12">
      {/* Top Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
            <Shield className="h-4 w-4" />
            Platform Governance
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-text-primary md:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Centralized platform management: users, organizations, question bank, practice controls, and Pera Algorand transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="max-w-full whitespace-normal break-all" variant="blue">
            Admin: {user?.email}
          </Badge>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex min-w-0 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain border-b border-border-subtle pb-px text-sm">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'organizations', label: 'Organizations', icon: Building2 },
          { id: 'questions', label: 'Question Bank', icon: HelpCircle },
          { id: 'practice', label: 'Practice Controls', icon: Settings },
          { id: 'assessments', label: 'Assessments', icon: FileCheck2 },
          { id: 'payments', label: 'Payments (Pera)', icon: Wallet },
          { id: 'audit-logs', label: 'Audit Trail', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium transition-colors ${
                isActive
                  ? 'border-brand-primary text-brand-primary font-semibold'
                  : 'border-transparent text-text-secondary hover:border-border-subtle hover:text-text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {isLoadingMetrics ? (
            <div className="py-12 text-center text-sm text-text-secondary">Loading platform metrics...</div>
          ) : metrics ? (
            <>
              {/* Primary Stat Grid */}
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4 md:gap-4">
                <Card padding="sm">
                  <span className="block min-w-0 text-xs font-medium leading-5 text-text-muted">Total Registered Users</span>
                  <div className="mt-1 break-words font-serif text-2xl font-medium text-text-primary sm:text-3xl">{metrics.users.total}</div>
                  <div className="mt-2 flex flex-wrap gap-x-2 text-xs text-text-secondary">
                    <span>{metrics.users.students} Students</span> &bull; <span>{metrics.users.faculty} Faculty</span>
                  </div>
                </Card>
                <Card padding="sm">
                  <span className="block min-w-0 text-xs font-medium leading-5 text-text-muted">Onboarded Institutions</span>
                  <div className="mt-1 break-words font-serif text-2xl font-medium text-text-primary sm:text-3xl">{metrics.organizations.total}</div>
                  <div className="mt-2 text-xs text-[#527565] font-medium">{metrics.organizations.active} Active</div>
                </Card>
                <Card padding="sm">
                  <span className="block min-w-0 text-xs font-medium leading-5 text-text-muted">Question Bank Size</span>
                  <div className="mt-1 break-words font-serif text-2xl font-medium text-text-primary sm:text-3xl">{metrics.questions.total}</div>
                  <div className="mt-2 flex flex-wrap gap-x-1 text-xs text-text-secondary">{metrics.questions.coding} Coding &bull; {metrics.questions.dsa} DSA</div>
                </Card>
                <Card padding="sm">
                  <span className="block min-w-0 text-xs font-medium leading-5 text-text-muted">Pera Payments Volume</span>
                  <div className="mt-1 break-all font-serif text-2xl font-medium text-[#527565] sm:text-3xl">{metrics.payments.totalAlgoVolume} ALGO</div>
                  <div className="mt-2 text-xs text-text-secondary">{metrics.payments.verifiedTransactions} Verified Txns</div>
                </Card>
              </div>

              {/* Authorized Admin & Treasury Details */}
              <Card
                header={
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words text-sm font-semibold text-text-primary">System Authority &amp; Treasury Wallet</span>
                    <Badge className="max-w-full whitespace-normal" variant="green">Verified On-Chain Destination</Badge>
                  </div>
                }
              >
                <div className="space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row justify-between py-1.5 border-b border-border-subtle">
                    <span className="text-text-muted font-medium">Authorized Admin Email:</span>
                    <span className="font-semibold text-text-primary">{metrics.system.adminEmail}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between py-1.5 border-b border-border-subtle">
                    <span className="text-text-muted font-medium">Authorized Admin Pera/Algorand Wallet:</span>
                    <span className="font-mono text-[#527565] font-medium break-all">{metrics.system.adminWallet}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between py-1.5">
                    <span className="text-text-muted font-medium">Algorand Network:</span>
                    <span className="font-semibold uppercase text-brand-primary">{metrics.system.network}</span>
                  </div>
                </div>
              </Card>

              {/* Recent System Activity */}
              <Card
                header={<span className="text-sm font-semibold text-text-primary">Recent Governance Audit Logs</span>}
              >
                {metrics.recentAuditLogs && metrics.recentAuditLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border-subtle text-text-muted">
                        <tr>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Action</th>
                          <th className="pb-2 font-medium">Admin</th>
                          <th className="pb-2 font-medium">Resource</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {metrics.recentAuditLogs.map((log: any) => (
                          <tr key={log._id} className="hover:bg-surface-neutral/40">
                            <td className="py-2.5 text-text-secondary">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="py-2.5 font-semibold text-text-primary">{log.action}</td>
                            <td className="py-2.5 text-text-secondary">{log.userId?.email || 'System'}</td>
                            <td className="py-2.5 font-mono text-text-muted">{log.resource}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-text-secondary">No audit logs recorded yet.</div>
                )}
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search by name, email, roll number, or wallet address..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                className="w-full rounded-lg border border-border-subtle bg-white pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setTimeout(loadUsers, 0);
                }}
                className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="college_admin">Institution Admins</option>
              </select>
              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setTimeout(loadUsers, 0);
                }}
                className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <Button size="sm" variant="outline" onClick={loadUsers}>
                Refresh
              </Button>
            </div>
          </div>

          <Card>
            {isLoadingUsers ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">No users found matching filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">User Profile</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Linked Pera Wallet</th>
                      <th className="pb-3 font-medium">Practice Attempts</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {users.map((u) => {
                      const hasWallet = u.walletAddress || (u.wallets && u.wallets.length > 0);
                      return (
                        <tr key={u._id} className="hover:bg-surface-neutral/40">
                          <td className="py-3">
                            <div className="font-semibold text-text-primary">{u.name}</div>
                            <div className="text-[11px] text-text-secondary">{u.email}</div>
                          </td>
                          <td className="py-3">
                            <Badge
                              variant={
                                u.role === 'admin'
                                  ? 'purple'
                                  : u.role === 'faculty'
                                    ? 'blue'
                                    : u.role === 'college_admin'
                                      ? 'amber'
                                      : 'neutral'
                              }
                            >
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge variant={u.status === 'active' ? 'green' : 'rose'}>
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-3">
                            {hasWallet ? (
                              <span className="font-mono text-[11px] text-[#527565]">
                                {u.walletAddress
                                  ? `${u.walletAddress.slice(0, 6)}...${u.walletAddress.slice(-4)}`
                                  : 'Linked'}
                              </span>
                            ) : (
                              <span className="text-text-muted text-[11px]">Not linked</span>
                            )}
                          </td>
                          <td className="py-3 text-text-secondary">
                            {u.freeAttempts?.used || 0}/{u.freeAttempts?.total || 10} free &bull; {u.paidAttempts?.total || 0} paid
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenUserDetail(u._id)}
                                icon={<Eye className="h-3.5 w-3.5" />}
                              >
                                View
                              </Button>
                              {u.role !== 'admin' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleUserStatus(u)}
                                    icon={<Power className="h-3.5 w-3.5" />}
                                  >
                                    {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteUser(u)}
                                    className="text-[#9A646D] hover:bg-[#F8EDEF]"
                                    icon={<Trash2 className="h-3.5 w-3.5" />}
                                  >
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: ORGANIZATIONS */}
      {activeTab === 'organizations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search organizations by name, code, or email..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadOrganizations()}
                className="w-full rounded-lg border border-border-subtle bg-white pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
            <Button size="sm" variant="outline" onClick={loadOrganizations}>
              Refresh List
            </Button>
          </div>

          <Card>
            {isLoadingOrgs ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading institutions...</div>
            ) : organizations.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">No organizations currently onboarded. Organizations can register via /college-register.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">Institution</th>
                      <th className="pb-3 font-medium">Code</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Departments</th>
                      <th className="pb-3 font-medium">Enrolled Students</th>
                      <th className="pb-3 font-medium">Assessments</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {organizations.map((org) => (
                      <tr key={org._id} className="hover:bg-surface-neutral/40">
                        <td className="py-3">
                          <div className="font-semibold text-text-primary">{org.name}</div>
                          <div className="text-[11px] text-text-secondary">{org.contactEmail}</div>
                        </td>
                        <td className="py-3 font-mono text-xs">{org.code}</td>
                        <td className="py-3">
                          <Badge variant={org.status === 'active' ? 'green' : 'rose'}>
                            {org.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-text-secondary">{org.departmentCount || 0}</td>
                        <td className="py-3 text-text-secondary">{org.studentCount || 0}</td>
                        <td className="py-3 text-text-secondary">{org.assessmentCount || 0}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleOrgStatus(org)}
                            >
                              {org.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteOrg(org)}
                              className="text-[#9A646D] hover:bg-[#F8EDEF]"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: QUESTION BANK MANAGEMENT */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search questions by title, statement, or topic..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadQuestions()}
                className="w-full rounded-lg border border-border-subtle bg-white pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={questionCategoryFilter}
                onChange={(e) => {
                  setQuestionCategoryFilter(e.target.value);
                  setTimeout(loadQuestions, 0);
                }}
                className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="dsa">DSA</option>
                <option value="coding">Coding</option>
                <option value="aptitude">Aptitude</option>
                <option value="reasoning">Reasoning</option>
                <option value="placement">Placement Core</option>
              </select>
              <select
                value={questionDifficultyFilter}
                onChange={(e) => {
                  setQuestionDifficultyFilter(e.target.value);
                  setTimeout(loadQuestions, 0);
                }}
                className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <Button size="sm" variant="primary" onClick={() => setIsQuestionModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Create Question
              </Button>
            </div>
          </div>

          <Card>
            {isLoadingQuestions ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading questions...</div>
            ) : questions.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">No questions found matching criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">Question Title</th>
                      <th className="pb-3 font-medium">Category / Topic</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Difficulty</th>
                      <th className="pb-3 font-medium">Marks</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {questions.map((q) => (
                      <tr key={q._id} className="hover:bg-surface-neutral/40">
                        <td className="py-3 max-w-sm">
                          <div className="font-semibold text-text-primary truncate">{q.title}</div>
                          <div className="text-[11px] text-text-secondary truncate">{q.statement}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-text-primary">{q.category}</div>
                          <div className="text-[11px] text-text-muted">{q.topic}</div>
                        </td>
                        <td className="py-3">
                          <Badge variant={q.type === 'coding' ? 'purple' : 'blue'}>
                            {q.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              q.difficulty === 'easy'
                                ? 'green'
                                : q.difficulty === 'medium'
                                  ? 'amber'
                                  : 'rose'
                            }
                          >
                            {q.difficulty}
                          </Badge>
                        </td>
                        <td className="py-3 text-text-secondary">{q.marks} pts</td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteQuestion(q)}
                            className="text-[#9A646D] hover:bg-[#F8EDEF]"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: PRACTICE ENGINE CONTROLS */}
      {activeTab === 'practice' && (
        <div className="space-y-6 max-w-4xl">
          <Card
            header={<span className="text-sm font-semibold text-text-primary">Practice Engine Configuration</span>}
          >
            <div className="space-y-4 text-xs">
              <div className="rounded-lg bg-surface-neutral p-4 border border-border-subtle">
                <span className="font-semibold text-text-primary">Fresh Question Delivery Policy:</span>
                <p className="mt-1 text-text-secondary">
                  The adaptive practice builder actively checks previously attempted question IDs in <code>PracticeQuestionHistory</code>.
                  It prioritizes questions that the user has never attempted before. When the pool of unattempted questions is exhausted,
                  it replenishes via Google Gemini AI Pro in real time without human intervention.
                </p>
              </div>

              {practiceConfig && (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                    <span className="font-medium text-text-secondary">Default Free Practice Attempts:</span>
                    <span className="font-semibold text-text-primary">{practiceConfig.defaultFreeAttempts} attempts</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                    <span className="font-medium text-text-secondary">AI Question Replenishment:</span>
                    <Badge variant={practiceConfig.aiReplenishmentEnabled ? 'green' : 'amber'}>
                      {practiceConfig.aiReplenishmentEnabled ? 'Enabled (Auto-Replenish)' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                    <span className="font-medium text-text-secondary">Active AI Model:</span>
                    <span className="font-mono text-text-primary font-medium">{practiceConfig.geminiModel}</span>
                  </div>

                  <div className="pt-2">
                    <span className="font-semibold text-text-primary">Configured Practice Categories & Topics:</span>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {practiceConfig.categories?.map((cat: any) => (
                        <div key={cat.id} className="rounded-lg border border-border-subtle p-3 bg-white">
                          <span className="font-bold text-text-primary">{cat.name}</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cat.topics.map((t: string) => (
                              <span key={t} className="rounded bg-surface-neutral px-1.5 py-0.5 text-[10px] text-text-secondary">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: ASSESSMENTS */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search assessments by title..."
                value={assessmentSearch}
                onChange={(e) => setAssessmentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAssessments()}
                className="w-full rounded-lg border border-border-subtle bg-white pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
            <Button size="sm" variant="outline" onClick={loadAssessments}>
              Refresh List
            </Button>
          </div>

          <Card>
            {isLoadingAssessments ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading assessments...</div>
            ) : assessments.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">No assessments registered on the platform.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">Assessment Title</th>
                      <th className="pb-3 font-medium">Institution</th>
                      <th className="pb-3 font-medium">Duration</th>
                      <th className="pb-3 font-medium">Total Marks</th>
                      <th className="pb-3 font-medium">Candidate Attempts</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {assessments.map((ass) => (
                      <tr key={ass._id} className="hover:bg-surface-neutral/40">
                        <td className="py-3 font-semibold text-text-primary">{ass.title}</td>
                        <td className="py-3 text-text-secondary">{ass.collegeId?.name || 'Global'}</td>
                        <td className="py-3 text-text-secondary">{ass.durationMinutes} mins</td>
                        <td className="py-3 text-text-secondary">{ass.totalMarks} pts</td>
                        <td className="py-3 text-text-secondary">{ass.attemptCount || 0}</td>
                        <td className="py-3">
                          <Badge variant={ass.status === 'published' ? 'green' : 'amber'}>
                            {ass.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleAssessmentStatus(ass)}
                          >
                            {ass.status === 'published' ? 'Unpublish' : 'Publish'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 7: PAYMENTS (PERA WALLET) */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* SECTION 1: PREMIUM PRACTICE PLANS MANAGEMENT */}
          <Card
            header={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-text-primary">Premium Practice Plans & Pricing</span>
                  <Badge variant="blue" className="text-[10px]">
                    Pricing Rule: Strictly &lt; 9 ALGO
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={loadAdminPlans} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                    Refresh Plans
                  </Button>
                  <Button size="sm" variant="primary" onClick={handleOpenCreatePlan} icon={<Plus className="h-3.5 w-3.5" />}>
                    Add Plan
                  </Button>
                </div>
              </div>
            }
          >
            {isLoadingPlans ? (
              <div className="py-8 text-center text-xs text-text-secondary">Loading configurable plans...</div>
            ) : adminPlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-secondary">
                No custom plans loaded. Default plans are seeded on startup.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">Plan Name</th>
                      <th className="pb-3 font-medium">Identifier</th>
                      <th className="pb-3 font-medium">Price (ALGO)</th>
                      <th className="pb-3 font-medium">Attempts</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Features</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {adminPlans.map((p) => {
                      const priceVal = p.price ?? p.priceAlgo;
                      const attemptsVal = p.attempts ?? p.paidAttempts;
                      const isCompliant = priceVal > 0 && priceVal < 9;
                      return (
                        <tr key={p._id || p.planId} className="hover:bg-surface-neutral/40">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text-primary">{p.name}</span>
                              {p.popular && (
                                <Badge variant="blue" className="text-[9px]">
                                  Popular
                                </Badge>
                              )}
                            </div>
                            {p.description && (
                              <div className="text-[10px] text-text-muted truncate max-w-xs">{p.description}</div>
                            )}
                          </td>
                          <td className="py-3 font-mono text-[11px] text-text-secondary">{p.planId}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 font-bold text-text-primary">
                              <span>{priceVal} ALGO</span>
                              {isCompliant ? (
                                <span className="text-[10px] text-[#527565] font-normal">(&lt; 9 ALGO)</span>
                              ) : (
                                <Badge variant="rose" className="text-[9px]">Non-Compliant</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 font-medium text-[#527565]">+{attemptsVal} attempts</td>
                          <td className="py-3">
                            <Badge variant={p.active ? 'green' : 'neutral'}>
                              {p.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 text-[11px] text-text-muted">
                            {Array.isArray(p.features) ? `${p.features.length} listed` : '0 listed'}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleOpenEditPlan(p)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 px-2 text-[11px] ${
                                  p.active ? 'text-[#896D45] hover:bg-[#F8F3E8]' : 'text-[#527565] hover:bg-[#E9F3ED]'
                                }`}
                                onClick={() => handleTogglePlanStatus(p)}
                              >
                                {p.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* SECTION 2: ALGORAND BLOCKCHAIN TRANSACTION LEDGER */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by Algorand transaction ID or sender wallet..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadPayments()}
                  className="w-full rounded-lg border border-border-subtle bg-white pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
                />
              </div>
              <Button size="sm" variant="outline" onClick={loadPayments}>
                Refresh Transactions
              </Button>
            </div>

            <Card
              header={
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Algorand Blockchain Transaction Ledger</span>
                  <span className="text-xs text-text-muted">Treasury: {metrics?.payments?.treasuryWallet?.slice(0, 10)}...</span>
                </div>
              }
            >
              {isLoadingPayments ? (
                <div className="py-12 text-center text-xs text-text-secondary">Loading payment transactions...</div>
              ) : payments.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-secondary">No blockchain transactions recorded yet. Practice attempts can be purchased via Pera Wallet in the Practice Builder.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border-subtle text-text-muted">
                      <tr>
                        <th className="pb-3 font-medium">Timestamp</th>
                        <th className="pb-3 font-medium">User</th>
                        <th className="pb-3 font-medium">Sender Wallet</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Attempts Unlocked</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Transaction ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {payments.map((tx) => (
                        <tr key={tx._id} className="hover:bg-surface-neutral/40">
                          <td className="py-3 text-text-secondary">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          <td className="py-3">
                            <div className="font-semibold text-text-primary">{tx.userId?.name || 'Unknown'}</div>
                            <div className="text-[10px] text-text-muted">{tx.userId?.email}</div>
                          </td>
                          <td className="py-3 font-mono text-[#527565]">
                            {tx.walletAddress?.slice(0, 8)}...{tx.walletAddress?.slice(-6)}
                          </td>
                          <td className="py-3 font-bold text-text-primary">{tx.amount} {tx.currency}</td>
                          <td className="py-3 font-medium text-[#527565]">+{tx.attemptsUnlocked}</td>
                          <td className="py-3">
                            <Badge variant={tx.status === 'verified' ? 'green' : 'amber'}>
                              {tx.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right font-mono text-[11px] text-brand-primary">
                            <a
                              href={`https://testnet.algoexplorer.io/tx/${tx.transactionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center justify-end gap-1"
                            >
                              {tx.transactionId?.slice(0, 10)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT LOGS */}
      {activeTab === 'audit-logs' && (
        <div className="space-y-4">
          <Card
            header={<span className="text-sm font-semibold text-text-primary">System Audit Trail</span>}
          >
            {isLoadingLogs ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-secondary">No audit logs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="pb-3 font-medium">Timestamp</th>
                      <th className="pb-3 font-medium">Action</th>
                      <th className="pb-3 font-medium">Admin User</th>
                      <th className="pb-3 font-medium">Resource</th>
                      <th className="pb-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-surface-neutral/40">
                        <td className="py-3 text-text-secondary">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-3 font-bold text-text-primary">{log.action}</td>
                        <td className="py-3 text-text-secondary">{log.userId?.email || 'System'}</td>
                        <td className="py-3 font-mono text-text-muted">{log.resource} ({log.resourceId || 'N/A'})</td>
                        <td className="py-3 text-[11px] text-text-secondary max-w-xs truncate">
                          {JSON.stringify(log.details || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: USER DETAILS */}
      {isUserDetailOpen && selectedUserDetail && (
        <Modal
          isOpen={isUserDetailOpen}
          onClose={() => setIsUserDetailOpen(false)}
          title={`User Profile: ${selectedUserDetail.user.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-neutral p-3 border border-border-subtle">
              <div>
                <span className="text-text-muted">Email:</span>
                <p className="font-semibold text-text-primary">{selectedUserDetail.user.email}</p>
              </div>
              <div>
                <span className="text-text-muted">Role:</span>
                <p className="font-semibold capitalize text-brand-primary">{selectedUserDetail.user.role}</p>
              </div>
              <div>
                <span className="text-text-muted">Status:</span>
                <Badge variant={selectedUserDetail.user.status === 'active' ? 'green' : 'rose'}>
                  {selectedUserDetail.user.status}
                </Badge>
              </div>
              <div>
                <span className="text-text-muted">Registered On:</span>
                <p className="text-text-primary">{new Date(selectedUserDetail.user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Linked Wallets */}
            <div>
              <span className="font-semibold text-text-primary">Linked Pera Wallet</span>
              {selectedUserDetail.user.walletAddress || (selectedUserDetail.user.wallets && selectedUserDetail.user.wallets.length > 0) ? (
                <div className="mt-1 rounded-lg border border-border-subtle p-2.5 font-mono text-[11px] text-[#527565] bg-white">
                  {selectedUserDetail.user.walletAddress || selectedUserDetail.user.wallets[0]?.address}
                </div>
              ) : (
                <p className="text-text-muted mt-1">No wallet linked to this account.</p>
              )}
            </div>

            {/* Quota Summary */}
            <div className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
              <div>
                <span className="text-text-muted">Free Attempts Used:</span>
                <p className="font-medium text-text-primary">{selectedUserDetail.user.freeAttempts?.used || 0} / {selectedUserDetail.user.freeAttempts?.total || 10}</p>
              </div>
              <div>
                <span className="text-text-muted">Paid Attempts Available:</span>
                <p className="font-medium text-[#527565]">{selectedUserDetail.user.paidAttempts?.total || 0}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button size="sm" variant="outline" onClick={() => setIsUserDetailOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CREATE QUESTION */}
      {isQuestionModalOpen && (
        <Modal
          isOpen={isQuestionModalOpen}
          onClose={() => setIsQuestionModalOpen(false)}
          title="Add Question to Question Bank"
        >
          <form onSubmit={handleCreateQuestionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-text-secondary">Question Title</label>
              <input
                type="text"
                required
                value={questionFormData.title}
                onChange={(e) => setQuestionFormData({ ...questionFormData, title: e.target.value })}
                placeholder="e.g. Reverse Linked List"
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-text-secondary">Category</label>
                <select
                  value={questionFormData.category}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary"
                >
                  <option value="DSA">DSA</option>
                  <option value="Coding">Coding</option>
                  <option value="Quantitative Aptitude">Aptitude</option>
                  <option value="Logical Reasoning">Reasoning</option>
                  <option value="Placement Core">Placement Core</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-text-secondary">Difficulty</label>
                <select
                  value={questionFormData.difficulty}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, difficulty: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-text-secondary">Topic</label>
                <input
                  type="text"
                  required
                  value={questionFormData.topic}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, topic: e.target.value })}
                  placeholder="e.g. Arrays, Trees, Percentages"
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary">Type</label>
                <select
                  value={questionFormData.type}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary"
                >
                  <option value="mcq">MCQ</option>
                  <option value="coding">Coding (Sandboxed)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-text-secondary">Problem Statement / Prompt</label>
              <textarea
                required
                rows={3}
                value={questionFormData.statement}
                onChange={(e) => setQuestionFormData({ ...questionFormData, statement: e.target.value })}
                placeholder="Enter detailed problem statement..."
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
              <Button size="sm" variant="outline" type="button" onClick={() => setIsQuestionModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit">
                Save to Question Bank
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: CREATE / EDIT PREMIUM PLAN */}
      {isPlanModalOpen && (
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          title={isEditingPlan ? 'Edit Premium Practice Plan' : 'Create New Premium Plan'}
        >
          <form onSubmit={handleSavePlanSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-text-secondary">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  placeholder="e.g. Pro Interview Bundle"
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary">Plan ID / Slug</label>
                <input
                  type="text"
                  required
                  disabled={isEditingPlan}
                  value={planFormData.planId}
                  onChange={(e) => setPlanFormData({ ...planFormData, planId: e.target.value })}
                  placeholder="e.g. pro-interview"
                  className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-neutral/50 px-3 py-2 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block font-medium text-text-secondary">Price in ALGO (0 &lt; price &lt; 9)</label>
                <span className="text-[10px] font-semibold text-[#527565]">Max limit: 8.99 ALGO</span>
              </div>
              <div className="relative mt-1">
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0.1"
                  max="8.99"
                  value={planFormData.price}
                  onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) || 0 })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-bold ${
                    planFormData.price > 0 && planFormData.price < 9
                      ? 'border-border-subtle bg-white text-text-primary focus:border-brand-primary'
                      : 'border-[#E8CFD2] bg-[#F8EDEF] text-[#9A646D]'
                  }`}
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-text-muted">ALGO</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#527565] bg-[#E9F3ED]/80 p-2 rounded-lg border border-[#C8DFD1]">
                🔒 <strong>Platform Pricing Policy:</strong> All premium plans must cost strictly less than 9 ALGO. Values &#8805; 9 ALGO are automatically rejected by backend validation.
              </p>
            </div>

            <div>
              <label className="block font-medium text-text-secondary">Unlocked Practice Attempts</label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={planFormData.attempts}
                onChange={(e) => setPlanFormData({ ...planFormData, attempts: parseInt(e.target.value, 10) || 1 })}
                placeholder="e.g. 25"
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-text-secondary">Description</label>
              <textarea
                rows={2}
                value={planFormData.description}
                onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                placeholder="Brief description of who this plan is tailored for..."
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-text-secondary">Features (comma-separated)</label>
              <input
                type="text"
                value={planFormData.features}
                onChange={(e) => setPlanFormData({ ...planFormData, features: e.target.value })}
                placeholder="25 Unlocked Attempts, All Categories, Instant Verification"
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={planFormData.active}
                  onChange={(e) => setPlanFormData({ ...planFormData, active: e.target.checked })}
                  className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                />
                <span>Active (visible to students)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={planFormData.popular}
                  onChange={(e) => setPlanFormData({ ...planFormData, popular: e.target.checked })}
                  className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary"
                />
                <span>Highlight as &quot;Popular&quot;</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
              <Button size="sm" variant="outline" type="button" onClick={() => setIsPlanModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit">
                {isEditingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmModal.isOpen && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
          title={confirmModal.title}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 rounded-lg border border-[#E8CFD2] bg-[#F8EDEF]/60 p-3 text-[#9A646D]">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[#9A646D] mt-0.5" />
              <span>{confirmModal.message}</span>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-[#F8EDEF] hover:bg-[#F8EDEF] text-white"
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.actionLabel}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
