import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Code2,
  AlertTriangle,
  XCircle,
  Terminal,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { IVisualizationResult, IExecutionStep } from '../../shared/types';

interface CodeVisualizationPanelProps {
  result: IVisualizationResult | null;
  isLoading: boolean;
  onStepChange?: (step: IExecutionStep | null) => void;
  onRequestUpgrade?: () => void;
}

export const CodeVisualizationPanel: React.FC<CodeVisualizationPanelProps> = ({
  result,
  isLoading,
  onStepChange,
  onRequestUpgrade
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x

  const steps = result?.steps || [];
  const currentStep: IExecutionStep | undefined = steps[currentStepIndex];
  const prevStep: IExecutionStep | undefined = currentStepIndex > 0 ? steps[currentStepIndex - 1] : undefined;

  // Notify parent on step change
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep || null);
    }
  }, [currentStepIndex, steps]);

  // Reset to step 0 when new result comes in
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [result]);

  // Autoplay timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && steps.length > 0) {
      const intervalMs = Math.round(1000 / playbackSpeed);
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, steps.length, playbackSpeed]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white text-text-primary">
        <div className="relative mb-3 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
        </div>
        <p className="text-xs font-semibold text-text-primary">Tracing Execution State...</p>
        <p className="text-[11px] text-text-muted mt-1 max-w-xs">
          Capturing statements, memory layout, and local scope in isolated runner.
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white text-text-primary">
        <div className="h-11 w-11 rounded-2xl bg-brand-light flex items-center justify-center text-brand-primary mb-3 border border-brand-accent/40">
          <Play className="h-5 w-5 ml-0.5" />
        </div>
        <h4 className="text-sm font-bold text-text-primary mb-1">Execution Visualizer</h4>
        <p className="text-xs text-text-secondary max-w-sm mb-4 leading-relaxed">
          Click <span className="font-semibold text-brand-primary">"Start Visualization"</span> above to step through code execution, inspect memory layouts, and watch variables update in real time.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-neutral px-3 py-1 text-[11px] text-text-muted">
          <span>JavaScript (ES6+)</span>
          <span>•</span>
          <span>Python 3.13</span>
        </div>
      </div>
    );
  }

  // Handle unsupported languages cleanly
  if (result.supported === false) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white text-text-primary">
        <div className="h-11 w-11 rounded-2xl bg-[#F8F3E8] border border-[#E9DAB5] flex items-center justify-center text-[#8A7047] mb-3">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-bold text-text-primary mb-1">Language Support</h4>
        <p className="text-xs text-text-secondary max-w-sm mb-4 leading-relaxed">
          {result.message || 'Execution visualization is currently available for JavaScript and Python.'}
        </p>
      </div>
    );
  }

  // Handle compilation / syntax error before trace
  if (!result.success && steps.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white">
        <div className="h-11 w-11 rounded-2xl bg-[#F8EDEF] border border-[#EACBC4] flex items-center justify-center text-[#A36162] mb-3">
          <XCircle className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-bold text-text-primary mb-1">Execution Error</h4>
        <div className="text-xs text-[#A36162] font-mono bg-[#F8EDEF]/70 border border-[#EACBC4] rounded-xl p-3.5 max-w-md mb-4 text-left whitespace-pre-wrap">
          {result.error || 'A syntax or runtime error occurred before an execution trace could be produced.'}
        </div>
      </div>
    );
  }

  // Calculate mutated variables in this step
  const currentVars = currentStep?.variables || {};
  const prevVars = prevStep?.variables || {};
  const mutatedVarKeys = Object.keys(currentVars).filter((k) => {
    return JSON.stringify(currentVars[k]) !== JSON.stringify(prevVars[k]);
  });

  // Extract array-typed variables for dedicated visual inspector
  const arrayVariables = Object.entries(currentVars).filter(([_, val]) => Array.isArray(val));

  // Extract pointer variables (scalars whose values match indices of array variables)
  const integerPointers: Record<string, number> = {};
  for (const [k, v] of Object.entries(currentVars)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      integerPointers[k] = v;
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-text-primary font-sans">
      {/* 1. Execution Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-neutral/70 px-4 py-2 shrink-0">
        {/* Playback Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Restart */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(0);
            }}
            disabled={currentStepIndex === 0}
            title="Restart (Step 1)"
            className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-border-subtle transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Previous Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentStepIndex === 0}
            title="Previous Step"
            className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-border-subtle transition-all"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => {
              if (currentStepIndex >= steps.length - 1) {
                setCurrentStepIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            title={isPlaying ? 'Pause' : 'Play Trace'}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white shadow-xs hover:bg-brand-dark transition-colors"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>

          {/* Next Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
            }}
            disabled={currentStepIndex >= steps.length - 1}
            title="Next Step"
            className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-border-subtle transition-all"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Step Scrubber Slider */}
        <div className="flex flex-1 items-center gap-3 min-w-[140px] max-w-sm mx-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            value={currentStepIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentStepIndex(Number(e.target.value));
            }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border-subtle accent-brand-primary"
          />
          <span className="font-mono text-xs font-semibold text-text-secondary whitespace-nowrap">
            {steps.length > 0 ? `${currentStepIndex + 1} / ${steps.length}` : '0 / 0'}
          </span>
        </div>

        {/* Line Indicator & Speed Selector */}
        <div className="flex items-center gap-2">
          {currentStep && (
            <span className="rounded-md bg-brand-light border border-brand-accent/40 px-2 py-0.5 text-xs font-mono font-bold text-brand-dark">
              Line {currentStep.line}
            </span>
          )}

          {/* Playback Speed */}
          <div className="flex items-center bg-white rounded-md p-0.5 border border-border-subtle text-xs font-mono">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                  playbackSpeed === s ? 'bg-brand-primary text-white font-bold' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Main Visualization Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Step Explanation Banner: Concise & contextual */}
        {currentStep && (
          <div className="rounded-xl border border-brand-accent/40 bg-brand-light/50 p-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Code2 className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                    Step {currentStepIndex + 1}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">•</span>
                  <span className="text-[10px] font-mono text-text-muted">Line {currentStep.line}</span>
                </div>
                <p className="text-xs font-semibold text-text-primary mt-0.5 leading-snug">
                  {currentStep.explanation || `Executing Line ${currentStep.line}`}
                </p>

                {currentStep.warning && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F8F3E8] border border-[#E9DAB5] px-2.5 py-1 text-xs text-[#8A7047]">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#8A7047] shrink-0" />
                    <span>{currentStep.warning}</span>
                  </div>
                )}
                {currentStep.error && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F8EDEF] border border-[#EACBC4] px-2.5 py-1 text-xs text-[#A36162]">
                    <XCircle className="h-3.5 w-3.5 text-[#A36162] shrink-0" />
                    <span>{currentStep.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Array & Memory Layout (Visual indexed cells with pointer markers) */}
        {arrayVariables.length > 0 && (
          <div className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-brand-primary" />
                <h5 className="text-xs font-bold text-text-primary">
                  Arrays &amp; Data Structures
                </h5>
              </div>
              <span className="text-[11px] text-text-muted">
                {arrayVariables.length} array{arrayVariables.length === 1 ? '' : 's'} in memory
              </span>
            </div>

            <div className="space-y-4">
              {arrayVariables.map(([arrName, arrVal]) => {
                const isArrMutated = mutatedVarKeys.includes(arrName);
                return (
                  <div key={arrName} className="rounded-lg border border-border-subtle bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-text-primary">{arrName}</span>
                        <span className="rounded bg-surface-neutral px-1.5 py-0.2 text-[10px] font-mono text-text-muted">
                          len: {arrVal.length}
                        </span>
                      </div>
                      {isArrMutated && (
                        <span className="rounded-md bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-dark border border-brand-accent/50">
                          Updated
                        </span>
                      )}
                    </div>

                    {/* Array Cells with Index and Pointer Markers */}
                    <div className="flex flex-wrap gap-2 pt-1 overflow-x-auto pb-1">
                      {arrVal.length === 0 ? (
                        <span className="text-xs text-text-muted italic py-1">[ Empty Array ]</span>
                      ) : (
                        arrVal.map((item: any, idx: number) => {
                          // Check if any integer pointer matches this index
                          const activePointers = Object.entries(integerPointers)
                            .filter(([_, ptrVal]) => ptrVal === idx)
                            .map(([ptrName]) => ptrName);

                          return (
                            <div key={idx} className="flex flex-col items-center">
                              {/* Pointer label above cell if active */}
                              <div className="h-4 text-[10px] font-mono font-bold text-brand-primary leading-none flex items-center justify-center">
                                {activePointers.length > 0 ? (
                                  <span>{activePointers.join(', ')} ↓</span>
                                ) : null}
                              </div>

                              {/* Cell Box */}
                              <div
                                className={`flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 min-w-[48px] text-center shadow-2xs transition-all ${
                                  isArrMutated
                                    ? 'border-brand-primary bg-brand-light/70 text-brand-dark ring-2 ring-brand-primary/20'
                                    : 'border-border-subtle bg-white text-text-primary'
                                }`}
                              >
                                <span className="text-xs font-mono font-bold">{JSON.stringify(item)}</span>
                                <span className="text-[10px] font-mono text-text-muted mt-0.5">[{idx}]</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Variables Watcher Grid */}
        <div className="rounded-xl border border-border-subtle bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-[#4C765D]" />
              <h5 className="text-xs font-bold text-text-primary">
                Scope Variables
              </h5>
            </div>
            <span className="text-[11px] text-text-muted font-mono">
              {Object.keys(currentVars).length} variable{Object.keys(currentVars).length === 1 ? '' : 's'}
            </span>
          </div>

          {Object.keys(currentVars).length === 0 ? (
            <p className="text-xs text-text-muted italic py-1">No local variables initialized yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {Object.entries(currentVars).map(([name, val]) => {
                const isMutated = mutatedVarKeys.includes(name);
                const valType = Array.isArray(val) ? 'array' : typeof val;
                return (
                  <div
                    key={name}
                    className={`rounded-lg border p-2.5 flex flex-col justify-between transition-all ${
                      isMutated
                        ? 'border-brand-primary/50 bg-brand-light/40 shadow-2xs'
                        : 'border-border-subtle bg-surface-neutral/40 hover:bg-surface-neutral/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-text-primary">{name}</span>
                      {isMutated ? (
                        <span className="rounded bg-[#E5F2EB] px-1.5 py-0.2 text-[10px] font-semibold text-[#4C765D] border border-[#C6DFD2]">
                          Updated
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-muted capitalize">{valType}</span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold text-text-primary truncate">
                      {JSON.stringify(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Call Stack Frames (Shown only if functions or recursion are active) */}
        {currentStep?.callStack && currentStep.callStack.length > 0 && (
          <div className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-bold text-text-primary">
                Active Call Stack
              </h5>
              <span className="text-[11px] text-text-muted font-mono">
                {currentStep.callStack.length} frame{currentStep.callStack.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              {currentStep.callStack.map((frame, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-text-primary border border-border-subtle shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-brand-primary font-bold">#{idx}</span>
                    <span className="font-semibold">
                      {typeof frame === 'object' && frame !== null
                        ? (frame as any).functionName || 'anonymous'
                        : String(frame)}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    line {typeof frame === 'object' && frame !== null ? (frame as any).line || '?' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standard Output Console Stream */}
        <div className="rounded-xl border border-border-subtle bg-[#EFF2F8] p-3 text-xs font-mono text-[#3C4B63]">
          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-[#E0E5EF] text-gray-400">
            <Terminal className="h-3.5 w-3.5 text-[#719B84]" />
            <span className="font-semibold text-[#748199] text-xs">Console Output</span>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed text-[#719B84] max-h-36 overflow-y-auto">
            {currentStep?.stdout || result.stdout || (
              <span className="text-gray-500 italic">No output logged up to this step.</span>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};
