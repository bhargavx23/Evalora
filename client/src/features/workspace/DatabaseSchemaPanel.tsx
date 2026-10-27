import React, { useState } from 'react';
import { Database, Table as TableIcon, Key, Copy, Check } from 'lucide-react';

export interface SchemaTableItem {
  tableName: string;
  description: string;
  columns: Array<{ name: string; type: string; isPrimary?: boolean }>;
  sampleRows: any[];
}

interface DatabaseSchemaPanelProps {
  tables: SchemaTableItem[];
}

export const DatabaseSchemaPanel: React.FC<DatabaseSchemaPanelProps> = ({ tables }) => {
  const [activeTable, setActiveTable] = useState<string>(
    tables.length > 0 ? tables[0].tableName : ''
  );
  const [copied, setCopied] = useState(false);

  const currentTable = tables.find((t) => t.tableName === activeTable) || tables[0];

  const handleCopySelect = (tableName: string) => {
    const snippet = `SELECT * FROM ${tableName} LIMIT 10;`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tables || tables.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
        <Database className="h-8 w-8 text-text-muted mb-2 opacity-50" />
        <p className="text-xs">No database tables available in this workspace schema.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-text-primary">
      {/* Table Selection Tabs */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tables.map((t) => {
            const isActive = t.tableName === currentTable?.tableName;
            return (
              <button
                key={t.tableName}
                type="button"
                onClick={() => setActiveTable(t.tableName)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-brand-primary border border-border-subtle shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5 text-brand-primary" />
                <span className="font-mono">{t.tableName}</span>
                <span className="rounded-full bg-brand-light px-1.5 py-0.2 text-[10px] text-brand-dark">
                  {t.columns.length} cols
                </span>
              </button>
            );
          })}
        </div>

        {currentTable && (
          <button
            type="button"
            onClick={() => handleCopySelect(currentTable.tableName)}
            className="flex items-center gap-1 rounded-md border border-border-subtle bg-white px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-brand-primary hover:border-brand-primary/30 transition-colors"
            title="Copy SELECT query"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#527565]" />
                <span className="text-[#527565]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy SELECT</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Schema View */}
      {currentTable && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 space-y-4 text-xs">
          {/* Table Header Details */}
          <div className="rounded-xl border border-border-subtle bg-surface-neutral/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-text-primary">{currentTable.tableName}</span>
              <span className="text-[11px] text-text-muted">{currentTable.columns.length} columns</span>
            </div>
            <p className="mt-1 text-[11px] text-text-secondary">{currentTable.description}</p>
          </div>

          {/* Columns Definition List */}
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Columns Specification</h4>
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-neutral/60 font-semibold text-text-secondary">
                    <th className="py-2 px-3 font-mono text-[11px]">Column</th>
                    <th className="py-2 px-3 font-mono text-[11px]">Type</th>
                    <th className="py-2 px-3 text-[11px]">Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                  {currentTable.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-brand-light/20">
                      <td className="py-1.5 px-3 font-semibold text-text-primary">{col.name}</td>
                      <td className="py-1.5 px-3 text-brand-primary">{col.type}</td>
                      <td className="py-1.5 px-3">
                        {col.isPrimary ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#F8F3E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#896D45] border border-[#E8D9B9]">
                            <Key className="h-2.5 w-2.5" /> PK
                          </span>
                        ) : (
                          <span className="text-text-muted text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Rows Preview */}
          {currentTable.sampleRows && currentTable.sampleRows.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Sample Records Preview</h4>
              <div className="overflow-x-auto rounded-xl border border-border-subtle bg-white shadow-xs">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-neutral/60 font-semibold text-text-secondary">
                      {currentTable.columns.map((c) => (
                        <th key={c.name} className="py-2 px-3 whitespace-nowrap">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {currentTable.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-brand-light/20">
                        {currentTable.columns.map((c) => (
                          <td key={c.name} className="py-1.5 px-3 whitespace-nowrap text-text-primary">
                            {String(row[c.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
