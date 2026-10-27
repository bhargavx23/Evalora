import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Building, ArrowRight, ShieldCheck } from 'lucide-react';

export const CollegeRegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    collegeName: '',
    collegeCode: '',
    domain: '',
    contactEmail: '',
    phone: '',
    address: '',
    adminName: '',
    adminPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { user, authStatus, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (authStatus === "authenticated" && user) {
      if (user.role === "college_admin") navigate("/admin/dashboard", { replace: true });
      else if (user.role === "faculty") navigate("/faculty/dashboard", { replace: true });
      else navigate("/dashboard", { replace: true });
    }
  }, [authStatus, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register-college', formData);
      if (res.data.success) {
        toast.success('Institution onboarding completed! Logging you in as College Administrator...');
        await login(formData.contactEmail, formData.adminPassword);
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Institution onboarding failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <Card>
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex p-2 rounded-xl bg-[#DDE7F7] text-[#555780] mb-1">
              <Building className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Register Your College / University</h2>
            <p className="text-xs text-gray-500">Set up isolated tenant workspace for your institution</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">College / University Name</label>
                <input
                  type="text"
                  value={formData.collegeName}
                  onChange={e => setFormData({ ...formData, collegeName: e.target.value })}
                  placeholder="e.g. National Tech Institute"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Institution Code (Unique)</label>
                <input
                  type="text"
                  value={formData.collegeCode}
                  onChange={e => setFormData({ ...formData, collegeCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. NTI"
                  className="w-full px-3 py-2 uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Email Domain (Optional)</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={e => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="e.g. nti.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Campus Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="City, State, Country"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-gray-200">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                Primary Administrator Details
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Admin Full Name</label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="Dean / Principal Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Admin Email (Login ID)</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="admin@nti.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Admin Password</label>
              <input
                type="password"
                value={formData.adminPassword}
                onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7779C5] focus:outline-none"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-3"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Complete Institutional Onboarding
            </Button>
          </form>

          <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-100">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-[#555780] hover:underline">
              Log in to your workspace
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};
