import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Loader2,
  RefreshCw,
  XCircle,
  ArrowRight,
  Smartphone,
  Receipt,
  Download,
  BookOpen,
  Layers,
  Check,
  Minus,
  HelpCircle,
  Clock,
  Code2,
} from 'lucide-react';
import { triggerBlobDownload } from '../../utils/downloadFile';
import { PaymentReceiptModal } from '../../components/payment/PaymentReceiptModal';
import {
  ensureActivePeraSession,
  connectPeraForPayment,
  signPeraPaymentTransaction,
  getConnectedBrowserWallet,
} from '../../utils/algorandWallet';

export type PaymentFlowState =
  | 'select'
  | 'waiting_approval'
  | 'submitting'
  | 'verified'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface PracticePlanItem {
  id: string;
  planId?: string;
  name: string;
  description: string;
  priceAlgo: number;
  priceMicroAlgos: number;
  paidAttempts: number;
  attempts?: number;
  popular?: boolean;
  features?: string[];
  exclusions?: string[];
  entitlements?: {
    domainPreparation?: boolean;
    allowedDomains?: string[];
    subscriptionDurationDays?: number;
    unlimitedDomainPractice?: boolean;
    aiAdaptivePractice?: boolean;
    codeWorkspacesEnabled?: boolean;
    performanceReportsPdf?: boolean;
    priorityExecution?: boolean;
  };
}

export interface AlgoPaymentPanelProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const isDevEnvironment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    Boolean((import.meta as any)?.env?.DEV));

export const AlgoPaymentPanel: React.FC<AlgoPaymentPanelProps> = ({
  onClose,
  onSuccess,
}) => {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState<PracticePlanItem[]>([]);
  const [network, setNetwork] = useState('testnet');
  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [flowState, setFlowState] = useState<PaymentFlowState>('select');
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [panelTab, setPanelTab] = useState<'cards' | 'matrix'>('cards');

  // Active payment intent and verification states
  const [activeIntent, setActiveIntent] = useState<any | null>(null);
  const [submittingMessage, setSubmittingMessage] = useState('Verifying your payment...');
  const [confirmedTxId, setConfirmedTxId] = useState('');
  const [unlockedAttemptsCount, setUnlockedAttemptsCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  const handleDownloadReceiptDirect = async () => {
    if (!confirmedTxId) return;
    setIsDownloadingReceipt(true);
    try {
      const res = await api.get(`/payments/receipt/${confirmedTxId}/pdf`, {
        responseType: 'blob',
      });
      const filename = `Evalora-Payment-Receipt-${confirmedTxId.slice(0, 10)}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success('Payment receipt PDF downloaded.');
    } catch {
      toast.error('Failed to download payment receipt PDF.');
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const isCancelledRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .get('/payments/plans')
      .then((res) => {
        if (res.data.success) {
          const loadedPlans = res.data.plans || [];
          setPlans(loadedPlans);
          setNetwork(res.data.network || 'testnet');
          if (loadedPlans.some((p: any) => p.id === 'trial')) {
            setSelectedPlanId('trial');
          } else if (loadedPlans.some((p: any) => p.id === 'starter')) {
            setSelectedPlanId('starter');
          }
        }
      })
      .catch(() => toast.error('Unable to load practice plans.'))
      .finally(() => setIsLoadingPlans(false));

    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handleResetToSelection = () => {
    isCancelledRef.current = false;
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setActiveIntent(null);
    setConfirmedTxId('');
    setErrorMessage('');
    setFlowState('select');
  };

  const handleCancelPayment = () => {
    isCancelledRef.current = true;
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setFlowState('cancelled');
    setErrorMessage('The payment was rejected in Pera Wallet.');
  };

  const pollBackendVerification = async (intentId: string, txId: string, walletAddress: string, attempt = 1) => {
    if (isCancelledRef.current) return;

    try {
      const res = await api.post('/payments/verify', {
        paymentIntentId: intentId,
        transactionId: txId,
        walletAddress,
      });

      if (res.status === 202 || res.data?.status === 'pending') {
        setSubmittingMessage('Waiting for blockchain confirmation...');
        if (attempt < 12) {
          pollTimerRef.current = window.setTimeout(() => {
            pollBackendVerification(intentId, txId, walletAddress, attempt + 1);
          }, 2500);
        } else {
          setFlowState('failed');
          setErrorMessage('Blockchain confirmation timed out. Please check transaction on Algorand.');
        }
        return;
      }

      if (res.data?.success && res.data?.status === 'verified') {
        setConfirmedTxId(txId);
        setUnlockedAttemptsCount(res.data.attemptsUnlocked || selectedPlan?.paidAttempts || 0);
        setFlowState('verified');
        await refreshProfile();
        toast.success(res.data.message || 'Payment successfully verified on Algorand!');
      } else {
        setFlowState('failed');
        setErrorMessage(res.data?.message || 'Blockchain verification was rejected.');
      }
    } catch (err: any) {
      if (isCancelledRef.current) return;
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || err.message || 'Transaction verification failed.';

      if (code === 'PAYMENT_INTENT_EXPIRED') {
        setFlowState('expired');
      } else if (attempt < 12 && (err.response?.status === 202 || code === 'TRANSACTION_PENDING')) {
        setSubmittingMessage('Waiting for blockchain confirmation...');
        pollTimerRef.current = window.setTimeout(() => {
          pollBackendVerification(intentId, txId, walletAddress, attempt + 1);
        }, 2500);
      } else {
        setFlowState('failed');
        setErrorMessage(msg);
      }
    }
  };

  const handleInitiatePeraPayment = async () => {
    if (!selectedPlan) return;
    isCancelledRef.current = false;
    setFlowState('waiting_approval');

    try {
      // 1. Create server-authoritative payment intent with suggested params
      const intentRes = await api.post('/payments/create-intent', {
        planId: selectedPlan.id,
      });

      if (!intentRes.data.success || !intentRes.data.paymentIntent) {
        throw new Error(intentRes.data.message || 'Could not prepare payment intent.');
      }

      const intent = intentRes.data.paymentIntent;
      setActiveIntent(intent);

      // 2. Ensure Pera Wallet is actively connected in browser session
      const senderAddress = await ensureActivePeraSession();
      if (!senderAddress) {
        throw new Error('Please connect your Pera Wallet to continue with payment.');
      }

      if (isCancelledRef.current) return;

      // 3. Request transaction signature in Pera Wallet mobile app
      const rawBase64 = intent.suggestedParams?.genesisHash || 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

      const signResult = await signPeraPaymentTransaction({
        senderAddress,
        receiverAddress: intent.expectedReceiver,
        amountMicroAlgos: intent.expectedAmountMicroAlgos,
        note: `evalora:${intent.intentId}`,
        suggestedParams: {
          fee: intent.suggestedParams?.fee || 1000,
          firstRound: intent.suggestedParams?.firstRound || 40000000,
          lastRound: intent.suggestedParams?.lastRound || 40001000,
          genesisHash: rawBase64,
          genesisID: intent.suggestedParams?.genesisID || 'testnet-v1.0',
        },
      });

      if (isCancelledRef.current) return;

      // 4. Once user approves in Pera Wallet, automatically obtain transaction ID & verify
      const txId = signResult.txId;
      setConfirmedTxId(txId);
      setFlowState('submitting');
      setSubmittingMessage('Verifying your payment...');

      const signedTxnBase64 = btoa(
        String.fromCharCode(...Array.from(signResult.signedTxnBytes))
      );

      // 5. Send transaction for independent server-side Algorand verification
      const verifyRes = await api.post('/payments/verify', {
        paymentIntentId: intent.intentId,
        transactionId: txId,
        walletAddress: senderAddress,
        signedTxn: signedTxnBase64,
      });

      if (verifyRes.status === 202 || verifyRes.data?.status === 'pending') {
        setSubmittingMessage('Waiting for blockchain confirmation...');
        pollBackendVerification(intent.intentId, txId, senderAddress, 1);
        return;
      }

      if (verifyRes.data?.success && verifyRes.data?.status === 'verified') {
        setUnlockedAttemptsCount(verifyRes.data.attemptsUnlocked || selectedPlan.paidAttempts);
        setFlowState('verified');
        await refreshProfile();
        toast.success(verifyRes.data.message || 'Payment successfully verified on Algorand!');
      } else {
        setFlowState('failed');
        setErrorMessage(verifyRes.data?.message || 'Verification rejected by Algorand network.');
      }
    } catch (err: any) {
      if (isCancelledRef.current) return;
      if (err.response?.status === 202 || err.response?.data?.code === 'TRANSACTION_PENDING') {
        setSubmittingMessage('Waiting for blockchain confirmation...');
        pollBackendVerification(activeIntent?.intentId || '', confirmedTxId || '', (user?.walletAddress as string) || '', 1);
        return;
      }

      const msg = err.response?.data?.message || err.message || 'Payment was not approved.';
      const lower = msg.toLowerCase();

      if (lower.includes('reject') || lower.includes('cancel') || lower.includes('closed')) {
        setFlowState('cancelled');
        setErrorMessage('The payment was rejected in Pera Wallet.');
      } else if (lower.includes('expired')) {
        setFlowState('expired');
        setErrorMessage('Payment request expired.');
      } else {
        setFlowState('failed');
        setErrorMessage(msg);
      }
    }
  };

  // Helper for development environment testing without mobile device
  const handleSimulateDevApproval = async () => {
    if (!selectedPlan) return;
    setFlowState('submitting');
    setSubmittingMessage('Verifying your payment...');

    try {
      // Always create a fresh intent so prior failures/timeouts do not interfere
      const createRes = await api.post('/payments/create-intent', { planId: selectedPlan.id });
      const intentRes = createRes.data.paymentIntent;

      const simTxId = `DEV_PERA_TX_${Date.now()}`;
      setConfirmedTxId(simTxId);

      const res = await api.post('/payments/verify', {
        paymentIntentId: intentRes.intentId,
        transactionId: simTxId,
        walletAddress: user?.walletAddress || 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA',
      });

      if (res.data?.success) {
        setUnlockedAttemptsCount(res.data.attemptsUnlocked || selectedPlan.paidAttempts);
        setFlowState('verified');
        await refreshProfile();
        toast.success('Simulated Pera payment successfully verified!');
      } else {
        setFlowState('failed');
        setErrorMessage(res.data?.message || 'Simulated verification failed.');
      }
    } catch (err: any) {
      setFlowState('failed');
      setErrorMessage(err.response?.data?.message || err.message || 'Simulation error.');
    }
  };

  const handleContinueAfterSuccess = () => {
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Card
      className="border-[#DEDDF0] bg-white shadow-2xl rounded-2xl overflow-hidden max-w-4xl w-full mx-auto"
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EFF9] text-[#7779C5]">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#49465B]">
                  Evalora Premium Plans & Practice System
                </span>
                <span className="font-mono text-[10px] uppercase text-[#777486] bg-[#F8F7FC] px-1.5 py-0.5 rounded border border-[#E9E7F0]">
                  Algorand {network}
                </span>
              </div>
              <p className="text-[11px] text-[#777486]">
                Extra practice attempts bundled with premium technology domain preparation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {flowState === 'select' && (
              <div className="flex items-center rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPanelTab('cards')}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                    panelTab === 'cards'
                      ? 'bg-white text-[#7779C5] font-semibold shadow-xs border border-[#DEDDF0]'
                      : 'text-[#777486] hover:text-[#49465B]'
                  }`}
                >
                  Packages
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('matrix')}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                    panelTab === 'matrix'
                      ? 'bg-white text-[#7779C5] font-semibold shadow-xs border border-[#DEDDF0]'
                      : 'text-[#777486] hover:text-[#49465B]'
                  }`}
                >
                  Compare All
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#777486] transition-colors hover:bg-[#F8F7FC] hover:text-[#49465B]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs">
        {/* STATE: SELECT PLAN & BEFORE APPROVAL */}
        {flowState === 'select' && (
          <div className="space-y-6">
            {isLoadingPlans ? (
              <div className="py-12 text-center text-xs text-[#777486] flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#7779C5]" />
                <span>Loading available practice packages and entitlements...</span>
              </div>
            ) : (
              <>
                {/* Value Proposition Callout */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-[#DEDDF0] bg-[#F0EFF9]/40 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#7779C5] shadow-2xs">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[#49465B]">Benefit A: Extra Practice Attempts</span>
                      <p className="text-[11px] text-[#777486] leading-relaxed">
                        Free tier includes 10 complimentary attempts. Subscribed plans unlock +15 to +150 attempts that never expire.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#7779C5] shadow-2xs">
                      <BookOpen className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[#49465B]">Benefit B: Premium Domain Preparation</span>
                      <p className="text-[11px] text-[#777486] leading-relaxed">
                        Unlocks full technology paths (MERN Stack, Frontend, Backend, AI/ML, Data Science) with live coding workspaces.
                      </p>
                    </div>
                  </div>
                </div>

                {/* TAB 1: PLAN CARDS VIEW */}
                {panelTab === 'cards' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#49465B] uppercase tracking-wider">
                        Available Plans (All &lt; 9 ALGO)
                      </span>
                      <span className="text-[11px] text-[#777486]">
                        Select a plan to inspect benefits and approve via Pera Wallet
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {plans.map((plan) => {
                        const isSelected = selectedPlanId === plan.id;
                        const hasDomains = Boolean(plan.entitlements?.domainPreparation);
                        return (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedPlanId(plan.id)}
                            className={`cursor-pointer flex flex-col justify-between rounded-xl border p-4 transition-all duration-150 ${
                              isSelected
                                ? 'border-[#7779C5] bg-[#F0EFF9]/30 shadow-sm ring-2 ring-[#7779C5]'
                                : 'border-[#E9E7F0] bg-white hover:border-[#DEDDF0] hover:bg-[#F7F8FF]/50'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-xs text-[#49465B] truncate">{plan.name}</span>
                                {plan.popular ? (
                                  <Badge variant="green" size="sm">
                                    Popular
                                  </Badge>
                                ) : hasDomains ? (
                                  <Badge variant="purple" size="sm">
                                    Domains
                                  </Badge>
                                ) : (
                                  <Badge variant="blue" size="sm">
                                    Pass
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold tracking-tight text-[#49465B]">
                                  {plan.priceAlgo}
                                </span>
                                <span className="font-semibold text-xs text-[#7779C5]">ALGO</span>
                                <span className="text-[#777486] text-[10px]">
                                  ~{(plan.priceAlgo * 1_000_000).toLocaleString()} microAlgos
                                </span>
                              </div>

                              {/* Two Core Benefits Breakdown */}
                              <div className="space-y-1.5 pt-1 border-t border-[#E9E7F0]">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-[#49465B]">
                                  <Check className="h-3.5 w-3.5 text-[#527565] shrink-0" />
                                  <span>+{plan.paidAttempts} Practice Attempts</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-[#49465B]">
                                  {hasDomains ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-[#7779C5] shrink-0" />
                                      <span className="text-[#555780]">
                                        All Tech Domains ({plan.entitlements?.subscriptionDurationDays || 30}d)
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Minus className="h-3.5 w-3.5 text-[#9895A8] shrink-0" />
                                      <span className="text-[#777486]">Standard Tracks Only</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <p className="text-[11px] leading-relaxed text-[#777486]">
                                {plan.description}
                              </p>

                              {/* Exclusions / Limitations Disclosure */}
                              {plan.exclusions && plan.exclusions.length > 0 && (
                                <div className="rounded-lg bg-[#F8F7FC] border border-[#E9E7F0] p-2 text-[10px] text-[#777486] space-y-0.5">
                                  {plan.exclusions.map((ex, idx) => (
                                    <div key={idx} className="flex items-start gap-1">
                                      <span className="text-[#896D45]">•</span>
                                      <span>{ex}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-[#E9E7F0] flex items-center justify-between text-[10px] text-[#777486]">
                              <span>Attempts never expire</span>
                              <span className="font-semibold text-[#7779C5]">
                                {isSelected ? 'Selected' : 'Click to Select'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: FULL FEATURE COMPARISON MATRIX */}
                {panelTab === 'matrix' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#49465B] uppercase tracking-wider">
                        Feature & Entitlement Comparison
                      </span>
                      <span className="text-[11px] text-[#777486]">
                        Transparent breakdown across free and subscription tiers
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#E9E7F0] bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E9E7F0] bg-[#F8F7FC] text-[#49465B]">
                            <th className="p-3 font-semibold text-[11px]">Feature / Entitlement</th>
                            <th className="p-3 font-semibold text-[11px] text-center">Free Tier</th>
                            {plans.map((p) => (
                              <th
                                key={p.id}
                                className={`p-3 font-semibold text-[11px] text-center cursor-pointer transition-colors ${
                                  selectedPlanId === p.id ? 'bg-[#F0EFF9] text-[#7779C5]' : 'hover:bg-[#F2F2F7]'
                                }`}
                                onClick={() => setSelectedPlanId(p.id)}
                              >
                                {p.name}
                                <div className="text-[10px] font-normal text-[#777486]">
                                  {p.priceAlgo} ALGO
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E9E7F0] text-[11px] text-[#49465B]">
                          <tr>
                            <td className="p-3 font-medium">Price in ALGO</td>
                            <td className="p-3 text-center text-[#777486]">0 ALGO</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center font-bold text-[#7779C5]">
                                {p.priceAlgo} ALGO
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Practice Attempts Included</td>
                            <td className="p-3 text-center">10 Free</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center font-semibold text-[#527565]">
                                +{p.paidAttempts}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Technology Domains (MERN, AI/ML, etc.)</td>
                            <td className="p-3 text-center text-[#777486]">Preview Only</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                {p.entitlements?.domainPreparation ? (
                                  <Badge variant="purple" size="sm">
                                    {p.entitlements.subscriptionDurationDays} Days Access
                                  </Badge>
                                ) : (
                                  <span className="text-[#9895A8]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Interactive Multi-tab Web Workspace</td>
                            <td className="p-3 text-center text-[#9895A8]">—</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                {p.entitlements?.codeWorkspacesEnabled || p.entitlements?.domainPreparation ? (
                                  <Check className="h-4 w-4 text-[#527565] mx-auto" />
                                ) : (
                                  <span className="text-[#9895A8]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">C / C++ / Python / Java Sandboxed Judge</td>
                            <td className="p-3 text-center">
                              <Check className="h-4 w-4 text-[#527565] mx-auto" />
                            </td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                <Check className="h-4 w-4 text-[#527565] mx-auto" />
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">48-Hour AI Autonomous Question Pool</td>
                            <td className="p-3 text-center">
                              <Check className="h-4 w-4 text-[#527565] mx-auto" />
                            </td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                <Check className="h-4 w-4 text-[#527565] mx-auto" />
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">PDF Performance Report Download</td>
                            <td className="p-3 text-center">
                              <Check className="h-4 w-4 text-[#527565] mx-auto" />
                            </td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                <Check className="h-4 w-4 text-[#527565] mx-auto" />
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Verified Payment Receipt (PDF)</td>
                            <td className="p-3 text-center text-[#9895A8]">—</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                <Check className="h-4 w-4 text-[#527565] mx-auto" />
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-[#F8F7FC]">
                            <td className="p-3 font-medium">Action</td>
                            <td className="p-3 text-center text-[#777486]">Default</td>
                            {plans.map((p) => (
                              <td key={p.id} className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlanId(p.id);
                                    setPanelTab('cards');
                                  }}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                    selectedPlanId === p.id
                                      ? 'bg-[#7779C5] text-white'
                                      : 'bg-white border border-[#DEDDF0] text-[#7779C5] hover:bg-[#F0EFF9]'
                                  }`}
                                >
                                  {selectedPlanId === p.id ? 'Selected' : 'Select'}
                                </button>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pre-Approval Payment Review Card */}
                <div className="rounded-xl border border-[#DEDDF0] bg-[#F7F8FF] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E9E7F0] pb-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#7779C5]" />
                      <span className="font-semibold text-sm text-[#49465B]">Selected Subscription Summary</span>
                    </div>
                    <Badge variant="blue" size="sm">
                      Official Algorand Integration
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-white p-3 border border-[#E9E7F0]">
                      <span className="block text-[10px] font-semibold text-[#777486] uppercase tracking-wider">
                        Benefit A: Extra Attempts
                      </span>
                      <span className="mt-1 block text-sm font-bold text-[#527565]">
                        +{selectedPlan?.paidAttempts || 25} Practice Attempts
                      </span>
                      <span className="text-[11px] text-[#777486]">
                        Valid across all question categories • Never expires
                      </span>
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-[#E9E7F0]">
                      <span className="block text-[10px] font-semibold text-[#777486] uppercase tracking-wider">
                        Benefit B: Domain Access
                      </span>
                      <span className="mt-1 block text-sm font-bold text-[#555780]">
                        {selectedPlan?.entitlements?.domainPreparation
                          ? `All Tech Domains (${selectedPlan?.entitlements?.subscriptionDurationDays || 30}d)`
                          : 'Standard Question Categories'}
                      </span>
                      <span className="text-[11px] text-[#777486]">
                        {selectedPlan?.entitlements?.domainPreparation
                          ? 'MERN, AI/ML, Frontend, Backend & Web Workspaces'
                          : 'General Practice Bank only'}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-[#E9E7F0]">
                      <span className="block text-[10px] font-semibold text-[#777486] uppercase tracking-wider">
                        Total Price
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-serif text-[#49465B]">
                          {selectedPlan?.priceAlgo || 3}
                        </span>
                        <span className="text-xs font-semibold text-[#7779C5]">ALGO</span>
                      </div>
                      <span className="text-[10px] text-[#777486]">
                        ~{((selectedPlan?.priceAlgo || 3) * 1_000_000).toLocaleString()} microAlgos
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      size="lg"
                      variant="primary"
                      className="flex-1 justify-center text-sm font-semibold"
                      onClick={handleInitiatePeraPayment}
                      icon={<Wallet className="h-4 w-4" />}
                    >
                      Pay {selectedPlan?.priceAlgo || 3} ALGO with Pera Wallet
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="justify-center text-xs"
                      onClick={onClose}
                    >
                      Cancel & Return
                    </Button>
                  </div>

                  {isDevEnvironment && (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      className="w-full justify-center text-xs text-[#7779C5] border-[#DEDDF0] hover:bg-[#F0EFF9]"
                      onClick={handleSimulateDevApproval}
                    >
                      ⚡ [Dev / Testnet: Fast-Track Simulation & Unlock]
                    </Button>
                  )}

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#777486]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#527565]" />
                    <span>Secure payment verified cryptographically on Algorand blockchain</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STATE: WAITING FOR PERA WALLET APPROVAL */}
        {flowState === 'waiting_approval' && (
          <div className="rounded-xl border border-[#DEDDF0] bg-[#F7F8FF] p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EFF9] text-[#7779C5] shadow-sm animate-pulse">
              <Smartphone className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#49465B]">
                Waiting for Pera Wallet approval...
              </h3>
              <div className="text-xs text-[#777486] max-w-sm mx-auto space-y-1 leading-relaxed">
                <p>Open your Pera Wallet mobile app</p>
                <p>Review the transaction details</p>
                <p>Approve the payment to continue</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#E9E7F0] bg-white p-3.5 max-w-xs mx-auto text-left text-xs space-y-2 shadow-xs">
              <div className="flex justify-between text-[#777486]">
                <span>Plan:</span>
                <span className="font-semibold text-[#49465B]">
                  +{selectedPlan?.paidAttempts} Practice Attempts
                </span>
              </div>
              <div className="flex justify-between text-[#777486]">
                <span>Amount:</span>
                <span className="font-semibold text-[#7779C5]">
                  {selectedPlan?.priceAlgo} ALGO
                </span>
              </div>
              {activeIntent && (
                <div className="flex justify-between text-[#777486] pt-1 border-t border-[#E9E7F0]">
                  <span>Payment Ref:</span>
                  <span className="font-mono text-[10px] text-[#9895A8]">
                    {activeIntent.intentId.slice(0, 16)}...
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                size="md"
                variant="outline"
                onClick={handleCancelPayment}
                className="w-36 justify-center"
              >
                Cancel
              </Button>
            </div>

            {isDevEnvironment && (
              <div className="pt-3 border-t border-[#E9E7F0]">
                <button
                  type="button"
                  onClick={handleSimulateDevApproval}
                  className="text-[11px] text-[#7779C5] underline hover:text-[#555780]"
                >
                  [Dev/Testing: Simulate Mobile Pera Approval]
                </button>
              </div>
            )}
          </div>
        )}

        {/* STATE: PAYMENT SUBMITTED / VERIFYING */}
        {flowState === 'submitting' && (
          <div className="rounded-xl border border-[#DEDDF0] bg-[#F7F8FF] p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EFF9] text-[#7779C5] shadow-sm">
              <Loader2 className="h-7 w-7 animate-spin text-[#7779C5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#49465B]">
                Payment submitted
              </h3>
              <p className="text-xs text-[#777486]">
                {submittingMessage}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#777486]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#F8F3E8] animate-ping" />
              <span>Independent Algorand node confirmation in progress</span>
            </div>
          </div>
        )}

        {/* STATE: PAYMENT SUCCESSFUL & VERIFIED */}
        {flowState === 'verified' && (
          <div className="rounded-xl border border-[#C8DFD1] bg-[#E9F3ED]/60 p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E9F3ED] text-[#527565] shadow-sm">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#49465B]">
                Payment Successful
              </h3>
              <p className="text-xs text-[#777486]">
                Your payment has been verified successfully.
              </p>
            </div>

            <div className="rounded-xl border border-[#C8DFD1] bg-white p-4 max-w-sm mx-auto text-left text-xs space-y-2.5 shadow-xs">
              <div className="flex justify-between items-center text-[#777486]">
                <span>Practice Package:</span>
                <span className="font-semibold text-[#527565]">
                  +{unlockedAttemptsCount} Additional Practice Attempts
                </span>
              </div>
              <div className="flex justify-between items-center text-[#777486]">
                <span>Amount Paid:</span>
                <span className="font-semibold text-[#49465B]">
                  {selectedPlan?.priceAlgo} ALGO
                </span>
              </div>
              {confirmedTxId && (
                <div className="pt-2 border-t border-[#E9E7F0]">
                  <div className="text-[11px] text-[#777486] mb-0.5">Transaction ID:</div>
                  <div className="font-mono text-[10px] text-[#49465B] break-all bg-[#F8F7FC] p-1.5 rounded border border-[#E9E7F0]">
                    {confirmedTxId}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 max-w-sm mx-auto">
              <Button
                size="md"
                variant="outline"
                onClick={() => setIsReceiptModalOpen(true)}
                className="w-full sm:w-auto flex-1 justify-center"
                icon={<Receipt className="h-4 w-4" />}
              >
                View Receipt
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={handleDownloadReceiptDirect}
                isLoading={isDownloadingReceipt}
                className="w-full sm:w-auto flex-1 justify-center"
                icon={<Download className="h-4 w-4" />}
              >
                {isDownloadingReceipt ? 'Downloading...' : 'Download Receipt'}
              </Button>
            </div>

            <div className="pt-1">
              <Button
                size="lg"
                variant="primary"
                onClick={handleContinueAfterSuccess}
                className="w-full max-w-sm mx-auto justify-center font-semibold"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Continue Practicing
              </Button>
            </div>
          </div>
        )}

        {/* STATE: PAYMENT CANCELLED */}
        {flowState === 'cancelled' && (
          <div className="rounded-xl border border-[#E9E7F0] bg-white p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F7FC] text-[#777486] shadow-sm">
              <XCircle className="h-7 w-7 text-[#9895A8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#49465B]">
                Payment cancelled
              </h3>
              <p className="text-xs text-[#777486]">
                The payment was rejected in Pera Wallet.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <Button
                size="md"
                variant="primary"
                onClick={handleResetToSelection}
                className="w-36 justify-center"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* STATE: PAYMENT REQUEST EXPIRED */}
        {flowState === 'expired' && (
          <div className="rounded-xl border border-[#E8D9B9] bg-[#F8F3E8]/50 p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F3E8] text-[#896D45] shadow-sm">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#49465B]">
                Payment request expired.
              </h3>
              <p className="text-xs text-[#777486]">
                The payment intent timed out. Generate a new request to continue.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <Button
                size="md"
                variant="primary"
                onClick={handleResetToSelection}
                className="w-52 justify-center"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Generate New Request
              </Button>
            </div>
          </div>
        )}

        {/* STATE: PAYMENT FAILED */}
        {flowState === 'failed' && (
          <div className="rounded-xl border border-[#E8CFD2] bg-[#F8EDEF]/50 p-6 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8EDEF] text-[#9A646D] shadow-sm">
              <XCircle className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#49465B]">
                Payment failed
              </h3>
              <p className="text-xs text-[#777486]">
                {errorMessage || 'The transaction could not be completed.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="md"
                variant="primary"
                onClick={handleResetToSelection}
                className="w-36 justify-center"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Try Again
              </Button>
              {isDevEnvironment && (
                <Button
                  size="md"
                  variant="outline"
                  type="button"
                  onClick={handleSimulateDevApproval}
                  className="justify-center text-xs text-[#7779C5] border-[#DEDDF0] hover:bg-[#F0EFF9]"
                >
                  ⚡ Simulate Approval in Dev
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmedTxId && (
        <PaymentReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          transactionId={confirmedTxId}
        />
      )}
    </Card>
  );
};
