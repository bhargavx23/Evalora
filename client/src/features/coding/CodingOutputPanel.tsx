import React from 'react';
import { CheckCircle2, CircleAlert, CircleX, Clock3, MemoryStick, Terminal } from 'lucide-react';
import { Badge, VerdictBadge } from '../../components/ui/Badge';

export interface CodingOutputPanelProps {
  result: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  customInput?: string;
  onCustomInputChange?: (value: string) => void;
}

export const CodingOutputPanel: React.FC<CodingOutputPanelProps> = ({
  result,
  activeTab,
  onTabChange,
  customInput,
  onCustomInputChange,
}) => {
  const currentTab = activeTab === 'problem' ? 'results' : activeTab;
  const isVerified = Boolean(result?.isVerified);
  const visibleResults = result?.results || [];
  const errors = [
    result?.compileError,
    result?.stderr,
    ...visibleResults.map((test: any) => test.error),
  ].filter(Boolean);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col border-t border-border-subtle bg-white"
      aria-label="Code output"
    >
      {/* Tab Navigation */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            ['results', 'Test Results'],
            ['output', 'Console Output'],
            ['errors', 'Errors'],
            ...(onCustomInputChange ? [['custom_input', 'Custom Input']] : []),
          ].map(([id, label]) => {
            const isActive = currentTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`relative shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'border-brand-primary font-semibold text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
                {id === 'errors' && errors.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#F8EDEF]/10 px-1.5 py-0.2 text-[10px] font-bold text-[#9A646D]">
                    {errors.length}
                  </span>
                )}
                {id === 'results' && isVerified && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      result.passedCount === result.totalTestCases
                        ? 'bg-[#E9F3ED]/10 text-[#527565]'
                        : 'bg-[#F8EDEF]/10 text-[#9A646D]'
                    }`}
                  >
                    {result.passedCount}/{result.totalTestCases}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick metrics header */}
        {result && (
          <div className="hidden items-center gap-3 pr-2 text-[11px] text-text-muted sm:flex">
            {(result.executionTimeMs || result.avgExecutionTimeMs) !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock3 className="h-3 w-3 text-text-muted" />
                {result.executionTimeMs || result.avgExecutionTimeMs || 0} ms
              </span>
            )}
            {result.maxMemoryKb ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <MemoryStick className="h-3 w-3 text-text-muted" />
                {result.maxMemoryKb} KB
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div key={currentTab} className="min-h-0 flex-1 overflow-y-auto p-4 text-xs animate-in fade-in-50 duration-150 ease-out">
        {currentTab === 'custom_input' && onCustomInputChange ? (
          <div className="h-full space-y-2">
            <span className="block text-[11px] font-medium text-text-secondary">
              Provide standard input (stdin) to run with your code:
            </span>
            <textarea
              value={customInput || ''}
              onChange={(e) => onCustomInputChange(e.target.value)}
              placeholder="e.g. 5&#10;1 2 3 4 5"
              className="h-32 w-full resize-y rounded-xl border border-border-subtle bg-surface-neutral/60 p-3 font-mono text-xs text-text-primary focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
        ) : currentTab === 'output' ? (
          result?.stdout ? (
            <pre className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-neutral/50 p-3.5 font-mono text-xs leading-relaxed text-text-primary">
              {result.stdout}
            </pre>
          ) : (
            <EmptyPanel text="Run code to view standard output." />
          )
        ) : currentTab === 'errors' ? (
          errors.length > 0 ? (
            <div className="space-y-2.5">
              {errors.map((error: string, index: number) => (
                <pre
                  key={`${error}-${index}`}
                  className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-[#E8CFD2] bg-[#F8EDEF]/70 p-3.5 font-mono text-xs text-[#9A646D]"
                >
                  {error}
                </pre>
              ))}
            </div>
          ) : (
            <EmptyPanel text="No compilation or runtime errors." />
          )
        ) : result ? (
          <div className="space-y-3.5">
            {/* Verdict Summary Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-neutral/50 p-3">
              <div className="flex items-center gap-2.5">
                {isVerified && result.verdict ? (
                  <VerdictBadge verdict={result.verdict} />
                ) : (
                  <Badge variant="blue">Executed</Badge>
                )}
                {isVerified && (
                  <span className="text-xs font-medium text-text-secondary">
                    Passed {result.passedCount} of {result.totalTestCases} test cases
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock3 className="h-3 w-3" />
                  {result.executionTimeMs || result.avgExecutionTimeMs || 0} ms
                </span>
                {result.maxMemoryKb ? (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <MemoryStick className="h-3 w-3" />
                    {result.maxMemoryKb} KB
                  </span>
                ) : null}
              </div>
            </div>

            {/* Test Case Breakdown */}
            {isVerified && visibleResults.length > 0 ? (
              <div className="space-y-2">
                {visibleResults.map((test: any) => (
                  <div
                    key={test.testCaseIndex}
                    className={`rounded-xl border p-3 transition-colors ${
                      test.passed
                        ? 'border-[#C8DFD1]/80 bg-[#E9F3ED]/30'
                        : 'border-[#E8CFD2]/80 bg-[#F8EDEF]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {test.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-[#527565]" />
                        ) : (
                          <CircleX className="h-4 w-4 text-[#9A646D]" />
                        )}
                        <span className="font-semibold text-text-primary">
                          Test Case #{test.testCaseIndex}
                        </span>
                      </div>
                      <Badge variant={test.passed ? 'green' : 'rose'} size="sm">
                        {test.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>

                    {test.isHidden ? (
                      <span className="mt-1 block text-[11px] text-text-muted">
                        Hidden evaluation test case
                      </span>
                    ) : (
                      <div className="mt-2.5 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
                        <div className="rounded-lg border border-border-subtle bg-white p-2">
                          <span className="block font-sans text-[10px] font-semibold uppercase text-text-muted">
                            Input
                          </span>
                          <span className="mt-0.5 block break-all text-text-primary">
                            {test.input || '(empty)'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-white p-2">
                          <span className="block font-sans text-[10px] font-semibold uppercase text-text-muted">
                            Expected
                          </span>
                          <span className="mt-0.5 block break-all text-text-primary">
                            {test.expectedOutput || '(empty)'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-border-subtle bg-white p-2">
                          <span className="block font-sans text-[10px] font-semibold uppercase text-text-muted">
                            Actual
                          </span>
                          <span
                            className={`mt-0.5 block break-all ${
                              test.passed ? 'text-[#527565]' : 'text-[#9A646D] font-semibold'
                            }`}
                          >
                            {test.actualOutput || '(empty)'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-neutral/60 p-3 text-text-secondary">
                <CircleAlert className="h-4 w-4 text-brand-primary" />
                <span>
                  {isVerified
                    ? 'No detailed test outputs returned.'
                    : 'Custom run completed without evaluating against hidden test suites.'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <EmptyPanel text="Run code to test sample input, or Submit Code to evaluate against all test cases." />
        )}
      </div>
    </section>
  );
};

const EmptyPanel: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 text-center text-text-muted">
    <Terminal className="h-6 w-6 text-text-muted/60" />
    <span className="max-w-xs text-xs">{text}</span>
  </div>
);
