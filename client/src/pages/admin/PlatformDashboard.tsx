import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  Building,
  Users,
  GraduationCap,
  Code2,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Cpu,
  Power
} from 'lucide-react';

export const PlatformDashboard: React.FC = () => {
  const toast = useToast();
  const [metrics, setMetrics] = useState<any>(null);
  const [colleges, setColleges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    domain: '',
    contactEmail: '',
    phone: '',
    address: ''
  });

  const fetchPlatformData = () => {
    setIsLoading(true);
    setLoadError('');
    api.get('/analytics/platform')
      .then(res => {
        if (res.data.success) {
          setMetrics(res.data.metrics);
          setColleges(res.data.colleges);
        } else {
          setLoadError('Unable to load platform metrics.');
        }
      })
      .catch(() => setLoadError('Unable to connect to platform analytics. Try again.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const handleToggleStatus = async (colId: string) => {
    try {
      const res = await api.patch(`/colleges/${colId}/toggle-status`);
      if (res.data.success) {
        toast.success(`Institution status updated: ${res.data.status}`);
        fetchPlatformData();
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/colleges', formData);
      if (res.data.success) {
        toast.success('College institution onboarded successfully');
        setIsAddModalOpen(false);
        setFormData({ name: '', code: '', domain: '', contactEmail: '', phone: '', address: '' });
        fetchPlatformData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create college');
    }
  };

  return (
    <div className="space-y-8 py-2 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DDE7F7] text-[#555780] text-xs font-semibold mb-1">
            <Cpu className="w-3.5 h-3.5 text-[#555780]" />
            Global Platform Administration
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Platform System Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Cross-tenant institutional oversight, resource provisioning, and active sandbox runners
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          icon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Add Institution
        </Button>
      </div>

      {/* Metric Cards */}
      {loadError && (
        <div className="rounded-lg border border-[#E8D9B9] bg-[#F8F3E8] px-3 py-2 text-xs font-medium text-[#896D45]">
          {loadError}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card pastelAccent="blue">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Institutions
            </span>
            <div className="text-2xl font-bold text-[#555780]">{isLoading ? '...' : metrics?.totalColleges ?? 0}</div>
            <div className="text-[10px] text-gray-400">Active Tenant Workspaces</div>
          </div>
        </Card>

        <Card pastelAccent="mint">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Enrolled Students
            </span>
            <div className="text-2xl font-bold text-[#527565]">{isLoading ? '...' : metrics?.totalStudents ?? 0}</div>
            <div className="text-[10px] text-gray-400">Total Registered Examinees</div>
          </div>
        </Card>

        <Card pastelAccent="purple">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Faculty Staff
            </span>
            <div className="text-2xl font-bold text-[#555780]">{isLoading ? '...' : metrics?.totalFaculty ?? 0}</div>
            <div className="text-[10px] text-gray-400">Active Examiners</div>
          </div>
        </Card>

        <Card pastelAccent="peach">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Code Executions
            </span>
            <div className="text-2xl font-bold text-[#896D45]">{isLoading ? '...' : metrics?.totalSubmissions ?? 0}</div>
            <div className="text-[10px] text-gray-400">Sandboxed Submissions</div>
          </div>
        </Card>
      </div>

      {/* Registered Colleges Table */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-600" />
              Institutions & Colleges ({colleges.length})
            </span>
            <Badge variant="blue">Multi-Tenant Scoped</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                <th className="pb-3">Institution Name</th>
                <th className="pb-3">Code</th>
                <th className="pb-3">Domain</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colleges.map(c => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="py-3 font-semibold text-gray-900">{c.name}</td>
                  <td className="py-3 font-mono font-bold text-[#555780]">{c.code}</td>
                  <td className="py-3 text-gray-500">{c.domain || 'N/A'}</td>
                  <td className="py-3">
                    <Badge variant={c.status === 'active' ? 'green' : 'rose'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant={c.status === 'active' ? 'outline' : 'accent'}
                      size="sm"
                      onClick={() => handleToggleStatus(c._id)}
                      icon={<Power className="w-3 h-3" />}
                    >
                      {c.status === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && colleges.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-500">
              <div className="font-semibold text-gray-800">No institutions yet</div>
              <div className="mt-1">Platform metrics will populate after institutions are onboarded.</div>
            </div>
          )}
        </div>
      </Card>

      {/* Add College Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Onboard New Educational Institution"
        >
          <form onSubmit={handleCreateCollege} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">College Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Cambridge Institute of Tech"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. CIT"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg uppercase"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Domain</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={e => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="e.g. cit.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="admin@cit.edu"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Provision Workspace
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
