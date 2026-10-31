import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Save,
  Upload,
  UserRound,
  Code2,
  GraduationCap,
  Wallet,
  CheckCircle2,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  FolderGit2,
  Award,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface Project {
  name: string;
  description: string;
  url?: string;
  technologies: string[];
}

interface ProfileLink {
  label: string;
  url: string;
}

const emptyProfile = {
  headline: '',
  bio: '',
  phone: '',
  location: '',
  degree: '',
  branch: '',
  graduationYear: '',
  cgpa: '',
  skills: [] as string[],
  programmingLanguages: [] as string[],
  frameworks: [] as string[],
  tools: [] as string[],
  certifications: [] as string[],
  projects: [] as Project[],
  links: [] as ProfileLink[],
};

export const ProfilePage: React.FC = () => {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(emptyProfile);
  const [candidateName, setCandidateName] = useState('');
  const [resume, setResume] = useState<any>(null);
  const [completion, setCompletion] = useState<any>({ percentage: 0, missing: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  // Sub-entity input states
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('GitHub');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Project Modal/Form state
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projUrl, setProjUrl] = useState('');
  const [projTech, setProjTech] = useState('');

  const load = () => {
    setIsLoading(true);
    api
      .get('/profile')
      .then((res) => {
        if (res.data.success) {
          setData(res.data.user);
          setCandidateName(res.data.user?.name || '');
          setProfile({
            ...emptyProfile,
            ...(res.data.profile || {}),
            skills: Array.isArray(res.data.profile?.skills) ? res.data.profile.skills : [],
            certifications: Array.isArray(res.data.profile?.certifications) ? res.data.profile.certifications : [],
            projects: Array.isArray(res.data.profile?.projects) ? res.data.profile.projects : [],
            links: Array.isArray(res.data.profile?.links) ? res.data.profile.links : [],
          });
          setResume(res.data.resume);
          setCompletion(res.data.completion || { percentage: 0, missing: [] });
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Unable to load profile'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: string, value: any) =>
    setProfile((current: any) => ({ ...current, [key]: value }));

  const save = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...profile,
        name: candidateName.trim(),
        phone: profile.phone?.trim(),
        graduationYear: profile.graduationYear ? Number(profile.graduationYear) : undefined,
        cgpa: profile.cgpa ? Number(profile.cgpa) : undefined,
      };

      const res = await api.put('/profile', payload);
      setProfile((prev: any) => ({ ...prev, ...(res.data.profile || {}) }));
      setCompletion(res.data.completion || completion);
      setData((prev: any) => ({ ...prev, name: candidateName.trim() }));
      toast.success('Profile saved and synced successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Skill tag management
  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (profile.skills.includes(trimmed)) {
      toast.warning('Skill already added.');
      return;
    }
    const updated = [...profile.skills, trimmed];
    update('skills', updated);
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = profile.skills.filter((s: string) => s !== skillToRemove);
    update('skills', updated);
  };

  // Certification management
  const handleAddCert = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = newCert.trim();
    if (!trimmed) return;
    if (profile.certifications.includes(trimmed)) {
      toast.warning('Certification already listed.');
      return;
    }
    const updated = [...profile.certifications, trimmed];
    update('certifications', updated);
    setNewCert('');
  };

  const handleRemoveCert = (certToRemove: string) => {
    const updated = profile.certifications.filter((c: string) => c !== certToRemove);
    update('certifications', updated);
  };

  // Project management
  const handleSaveProject = () => {
    if (!projName.trim()) {
      toast.error('Project title is required.');
      return;
    }
    const techArray = projTech
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newProject: Project = {
      name: projName.trim(),
      description: projDesc.trim(),
      url: projUrl.trim() || undefined,
      technologies: techArray,
    };

    const updatedProjects = [...profile.projects, newProject];
    update('projects', updatedProjects);

    // Reset project form
    setProjName('');
    setProjDesc('');
    setProjUrl('');
    setProjTech('');
    setIsAddingProject(false);
    toast.info('Project added to list. Click "Save Changes" to persist.');
  };

  const handleRemoveProject = (index: number) => {
    const updated = profile.projects.filter((_: any, i: number) => i !== index);
    update('projects', updated);
  };

  // Link management
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) {
      toast.error('URL cannot be empty.');
      return;
    }
    const normalizedUrl =
      newLinkUrl.startsWith('http://') || newLinkUrl.startsWith('https://')
        ? newLinkUrl.trim()
        : `https://${newLinkUrl.trim()}`;

    const updatedLinks = [...profile.links, { label: newLinkLabel, url: normalizedUrl }];
    update('links', updatedLinks);
    setNewLinkUrl('');
  };

  const handleRemoveLink = (index: number) => {
    const updated = profile.links.filter((_: any, i: number) => i !== index);
    update('links', updated);
  };

  // Resume Upload
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await api.post('/profile/resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResume(res.data.resume);
      setCompletion((current: any) => ({
        ...current,
        percentage: Math.max(current.percentage, 25),
        missing: current.missing.filter((item: string) => item !== 'Resume'),
      }));
      toast.success('Resume uploaded successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Resume upload failed');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  // Avatar Upload
  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      await api.post('/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
      toast.success('Profile photo updated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Profile photo upload failed');
    } finally {
      setIsAvatarUploading(false);
      event.target.value = '';
    }
  };

  const copyWalletAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Wallet address copied to clipboard');
  };

  const primaryWallet =
    data?.walletAddress ||
    (data?.wallets && data.wallets.length > 0 ? data.wallets[0]?.address : null);

  const formatAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-[#D2D2D7] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#007AFF]">
              Candidate Workspace
            </span>
            <Badge variant="blue">{data?.role?.toUpperCase() || 'STUDENT'}</Badge>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1D1D1F] md:text-4xl mt-1">
            Candidate Profile
          </h1>
          <p className="mt-1 text-sm text-[#6E6E73]">
            Manage your personal credentials, skills portfolio, projects, and Algorand verification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={completion.percentage >= 80 ? 'green' : 'blue'}>
            {completion.percentage}% Profile Complete
          </Badge>
          <Button
            size="sm"
            variant="primary"
            isLoading={isSaving}
            onClick={() => save()}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            Save Changes
          </Button>
        </div>
      </header>

      {/* Top Section: Identity Summary & Status Overview */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* Left Card: Candidate Identity & Photo */}
        <Card>
          <div className="flex items-center gap-4">
            <label className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#E5F1FF] text-2xl font-semibold text-[#0056CC] shadow-[inset_0_0_0_1px_rgba(119,121,197,0.16)] flex-shrink-0">
              {data?.avatar ? (
                <img
                  src={`/api/profile/avatar/${data.avatar}`}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                candidateName.charAt(0) || <UserRound className="h-8 w-8" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-[#1D1D1F]/80 py-1 text-center text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {isAvatarUploading ? '...' : 'Change'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={uploadAvatar}
              />
            </label>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#1D1D1F] truncate">
                  {candidateName || 'Add Your Name'}
                </h2>
                {data?.emailVerified && (
                  <span title="Verified Account">
                    <CheckCircle2 className="h-4 w-4 text-[#4C765D] flex-shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6E6E73] truncate mt-0.5">
                {profile.headline || 'No professional headline set'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] font-mono text-[#8490A2] bg-[#F5F5F7] px-2 py-0.5 rounded border border-[#D2D2D7]">
                  {data?.email}
                </span>
                <Badge variant={data?.status === 'active' ? 'green' : 'amber'}>
                  {data?.status || 'active'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#D2D2D7] pt-5">
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-[#6E6E73]">Profile Strength</span>
              <span className="font-semibold text-[#1D1D1F]">{completion.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F5F5F7]">
              <div
                className="h-full rounded-full bg-[#007AFF] transition-all duration-500"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </div>

          {completion.missing.length > 0 ? (
            <div className="mt-5 border-t border-[#D2D2D7] pt-4">
              <p className="text-xs font-semibold text-[#1D1D1F]">Suggested additions to reach 100%:</p>
              <ul className="mt-2.5 space-y-1.5 text-xs text-[#6E6E73]">
                {completion.missing.map((item: string) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-[#007AFF] font-bold">+</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#E5F2EB] p-3 text-xs font-medium text-[#4C765D] border border-[#C6DFD2]">
              <CheckCircle2 className="h-4 w-4 text-[#4C765D] flex-shrink-0" />
              <span>Candidate profile is 100% complete!</span>
            </div>
          )}
        </Card>

        {/* Right Card: Pera Wallet & Account Quota */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#007AFF]" />
                <span className="text-sm font-semibold text-[#1D1D1F]">Pera Wallet & Quota</span>
              </div>
              <Link
                to="/settings"
                className="text-xs font-semibold text-[#007AFF] hover:underline"
              >
                Settings & Wallet
              </Link>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Wallet Status */}
            <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8490A2]">
                    Pera Wallet (Algorand)
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {primaryWallet ? (
                      <>
                        <span className="font-mono text-sm font-medium text-[#1D1D1F]">
                          {formatAddress(primaryWallet)}
                        </span>
                        <button
                          onClick={() => copyWalletAddress(primaryWallet)}
                          className="rounded p-1 text-[#6E6E73] hover:bg-white hover:text-[#1D1D1F] transition-colors"
                          title="Copy full address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[#8490A2]">No Pera wallet linked</span>
                    )}
                  </div>
                </div>
                <Badge variant={primaryWallet ? 'green' : 'amber'}>
                  {primaryWallet ? 'Connected & Verified' : 'Not Connected'}
                </Badge>
              </div>

              {!primaryWallet && (
                <div className="mt-3 border-t border-[#D2D2D7] pt-3">
                  <p className="text-xs text-[#6E6E73]">
                    Connect your Pera Wallet to verify on-chain credentials and purchase additional practice attempts.
                  </p>
                  <Link to="/settings" className="mt-2 inline-block">
                    <Button size="sm" variant="primary">
                      Connect Pera Wallet
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Practice Attempts Quota */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#D2D2D7] bg-white p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8490A2] flex items-center gap-1">
                  <Zap className="h-3 w-3 text-[#8A7047]" /> Complimentary Attempts
                </span>
                <div className="mt-1 text-base font-semibold text-[#1D1D1F]">
                  {Math.max(0, (data?.freeAttempts?.total ?? 10) - (data?.freeAttempts?.used ?? 0))}
                  <span className="text-xs font-normal text-[#8490A2]">
                    {' '}/ {data?.freeAttempts?.total ?? 10} remaining
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#D2D2D7] bg-white p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8490A2] flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-[#007AFF]" /> Paid / Purchased
                </span>
                <div className="mt-1 text-base font-semibold text-[#1D1D1F]">
                  {Math.max(0, (data?.paidAttempts?.total ?? 0) - (data?.paidAttempts?.used ?? 0))}
                  <span className="text-xs font-normal text-[#8490A2]">
                    {' '}/ {data?.paidAttempts?.total ?? 0} unlocked
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Form: Personal & Academic Credentials */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#1D1D1F]">Personal & Academic Details</h2>
              <p className="text-xs text-[#6E6E73] mt-0.5">
                Keep your details updated for personalized practice and placement recommendations.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              isLoading={isSaving}
              onClick={() => save()}
              icon={<Save className="h-3.5 w-3.5" />}
            >
              Save Details
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Full Name"
            value={candidateName}
            onChange={(v) => setCandidateName(v)}
            placeholder="Your full name"
          />
          <Field
            label="Professional Headline"
            value={profile.headline}
            onChange={(v) => update('headline', v)}
            placeholder="e.g. Full-Stack Developer / CS Student"
          />
          <Field
            label="Location"
            value={profile.location}
            onChange={(v) => update('location', v)}
            placeholder="e.g. Bengaluru, India"
          />
          <Field
            label="Phone"
            value={profile.phone}
            onChange={(v) => update('phone', v)}
            placeholder="+91 98765 43210"
          />
          <Field
            label="Degree Program"
            value={profile.degree}
            onChange={(v) => update('degree', v)}
            placeholder="B.Tech / B.E. / M.C.A."
          />
          <Field
            label="Branch / Major"
            value={profile.branch}
            onChange={(v) => update('branch', v)}
            placeholder="Computer Science"
          />
          <Field
            label="Graduation Year"
            value={profile.graduationYear}
            onChange={(v) => update('graduationYear', v)}
            placeholder="2027"
          />
          <Field
            label="CGPA / Percentage"
            value={profile.cgpa}
            onChange={(v) => update('cgpa', v)}
            placeholder="8.75"
          />
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-[#6E6E73]">Professional Bio / Summary</span>
          <textarea
            value={profile.bio || ''}
            onChange={(e) => update('bio', e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full resize-y rounded-lg border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-xs text-[#1D1D1F] placeholder:text-[#8490A2] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
            placeholder="Concise summary of your problem-solving experience, technical background, and career objectives."
          />
        </label>
      </Card>

      {/* Skills & Certifications Section */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Skills Tag Manager */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#007AFF]" />
                <span className="text-sm font-semibold text-[#1D1D1F]">Skills & Tech Stack</span>
              </div>
              <span className="text-xs text-[#8490A2]">{profile.skills.length} skills added</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder="e.g. Python, Dynamic Programming, React..."
                className="flex-1 rounded-lg border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#8490A2] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
              />
              <Button size="sm" variant="secondary" onClick={handleAddSkill} icon={<Plus className="h-3.5 w-3.5" />}>
                Add
              </Button>
            </div>

            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {profile.skills.map((skill: string) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F1FF] px-3 py-1 text-xs font-semibold text-[#0056CC] border border-[#007AFF]/20 shadow-xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="rounded-full p-0.5 text-[#007AFF] hover:bg-[#D6D8F8] transition-colors"
                      title="Remove skill"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D2D2D7] p-4 text-center text-xs text-[#8490A2]">
                No skills added yet. Type a technology or concept and click Add.
              </div>
            )}
          </div>
        </Card>

        {/* Certifications Manager */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-[#8A7047]" />
                <span className="text-sm font-semibold text-[#1D1D1F]">Certifications & Licenses</span>
              </div>
              <span className="text-xs text-[#8490A2]">{profile.certifications.length} listed</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                onKeyDown={handleAddCert}
                placeholder="e.g. AWS Solutions Architect, Meta React Specialist..."
                className="flex-1 rounded-lg border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] placeholder:text-[#8490A2] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
              />
              <Button size="sm" variant="secondary" onClick={handleAddCert} icon={<Plus className="h-3.5 w-3.5" />}>
                Add
              </Button>
            </div>

            {profile.certifications.length > 0 ? (
              <div className="space-y-2 pt-2">
                {profile.certifications.map((cert: string) => (
                  <div
                    key={cert}
                    className="flex items-center justify-between rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[#1D1D1F]">{cert}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCert(cert)}
                      className="text-[#8490A2] hover:text-[#A36162] transition-colors p-1"
                      title="Remove certification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D2D2D7] p-4 text-center text-xs text-[#8490A2]">
                No certifications listed yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Projects Portfolio Section */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-[#007AFF]" />
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F]">Projects & Portfolio</span>
                <p className="text-xs text-[#6E6E73] mt-0.5">
                  Showcase software projects, open source repositories, and technical deliverables.
                </p>
              </div>
            </div>
            {!isAddingProject && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsAddingProject(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add Project
              </Button>
            )}
          </div>
        }
      >
        {isAddingProject && (
          <div className="mb-6 rounded-xl border border-[#CFE2DC] bg-[#F5F5F7] p-5 shadow-xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#007AFF] mb-3">
              Add New Project
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Project Title *"
                value={projName}
                onChange={setProjName}
                placeholder="e.g. Algorithmic Trading Simulator"
              />
              <Field
                label="Live Demo or GitHub URL"
                value={projUrl}
                onChange={setProjUrl}
                placeholder="https://github.com/..."
              />
              <div className="sm:col-span-2">
                <Field
                  label="Technologies Used (comma separated)"
                  value={projTech}
                  onChange={setProjTech}
                  placeholder="e.g. Python, FastAPI, React, Docker"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#6E6E73]">Description</span>
                  <textarea
                    rows={2}
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                    placeholder="Key architectural highlights and technical contributions."
                    className="w-full resize-y rounded-lg border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsAddingProject(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveProject}>
                Save to Profile
              </Button>
            </div>
          </div>
        )}

        {profile.projects && profile.projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.projects.map((proj: Project, index: number) => (
              <div
                key={index}
                className="flex flex-col justify-between rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-xs hover:border-[#CFE2DC] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-[#1D1D1F]">{proj.name}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveProject(index)}
                      className="text-[#8490A2] hover:text-[#A36162] transition-colors p-1"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {proj.description && (
                    <p className="text-xs text-[#6E6E73] mt-1.5 leading-relaxed">{proj.description}</p>
                  )}
                  {proj.technologies && proj.technologies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {proj.technologies.map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-medium text-[#6E6E73] border border-[#D2D2D7]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {proj.url && (
                  <div className="mt-4 border-t border-[#D2D2D7] pt-2.5">
                    <a
                      href={proj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007AFF] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View Repository / Demo
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#D2D2D7] p-8 text-center">
            <FolderGit2 className="h-8 w-8 text-[#8490A2] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#1D1D1F]">No projects listed</p>
            <p className="text-xs text-[#6E6E73] mt-1">
              Add your technical projects to demonstrate hands-on coding capability.
            </p>
          </div>
        )}
      </Card>

      {/* Links & Resume & Academic Records */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* Social & Portfolio Links */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-[#007AFF]" />
              <span className="text-sm font-semibold text-[#1D1D1F]">Online Profiles</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="rounded-lg border border-[#D2D2D7] bg-white px-2 py-1.5 text-xs text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
              >
                <option value="GitHub">GitHub</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Portfolio">Portfolio</option>
                <option value="LeetCode">LeetCode</option>
                <option value="Blog">Blog</option>
              </select>
              <input
                type="text"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-xs text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
              />
              <Button size="sm" variant="secondary" onClick={handleAddLink} icon={<Plus className="h-3 w-3" />}>
                Add
              </Button>
            </div>

            {profile.links && profile.links.length > 0 ? (
              <div className="space-y-2">
                {profile.links.map((link: ProfileLink, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-[#1D1D1F]">{link.label}:</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[#007AFF] hover:underline"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(index)}
                      className="text-[#8490A2] hover:text-[#A36162] transition-colors ml-2"
                      title="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8490A2] text-center py-2">No links added yet.</p>
            )}
          </div>
        </Card>

        {/* Resume Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D1D1F]">Resume Document</span>
              {resume && <Badge variant="green">Uploaded</Badge>}
            </div>
          }
        >
          {resume ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E5F1FF] text-[#007AFF]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#1D1D1F] truncate">{resume.originalName}</p>
                  <p className="text-[11px] text-[#8490A2] mt-0.5">
                    {Math.round(resume.sizeBytes / 1024)} KB · {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/profile/resume/file"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                >
                  View Document
                </a>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]">
                  <Upload className="h-3 w-3 text-[#6E6E73]" /> {isUploading ? 'Uploading...' : 'Replace'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={upload}
                  />
                </label>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-7 w-7 text-[#8490A2]" />}
              title="No resume uploaded"
              description="Upload your PDF or DOCX resume to extract skills."
              action={
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#007AFF] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#367873]">
                  {isUploading ? 'Uploading...' : 'Upload Resume'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={upload}
                  />
                </label>
              }
            />
          )}
        </Card>

        {/* Academic / Institutional Records */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#007AFF]" />
              <span className="text-sm font-semibold text-[#1D1D1F]">Institution Data</span>
            </div>
          }
        >
          <dl className="space-y-2.5 text-xs">
            <Row label="Account Email" value={data?.email} />
            <Row
              label="Assigned College"
              value={typeof data?.collegeId === 'object' ? data.collegeId?.name : 'Independent Student'}
            />
            <Row
              label="Department"
              value={typeof data?.departmentId === 'object' ? data.departmentId?.name : 'Independent'}
            />
            <Row label="Student ID / Roll No" value={data?.studentId || 'None'} />
            <Row label="Account Role" value={data?.role || 'student'} />
          </dl>
        </Card>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-[#6E6E73]">{label}</span>
    <input
      className="w-full rounded-lg border border-[#D2D2D7] bg-white px-3.5 py-2 text-xs text-[#1D1D1F] placeholder:text-[#8490A2] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-[#D2D2D7] pb-2">
    <dt className="text-[#8490A2] truncate">{label}</dt>
    <dd className="text-right font-medium text-[#1D1D1F] truncate">{value || 'Not provided'}</dd>
  </div>
);
