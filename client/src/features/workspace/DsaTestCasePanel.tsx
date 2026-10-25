import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, MemoryStick, Terminal, HelpCircle } from 'lucide-react';

export interface TestCaseItem {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface TestCaseResultItem {
  testCaseIndex: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  isHidden?: boolean;
  error?: string;
  executionTimeMs?: number;
  memoryKb?: number;
}

export interface DsaEvaluationResult {
  passed: boolean;
  score?: number;
  totalTestCases: number;
  passedCount: number;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED';
  compileError?: string;
  stderr?: string;
  executionTimeMs?: number;
  maxMemoryKb?: number;
  results: TestCaseResultItem[];
}

interface DsaTestCasePanelProps {
  testCases?: TestCaseItem[];
  evaluationResult: DsaEvaluationResult | null;
  isRunning?: boolean;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  singleRunResult?: {
    stdout?: string;
    stderr?: string;
    executionTimeMs?: number;
    memoryKb?: number;
  } | null;
}

export const DsaTestCasePanel: React.FC<DsaTestCasePanelProps> = ({
  testCases = [],
  evaluationResult,
  isRunning = false,
  customInput,
  onCustomInputChange,
  singleRunResult
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'custom' | 'output'>('tests');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent mb-3" />
        <p className="text-xs font-medium text-text-primary">Running test cases against sandbox...</p>
        <p className="text-[11px] text-text-muted mt-1">Compiling code, feeding test inputs, and verifying outputs</p>
      </div>
    );
  }

  const results = evaluationResult?.results || [];
  const displayCases = results.length > 0 ? results : testCases.map((tc, idx) => ({
    testCaseIndex: idx,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    actualOutput: '',
    passed: false,
    isHidden: tc.isHidden,
    error: undefined
  }));

  const currentCase = displayCases[selectedCaseIdx] || displayCases[0];

  const getVerdictBadge = () => {
    if (!evaluationResult) return null;
    const { status, passedCount, totalTestCases } = evaluationResult;
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Accepted ({passedCount}/{totalTestCases})
          </span>
        );
      case 'WRONG_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" /> Wrong Answer ({passedCount}/{totalTestCases})
          </span>
        );
      case 'COMPILATION_ERROR':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> Compile Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-text-primary">
      {/* Header Tabs */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
              activeTab === 'tests'
                ? 'border-brand-primary font-semibold text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Test Cases</span>
            {evaluationResult && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  evaluationResult.passed
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {evaluationResult.passedCount}/{evaluationResult.totalTestCases}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
              activeTab === 'custom'
                ? 'border-brand-primary font-semibold text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Custom Input</span>
          </button>

          {singleRunResult && (
            <button
              type="button"
              onClick={() => setActiveTab('output')}
              className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'output'
                  ? 'border-brand-primary font-semibold text-brand-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Output</span>
            </button>
          )}
        </div>

        {/* Verdict & Metrics */}
        <div className="flex items-center gap-2 pr-2">
          {getVerdictBadge()}
          {evaluationResult?.executionTimeMs !== undefined && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-text-muted">
              <Clock className="h-3 w-3" />
              {evaluationResult.executionTimeMs} ms
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Compilation Error Notice */}
        {evaluationResult?.compileError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800">
            <div className="flex items-center gap-2 font-semibold text-rose-900 mb-1">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Compilation Error:</span>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{evaluationResult.compileError}</pre>
          </div>
        )}

        {/* TAB 1: TEST CASES */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            {/* Case selector pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {displayCases.map((tc, idx) => {
                const isSelected = selectedCaseIdx === idx;
                const hasEvaluated = evaluationResult !== null;
                const passed = (tc as any).passed;
                const isHidden = tc.isHidden;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCaseIdx(idx)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-primary text-white shadow-xs font-semibold'
                        : 'bg-surface-neutral/80 text-text-secondary hover:bg-surface-neutral hover:text-text-primary'
                    }`}
                  >
                    <span>Case {idx + 1}</span>
                    {isHidden && (
                      <span className="text-[10px] opacity-75">(Hidden)</span>
                    )}
                    {hasEvaluated && !isHidden && (
                      <span
                        className={`h-2 w-2 rounded-full ${
                          passed ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current Test Case Details */}
            {currentCase && (
              <div className="space-y-3">
                {currentCase.isHidden ? (
                  <div className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-5 text-center text-xs text-text-muted">
                    <p className="font-medium text-text-primary mb-1">Hidden Test Case</p>
                    <p className="text-[11px]">Inputs and expected outputs for this test case are hidden to assess genuine algorithmic correctness and edge cases.</p>
                    {evaluationResult && (
                      <div className="mt-3">
                        {(currentCase as any).passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                            <CheckCircle2 className="h-4 w-4" /> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-xs">
                            <XCircle className="h-4 w-4" /> Failed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Input */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                        Input
                      </span>
                      <div className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-3 font-mono text-xs text-text-primary overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{currentCase.input || '(empty)'}</pre>
                      </div>
                    </div>

                    {/* Expected Output */}
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                        Expected Output
                      </span>
                      <div className="rounded-xl border border-border-subtle bg-surface-neutral/60 p-3 font-mono text-xs text-text-primary overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{currentCase.expectedOutput}</pre>
                      </div>
                    </div>

                    {/* Actual Output (if evaluated) */}
                    {evaluationResult && (
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                          Actual Output
                        </span>
                        <div
                          className={`rounded-xl border p-3 font-mono text-xs overflow-x-auto ${
                            (currentCase as any).passed
                              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                              : 'border-rose-200 bg-rose-50/50 text-rose-900'
                          }`}
                        >
                          <pre className="whitespace-pre-wrap">
                            {(currentCase as any).actualOutput || '(no output)'}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Error if present */}
                    {(currentCase as any).error && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800">
                        <span className="font-semibold block mb-1">Runtime Note:</span>
                        <pre className="font-mono text-[11px] whitespace-pre-wrap">{(currentCase as any).error}</pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CUSTOM INPUT */}
        {activeTab === 'custom' && (
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Custom Standard Input (stdin)
            </label>
            <p className="text-[11px] text-text-secondary">
              Provide your own raw inputs. Click "Run Code" in the toolbar to execute your code with this custom stdin.
            </p>
            <textarea
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              placeholder="e.g. 5&#10;1 2 3 4 5"
              rows={6}
              className="w-full rounded-xl border border-border-subtle bg-surface-neutral/40 p-3 font-mono text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
        )}

        {/* TAB 3: SINGLE RUN OUTPUT */}
        {activeTab === 'output' && singleRunResult && (
          <div className="space-y-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Execution Output
            </span>
            <div className="rounded-xl border border-border-subtle bg-[#0D0D11] p-4 font-mono text-xs text-gray-200 overflow-x-auto min-h-[180px]">
              {singleRunResult.stdout ? (
                <pre className="whitespace-pre-wrap text-emerald-400">{singleRunResult.stdout}</pre>
              ) : (
                <span className="text-gray-500 italic">No standard output produced.</span>
              )}
              {singleRunResult.stderr && (
                <pre className="mt-2 text-rose-400 whitespace-pre-wrap">{singleRunResult.stderr}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
