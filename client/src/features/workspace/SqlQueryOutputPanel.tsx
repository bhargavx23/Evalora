import React, { useState } from 'react';
import { Database, Clock, CheckCircle2, AlertCircle, FileText, Table } from 'lucide-react';

export interface SqlQueryOutputProps {
  result: {
    success?: boolean;
    columns?: string[];
    rows?: any[];
    rowCount?: number;
    executionTimeMs?: number;
    rawOutput?: string;
    error?: string;
  } | null;
  isRunning?: boolean;
}

export const SqlQueryOutputPanel: React.FC<SqlQueryOutputProps> = ({
  result,
  isRunning = false
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'raw'>('table');

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent mb-3" />
        <p className="text-xs font-medium text-text-primary">Executing SQL query against SQLite database...</p>
        <p className="text-[11px] text-text-muted mt-1">Analyzing syntax, building execution plan, and fetching records</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted bg-white">
        <Database className="h-10 w-10 text-text-muted mb-2 opacity-40" />
        <p className="text-xs font-medium text-text-primary">Execute query to see database results</p>
        <p className="text-[11px] text-text-muted max-w-xs mt-1">
          Write standard SQL (SELECT, WHERE, JOIN, GROUP BY) and run against the pre-loaded sandbox database.
        </p>
      </div>
    );
  }

  const columns = result.columns || [];
  const rows = result.rows || [];
  const rowCount = result.rowCount !== undefined ? result.rowCount : rows.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-text-primary">
      {/* Header Tabs */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
              activeTab === 'table'
                ? 'border-brand-primary font-semibold text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            <span>Result Grid</span>
            <span className="rounded-full bg-brand-light px-1.5 py-0.2 text-[10px] font-bold text-brand-dark">
              {rowCount} rows
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${
              activeTab === 'raw'
                ? 'border-brand-primary font-semibold text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Raw Output</span>
          </button>
        </div>

        {/* Query Stats */}
        <div className="flex items-center gap-3 pr-2 text-[11px] text-text-muted font-mono">
          {result.executionTimeMs !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.executionTimeMs} ms
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* SQL Error Banner */}
        {result.error && (
          <div className="mb-4 rounded-xl border border-[#EACBC4] bg-[#F8EDEF]/70 p-3.5 text-xs text-[#A36162]">
            <div className="flex items-center gap-2 font-semibold text-[#A36162] mb-1">
              <AlertCircle className="h-4 w-4 text-[#A36162] shrink-0" />
              <span>SQL Execution Error:</span>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{result.error}</pre>
          </div>
        )}

        {/* Tab 1: Table Grid */}
        {activeTab === 'table' && !result.error && (
          <div>
            {columns.length > 0 && rows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xs">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-neutral/70 font-semibold text-text-secondary">
                      <th className="py-2 px-3 w-10 text-text-muted">#</th>
                      {columns.map((col) => (
                        <th key={col} className="py-2 px-3 whitespace-nowrap text-text-primary">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-brand-light/20 transition-colors">
                        <td className="py-1.5 px-3 text-text-muted">{idx + 1}</td>
                        {columns.map((col) => {
                          const val = Array.isArray(row) ? row[columns.indexOf(col)] : row[col];
                          return (
                            <td key={col} className="py-1.5 px-3 whitespace-nowrap text-text-primary">
                              {val === null ? (
                                <span className="italic text-text-muted">NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted text-xs">
                {rowCount === 0 ? 'Query returned 0 rows successfully.' : 'No rows to display.'}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raw / Explain Output */}
        {activeTab === 'raw' && (
          <div className="rounded-xl border border-border-subtle bg-[#EFF2F8] p-4 font-mono text-xs text-[#3C4B63] overflow-x-auto min-h-[220px]">
            {result.rawOutput ? (
              <pre className="whitespace-pre-wrap text-[#719B84] leading-relaxed">{result.rawOutput}</pre>
            ) : (
              <pre className="whitespace-pre-wrap text-gray-400 leading-relaxed">
                {JSON.stringify({ columns, rowCount, rows }, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
