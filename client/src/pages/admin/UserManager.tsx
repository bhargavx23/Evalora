import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Users, GraduationCap, Building2, Search, X } from 'lucide-react';

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filterRole, setFilterRole] = useState<'all' | 'faculty' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setLoadError('');
    api.get('/users')
      .then(res => {
        if (res.data.success) {
          setUsers(res.data.users || []);
        } else {
          setLoadError('Unable to load users.');
        }
      })
      .catch(() => setLoadError('Unable to connect to user management. Try again.'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = users
    .filter(u => {
      if (filterRole === 'all') return true;
      return u.role === filterRole;
    })
    .filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const deptCode = typeof u.departmentId === 'object' && u.departmentId?.code ? u.departmentId.code.toLowerCase() : '';
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.studentId?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        deptCode.includes(q)
      );
    });

  return (
    <div className="page-shell">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E5EF] pb-6">
        <div>
          <div className="page-kicker">Administration</div>
          <h1 className="page-title mt-1">User Management</h1>
          <p className="page-copy">
            Manage faculty instructors, examiners, administrators, and enrolled students
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EFF2F8] rounded-xl border border-[#E0E5EF] text-xs">
          <button
            onClick={() => setFilterRole('all')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              filterRole === 'all'
                ? 'bg-white text-[#3C4B63] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setFilterRole('student')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              filterRole === 'student'
                ? 'bg-white text-[#3C648E] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setFilterRole('faculty')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              filterRole === 'faculty'
                ? 'bg-white text-[#5288B8] font-semibold shadow-xs'
                : 'text-[#748199] hover:text-[#3C4B63]'
            }`}
          >
            Faculty
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8490A2] absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by name, email, roll number, or department..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2 text-xs border border-[#E0E5EF] rounded-xl focus:outline-none focus:border-[#5288B8] focus:ring-2 focus:ring-[#5288B8]/15 text-[#3C4B63] bg-white transition-all shadow-[0_1px_2px_rgba(82,77,119,0.02)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-[#8490A2] hover:text-[#3C4B63]"
            title="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3C4B63]">
              Enrolled Users ({filtered.length})
            </span>
          </div>
        }
      >
        {loadError && (
          <div className="mb-4 rounded-xl border border-[#E9DAB5] bg-[#F8F3E8] px-3.5 py-2.5 text-xs font-medium text-[#8A7047]">
            {loadError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E0E5EF] text-[#8490A2] font-semibold uppercase text-[10px] tracking-wider">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Roll / ID</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E5EF]">
              {filtered.map(u => (
                <tr key={u._id} className="hover:bg-[#F7F8FC] transition-colors">
                  <td className="py-3 font-semibold text-[#3C4B63]">{u.name}</td>
                  <td className="py-3 text-[#748199]">{u.email}</td>
                  <td className="py-3">
                    <Badge variant={u.role === 'student' ? 'blue' : u.role === 'faculty' ? 'purple' : 'neutral'}>
                      {u.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 font-medium text-[#3C4B63]">
                    {typeof u.departmentId === 'object' && u.departmentId?.code ? u.departmentId.code : 'Unassigned'}
                  </td>
                  <td className="py-3 font-mono text-[#748199]">{u.studentId || u.employeeId || '—'}</td>
                  <td className="py-3 text-right">
                    <Badge variant={u.status === 'active' ? 'green' : 'rose'}>{u.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <div className="py-10 text-center text-xs text-[#748199] space-y-1">
              <div className="font-semibold text-[#3C4B63]">
                {searchQuery ? 'No matching users found' : 'No users registered yet'}
              </div>
              <div>{searchQuery ? 'Try adjusting your search criteria.' : 'Registered users will appear here.'}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
