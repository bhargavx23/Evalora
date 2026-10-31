import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import {
  Code2,
  Play,
  CheckCircle2,
  ArrowLeft,
  FileCode,
  Layers,
  Award,
  Loader2,
  Check,
  X,
  ExternalLink
} from 'lucide-react';

const getEditorLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'c':
      return 'c';
    case 'cpp':
    case 'cc':
      return 'cpp';
    case 'sql':
      return 'sql';
    case 'json':
      return 'json';
    default:
      return 'plaintext';
  }
};

const setupMonacoLightTheme = (monaco: any) => {
  monaco.editor.defineTheme('evalora-soft', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#F5F5F7',
      'editorGutter.background': '#F5F5F7',
      'editorLineNumber.foreground': '#9895A8',
      'editorLineNumber.activeForeground': '#8D8BC2',
      'editor.lineHighlightBackground': '#007AFF15',
      'editorCursor.foreground': '#007AFF',
    }
  });
};

export const DomainProjectWorkspace: React.FC = () => {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [domain, setDomain] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<Array<{ filename: string; language: string; content: string }>>([]);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [mobilePane, setMobilePane] = useState<'tasks' | 'editor' | 'preview'>('editor');

  const [compiledPreview, setCompiledPreview] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/domains/${slug}`);
        if (res.data.success) {
          setDomain(res.data.domain);
          const found = res.data.domain.projects.find((p: any) => p.projectId === projectId);
          if (found) {
            setProject(found);
            setFiles(found.starterFiles || []);
            if (found.starterFiles?.length > 0) {
              setActiveFileName(found.starterFiles[0].filename);
            }
          }
        }
      } catch {
        toast.error('Failed to load project details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [slug, projectId]);

  // Update live preview
  useEffect(() => {
    if (files.length === 0) return;

    const htmlFile = files.find((f) => f.filename.endsWith('.html'))?.content || '';
    const cssFile = files.find((f) => f.filename.endsWith('.css'))?.content || '';
    const jsFile = files.find((f) => f.filename.endsWith('.js'))?.content || '';

    const combined = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${cssFile}</style>
</head>
<body>
  ${htmlFile}
  <script type="module">
    ${jsFile}
  </script>
</body>
</html>`;

    setCompiledPreview(combined);
  }, [files]);

  const handleFileContentChange = (newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.filename === activeFileName ? { ...f, content: newContent } : f))
    );
  };

  const handleToggleTask = (taskId: string) => {
    setTaskChecked((prev) => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleSubmitProject = async () => {
    setIsEvaluating(true);
    try {
      const res = await api.post(`/domains/${slug}/projects/${projectId}/submit`, {
        files,
        taskStatus: taskChecked
      });

      if (res.data.success) {
        setEvaluationResult(res.data);
        toast.success(`Project evaluated! Score: ${res.data.score}%`);
      }
    } catch {
      toast.error('Submission failed. Check network connection.');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0056CC]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center">
        <p className="text-[#6E6E73]">Project not found.</p>
        <Button onClick={() => navigate(`/domains/${slug}`)} className="mt-4">
          Back to Learning Path
        </Button>
      </div>
    );
  }

  const activeFile = files.find((f) => f.filename === activeFileName) || files[0];

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Top Navbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            to={`/domains/${slug}`}
            className="flex items-center gap-1 text-xs text-[#6E6E73] hover:text-[#1D1D1F]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Learning Path</span>
          </Link>
          <span className="hidden text-[#6E6E73] sm:inline">|</span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 rounded bg-[#E5F1FF] px-2 py-0.5 text-xs font-bold uppercase text-[#367873] sm:inline-flex">
              {project.difficulty} Project
            </span>
            <span className="truncate text-sm font-semibold text-[#1D1D1F]">{project.title}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitProject}
            disabled={isEvaluating}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#679B7C] hover:bg-[#68977F] active:bg-[#5F8A75] px-4 text-xs font-bold text-white shadow-md shadow-[#719B84]/20 border border-[#C8DFD1] transition-all focus:outline-none focus:ring-2 focus:ring-[#679B7C]/50 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Award className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">{isEvaluating ? 'Evaluating' : 'Submit'}</span>
            <span className="hidden sm:inline">{isEvaluating ? 'Evaluating...' : 'Submit Project Evaluation'}</span>
          </button>
        </div>
      </div>

      <nav className="grid shrink-0 grid-cols-3 border-b border-[#D2D2D7] bg-white text-xs lg:hidden" aria-label="Project workspace panels">
        {([
          ['tasks', 'Milestones', Layers],
          ['editor', 'Editor', Code2],
          ['preview', 'Preview', ExternalLink]
        ] as const).map(([pane, label, Icon]) => (
          <button
            key={pane}
            type="button"
            aria-pressed={mobilePane === pane}
            onClick={() => setMobilePane(pane)}
            className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-3 font-semibold transition-colors ${mobilePane === pane ? 'border-[#007AFF] text-[#0056CC]' : 'border-transparent text-[#6E6E73]'}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>

      {/* Main Split Layout */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left Column: Milestones & Tasks Checklist (320px) */}
        <div className={`${mobilePane === 'tasks' ? 'flex' : 'hidden'} min-h-0 w-full flex-col overflow-y-auto border-r border-[#D2D2D7] bg-[#F5F5F7] p-4 lg:flex lg:w-80 lg:shrink-0 lg:p-5`}>
          <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#007AFF]" />
            <span>Project Milestones</span>
          </h3>
          <p className="mt-2 text-xs text-[#6E6E73]">{project.description}</p>

          <div className="mt-5 space-y-3">
            {(project.tasks || []).map((task: any) => {
              const isChecked = Boolean(taskChecked[task.taskId]);

              return (
                <div
                  key={task.taskId}
                  onClick={() => handleToggleTask(task.taskId)}
                  className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                    isChecked
                      ? 'border-[#C8DFD1] bg-[#E5F2EB] text-[#527565]'
                      : 'border-[#D2D2D7] bg-[#F5F5F7]/60 text-[#6E6E73] hover:border-[#C9C5DD]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <div
                      className={`h-4 w-4 rounded flex items-center justify-center border ${
                        isChecked ? 'bg-[#E5F2EB] border-[#679B7C] text-[#1D1D1F]' : 'border-[#CFE2DC]'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span>{task.title}</span>
                  </div>
                  <p className="mt-1.5 pl-6 text-[11px] text-[#6E6E73]">{task.description}</p>
                </div>
              );
            })}
          </div>

          {/* Feedback Card after evaluation */}
          {evaluationResult && (
            <div className="mt-6 rounded-xl border border-[#9691CC]/40 bg-[#E5F1FF] p-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#367873]">
                <span>Evaluation Result</span>
                <span className="text-sm font-extrabold text-[#1D1D1F]">{evaluationResult.score}%</span>
              </div>
              <p className="mt-2 text-xs text-[#6E6E73]">{evaluationResult.feedback}</p>
            </div>
          )}
        </div>

        {/* Center: File Tabs & Code Editor */}
        <div className={`${mobilePane === 'editor' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col border-r border-[#D2D2D7] bg-[#F5F5F7]`}>
          <div className="flex min-w-0 items-center overflow-x-auto border-b border-[#D2D2D7] bg-[#F5F5F7]">
            {files.map((file) => (
              <button
                key={file.filename}
                onClick={() => setActiveFileName(file.filename)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeFileName === file.filename
                    ? 'border-[#9691CC] bg-[#F5F5F7] text-[#1D1D1F]'
                    : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <FileCode className="h-3.5 w-3.5 text-[#007AFF]" />
                <span>{file.filename}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 overflow-hidden min-h-0 bg-[#F5F5F7]">
            <Editor
              height="100%"
              language={getEditorLanguage(activeFile?.filename || '')}
              value={activeFile?.content || ''}
              beforeMount={setupMonacoLightTheme}
              theme="evalora-soft"
              onChange={(val) => handleFileContentChange(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                lineNumbers: "on",
                roundedSelection: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: "on",
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                suggestOnTriggerCharacters: true,
                autoClosingBrackets: "always",
                autoClosingQuotes: "always",
                formatOnPaste: true,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>
        </div>

        {/* Right: Live Project Preview */}
        <div className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col bg-[#F5F5F7] p-3`}>
          <div className="text-xs font-semibold text-[#6E6E73] pb-2">Live Application Preview</div>
          <div className="h-full w-full overflow-hidden rounded-lg bg-white shadow-md">
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts allow-modals"
              srcDoc={compiledPreview}
              title="Project Live Preview"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
