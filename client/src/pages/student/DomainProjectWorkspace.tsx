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

const setupMonacoBlackTheme = (monaco: any) => {
  monaco.editor.defineTheme('evalora-black', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#000000',
      'editorGutter.background': '#000000',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#a5b4fc',
      'editor.lineHighlightBackground': '#18181b50',
      'editorCursor.foreground': '#6366f1',
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
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Project not found.</p>
        <Button onClick={() => navigate(`/domains/${slug}`)} className="mt-4">
          Back to Learning Path
        </Button>
      </div>
    );
  }

  const activeFile = files.find((f) => f.filename === activeFileName) || files[0];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0b0f19] text-gray-200 min-h-0 min-w-0">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#111827] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            to={`/domains/${slug}`}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Learning Path</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-900/60 text-indigo-300 px-2 py-0.5 text-xs font-bold uppercase">
              {project.difficulty} Project
            </span>
            <span className="text-sm font-semibold text-white">{project.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSubmitProject}
            disabled={isEvaluating}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 text-xs font-bold text-white shadow-md shadow-emerald-950/40 border border-emerald-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Award className="h-4 w-4 shrink-0" />
            <span>{isEvaluating ? 'Evaluating...' : 'Submit Project Evaluation'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Milestones & Tasks Checklist (320px) */}
        <div className="w-80 flex flex-col border-r border-gray-800 bg-[#0f172a] p-5 overflow-y-auto">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Project Milestones</span>
          </h3>
          <p className="mt-2 text-xs text-gray-400">{project.description}</p>

          <div className="mt-5 space-y-3">
            {(project.tasks || []).map((task: any) => {
              const isChecked = Boolean(taskChecked[task.taskId]);

              return (
                <div
                  key={task.taskId}
                  onClick={() => handleToggleTask(task.taskId)}
                  className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                    isChecked
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <div
                      className={`h-4 w-4 rounded flex items-center justify-center border ${
                        isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-gray-600'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span>{task.title}</span>
                  </div>
                  <p className="mt-1.5 pl-6 text-[11px] text-gray-400">{task.description}</p>
                </div>
              );
            })}
          </div>

          {/* Feedback Card after evaluation */}
          {evaluationResult && (
            <div className="mt-6 rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                <span>Evaluation Result</span>
                <span className="text-sm font-extrabold text-white">{evaluationResult.score}%</span>
              </div>
              <p className="mt-2 text-xs text-gray-300">{evaluationResult.feedback}</p>
            </div>
          )}
        </div>

        {/* Center: File Tabs & Code Editor */}
        <div className="flex flex-1 flex-col border-r border-gray-800 bg-[#0b0f19]">
          <div className="flex items-center border-b border-gray-800 bg-[#111827]">
            {files.map((file) => (
              <button
                key={file.filename}
                onClick={() => setActiveFileName(file.filename)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeFileName === file.filename
                    ? 'border-indigo-500 bg-[#0b0f19] text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                <span>{file.filename}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 overflow-hidden min-h-0 bg-black">
            <Editor
              height="100%"
              language={getEditorLanguage(activeFile?.filename || '')}
              value={activeFile?.content || ''}
              beforeMount={setupMonacoBlackTheme}
              theme="evalora-black"
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
        <div className="flex flex-1 flex-col bg-[#0f172a] p-3">
          <div className="text-xs font-semibold text-gray-400 pb-2">Live Application Preview</div>
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
