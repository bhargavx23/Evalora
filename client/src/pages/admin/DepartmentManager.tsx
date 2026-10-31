import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Building2, PlusCircle, Trash2, Search, X } from 'lucide-react';

export const DepartmentManager: React.FC = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  const fetchDepts = () => {
    api.get('/departments')
      .then(res => {
        if (res.data.success) {
          setDepartments(res.data.departments || []);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/departments', formData);
      if (res.data.success) {
        toast.success('Department created successfully');
        setIsModalOpen(false);
        setFormData({ name: '', code: '', description: '' });
        fetchDepts();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Department deleted');
      fetchDepts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cannot delete department');
    }
  };

  const filtered = departments.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.code?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-shell">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D2D2D7] pb-6">
        <div>
          <div className="page-kicker">Administration</div>
          <h1 className="page-title mt-1">Department Management</h1>
          <p className="page-copy">
            Manage institutional academic branches, codes, and department allocations
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          icon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Add Department
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8490A2] absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by department name or code..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2 text-xs border border-[#D2D2D7] rounded-xl focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 text-[#1D1D1F] bg-white transition-all shadow-[0_1px_2px_rgba(82,77,119,0.02)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-[#8490A2] hover:text-[#1D1D1F]"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1D1D1F]">
              Academic Departments ({filtered.length})
            </span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D2D2D7] text-[#8490A2] font-semibold uppercase text-[10px] tracking-wider">
                <th className="pb-3">Department Name</th>
                <th className="pb-3">Code</th>
                <th className="pb-3">Faculty Count</th>
                <th className="pb-3">Student Count</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2D2D7]">
              {filtered.map(d => (
                <tr key={d._id} className="hover:bg-[#F5F5F7] transition-colors">
                  <td className="py-3 font-semibold text-[#1D1D1F]">{d.name}</td>
                  <td className="py-3 font-mono text-[#0056CC] font-bold">{d.code}</td>
                  <td className="py-3 text-[#6E6E73]">{d.facultyCount || 0}</td>
                  <td className="py-3 text-[#6E6E73]">{d.studentCount || 0}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDelete(d._id)}
                      className="p-1.5 text-[#6E6E73] hover:text-[#A36162] hover:bg-[#F8EDEF] rounded-lg transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#6E6E73]">
                    {searchQuery ? 'No departments match your search.' : 'No departments configured yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Department"
        >
          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#1D1D1F] mb-1">Department Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Computer Science & Engineering"
                className="w-full px-3.5 py-2.5 border border-[#D2D2D7] rounded-xl text-xs text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1D1D1F] mb-1">Department Code</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CSE"
                className="w-full px-3.5 py-2.5 border border-[#D2D2D7] rounded-xl text-xs text-[#1D1D1F] font-mono focus:border-[#007AFF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1D1D1F] mb-1">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief department scope..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-[#D2D2D7] rounded-xl text-xs text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#D2D2D7]">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Department
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
