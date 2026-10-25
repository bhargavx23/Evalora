import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Code2, Check, X, BookOpen, Loader2 } from 'lucide-react';

export interface IVisualizerSample {
  sampleId: string;
  title: string;
  language: 'javascript' | 'python';
  category: string;
  difficulty: string;
  description: string;
  code: string;
}

interface SampleCodeDropdownProps {
  samples: IVisualizerSample[];
  selectedSampleId: string;
  onSelectSample: (sampleId: string) => void;
  onClearSample?: () => void;
  isLoading?: boolean;
  currentLanguage?: 'javascript' | 'python';
}

export const SampleCodeDropdown: React.FC<SampleCodeDropdownProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
  onClearSample,
  isLoading = false,
  currentLanguage
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const selectedSample = samples.find((s) => s.sampleId === selectedSampleId);

  // Group samples by language
  const jsSamples = samples.filter((s) => s.language === 'javascript');
  const pySamples = samples.filter((s) => s.language === 'python');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < samples.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : samples.length - 1));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < samples.length) {
      e.preventDefault();
      onSelectSample(samples[focusedIndex].sampleId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={selectedSample ? `Selected: ${selectedSample.title}` : 'Choose Sample Code'}
          className={`h-9 flex items-center justify-between gap-2 rounded-lg border bg-white px-3 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${
            selectedSample
              ? 'border-brand-primary/40 text-text-primary bg-brand-light/30'
              : 'border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-neutral'
          } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          style={{ minWidth: '180px', maxWidth: '260px' }}
        >
          <div className="flex items-center gap-2 truncate">
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary shrink-0" />
            ) : (
              <BookOpen className="h-3.5 w-3.5 text-brand-primary shrink-0" />
            )}
            <span className="truncate">
              {selectedSample ? selectedSample.title : 'Choose Sample Code'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedSample && onClearSample && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSample();
                }}
                title="Clear selected sample"
                className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-black/5"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 text-text-muted transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* Floating Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 z-50 w-72 sm:w-80 rounded-xl border border-border-subtle bg-white py-1.5 shadow-lg focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100 max-h-80 overflow-y-auto"
        >
          {samples.length === 0 ? (
            <div className="p-3 text-center text-xs text-text-muted">No sample codes available.</div>
          ) : (
            <>
              {/* JavaScript Section */}
              {jsSamples.length > 0 && (
                <div className="px-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                    <span>JavaScript Samples</span>
                    <span className="text-[9px] font-mono text-text-muted">ES6+</span>
                  </div>
                  {jsSamples.map((sample) => {
                    const isSelected = sample.sampleId === selectedSampleId;
                    return (
                      <button
                        key={sample.sampleId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSelectSample(sample.sampleId);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-brand-light text-brand-dark font-semibold'
                            : 'hover:bg-surface-neutral text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{sample.title}</span>
                            <span className="rounded bg-surface-neutral px-1.5 py-0.2 text-[9px] font-medium text-text-muted shrink-0">
                              {sample.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {sample.description}
                          </p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Divider if both languages present */}
              {jsSamples.length > 0 && pySamples.length > 0 && (
                <div className="my-1 border-t border-border-subtle" />
              )}

              {/* Python Section */}
              {pySamples.length > 0 && (
                <div className="px-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                    <span>Python 3 Samples</span>
                    <span className="text-[9px] font-mono text-text-muted">3.13</span>
                  </div>
                  {pySamples.map((sample) => {
                    const isSelected = sample.sampleId === selectedSampleId;
                    return (
                      <button
                        key={sample.sampleId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSelectSample(sample.sampleId);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-brand-light text-brand-dark font-semibold'
                            : 'hover:bg-surface-neutral text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{sample.title}</span>
                            <span className="rounded bg-surface-neutral px-1.5 py-0.2 text-[9px] font-medium text-text-muted shrink-0">
                              {sample.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {sample.description}
                          </p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
