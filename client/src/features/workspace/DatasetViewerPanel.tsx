import React, { useState } from 'react';
import { Database, Table, Copy, Check, FileText } from 'lucide-react';

export interface DatasetItem {
  id: string;
  name: string;
  filename: string;
  description: string;
  rowCount: number;
  sampleRows: any[];
}

interface DatasetViewerPanelProps {
  datasets: DatasetItem[];
  selectedDatasetId?: string;
  onSelectDataset?: (id: string) => void;
}

export const DatasetViewerPanel: React.FC<DatasetViewerPanelProps> = ({
  datasets,
  selectedDatasetId,
  onSelectDataset
}) => {
  const [activeId, setActiveId] = useState<string>(
    selectedDatasetId || (datasets.length > 0 ? datasets[0].id : '')
  );
  const [copied, setCopied] = useState(false);

  const activeDataset = datasets.find((d) => d.id === activeId) || datasets[0];

  const handleCopySnippet = (filename: string) => {
    const snippet = `import pandas as pd\ndf = pd.read_csv('${filename}')\nprint(df.head())`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!datasets || datasets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
        <Database className="h-8 w-8 text-text-muted mb-2 opacity-50" />
        <p className="text-xs">No datasets attached to this workspace.</p>
      </div>
    );
  }

  const columns = activeDataset && activeDataset.sampleRows && activeDataset.sampleRows.length > 0
    ? Object.keys(activeDataset.sampleRows[0])
    : [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-text-primary">
      {/* Header & Dataset Tabs */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {datasets.map((ds) => {
            const isActive = ds.id === activeDataset?.id;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => {
                  setActiveId(ds.id);
                  if (onSelectDataset) onSelectDataset(ds.id);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-brand-primary border border-border-subtle shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-brand-primary" />
                <span>{ds.name}</span>
                <span className="rounded-full bg-brand-light px-1.5 py-0.2 text-[10px] text-brand-dark">
                  {ds.rowCount} rows
                </span>
              </button>
            );
          })}
        </div>

        {activeDataset && (
          <button
            type="button"
            onClick={() => handleCopySnippet(activeDataset.filename)}
            className="flex items-center gap-1 rounded-md border border-border-subtle bg-white px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-brand-primary hover:border-brand-primary/30 transition-colors"
            title="Copy pandas read_csv code snippet"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy import snippet</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Dataset Details & Preview */}
      {activeDataset && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border-subtle bg-surface-neutral/30 px-4 py-2.5 text-xs">
            <p className="text-text-secondary">{activeDataset.description}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
              <span>File: <code className="font-mono text-brand-primary font-semibold">{activeDataset.filename}</code></span>
              <span>•</span>
              <span>Total Records: <strong className="text-text-primary">{activeDataset.rowCount}</strong></span>
              <span>•</span>
              <span>Features ({columns.length}): <span className="font-mono text-text-secondary">{columns.join(', ')}</span></span>
            </div>
          </div>

          {/* Table Container */}
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-neutral/70 font-semibold text-text-secondary">
                    <th className="py-2 px-3 text-[11px] font-mono w-10 text-text-muted">#</th>
                    {columns.map((col) => (
                      <th key={col} className="py-2 px-3 font-medium font-mono text-[11px] text-text-primary">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                  {activeDataset.sampleRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-brand-light/30 transition-colors">
                      <td className="py-1.5 px-3 text-text-muted">{idx + 1}</td>
                      {columns.map((col) => (
                        <td key={col} className="py-1.5 px-3 text-text-primary whitespace-nowrap">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-[11px] text-text-muted">
              Showing top {activeDataset.sampleRows.length} sample rows of {activeDataset.rowCount} records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
