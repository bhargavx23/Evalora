import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import {
  CodeVisualizationPanel,
  VisualizerUpgradeModal,
  SampleCodeDropdown
} from '../../features/codeVisualizer';
import { IVisualizationResult, IExecutionStep } from '../../shared/types';
import {
  Cpu,
  Play,
  RotateCcw,
  Code2,
  Lock,
  ArrowRight,
  Loader2,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface IVisualizerSample {
  sampleId: string;
  title: string;
  language: 'javascript' | 'python';
  category: string;
  difficulty: string;
  description: string;
  code: string;
}

const DEFAULT_STARTER_JS = `// Enter or paste JavaScript code to visualize execution
let numbers = [10, 20, 30, 40];
let sum = 0;

for (let i = 0; i < numbers.length; i++) {
  sum += numbers[i];
  console.log("Current index:", i, "Running sum:", sum);
}

console.log("Final Total:", sum);`;

const DEFAULT_STARTER_PY = `# Enter or paste Python code to visualize execution
numbers = [10, 20, 30, 40]
total = 0

for num in numbers:
    total += num
    print(f"Adding {num}, current total = {total}")

print("Final total:", total)`;

const setupMonacoLightTheme = (monaco: any) => {
  monaco.editor.defineTheme('evalora-soft', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#F5F5F7',
      'editorGutter.background': '#F5F5F7',
      'editorLineNumber.foreground': '#8490A2',
      'editorLineNumber.activeForeground': '#8D8BC2',
      'editor.lineHighlightBackground': '#007AFF15',
      'editorCursor.foreground': '#007AFF'
    }
  });
};

export const DedicatedCodeVisualizer: React.FC = () => {
  const toast = useToast();

  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [code, setCode] = useState<string>(DEFAULT_STARTER_JS);
  const [samples, setSamples] = useState<IVisualizerSample[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');
  const [isSamplesLoading, setIsSamplesLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Entitlement state
  const [isEntitled, setIsEntitled] = useState<boolean>(true);
  const [userPlanName, setUserPlanName] = useState<string>('');
  const [isStatusLoading, setIsStatusLoading] = useState<boolean>(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<string>('');

  // Trace execution state
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [visualizationResult, setVisualizationResult] = useState<IVisualizationResult | null>(null);
  const [activeStep, setActiveStep] = useState<IExecutionStep | null>(null);

  // Monaco Editor refs
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsCollectionRef = useRef<any>(null);

  // 1. Fetch visualizer entitlement status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsStatusLoading(true);
        const res = await api.get('/visualizer/status');
        if (res.data.success) {
          setIsEntitled(Boolean(res.data.entitled));
          setUserPlanName(res.data.planName || 'Free Tier');
        }
      } catch {
        setIsEntitled(false);
      } finally {
        setIsStatusLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // 2. Fetch database-backed samples
  useEffect(() => {
    const fetchSamples = async () => {
      try {
        setIsSamplesLoading(true);
        const res = await api.get('/visualizer/samples');
        if (res.data.success && res.data.samples) {
          setSamples(res.data.samples);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setIsSamplesLoading(false);
      }
    };

    fetchSamples();
  }, []);

  // Synchronize Monaco line highlight decoration with current step
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (activeStep && activeStep.line > 0) {
      const newDecorations = [
        {
          range: new monaco.Range(activeStep.line, 1, activeStep.line, 1),
          options: {
            isWholeLine: true,
            className: 'active-execution-line-bg',
            linesDecorationsClassName: 'active-execution-line-decor'
          }
        }
      ];

      if (editor.createDecorationsCollection) {
        if (!decorationsCollectionRef.current) {
          decorationsCollectionRef.current = editor.createDecorationsCollection(newDecorations);
        } else {
          decorationsCollectionRef.current.set(newDecorations);
        }
      } else {
        decorationsCollectionRef.current = editor.deltaDecorations(
          decorationsCollectionRef.current || [],
          newDecorations
        );
      }

      editor.revealLineInCenter(activeStep.line);
    } else {
      if (decorationsCollectionRef.current) {
        if (decorationsCollectionRef.current.clear) {
          decorationsCollectionRef.current.clear();
        } else if (editor.deltaDecorations) {
          decorationsCollectionRef.current = editor.deltaDecorations(
            decorationsCollectionRef.current,
            []
          );
        }
      }
    }
  }, [activeStep]);

  // Handle switching language
  const handleLanguageChange = (newLang: 'javascript' | 'python') => {
    setLanguage(newLang);
    setSelectedSampleId('');
    setVisualizationResult(null);
    setActiveStep(null);
    if (newLang === 'python') {
      setCode(DEFAULT_STARTER_PY);
    } else {
      setCode(DEFAULT_STARTER_JS);
    }
  };

  // Handle loading sample algorithm
  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setVisualizationResult(null);
    setActiveStep(null);
    const found = samples.find((s) => s.sampleId === sampleId);
    if (found) {
      setLanguage(found.language);
      setCode(found.code);
      toast.info(`Loaded sample: ${found.title}`);
    }
  };

  const handleClearSample = () => {
    setSelectedSampleId('');
    if (language === 'python') {
      setCode(DEFAULT_STARTER_PY);
    } else {
      setCode(DEFAULT_STARTER_JS);
    }
    setVisualizationResult(null);
    setActiveStep(null);
  };

  // Generate genuine execution trace
  const handleRunVisualization = async () => {
    if (!code.trim()) {
      toast.error('Please enter code to visualize.');
      return;
    }

    try {
      setIsTracing(true);
      setActiveStep(null);

      const res = await api.post('/visualizer/trace', {
        code,
        language
      });

      if (res.data.success) {
        setVisualizationResult(res.data);
        toast.success(`Trace ready: ${res.data.totalSteps} execution steps recorded!`);
      } else if (res.data.supported === false) {
        setVisualizationResult(res.data);
        toast.info(res.data.message || 'Language not supported.');
      } else {
        setVisualizationResult(res.data);
        toast.error(res.data.error || 'Execution could not complete.');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        const data = err.response.data;
        setUpgradeModalReason(
          data.message ||
            'Interactive Step-by-Step Execution Visualizer is a premium feature available on Domain Pass (4 ALGO), Pro (5 ALGO), and Master (8 ALGO) plans.'
        );
        setShowUpgradeModal(true);
      } else {
        toast.error(err.response?.data?.message || 'Failed to generate execution trace.');
      }
    } finally {
      setIsTracing(false);
    }
  };

  return (
    <div
      className={`flex flex-col w-full overflow-hidden transition-all duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#F5F5F7]'
          : 'h-[calc(100vh-5.5rem)] rounded-xl border border-border-subtle bg-white shadow-xs'
      }`}
    >
      {/* 1. Header & Configuration Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white px-4 py-2.5 shrink-0 z-10">
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light text-brand-primary border border-brand-accent/40 shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary tracking-tight truncate">
                Code Execution Visualizer
              </h2>
              <span className="rounded-full bg-brand-light border border-brand-accent/40 px-2 py-0.2 text-[10px] font-bold text-brand-dark shrink-0">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-text-muted hidden sm:block truncate">
              Step-by-step algorithm runtime tracer and state inspector
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Switcher */}
          <div className="flex items-center bg-surface-neutral rounded-lg p-0.5 border border-border-subtle text-xs">
            <button
              type="button"
              onClick={() => handleLanguageChange('javascript')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                language === 'javascript'
                  ? 'bg-white text-brand-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              JavaScript
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('python')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                language === 'python'
                  ? 'bg-white text-brand-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Python 3
            </button>
          </div>

          {/* Redesigned Sample Code Dropdown */}
          <SampleCodeDropdown
            samples={samples}
            selectedSampleId={selectedSampleId}
            onSelectSample={handleSelectSample}
            onClearSample={handleClearSample}
            isLoading={isSamplesLoading}
            currentLanguage={language}
          />

          {/* Clear Code Action */}
          <button
            type="button"
            onClick={() => {
              setCode('');
              setSelectedSampleId('');
              setVisualizationResult(null);
              setActiveStep(null);
            }}
            title="Clear editor code"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border-subtle bg-white text-text-secondary hover:text-text-primary hover:bg-surface-neutral transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            className="h-9 w-9 hidden md:inline-flex items-center justify-center rounded-lg border border-border-subtle bg-white text-text-secondary hover:text-text-primary hover:bg-surface-neutral transition-colors"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Primary Action Button: Start Visualization */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleRunVisualization}
            isLoading={isTracing}
            icon={<Play className="h-3.5 w-3.5" />}
          >
            <span>Start Visualization</span>
          </Button>
        </div>
      </header>

      {/* Free Tier / Non-Entitled Banner Notice */}
      {!isStatusLoading && !isEntitled && (
        <div className="flex items-center justify-between border-b border-brand-accent/40 bg-brand-light px-4 py-2 text-xs text-brand-dark shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-brand-primary shrink-0" />
            <span>
              You are currently on <strong>{userPlanName}</strong>. Interactive Code Visualization requires an active{' '}
              <strong>Domain Pass (4 ALGO)</strong>, <strong>Pro (5 ALGO)</strong>, or <strong>Master (8 ALGO)</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setUpgradeModalReason(
                'Interactive Code Execution Visualizer requires a Domain Pass, Pro, or Master plan.'
              );
              setShowUpgradeModal(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline"
          >
            <span>Upgrade to Unlock</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 2. Main Two-Column Full-Size Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 min-w-0">
        {/* Left Column: Monaco Code Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 border-b lg:border-b-0 lg:border-r border-border-subtle bg-[#F5F5F7]">
          <div className="flex items-center justify-between border-b border-[#D2D2D7] bg-[#F5F5F7] px-4 py-2 text-xs font-mono font-semibold text-[#6E6E73] shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-[#A5B4FC]" />
              <span>
                Source Editor ({language === 'javascript' ? 'JavaScript ES6+' : 'Python 3.13'})
              </span>
            </div>
            <span className="text-[#6E6E73] text-[11px]">250 Steps Loop Guard Enabled</span>
          </div>

          <div className="flex-1 overflow-hidden relative min-h-0 bg-[#F5F5F7]">
            <Editor
              height="100%"
              language={language}
              value={code}
              beforeMount={setupMonacoLightTheme}
              theme="evalora-soft"
              onChange={(val) => setCode(val || '')}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true
                },
                suggestOnTriggerCharacters: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                formatOnPaste: true,
                padding: { top: 14, bottom: 14 }
              }}
            />
          </div>
        </div>

        {/* Right Column: Execution Visualizer Player & Watcher */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
          <CodeVisualizationPanel
            result={visualizationResult}
            isLoading={isTracing}
            onStepChange={(step) => setActiveStep(step)}
            onRequestUpgrade={() => {
              setUpgradeModalReason(
                'Interactive Code Execution Visualizer requires a Domain Pass, Pro, or Master plan.'
              );
              setShowUpgradeModal(true);
            }}
          />
        </div>
      </div>

      {/* Subscription Upgrade Modal */}
      <VisualizerUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeModalReason}
      />
    </div>
  );
};
