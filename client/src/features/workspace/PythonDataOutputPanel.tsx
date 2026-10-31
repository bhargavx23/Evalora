import React, { useState } from 'react';
import { BarChart3, Image as ImageIcon, Table as TableIcon, Terminal, Clock, CheckCircle2, AlertCircle, Maximize2, X } from 'lucide-react';

export interface PythonDataOutputProps {
  result: {
    success?: boolean;
    output?: string;
    stderr?: string;
    executionTimeMs?: number;
    plots?: string[];
    metrics?: Record<string, number>;
    tablePreview?: {
      columns: string[];
      rows: any[];
    };
  } | null;
  isRunning?: boolean;
}

export const PythonDataOutputPanel: React.FC<PythonDataOutputProps> = ({
  result,
  isRunning = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'plots' | 'table' | 'console'>('overview');
  const [enlargedPlot, setEnlargedPlot] = useState<string | null>(null);

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent mb-3" />
        <p className="text-xs font-medium text-text-primary">Executing Python Data Science code...</p>
        <p className="text-[11px] text-text-muted mt-1">Crunching data, training models & rendering plots in isolated sandbox</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted bg-white">
        <BarChart3 className="h-10 w-10 text-text-muted mb-2 opacity-40" />
        <p className="text-xs font-medium text-text-primary">Run code to see Data Science outputs</p>
        <p className="text-[11px] text-text-muted max-w-xs mt-1">
          Execute your Python script to generate real Matplotlib charts, inspect Pandas DataFrames, and evaluate model metrics.
        </p>
      </div>
    );
  }

  const plots = result.plots || [];
  const metrics = result.metrics || {};
  const metricKeys = Object.keys(metrics);
  const tableData = result.tablePreview;
  const hasError = !result.success || Boolean(result.stderr);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-text-primary">
      {/* Tab Navigation Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Visuals', count: plots.length + metricKeys.length },
            { id: 'plots', label: 'Plots', count: plots.length },
            { id: 'table', label: 'Data Table', count: tableData?.rows?.length ? tableData.rows.length : 0 },
            { id: 'console', label: 'Console Output', hasErr: hasError }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-brand-primary font-semibold text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="rounded-full bg-brand-light px-1.5 py-0.2 text-[10px] font-bold text-brand-dark">
                    {tab.count}
                  </span>
                )}
                {tab.hasErr && (
                  <span className="rounded-full bg-[#F8EDEF] px-1.5 py-0.2 text-[10px] font-bold text-[#A36162]">
                    error
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Execution time badge */}
        {result.executionTimeMs !== undefined && (
          <div className="flex items-center gap-1 font-mono text-[11px] text-text-muted pr-2">
            <Clock className="h-3 w-3" />
            <span>{result.executionTimeMs} ms</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error notification if any */}
        {result.stderr && (
          <div className="rounded-xl border border-[#EACBC4] bg-[#F8EDEF]/70 p-3 text-xs text-[#A36162]">
            <div className="flex items-center gap-1.5 font-semibold mb-1 text-[#A36162]">
              <AlertCircle className="h-4 w-4 text-[#A36162] shrink-0" />
              <span>Execution Note / Error:</span>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{result.stderr}</pre>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Metric Cards if extracted */}
            {metricKeys.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Model Metrics & Evaluations
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {metricKeys.map((key) => {
                    const val = metrics[key];
                    const isPercentage = key.toLowerCase().includes('accuracy') || key.toLowerCase().includes('score');
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-3 flex flex-col justify-between shadow-2xs"
                      >
                        <span className="text-[11px] font-medium text-text-secondary capitalize truncate">
                          {key}
                        </span>
                        <span className="mt-1 font-mono text-lg font-bold text-brand-dark">
                          {isPercentage && val <= 1 ? `${(val * 100).toFixed(1)}%` : val.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Generated Plots */}
            {plots.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Generated Plots ({plots.length})
                  </h4>
                  <span className="text-[11px] text-text-muted">Click to view enlarged</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plots.map((base64Plot, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEnlargedPlot(base64Plot)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border-subtle bg-white p-2 shadow-xs hover:border-brand-primary/40 transition-all"
                    >
                      <img
                        src={`data:image/png;base64,${base64Plot}`}
                        alt={`Figure ${idx + 1}`}
                        className="w-full h-auto object-contain rounded-lg"
                      />
                      <div className="absolute top-3 right-3 rounded-md bg-white/90 p-1 opacity-0 group-hover:opacity-100 shadow-xs transition-opacity border border-border-subtle">
                        <Maximize2 className="h-3.5 w-3.5 text-text-primary" />
                      </div>
                      <div className="mt-1 text-center font-mono text-[10px] text-text-muted">
                        Figure {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              !result.stderr && (
                <div className="rounded-xl border border-dashed border-border-subtle p-4 text-center text-xs text-text-muted">
                  <ImageIcon className="h-5 w-5 mx-auto mb-1 opacity-40" />
                  <span>No plots rendered. Call <code className="font-mono text-brand-primary">plt.show()</code> or <code className="font-mono text-brand-primary">plt.plot()</code> to visualize data.</span>
                </div>
              )
            )}

            {/* Console snippet preview */}
            {result.output && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Output Logs
                </h4>
                <div className="rounded-xl border border-border-subtle bg-[#EFF2F8] p-3 font-mono text-xs text-[#719B84] overflow-x-auto max-h-48 leading-relaxed">
                  <pre className="whitespace-pre-wrap">{result.output}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PLOTS */}
        {activeTab === 'plots' && (
          <div className="space-y-4">
            {plots.length > 0 ? (
              plots.map((base64Plot, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border-subtle bg-white p-3 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border-subtle mb-3">
                    <span className="font-semibold text-xs text-text-primary">Plot Figure {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setEnlargedPlot(base64Plot)}
                      className="flex items-center gap-1 text-[11px] text-brand-primary hover:underline font-medium"
                    >
                      <Maximize2 className="h-3 w-3" /> Full Size
                    </button>
                  </div>
                  <img
                    src={`data:image/png;base64,${base64Plot}`}
                    alt={`Figure ${idx + 1}`}
                    className="w-full max-h-[480px] object-contain rounded-lg mx-auto"
                  />
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-text-muted text-xs">
                No Matplotlib plots generated during execution.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DATA TABLE */}
        {activeTab === 'table' && (
          <div>
            {tableData && tableData.rows && tableData.rows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xs">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-neutral/70 font-semibold text-text-secondary">
                      <th className="py-2 px-3 w-10 text-text-muted">#</th>
                      {tableData.columns.map((col) => (
                        <th key={col} className="py-2 px-3 whitespace-nowrap text-text-primary">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {tableData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-brand-light/20">
                        <td className="py-1.5 px-3 text-text-muted">{idx + 1}</td>
                        {tableData.columns.map((col) => (
                          <td key={col} className="py-1.5 px-3 whitespace-nowrap text-text-primary">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted text-xs">
                No tabular DataFrame output captured. Print a DataFrame (e.g. <code className="font-mono text-brand-primary">print(df.head())</code>) to view structured rows here.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONSOLE */}
        {activeTab === 'console' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border-subtle bg-[#EFF2F8] p-4 font-mono text-xs text-[#3C4B63] overflow-x-auto min-h-[220px]">
              {result.output ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-[#719B84]">{result.output}</pre>
              ) : (
                <span className="text-gray-500 italic">No standard output logged.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enlarged Plot Modal */}
      {enlargedPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#625E75]/35 p-4 backdrop-blur-xs"
          onClick={() => setEnlargedPlot(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlargedPlot(null)}
              className="absolute -top-3 -right-3 rounded-full bg-surface-neutral p-1.5 text-text-secondary hover:text-text-primary shadow-md border border-border-subtle"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={`data:image/png;base64,${enlargedPlot}`}
              alt="Enlarged Plot"
              className="max-h-[82vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
