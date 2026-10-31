import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Building2, FileCheck2, PlusCircle, Users } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/departments').catch(() => ({ data: { success: false } })),
      api.get('/assessments').catch(() => ({ data: { success: false } }))
    ]).then(([deptRes, assRes]) => {
      if (deptRes.data.success) setDepartments(deptRes.data.departments);
      if (assRes.data.success) setAssessments(assRes.data.assessments);
      if (!deptRes.data.success || !assRes.data.success) {
        setLoadError('Some administration data could not be loaded. Try refreshing the page.');
      }
    }).finally(() => setIsLoading(false));
  }, []);

  const totalStudents = departments.reduce((acc, d) => acc + (d.studentCount || 0), 0);
  const totalFaculty = departments.reduce((acc, d) => acc + (d.facultyCount || 0), 0);
  const collegeName = typeof user?.collegeId === 'object' && user?.collegeId?.name ? user.collegeId.name : 'Institution workspace';

  return (
    <div className="page-shell">
      <header className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end">
        <div>
          <p className="page-kicker">{collegeName}</p>
          <h1 className="page-title">Institution Administration</h1>
          <p className="page-copy">Manage departments, faculty, students, and assessment readiness from one scoped workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')} icon={<Users className="h-4 w-4" />}>
            Users
          </Button>
          <Button size="sm" onClick={() => navigate('/admin/departments')} icon={<PlusCircle className="h-4 w-4" />}>
            Departments
          </Button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-md border border-[#E9DAB5] bg-[#F4EAC5]/50 px-3 py-2 text-xs font-medium text-[#8A7047]">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Departments" value={isLoading ? '...' : String(departments.length)} />
        <Metric label="Students" value={isLoading ? '...' : String(totalStudents)} />
        <Metric label="Faculty" value={isLoading ? '...' : String(totalFaculty)} />
        <Metric label="Assessments" value={isLoading ? '...' : String(assessments.length)} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-950">Academic Departments</span>
              <Badge variant="blue">{departments.length} total</Badge>
            </div>
          }
        >
          {isLoading ? (
            <SkeletonRows rows={4} />
          ) : departments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Code</th>
                    <th className="pb-3 font-medium">Faculty</th>
                    <th className="pb-3 font-medium">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {departments.map(dept => (
                    <tr key={dept._id}>
                      <td className="py-3">
                        <div className="font-medium text-neutral-950">{dept.name}</div>
                        <div className="text-xs text-gray-500">{dept.description || 'No description provided'}</div>
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-600">{dept.code}</td>
                      <td className="py-3 text-gray-700">{dept.facultyCount ?? 0}</td>
                      <td className="py-3 text-gray-700">{dept.studentCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="No departments yet"
              description="Create departments to start seeing real faculty and student counts."
              action={<Button size="sm" onClick={() => navigate('/admin/departments')}>Manage Departments</Button>}
            />
          )}
        </Card>

        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <FileCheck2 className="h-4 w-4" />
              Assessment Readiness
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Assessment counts reflect real records created in this tenant. Student performance analytics appear only after submissions exist.
            </p>
            <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => navigate('/faculty/assessments')}>
              View Assessments
            </Button>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-5">
            <div className="text-sm font-semibold text-neutral-950">Workspace Scope</div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Faculty and student data is scoped to the active institution and department assignments.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-l border-stone-200 pl-4">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">{value}</div>
  </div>
);
