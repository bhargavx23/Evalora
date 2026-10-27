import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AlgoPaymentPanel } from '../../features/payment/AlgoPaymentPanel';
import {
  Compass,
  Layers,
  Cpu,
  BarChart3,
  Monitor,
  Server,
  Globe,
  Lock,
  Unlock,
  ArrowRight,
  BookOpen,
  Code2,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';

interface DomainCardItem {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  technologies: string[];
  overview: string;
  icon: string;
  badge: string;
  moduleCount: number;
  projectCount: number;
  assessmentCount: number;
  hasAccess: boolean;
  subscriptionRequired: boolean;
}

interface SubscriptionInfo {
  isSubscribed: boolean;
  allowedDomains: string[];
  daysRemaining?: number;
  planName?: string;
}

export const DomainExploration: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [domains, setDomains] = useState<DomainCardItem[]>([]);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo>({
    isSubscribed: false,
    allowedDomains: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedDomainForUnlock, setSelectedDomainForUnlock] = useState<DomainCardItem | null>(null);

  const fetchDomainsAndSubscription = async () => {
    try {
      setIsLoading(true);
      const [domainsRes, subRes] = await Promise.allSettled([
        api.get('/domains'),
        api.get('/payments/subscription/status')
      ]);

      if (domainsRes.status === 'fulfilled' && domainsRes.value.data.success) {
        setDomains(domainsRes.value.data.domains || []);
      }

      if (subRes.status === 'fulfilled' && subRes.value.data.success) {
        setSubInfo({
          isSubscribed: subRes.value.data.subscribed || false,
          allowedDomains: subRes.value.data.subscription?.entitlements?.allowedDomains || [],
          daysRemaining: subRes.value.data.subscription?.daysRemaining,
          planName: subRes.value.data.subscription?.planName
        });
      }
    } catch {
      toast.error('Failed to load technology domains.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomainsAndSubscription();
  }, []);

  const handleDomainClick = (domain: DomainCardItem) => {
    // Check if user has access to this domain
    const hasAccess =
      domain.hasAccess ||
      subInfo.isSubscribed ||
      user?.role === 'platform_admin' ||
      user?.role === 'college_admin';

    if (hasAccess) {
      navigate(`/domains/${domain.slug}`);
    } else {
      setSelectedDomainForUnlock(domain);
      setIsPaymentModalOpen(true);
    }
  };

  const getDomainIcon = (iconName: string) => {
    switch (iconName) {
      case 'layers':
        return <Layers className="h-6 w-6 text-[#7779C5]" />;
      case 'cpu':
        return <Cpu className="h-6 w-6 text-[#527565]" />;
      case 'bar-chart':
        return <BarChart3 className="h-6 w-6 text-[#896D45]" />;
      case 'monitor':
        return <Monitor className="h-6 w-6 text-[#555780]" />;
      case 'server':
        return <Server className="h-6 w-6 text-[#555780]" />;
      case 'globe':
        return <Globe className="h-6 w-6 text-[#527565]" />;
      default:
        return <Compass className="h-6 w-6 text-[#7779C5]" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Hierarchy */}
      <header className="flex flex-col justify-between gap-5 border-b border-[#E9E7F0] pb-7 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F0EFF9] border border-[#DEDDF0] px-3 py-1 text-xs font-semibold text-[#555780] mb-3">
            <Compass className="h-3.5 w-3.5 text-[#7779C5]" />
            <span>Multi-Domain Career Preparation</span>
          </div>
          <h1 className="page-title display-heading text-3xl sm:text-4xl text-[#49465B]">
            Explore Your Learning Path
          </h1>
          <p className="page-copy mt-2 text-[#777486] max-w-2xl">
            Choose a technology domain and prepare with structured learning, beginner-to-advanced lessons, coding practice, and technical assessments.
          </p>
        </div>

        {/* Subscription Status Bar */}
        <div className="shrink-0">
          {subInfo.isSubscribed ? (
            <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#C8DFD1] bg-[#E9F3ED] px-4 py-2.5 text-xs text-[#527565]">
              <CheckCircle2 className="h-4 w-4 text-[#527565] shrink-0" />
              <span>
                <strong>Active Plan:</strong> {subInfo.planName || 'All-Access Pass'}
                {subInfo.daysRemaining !== undefined && ` (${subInfo.daysRemaining} days remaining)`}
              </span>
            </div>
          ) : (
            <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-[#DEDDF0] bg-[#F0EFF9] px-4 py-2.5 text-xs text-[#555780]">
              <ShieldCheck className="h-4 w-4 text-[#7779C5] shrink-0" />
              <span>Domain access via Algorand payment (&lt; 9 ALGO).</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedDomainForUnlock(null);
                  setIsPaymentModalOpen(true);
                }}
              >
                View Plans
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#7779C5]" />
            <p className="text-sm font-medium text-[#777486]">Loading learning paths...</p>
          </div>
        </div>
      ) : (
        /* Domain Cards Grid */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => {
            const hasAccess =
              domain.hasAccess ||
              subInfo.isSubscribed ||
              user?.role === 'platform_admin' ||
              user?.role === 'college_admin';

            return (
              <div
                key={domain.slug}
                onClick={() => handleDomainClick(domain)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E9E7F0] bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#DEDDF0] hover:shadow-md cursor-pointer"
              >
                {/* Card Top: Icon & Badge */}
                <div>
                  <div className="flex items-center justify-between pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8F7FC] border border-[#E9E7F0] group-hover:scale-105 transition-transform">
                      {getDomainIcon(domain.icon)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="blue">
                        {domain.badge || 'Track'}
                      </Badge>
                      {hasAccess ? (
                        <Badge variant="green">
                          <Unlock className="h-3 w-3" /> Unlocked
                        </Badge>
                      ) : (
                        <Badge variant="amber">
                          <Lock className="h-3 w-3" /> Premium
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Title & Short Description */}
                  <h3 className="text-xl font-bold text-[#49465B] group-hover:text-[#7779C5] transition-colors">
                    {domain.name}
                  </h3>
                  <p className="mt-2 text-sm text-[#777486] line-clamp-2">
                    {domain.shortDescription}
                  </p>

                  {/* Technology Badges */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {domain.technologies.slice(0, 5).map((tech) => (
                      <span
                        key={tech}
                        className="rounded bg-[#F1F2F8] px-2 py-0.5 text-[11px] font-medium text-[#49465B]"
                      >
                        {tech}
                      </span>
                    ))}
                    {domain.technologies.length > 5 && (
                      <span className="rounded bg-[#F1F2F8] px-1.5 py-0.5 text-[11px] font-medium text-[#777486]">
                        +{domain.technologies.length - 5}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Metrics & CTA */}
                <div className="mt-6 border-t border-[#E9E7F0] pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#777486] pb-4">
                    <div className="rounded-lg bg-[#F8F7FC] p-2">
                      <span className="block font-bold text-[#49465B] text-sm">{domain.moduleCount}</span>
                      <span>Modules</span>
                    </div>
                    <div className="rounded-lg bg-[#F8F7FC] p-2">
                      <span className="block font-bold text-[#49465B] text-sm">{domain.projectCount}</span>
                      <span>Projects</span>
                    </div>
                    <div className="rounded-lg bg-[#F8F7FC] p-2">
                      <span className="block font-bold text-[#49465B] text-sm">{domain.assessmentCount || 1}</span>
                      <span>Exams</span>
                    </div>
                  </div>

                  <Button
                    variant={hasAccess ? 'primary' : 'warm'}
                    className="w-full flex items-center justify-center gap-2"
                    icon={hasAccess ? <ArrowRight className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                  >
                    <span>{hasAccess ? 'Start Preparation' : 'Unlock Access'}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pera Wallet Payment Modal */}
      {isPaymentModalOpen && (
        <AlgoPaymentPanel
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            toast.success('Subscription activated! You now have full access to technology domains.');
            fetchDomainsAndSubscription();
          }}
        />
      )}
    </div>
  );
};
