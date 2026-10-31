import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LogoMark } from '../../components/ui/LogoMark';
import { AlgoPaymentPanel } from '../../features/payment/AlgoPaymentPanel';
import {
  Wallet,
  Check,
  Minus,
  Cpu,
  Layers,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Clock,
  Terminal,
  Code2,
  FileCheck2,
  Receipt,
  Download,
  Loader2
} from 'lucide-react';
import { PracticePlanItem } from '../../shared/types';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [plans, setPlans] = useState<PracticePlanItem[]>([]);
  const [network, setNetwork] = useState('testnet');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('domain_pass');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'matrix'>('cards');

  useEffect(() => {
    setIsLoading(true);
    api
      .get('/payments/plans')
      .then((res) => {
        if (res.data.success) {
          const loaded = res.data.plans || [];
          setPlans(loaded);
          setNetwork(res.data.network || 'testnet');
          if (loaded.some((p: any) => p.id === 'pro')) {
            setSelectedPlanId('pro');
          } else if (loaded.length > 0) {
            setSelectedPlanId(loaded[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load plans:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSubscribeClick = (planId: string) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    setSelectedPlanId(planId);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFE] text-[#1D1D1F] antialiased">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#D2D2D7] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="font-serif text-lg font-bold tracking-tight text-[#1D1D1F]">
              Evalora
            </span>
            <span className="rounded-full bg-[#E5F1FF] px-2 py-0.5 text-[10px] font-semibold text-[#007AFF]">
              Subscription & Plans
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/domains"
              className="hidden sm:inline-flex text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
            >
              Explore Domains
            </Link>
            {isAuthenticated ? (
              <Button size="sm" variant="secondary" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button size="sm" variant="primary" onClick={() => navigate('/register')}>
                  Create Free Account
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:py-16 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <Badge variant="blue">Transparent Algorand Micro-Payments</Badge>
          <h1 className="display-heading text-3xl sm:text-5xl font-serif text-[#1D1D1F] tracking-tight">
            One subscription. Extra attempts & full technology domain mastery.
          </h1>
          <p className="text-sm sm:text-base text-[#6E6E73] leading-relaxed">
            Free users receive 10 complimentary practice sessions. Subscribed learners unlock additional lifetime attempts,
            complete multi-domain curriculum paths (MERN, AI/ML, Frontend, Backend), and live sandboxed project workspaces.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C6DFD2] bg-[#E5F2EB] px-3 py-1 text-xs text-[#4C765D]">
            <ShieldCheck className="h-4 w-4 text-[#4C765D]" />
            <span>Strict platform pricing rule: Every premium package costs strictly under 9 ALGO.</span>
          </div>
        </div>

        {/* Two Core Benefits Spotlight */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#CFE2DC] bg-gradient-to-br from-white to-[#E5F1FF]/30 p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F1FF] text-[#007AFF]">
              <Layers className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-[#1D1D1F]">Benefit A — Extra Practice Attempts</h2>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Every learner begins with 10 free attempts. Subscribed plans grant +15 to +150 additional practice attempts across DSA, Quantitative Aptitude, Logical Reasoning, and Developer Coding. Practice attempts never expire.
            </p>
            <div className="text-xs font-semibold text-[#007AFF]">
              Atomic deduction • Session resumption without quota burn
            </div>
          </div>

          <div className="rounded-2xl border border-[#CFE2DC] bg-gradient-to-br from-white to-[#E5F1FF]/30 p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F1FF] text-[#007AFF]">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-[#1D1D1F]">Benefit B — Premium Domain Preparation</h2>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Subscribed users unlock full technology tracks including MERN Stack (7 structured modules with practical projects), AI/ML, Data Science, and Frontend Engineering with multi-tab web code editors and live sandboxes.
            </p>
            <div className="text-xs font-semibold text-[#0056CC]">
              Live iframe previews • Portfolio projects • Diagnostic assessments
            </div>
          </div>
        </div>

        {/* View Switcher: Packages vs Comparison Table */}
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-2xl border border-[#D2D2D7] bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`rounded-xl px-5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'cards'
                  ? 'bg-[#007AFF] text-white shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Subscription Packages
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`rounded-xl px-5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'matrix'
                  ? 'bg-[#007AFF] text-white shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Full Feature Comparison Matrix
            </button>
          </div>
        </div>

        {/* Dynamic Plan Content */}
        {isLoading ? (
          <div className="py-20 text-center text-xs text-[#6E6E73] flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            <span>Fetching live verified plans from backend...</span>
          </div>
        ) : activeTab === 'cards' ? (
          /* Cards View */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isPopular = Boolean(plan.popular);
              const hasDomains = Boolean(plan.entitlements?.domainPreparation);
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-6 transition-all duration-200 hover:shadow-lg ${
                    isPopular
                      ? 'border-[#007AFF] shadow-md ring-2 ring-[#007AFF]/20 relative'
                      : 'border-[#D2D2D7] hover:border-[#CFE2DC]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#1D1D1F]">{plan.name}</span>
                      {isPopular ? (
                        <Badge variant="green" size="sm">
                          Most Popular
                        </Badge>
                      ) : hasDomains ? (
                        <Badge variant="purple" size="sm">
                          All Domains
                        </Badge>
                      ) : (
                        <Badge variant="blue" size="sm">
                          Practice Pack
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#1D1D1F]">
                        {plan.priceAlgo}
                      </span>
                      <span className="font-semibold text-sm text-[#007AFF]">ALGO</span>
                      <span className="text-xs text-[#6E6E73]">
                        (~{(plan.priceAlgo * 1_000_000).toLocaleString()} microAlgos)
                      </span>
                    </div>

                    <p className="text-xs text-[#6E6E73] leading-relaxed">
                      {plan.description}
                    </p>

                    {/* Dual Benefits Breakdown */}
                    <div className="rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-medium text-[#1D1D1F]">
                        <Check className="h-4 w-4 text-[#4C765D] shrink-0" />
                        <span><strong>+{plan.paidAttempts}</strong> Extra Practice Attempts</span>
                      </div>
                      <div className="flex items-center gap-2 font-medium text-[#1D1D1F]">
                        {hasDomains ? (
                          <>
                            <Check className="h-4 w-4 text-[#007AFF] shrink-0" />
                            <span className="text-[#0056CC]">
                              <strong>{plan.entitlements?.subscriptionDurationDays || 30} Days</strong> All-Domain Pass
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-4 w-4 text-[#8490A2] shrink-0" />
                            <span className="text-[#6E6E73]">General Question Bank Only</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-2 border-t border-[#D2D2D7] text-xs">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[#1D1D1F]">
                          <Check className="h-3.5 w-3.5 text-[#4C765D] shrink-0 mt-0.5" />
                          <span className="text-[11px]">{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* Exclusions if any */}
                    {plan.exclusions && plan.exclusions.length > 0 && (
                      <div className="rounded-lg bg-[#F8F3E8]/70 border border-[#E9DAB5]/80 p-2.5 text-[10px] text-[#8A7047] space-y-1">
                        <span className="font-semibold block uppercase tracking-wider text-[9px] text-[#8A7047]">
                          Scope & Limits
                        </span>
                        {plan.exclusions.map((ex, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{ex}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#D2D2D7] space-y-2">
                    <Button
                      size="md"
                      variant={isPopular ? 'primary' : 'secondary'}
                      className="w-full justify-center text-xs font-semibold"
                      onClick={() => handleSubscribeClick(plan.id)}
                      icon={<Wallet className="h-3.5 w-3.5" />}
                    >
                      Subscribe with Pera Wallet
                    </Button>
                    <div className="text-center text-[10px] text-[#8490A2]">
                      Attempts never expire • Verified on Algorand
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Full Feature Matrix View */
          <div className="overflow-x-auto rounded-2xl border border-[#D2D2D7] bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D2D2D7] bg-[#F5F5F7] text-[#1D1D1F]">
                  <th className="p-4 font-semibold text-xs">Capability / Entitlement</th>
                  <th className="p-4 font-semibold text-xs text-center">Free Tier</th>
                  {plans.map((p) => (
                    <th key={p.id} className="p-4 font-semibold text-xs text-center">
                      <div>{p.name}</div>
                      <div className="text-sm font-bold text-[#007AFF]">{p.priceAlgo} ALGO</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D2D2D7] text-xs text-[#1D1D1F]">
                <tr>
                  <td className="p-4 font-medium">Price in ALGO</td>
                  <td className="p-4 text-center text-[#6E6E73]">0 ALGO</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center font-bold text-[#007AFF]">
                      {p.priceAlgo} ALGO
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Included Practice Attempts</td>
                  <td className="p-4 text-center">10 Free</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center font-semibold text-[#4C765D]">
                      +{p.paidAttempts} Extra
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Technology Domains (MERN, AI/ML, Data Science, etc.)</td>
                  <td className="p-4 text-center text-[#6E6E73]">Curriculum Preview</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      {p.entitlements?.domainPreparation ? (
                        <Badge variant="purple" size="sm">
                          {p.entitlements.subscriptionDurationDays} Days Access
                        </Badge>
                      ) : (
                        <span className="text-[#8490A2]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Multi-Tab Web Code Editor & Live Preview</td>
                  <td className="p-4 text-center text-[#8490A2]">—</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      {p.entitlements?.codeWorkspacesEnabled || p.entitlements?.domainPreparation ? (
                        <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                      ) : (
                        <span className="text-[#8490A2]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                    <span>Interactive Code Visualizer (Line Stepper &amp; Memory Watcher)</span>
                  </td>
                  <td className="p-4 text-center text-[#8490A2]">—</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      {p.entitlements?.codeVisualization ? (
                        <div className="flex flex-col items-center">
                          <Check className="h-4 w-4 text-[#4C765D]" />
                          <span className="text-[10px] text-[#007AFF] font-semibold mt-0.5">Included</span>
                        </div>
                      ) : (
                        <span className="text-[#8490A2]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Sandboxed Code Judge (C, C++, Python, Java)</td>
                  <td className="p-4 text-center">
                    <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">48-Hour AI Autonomous Question Generation</td>
                  <td className="p-4 text-center">
                    <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Downloadable PDF Performance Reports</td>
                  <td className="p-4 text-center">
                    <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Official Cryptographic Payment Receipt (PDF)</td>
                  <td className="p-4 text-center text-[#8490A2]">—</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      <Check className="h-4 w-4 text-[#4C765D] mx-auto" />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-medium">Attempt Expiration Policy</td>
                  <td className="p-4 text-center">Never</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center font-medium">
                      Never
                    </td>
                  ))}
                </tr>
                <tr className="bg-[#F5F5F7]">
                  <td className="p-4 font-medium">Action</td>
                  <td className="p-4 text-center text-[#6E6E73]">Included</td>
                  {plans.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSubscribeClick(p.id)}
                      >
                        Subscribe
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* FAQ Section */}
        <section className="pt-12 border-t border-[#D2D2D7] max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-serif font-bold text-[#1D1D1F]">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-[#6E6E73]">
              Everything you need to know about Evalora subscriptions, attempts, and Algorand micro-payments.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 space-y-1.5">
              <h3 className="font-semibold text-xs text-[#1D1D1F]">How does the 10 free attempt policy work?</h3>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                Every newly registered candidate receives 10 free practice attempts. Attempts are only deducted once per completed practice session. Refreshes, retries, and in-progress sessions resume seamlessly without deducting extra attempts.
              </p>
            </div>

            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 space-y-1.5">
              <h3 className="font-semibold text-xs text-[#1D1D1F]">What happens when my domain subscription expires?</h3>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                When a 30-day or 90-day domain pass expires, your historical learning progress, submitted code, milestone completions, and scores remain permanently saved on your profile. Your unlocked practice attempts never expire. You can renew your subscription anytime to resume active domain modules.
              </p>
            </div>

            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 space-y-1.5">
              <h3 className="font-semibold text-xs text-[#1D1D1F]">Why are payments in ALGO and strictly under 9 ALGO?</h3>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                Evalora utilizes the Algorand blockchain for instant, low-cost micro-transactions with sub-4-second finality and negligible network fees (~0.001 ALGO). To maintain affordable student access, all plans are strictly enforced by the backend to cost less than 9 ALGO.
              </p>
            </div>

            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 space-y-1.5">
              <h3 className="font-semibold text-xs text-[#1D1D1F]">Can I download an official payment receipt?</h3>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                Yes. Immediately upon on-chain verification, a cryptographically signed PDF Payment Receipt is generated with the Algorand Transaction ID, payer address, timestamp, and breakdown, downloadable directly from your profile and payment modal.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#625E75]/35 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <AlgoPaymentPanel
              onClose={() => setIsPaymentModalOpen(false)}
              onSuccess={() => {
                setIsPaymentModalOpen(false);
                navigate('/dashboard');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
