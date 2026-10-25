import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  X,
  ArrowRight,
  Eye,
  Activity,
  Layers,
  Cpu
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface VisualizerUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export const VisualizerUpgradeModal: React.FC<VisualizerUpgradeModalProps> = ({
  isOpen,
  onClose,
  reason
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-border-subtle bg-white p-6 shadow-2xl text-text-primary">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-text-muted hover:bg-surface-neutral hover:text-text-primary transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header Badges */}
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/40 bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
            <Cpu className="h-3.5 w-3.5 text-brand-primary" />
            <span>Interactive Code Execution</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <Lock className="h-3 w-3" />
            <span>Subscription Feature</span>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-bold tracking-tight text-text-primary mb-2">
          Step-by-Step Code Visualizer
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">
          {reason || 'Watch your code run line-by-line in real time. Inspect variable mutations, track memory layouts, examine active call stacks, and catch algorithmic edge cases before they happen.'}
        </p>

        {/* Feature Grid Preview */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-neutral/40 p-3">
            <Eye className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Line-by-Line Stepper</p>
              <p className="text-[11px] text-text-muted">Synchronized IDE cursor navigation with scrubbing controls</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-neutral/40 p-3">
            <Activity className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Variable Mutation Watcher</p>
              <p className="text-[11px] text-text-muted">Highlight state changes and index accesses at every step</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-neutral/40 p-3">
            <Layers className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Array &amp; Memory Inspector</p>
              <p className="text-[11px] text-text-muted">Interactive visual blocks with pointer markers and indices</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-neutral/40 p-3">
            <Cpu className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Infinite Loop Safeguard</p>
              <p className="text-[11px] text-text-muted">Protected sandbox with 250-step loop interceptor</p>
            </div>
          </div>
        </div>

        {/* Eligible Plans Comparison */}
        <div className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-4 mb-6">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-text-secondary">Included in these plans:</span>
            <span className="text-brand-primary font-mono text-[11px] font-semibold">Transparent Algorand Pricing</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-border-subtle bg-white p-3 text-center shadow-xs">
              <p className="text-xs font-bold text-text-primary">Domain Pass</p>
              <p className="text-sm font-black text-brand-primary mt-0.5">4 ALGO</p>
              <p className="text-[10px] text-text-muted mt-1">Single domain access</p>
            </div>

            <div className="relative rounded-xl border border-brand-primary/50 bg-brand-light p-3 text-center shadow-xs">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-primary px-2 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                Popular
              </span>
              <p className="text-xs font-bold text-brand-dark">Pro Bundle</p>
              <p className="text-sm font-black text-brand-dark mt-0.5">5 ALGO</p>
              <p className="text-[10px] text-brand-dark/70 mt-1">All domains + 75 tries</p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-white p-3 text-center shadow-xs">
              <p className="text-xs font-bold text-text-primary">Master Pass</p>
              <p className="text-sm font-black text-brand-primary mt-0.5">8 ALGO</p>
              <p className="text-[10px] text-text-muted mt-1">Full platform + 200 tries</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Maybe Later
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            <span>View Subscription Plans</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
