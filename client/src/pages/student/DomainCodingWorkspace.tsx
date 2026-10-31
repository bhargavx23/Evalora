import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Code2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Monitor,
  Smartphone,
  Tablet,
  ArrowLeft,
  Cpu,
  FileCode,
  Save,
  Send,
  Loader2,
  ChevronRight,
  Award,
  Maximize2,
  Minimize2,
  Database,
  Table as TableIcon,
  FileText,
  Check,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { CodeVisualizationPanel, VisualizerUpgradeModal } from '../../features/codeVisualizer';
import {
  DatasetViewerPanel,
  DatabaseSchemaPanel,
  PythonDataOutputPanel,
  SqlQueryOutputPanel,
  DsaTestCasePanel
} from '../../features/workspace';
import {
  IAssignmentStarterFile,
  IAssignmentRubricItem,
  IDomainAssignment,
  IVisualizationResult,
  IExecutionStep,
  IWorkspaceConfig,
  CodingLanguage
} from '../../shared/types';

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

export const DomainCodingWorkspace: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const moduleIdParam = searchParams.get('moduleId');
  const isAssignmentMode = searchParams.get('assignment') === 'true';
  const topicParam = searchParams.get('topic');
  const exerciseIdParam = searchParams.get('exerciseId');

  // Backend-loaded state
  const [assignment, setAssignment] = useState<IDomainAssignment | null>(null);
  const [exercise, setExercise] = useState<any | null>(null);
  const [workspaceConfig, setWorkspaceConfig] = useState<IWorkspaceConfig | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string>(moduleIdParam || '');
  const [taskTitle, setTaskTitle] = useState<string>('Coding Workspace');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [rubricItems, setRubricItems] = useState<IAssignmentRubricItem[]>([]);

  // Files & Language state
  const [files, setFiles] = useState<IAssignmentStarterFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [initialFiles, setInitialFiles] = useState<IAssignmentStarterFile[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');

  // Multi-domain workspace input/output state
  const [activeLeftTab, setActiveLeftTab] = useState<'instructions' | 'dataset' | 'schema'>('instructions');
  const [activeRightTab, setActiveRightTab] = useState<'output' | 'console' | 'visualizer'>('output');
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('student_scores');
  const [databaseSchema, setDatabaseSchema] = useState<any[]>([]);

  // Execution outputs
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [pythonDataResult, setPythonDataResult] = useState<any | null>(null);
  const [sqlResult, setSqlResult] = useState<any | null>(null);
  const [dsaEvaluationResult, setDsaEvaluationResult] = useState<any | null>(null);
  const [singleRunResult, setSingleRunResult] = useState<any | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState<'instructions' | 'code' | 'preview' | 'console'>('code');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(false);

  // Code Visualizer state
  const [isVisualizing, setIsVisualizing] = useState<boolean>(false);
  const [visualizationResult, setVisualizationResult] = useState<IVisualizationResult | null>(null);
  const [activeTraceStep, setActiveTraceStep] = useState<IExecutionStep | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<string>('');

  // Monaco Editor refs & decorations
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsCollectionRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const workspaceKey = `${slug}_${activeModuleId || 'default'}_${exerciseIdParam || 'assignment'}`;

  // Synchronize execution trace step with Monaco line decoration & reveal
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (activeTraceStep && activeTraceStep.line > 0) {
      const newDecorations = [
        {
          range: new monaco.Range(activeTraceStep.line, 1, activeTraceStep.line, 1),
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

      editor.revealLineInCenter(activeTraceStep.line);
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
  }, [activeTraceStep]);

  // 1. Fetch task definitions dynamically from backend APIs
  useEffect(() => {
    const loadWorkspaceData = async () => {
      if (!slug) return;
      try {
        setIsLoading(true);
        setRuntimeError(null);

        let targetModuleId = activeModuleId;

        // If no moduleId passed, fetch domain to get the active module
        if (!targetModuleId) {
          const domRes = await api.get(`/domains/${slug}`);
          if (domRes.data.success && domRes.data.domain.modules?.length > 0) {
            targetModuleId = domRes.data.domain.modules[0].moduleId;
            setActiveModuleId(targetModuleId);
          }
        }

        if (!targetModuleId) {
          toast.error('No module available for this domain.');
          return;
        }

        let loadedConfig: IWorkspaceConfig | null = null;

        if (topicParam && exerciseIdParam) {
          // Exercise mode: load topic content
          const topicRes = await api.get(
            `/domains/${slug}/modules/${targetModuleId}/topics/${encodeURIComponent(topicParam)}/content`
          );
          if (topicRes.data.success && topicRes.data.content) {
            const foundEx = topicRes.data.content.exercises?.find(
              (e: any) => e.exerciseId === exerciseIdParam
            );
            if (foundEx) {
              setExercise(foundEx);
              setTaskTitle(foundEx.title);
              setTaskDescription(foundEx.instruction);
              setInstructions(foundEx.hints || [foundEx.instruction]);

              loadedConfig = foundEx.workspaceConfig || null;

              const rawLang = (foundEx.language || '').toLowerCase();
              const starter = foundEx.starterCode || '';
              const isHtml = rawLang === 'html' || starter.includes('<html') || starter.includes('<!--') || starter.includes('<h1>');
              const isCss = rawLang === 'css' || (starter.includes('{') && !starter.includes('function') && !starter.includes('const '));
              const isPython = rawLang === 'python';
              const isSql = rawLang === 'sql';
              const isReactEx = rawLang === 'react' || rawLang === 'jsx' || starter.includes('import React') || (starter.includes('export function') && starter.includes('<'));

              let defaultFiles: IAssignmentStarterFile[] = [];

              if (isHtml) {
                defaultFiles = [
                  {
                    filename: 'index.html',
                    language: 'html',
                    content: starter || '<!DOCTYPE html>\n<html>\n<body>\n  <h1>My Web Page</h1>\n</body>\n</html>'
                  },
                  {
                    filename: 'styles.css',
                    language: 'css',
                    content: 'body { font-family: sans-serif; padding: 20px; }'
                  }
                ];
                setSelectedLanguage('html');
              } else if (isCss) {
                defaultFiles = [
                  {
                    filename: 'styles.css',
                    language: 'css',
                    content: starter || '/* Write your CSS styling here */\n'
                  },
                  {
                    filename: 'index.html',
                    language: 'html',
                    content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div class="my-box">Styled Box</div>\n</body>\n</html>'
                  }
                ];
                setSelectedLanguage('css');
              } else if (isReactEx) {
                defaultFiles = [
                  {
                    filename: 'App.jsx',
                    language: 'javascript',
                    content: starter || 'export default function App() {\n  return <h1>Hello React</h1>;\n}\n'
                  },
                  {
                    filename: 'index.html',
                    language: 'html',
                    content: '<!DOCTYPE html>\n<html>\n<body>\n  <div id="root"></div>\n</body>\n</html>'
                  }
                ];
                setSelectedLanguage('javascript');
              } else if (isPython) {
                defaultFiles = [
                  {
                    filename: 'solution.py',
                    language: 'python',
                    content: starter || '# Write your Python code here\n'
                  }
                ];
                setSelectedLanguage('python');
              } else if (isSql) {
                defaultFiles = [
                  {
                    filename: 'query.sql',
                    language: 'sql',
                    content: starter || '-- Write your SQL query here\n'
                  }
                ];
                setSelectedLanguage('sql');
              } else {
                defaultFiles = [
                  {
                    filename: 'solution.js',
                    language: 'javascript',
                    content: starter || '// Write your JavaScript solution here\n'
                  }
                ];
                setSelectedLanguage('javascript');
              }

              setFiles(defaultFiles);
              setInitialFiles(defaultFiles);
              setActiveFileName(defaultFiles[0].filename);
            }
          }
        } else {
          // Assignment mode (default)
          const assignRes = await api.get(
            `/domains/${slug}/modules/${targetModuleId}/assignment`
          );
          if (assignRes.data.success && assignRes.data.assignment) {
            const a = assignRes.data.assignment;
            setAssignment(a);
            setTaskTitle(a.title);
            setTaskDescription(a.description);
            setInstructions(a.instructions || []);
            setRubricItems(a.rubric || []);

            loadedConfig = a.workspaceConfig || null;

            const defaultFiles: IAssignmentStarterFile[] =
              a.starterFiles && a.starterFiles.length > 0
                ? a.starterFiles
                : [
                    {
                      filename: 'index.html',
                      language: 'html',
                      content: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Ready to code</h1>\n</body>\n</html>'
                    },
                    {
                      filename: 'styles.css',
                      language: 'css',
                      content: 'body { font-family: sans-serif; margin: 1.5rem; }'
                    },
                    {
                      filename: 'app.js',
                      language: 'javascript',
                      content: '// Client script\nconsole.log("Workspace initialized");'
                    }
                  ];

            setFiles(defaultFiles);
            setInitialFiles(defaultFiles);
            setActiveFileName(defaultFiles[0].filename);
            if (defaultFiles[0].language) {
              setSelectedLanguage(defaultFiles[0].language);
            }
          }
        }

        // Determine workspaceType fallback if loadedConfig is missing
        if (!loadedConfig) {
          const s = slug.toLowerCase();
          if (s.includes('mern') || s.includes('web') || s.includes('react') || s.includes('frontend')) {
            loadedConfig = {
              workspaceType: 'web',
              editorType: 'multi_file',
              executionEnvironment: 'browser_preview',
              supportedLanguages: ['html', 'css', 'javascript'],
              defaultLanguage: 'javascript',
              inputPanels: ['instructions', 'rubric'],
              outputPanels: ['preview', 'console', 'visualizer'],
              gradingStrategy: 'rubric'
            };
          } else if (s.includes('ai') || s.includes('data-science') || s.includes('machine-learning') || s.includes('python')) {
            loadedConfig = {
              workspaceType: 'python_data',
              editorType: 'single_file',
              executionEnvironment: 'python_isolated',
              supportedLanguages: ['python'],
              defaultLanguage: 'python',
              inputPanels: ['instructions', 'dataset', 'rubric'],
              outputPanels: ['chart', 'data_table', 'metrics', 'console', 'visualizer'],
              gradingStrategy: 'output_match'
            };
          } else if (s.includes('sql') || s.includes('database')) {
            loadedConfig = {
              workspaceType: 'sql',
              editorType: 'sql_editor',
              executionEnvironment: 'sqlite_sandbox',
              supportedLanguages: ['sql'],
              defaultLanguage: 'sql',
              inputPanels: ['instructions', 'schema', 'rubric'],
              outputPanels: ['query_results', 'console'],
              gradingStrategy: 'query_match'
            };
          } else {
            loadedConfig = {
              workspaceType: 'dsa',
              editorType: 'single_file',
              executionEnvironment: 'compiled_sandbox',
              supportedLanguages: ['python', 'cpp', 'c', 'java', 'javascript'],
              defaultLanguage: 'python',
              inputPanels: ['instructions', 'custom_input', 'rubric'],
              outputPanels: ['test_cases', 'console', 'visualizer'],
              gradingStrategy: 'test_cases'
            };
          }
        }

        setWorkspaceConfig(loadedConfig);

        // Fetch datasets if in python_data workspace
        if (loadedConfig.workspaceType === 'python_data') {
          if (loadedConfig.availableDatasets && loadedConfig.availableDatasets.length > 0) {
            setAvailableDatasets(loadedConfig.availableDatasets);
            setSelectedDatasetId(loadedConfig.availableDatasets[0].id);
          } else {
            try {
              const dRes = await api.get(`/domains/${slug}/datasets`);
              if (dRes.data.success && dRes.data.datasets?.length > 0) {
                setAvailableDatasets(dRes.data.datasets);
                setSelectedDatasetId(dRes.data.datasets[0].id);
              }
            } catch {
              // Ignore failure
            }
          }
        }

        // Fetch schema if in sql workspace
        if (loadedConfig.workspaceType === 'sql') {
          if (loadedConfig.databaseSchema && loadedConfig.databaseSchema.length > 0) {
            setDatabaseSchema(loadedConfig.databaseSchema);
          } else {
            try {
              const sRes = await api.get(`/domains/${slug}/schema`);
              if (sRes.data.success && sRes.data.tables?.length > 0) {
                setDatabaseSchema(sRes.data.tables);
              }
            } catch {
              // Ignore failure
            }
          }
        }

        // Restore saved draft if available
        try {
          const draftRes = await api.get(`/domains/${slug}/workspace/${workspaceKey}`);
          if (draftRes.data.success && draftRes.data.files?.length > 0) {
            setFiles(draftRes.data.files);
            setActiveFileName(draftRes.data.files[0].filename);
            toast.info('Restored your previously saved draft.');
          }
        } catch {
          // No saved draft, proceed with starter
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          toast.error('Subscription required to access domain workspaces.');
          navigate('/pricing');
        } else {
          toast.error('Failed to load workspace files from backend.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspaceData();
  }, [slug, activeModuleId, topicParam, exerciseIdParam]);

  // 2. Web Live Preview compilation (only when workspaceType === 'web')
  useEffect(() => {
    if (workspaceConfig?.workspaceType !== 'web' || files.length === 0) return;

    let htmlFile = files.find((f) => f.filename.endsWith('.html'))?.content || '';
    if (!htmlFile) {
      const htmlLike = files.find(
        (f) =>
          f.content.trim().startsWith('<!DOCTYPE') ||
          f.content.trim().startsWith('<html') ||
          f.content.trim().startsWith('<!--')
      );
      if (htmlLike) htmlFile = htmlLike.content;
    }

    const cssFile = files.find((f) => f.filename.endsWith('.css'))?.content || '';
    const jsFiles = files.filter(
      (f) =>
        f.filename.endsWith('.js') ||
        f.filename.endsWith('.jsx') ||
        f.filename.endsWith('.ts') ||
        f.filename.endsWith('.tsx')
    );

    const isReact =
      files.some((f) => f.filename.endsWith('.jsx') || f.filename.endsWith('.tsx')) ||
      jsFiles.some((f) => f.content.includes('import React') || f.content.includes('export default function') || f.content.includes('ReactDOM.render'));

    let combinedJs = jsFiles.map((f) => f.content).join('\n\n');
    if (isReact) {
      combinedJs = combinedJs.replace(/import\s+.*?\s+from\s+['"].*?['"];?/g, '');
      combinedJs = combinedJs.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1');
      combinedJs = combinedJs.replace(/export\s+default\s+([A-Za-z0-9_]+);?/g, '');
      if (combinedJs.includes('function App') && !combinedJs.includes('ReactDOM.createRoot')) {
        combinedJs += `\n\nconst rootElement = document.getElementById('root');\nif (rootElement) {\n  const root = ReactDOM.createRoot(rootElement);\n  root.render(React.createElement(App));\n}\n`;
      }
    }

    const errorCaptureScript = `
<script>
  window.addEventListener('error', function(event) {
    var msg = event.message || 'Unknown JavaScript Error';
    var line = event.lineno;
    window.parent.postMessage({ type: 'EVALORA_RUNTIME_ERROR', message: msg + (line ? ' (Line ' + line + ')' : '') }, '*');
  });
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason ? (event.reason.message || event.reason) : 'Unhandled Promise Rejection';
    window.parent.postMessage({ type: 'EVALORA_RUNTIME_ERROR', message: String(reason) }, '*');
  });
  var _origLog = console.log;
  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    var formatted = args.map(function(a) {
      try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
    }).join(' ');
    window.parent.postMessage({ type: 'EVALORA_CONSOLE_LOG', log: formatted }, '*');
    _origLog.apply(console, arguments);
  };
</script>
`;

    const jsTag = combinedJs.trim()
      ? isReact
        ? `<script type="text/babel">${combinedJs}</script>`
        : `<script>${combinedJs}</script>`
      : '';

    let previewDoc = '';
    const cleanedHtml = htmlFile.trim();

    if (cleanedHtml.includes('<html') || cleanedHtml.includes('<!DOCTYPE')) {
      previewDoc = cleanedHtml;
      if (cssFile.trim() && !previewDoc.includes(cssFile)) {
        if (previewDoc.includes('</head>')) {
          previewDoc = previewDoc.replace('</head>', `<style>${cssFile}</style></head>`);
        } else {
          previewDoc = `<style>${cssFile}</style>` + previewDoc;
        }
      }
      if (previewDoc.includes('</body>')) {
        previewDoc = previewDoc.replace('</body>', `${errorCaptureScript}\n${jsTag}\n</body>`);
      } else {
        previewDoc = previewDoc + errorCaptureScript + jsTag;
      }
    } else {
      previewDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${cssFile}</style>
  ${
    isReact
      ? `
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  `
      : ''
  }
</head>
<body>
  ${
    isReact && !cleanedHtml.includes('id="root"')
      ? `<div id="root"></div>\n${cleanedHtml}`
      : cleanedHtml
  }
  ${errorCaptureScript}
  ${jsTag}
</body>
</html>`;
    }

    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewDoc;
    }
  }, [files, workspaceConfig?.workspaceType]);

  // Listen to iframe postMessages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EVALORA_CONSOLE_LOG') {
        setConsoleLogs((prev) => [...prev.slice(-30), event.data.log]);
      } else if (event.data?.type === 'EVALORA_RUNTIME_ERROR') {
        setRuntimeError(event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCodeChange = (newCode: string) => {
    setRuntimeError(null);
    setFiles((prev) =>
      prev.map((f) => (f.filename === activeFileName ? { ...f, content: newCode } : f))
    );
  };

  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang);
    // Find or create matching starter file
    const extMap: Record<string, string> = {
      python: 'py',
      cpp: 'cpp',
      c: 'c',
      java: 'java',
      javascript: 'js',
      sql: 'sql',
      html: 'html'
    };
    const targetExt = extMap[newLang] || 'txt';
    const existingFile = files.find((f) => f.filename.endsWith(`.${targetExt}`));
    if (existingFile) {
      setActiveFileName(existingFile.filename);
    } else {
      const newFile: IAssignmentStarterFile = {
        filename: `solution.${targetExt}`,
        language: newLang,
        content: activeFile?.content || ''
      };
      setFiles([newFile]);
      setActiveFileName(newFile.filename);
    }
  };

  // 3. Execution Action: Run Code in the appropriate backend sandbox
  const handleRunCode = async () => {
    if (!slug || !activeFile) return;

    const wType = workspaceConfig?.workspaceType || 'web';

    if (wType === 'web') {
      // Re-trigger preview compilation and clear logs
      setConsoleLogs([]);
      setRuntimeError(null);
      if (iframeRef.current) {
        iframeRef.current.srcdoc = iframeRef.current.srcdoc;
      }
      setActiveRightTab('output');
      toast.success('Live preview refreshed!');
      return;
    }

    try {
      setIsExecuting(true);
      setActiveRightTab('output');
      setRuntimeError(null);

      const payload: any = {
        code: activeFile.content,
        language: selectedLanguage || getEditorLanguage(activeFile.filename),
        files,
        dataset: selectedDatasetId,
        customInput
      };

      const res = await api.post(`/domains/${slug}/coding/run`, payload);

      if (res.data.success) {
        if (wType === 'python_data') {
          setPythonDataResult(res.data);
          toast.success('Python Data Science script executed successfully!');
        } else if (wType === 'sql') {
          setSqlResult(res.data);
          toast.success(`Query executed: ${res.data.rowCount || 0} rows fetched.`);
        } else {
          setSingleRunResult(res.data);
          toast.success('Code executed against sandbox!');
        }
      } else {
        if (wType === 'python_data') {
          setPythonDataResult(res.data);
        } else if (wType === 'sql') {
          setSqlResult(res.data);
        } else {
          setSingleRunResult(res.data);
        }
        toast.error(res.data.error || res.data.stderr || 'Execution encountered an error.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Code execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  // 4. Submission & Evaluation Action
  const handleSubmitAssignment = async () => {
    if (!slug || !activeModuleId) return;
    try {
      setIsSubmitting(true);

      const wType = workspaceConfig?.workspaceType || 'web';

      // If DSA with automated test cases in exercise mode:
      if (exercise && workspaceConfig?.testCases && workspaceConfig.testCases.length > 0) {
        const evalRes = await api.post(`/domains/${slug}/coding/evaluate`, {
          code: activeFile.content,
          language: selectedLanguage,
          testCases: workspaceConfig.testCases
        });

        if (evalRes.data.success) {
          setDsaEvaluationResult(evalRes.data);
          setActiveRightTab('output');
          if (evalRes.data.passed) {
            toast.success(`All ${evalRes.data.totalTestCases} test cases passed!`);
          } else {
            toast.warning(`Passed ${evalRes.data.passedCount}/${evalRes.data.totalTestCases} test cases.`);
          }
          return;
        }
      }

      // Mandatory module assignment evaluation
      const res = await api.post(
        `/domains/${slug}/modules/${activeModuleId}/assignment/submit`,
        {
          files
        }
      );

      if (res.data.success) {
        setEvaluationResult(res.data);
        if (res.data.passed) {
          setShowCelebrationModal(true);
          toast.success(`Passed! Score: ${res.data.score}% — Next module unlocked!`);
        } else {
          toast.warning(`Score: ${res.data.score}% (Passing: ${res.data.passingScore}%). Review rubric criteria and retry.`);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Assignment evaluation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!slug) return;
    try {
      setIsSaving(true);
      await api.post(`/domains/${slug}/workspace/save`, {
        workspaceKey,
        files
      });
      setIsJustSaved(true);
      setTimeout(() => setIsJustSaved(false), 2500);
      toast.success('Draft saved successfully to your cloud profile!');
    } catch {
      toast.error('Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVisualizeCode = async () => {
    if (!activeFile) return;
    const lang = getEditorLanguage(activeFile.filename);

    try {
      setIsVisualizing(true);
      setActiveRightTab('visualizer');
      setMobileTab('preview');

      const endpoint = slug ? `/domains/${slug}/visualize` : '/domains/visualize';
      const targetLang = lang === 'python' ? 'python' : lang === 'javascript' ? 'javascript' : activeFile.filename.endsWith('.py') ? 'python' : 'javascript';
      const res = await api.post(endpoint, {
        code: activeFile.content,
        language: targetLang
      });

      if (res.data.success) {
        setVisualizationResult(res.data);
        toast.success(`Trace ready: ${res.data.totalSteps} execution steps recorded!`);
      } else if (res.data.supported === false) {
        setVisualizationResult(res.data);
      } else {
        setVisualizationResult(res.data);
        toast.error(res.data.error || 'Visualization could not complete.');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        const data = err.response.data;
        setUpgradeModalReason(data.message || 'Interactive Step-by-Step Execution Visualizer requires a Domain Pass, Pro, or Master subscription.');
        setShowUpgradeModal(true);
      } else {
        toast.error(err.response?.data?.message || 'Failed to generate execution trace.');
      }
    } finally {
      setIsVisualizing(false);
    }
  };

  const activeFile = files.find((f) => f.filename === activeFileName) || files[0];
  const workspaceType = workspaceConfig?.workspaceType || 'web';

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-surface-neutral text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-sm font-medium text-text-secondary">Loading domain workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-surface-neutral font-sans text-text-primary">
      {/* 1. Evalora Header Toolbar */}
      <header className="z-10 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-white px-3 py-2 sm:flex-nowrap sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            to={`/domains/${slug}`}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Curriculum</span>
          </Link>
          <span className="text-border-subtle">/</span>
          <div className="flex items-center gap-2 truncate">
            <Code2 className="h-4 w-4 text-brand-primary shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold text-text-primary truncate">{taskTitle}</h1>
            <span className="hidden md:inline-flex rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark uppercase tracking-wider">
              {workspaceType.replace('_', ' ')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsInstructionsCollapsed((prev) => !prev)}
            title={isInstructionsCollapsed ? "Show Instructions Panel" : "Hide Instructions Panel"}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
              isInstructionsCollapsed
                ? 'border-brand-primary/40 bg-brand-light text-brand-primary shadow-xs'
                : 'border-border-subtle bg-white text-text-secondary hover:text-text-primary hover:bg-surface-neutral'
            }`}
          >
            {isInstructionsCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            <span>Instructions</span>
          </button>
        </div>

        {/* Viewport switcher & actions */}
        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
          {/* Viewport switcher for Web mode */}
          {workspaceType === 'web' && (
            <div className="hidden md:flex items-center bg-surface-neutral rounded-lg p-0.5 border border-border-subtle">
              <button
                onClick={() => setPreviewViewport('desktop')}
                title="Desktop preview"
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  previewViewport === 'desktop' ? 'bg-white text-brand-primary shadow-xs font-semibold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPreviewViewport('tablet')}
                title="Tablet preview (768px)"
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  previewViewport === 'tablet' ? 'bg-white text-brand-primary shadow-xs font-semibold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Tablet className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPreviewViewport('mobile')}
                title="Mobile preview (375px)"
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  previewViewport === 'mobile' ? 'bg-white text-brand-primary shadow-xs font-semibold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
              <div className="h-3.5 w-px bg-border-subtle mx-1" />
              <button
                onClick={() => setIsFullscreenPreview((prev) => !prev)}
                title={isFullscreenPreview ? "Restore Split View" : "Maximize Preview (Full Width)"}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  isFullscreenPreview ? 'bg-white text-brand-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {isFullscreenPreview ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {/* Language Selector for DSA / Multi-language */}
          {workspaceType === 'dsa' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted hidden sm:inline">Lang:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="rounded-lg border border-border-subtle bg-white px-2.5 py-1 text-xs font-medium text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="python">Python 3</option>
                <option value="cpp">C++ 20</option>
                <option value="c">C 17</option>
                <option value="java">Java 25</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
          )}

          {/* Action Buttons: Run Code, Visualize, Reset, Save Draft, Submit Assignment */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Primary Action: Run Code */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunCode}
              isLoading={isExecuting}
              icon={<Play className="h-3.5 w-3.5 text-brand-primary" />}
            >
              <span className="hidden sm:inline">Run Code</span>
              <span className="sm:hidden">Run</span>
            </Button>

            {/* Premium Code Visualizer Action */}
            <button
              type="button"
              onClick={handleVisualizeCode}
              disabled={isVisualizing}
              title="Run step-by-step code execution trace"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-accent/40 bg-brand-light hover:bg-brand-light/80 px-3 text-xs font-semibold text-brand-dark transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {isVisualizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary shrink-0" />
                  <span className="hidden sm:inline">Tracing...</span>
                </>
              ) : (
                <>
                  <Cpu className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                  <span className="hidden sm:inline">Visualize</span>
                </>
              )}
            </button>

            {/* Save Draft */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              title="Save current workspace code"
              className="hidden sm:inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-white px-3 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary hover:bg-surface-neutral active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
              ) : isJustSaved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#527565]" />
                  <span className="text-[#527565] font-bold">Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 text-text-muted" />
                  <span>Save</span>
                </>
              )}
            </button>

            {/* Reset Starter */}
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset code to starter template"
              className="hidden lg:inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-white px-3 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary hover:bg-surface-neutral active:scale-95 focus:outline-none shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
              <span>Reset</span>
            </button>

            {/* Primary Action: Submit Assignment / Test Code */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitAssignment}
              isLoading={isSubmitting}
              icon={<Send className="h-3.5 w-3.5" />}
            >
              <span className="hidden sm:inline">{isAssignmentMode ? 'Submit Assignment' : 'Submit Code'}</span>
              <span className="sm:hidden">Submit</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile mode tabs */}
      <div className="flex lg:hidden border-b border-border-subtle bg-white text-xs">
        <button
          onClick={() => setMobileTab('instructions')}
          className={`flex-1 py-2 font-medium text-center border-b-2 ${
            mobileTab === 'instructions' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-text-secondary'
          }`}
        >
          Instructions
        </button>
        <button
          onClick={() => setMobileTab('code')}
          className={`flex-1 py-2 font-medium text-center border-b-2 ${
            mobileTab === 'code' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-text-secondary'
          }`}
        >
          Editor ({files.length})
        </button>
        <button
          onClick={() => {
            setMobileTab('preview');
            setActiveRightTab('output');
          }}
          className={`flex-1 py-2 font-medium text-center border-b-2 ${
            mobileTab === 'preview' && activeRightTab === 'output' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-text-secondary'
          }`}
        >
          Output
        </button>
        <button
          onClick={() => {
            setMobileTab('preview');
            setActiveRightTab('visualizer');
          }}
          className={`flex-1 py-2 font-medium text-center border-b-2 flex items-center justify-center gap-1 ${
            activeRightTab === 'visualizer' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-text-secondary'
          }`}
        >
          <Cpu className="h-3 w-3 text-brand-primary" />
          <span>Visualizer</span>
        </button>
      </div>

      {/* 2. Workspace Body (Split view on Desktop, Tabbed on Mobile) */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0 bg-surface-neutral">
        {/* Panel A: Left Side (Instructions, Rubric, Dataset Viewer, DB Schema) */}
        <div
          className={`${
            mobileTab === 'instructions' ? 'flex' : 'hidden'
          } ${
            isFullscreenPreview || isInstructionsCollapsed ? 'hidden' : 'lg:flex'
          } w-full lg:w-80 xl:w-96 shrink-0 flex-col min-h-0 border-r border-border-subtle bg-white overflow-hidden text-xs`}
        >
          {/* Navigation tabs & collapse button for Left Panel */}
          <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-neutral/60 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveLeftTab('instructions')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  activeLeftTab === 'instructions'
                    ? 'bg-white text-brand-primary border border-border-subtle shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Instructions</span>
              </button>

              {workspaceType === 'python_data' && (
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('dataset')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    activeLeftTab === 'dataset'
                      ? 'bg-white text-brand-primary border border-border-subtle shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Database className="h-3.5 w-3.5 text-brand-primary" />
                  <span>Datasets</span>
                </button>
              )}

              {workspaceType === 'sql' && (
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('schema')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    activeLeftTab === 'schema'
                      ? 'bg-white text-brand-primary border border-border-subtle shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5 text-brand-primary" />
                  <span>Schema</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsInstructionsCollapsed(true)}
              title="Collapse Instructions panel"
              className="hidden lg:flex items-center justify-center p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white transition-colors"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Left Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activeLeftTab === 'instructions' && (
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-dark uppercase tracking-wider">
                    Objective &amp; Requirements
                  </span>
                  <h2 className="text-sm font-bold text-text-primary">{taskTitle}</h2>
                  <p className="text-text-secondary leading-relaxed">{taskDescription}</p>
                </div>

                {/* Instructions */}
                {instructions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <h3 className="font-semibold text-text-muted uppercase tracking-wider text-[11px]">
                      Instructions
                    </h3>
                    <ul className="space-y-2 text-text-secondary">
                      {instructions.map((inst, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="leading-snug text-xs">{inst}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rubric Criteria */}
                {rubricItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text-muted uppercase tracking-wider text-[11px]">
                        Grading Rubric (Pass: 70%)
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {rubricItems.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start justify-between rounded-xl border border-border-subtle bg-surface-neutral/40 p-2.5 gap-2"
                        >
                          <div className="space-y-0.5">
                            <p className="font-medium text-text-primary text-xs">{r.title}</p>
                            <p className="text-[11px] text-text-muted">{r.description}</p>
                          </div>
                          <span className="rounded-md bg-white border border-border-subtle px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary shrink-0">
                            {r.weight}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latest evaluation result banner */}
                {evaluationResult && (
                  <div
                    className={`rounded-xl p-3 text-xs border ${
                      evaluationResult.passed
                        ? 'bg-[#E5F2EB] border-[#C8DFD1] text-[#527565]'
                        : 'bg-[#F8F3E8] border-[#E8D9B9] text-[#896D45]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span>Evaluation Score</span>
                      <span>{evaluationResult.score}%</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{evaluationResult.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {activeLeftTab === 'dataset' && workspaceType === 'python_data' && (
              <DatasetViewerPanel
                datasets={availableDatasets}
                selectedDatasetId={selectedDatasetId}
                onSelectDataset={(id) => setSelectedDatasetId(id)}
              />
            )}

            {activeLeftTab === 'schema' && workspaceType === 'sql' && (
              <DatabaseSchemaPanel tables={databaseSchema} />
            )}
          </div>
        </div>

        {/* Panel B: Monaco Code Editor (Center column) */}
        <div
          className={`${
            mobileTab === 'code' ? 'flex' : 'hidden'
          } ${
            isFullscreenPreview ? 'hidden' : 'lg:flex'
          } flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-[#F5F5F7] border-r border-border-subtle`}
        >
          {/* File Tabs for multi-file web mode */}
          {workspaceType === 'web' && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-[#D2D2D7] bg-[#F5F5F7] px-2 py-1.5 shrink-0">
              {files.map((file) => {
                const isActive = file.filename === activeFileName;
                return (
                  <button
                    key={file.filename}
                    onClick={() => setActiveFileName(file.filename)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#F5F5F7] text-[#A5B4FC] shadow-2xs font-semibold border border-[#D2D2D7]'
                        : 'text-[#6E6E73] hover:bg-[#E5F1FF] hover:text-[#1D1D1F]'
                    }`}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>{file.filename}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Single-file header for python_data, sql, dsa */}
          {workspaceType !== 'web' && (
            <div className="flex items-center justify-between border-b border-[#D2D2D7] bg-[#F5F5F7] px-3 py-1.5 shrink-0 text-xs">
              <div className="flex items-center gap-2 font-mono text-[#6E6E73]">
                <FileCode className="h-3.5 w-3.5 text-[#A5B4FC]" />
                <span className="font-semibold">{activeFile?.filename || 'solution'}</span>
              </div>
              <span className="font-mono text-[11px] text-[#6E6E73] uppercase">
                {selectedLanguage}
              </span>
            </div>
          )}

          {/* Monaco code editor container using the shared light theme */}
          <div className="flex-1 flex overflow-hidden relative min-h-0 bg-[#F5F5F7]">
            <Editor
              height="100%"
              language={getEditorLanguage(activeFile?.filename || '')}
              value={activeFile?.content || ''}
              beforeMount={setupMonacoLightTheme}
              theme="evalora-soft"
              onChange={(val) => handleCodeChange(val || '')}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
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

          {/* Error Banner */}
          {runtimeError && (
            <div className="shrink-0 flex items-center gap-2 bg-[#F8EDEF] border-t border-[#E8CFD2] px-4 py-2 text-xs text-[#9A646D]">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#9A646D]" />
              <span className="truncate">{runtimeError}</span>
            </div>
          )}
        </div>

        {/* Panel C: Output Panel (Right column - Domain Aware) */}
        <div
          className={`${
            mobileTab === 'preview' || mobileTab === 'console' ? 'flex' : 'hidden'
          } lg:flex flex-1 flex-col overflow-hidden min-h-0 min-w-0 bg-white`}
        >
          {/* Header tabs for Right Panel */}
          <div className="hidden lg:flex items-center justify-between border-b border-border-subtle bg-surface-neutral/80 px-3 py-1.5 shrink-0 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveRightTab('output')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeRightTab === 'output'
                    ? 'bg-white text-brand-primary shadow-xs border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {workspaceType === 'web' ? (
                  <>
                    <Monitor className="h-3.5 w-3.5" />
                    <span>Live Preview</span>
                  </>
                ) : workspaceType === 'python_data' ? (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    <span>Data &amp; Plots</span>
                  </>
                ) : workspaceType === 'sql' ? (
                  <>
                    <TableIcon className="h-3.5 w-3.5" />
                    <span>Query Results</span>
                  </>
                ) : (
                  <>
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Test Cases &amp; Output</span>
                  </>
                )}
              </button>

              {workspaceType === 'web' && (
                <button
                  onClick={() => setActiveRightTab('console')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    activeRightTab === 'console'
                      ? 'bg-white text-brand-primary shadow-xs border border-border-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5 text-[#527565]" />
                  <span>Console</span>
                  {consoleLogs.length > 0 && (
                    <span className="rounded-full bg-brand-light px-1.5 py-0.2 text-[10px] font-mono text-brand-dark">
                      {consoleLogs.length}
                    </span>
                  )}
                </button>
              )}

              {/* Code Visualizer Tab */}
              <button
                onClick={() => setActiveRightTab('visualizer')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeRightTab === 'visualizer'
                    ? 'bg-brand-light border border-brand-accent/40 text-brand-dark shadow-xs'
                    : 'text-text-secondary hover:text-brand-primary hover:bg-brand-light/40'
                }`}
              >
                <Cpu className="h-3.5 w-3.5 text-brand-primary" />
                <span>Execution Visualizer</span>
                <span className="rounded bg-brand-accent/20 px-1 py-0.2 text-[9px] font-bold text-brand-primary">
                  PRO
                </span>
              </button>
            </div>

            {workspaceType === 'web' && activeRightTab === 'output' && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted font-mono text-[11px]">
                  {previewViewport === 'desktop' ? 'Full Width' : previewViewport === 'tablet' ? '768px' : '375px'}
                </span>
                <button
                  onClick={() => setIsFullscreenPreview((prev) => !prev)}
                  className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-[11px] font-medium px-2 py-0.5 rounded bg-surface-neutral hover:bg-white border border-border-subtle transition-colors"
                >
                  {isFullscreenPreview ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  <span>{isFullscreenPreview ? 'Restore' : 'Expand'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Panel Body: Conditional based on activeRightTab & workspaceType */}
          {activeRightTab === 'visualizer' ? (
            <CodeVisualizationPanel
              result={visualizationResult}
              isLoading={isVisualizing}
              onStepChange={(step) => setActiveTraceStep(step)}
              onRequestUpgrade={() => {
                setUpgradeModalReason('Code Execution Visualizer is a premium subscription feature.');
                setShowUpgradeModal(true);
              }}
            />
          ) : activeRightTab === 'console' && workspaceType === 'web' ? (
            /* Console log output view for Web */
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#F5F5F7] p-4 font-mono text-xs text-[#1D1D1F]">
              <div className="flex items-center justify-between border-b border-[#D2D2D7] pb-2 mb-2 text-[#6E6E73]">
                <div className="flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-[#719B84]" />
                  <span className="font-semibold text-[#1D1D1F]">Browser Console Logs</span>
                </div>
                <button
                  onClick={() => setConsoleLogs([])}
                  className="text-[11px] text-[#6E6E73] hover:text-[#1D1D1F]"
                >
                  Clear
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 text-[#6E6E73]">
                {consoleLogs.length === 0 ? (
                  <p className="text-[#6E6E73] italic">No console messages logged yet.</p>
                ) : (
                  consoleLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#719B84] select-none">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : workspaceType === 'python_data' ? (
            /* Python Data Science & ML Output Panel */
            <PythonDataOutputPanel
              result={pythonDataResult}
              isRunning={isExecuting}
            />
          ) : workspaceType === 'sql' ? (
            /* SQL Database Query Output Panel */
            <SqlQueryOutputPanel
              result={sqlResult}
              isRunning={isExecuting}
            />
          ) : workspaceType === 'dsa' ? (
            /* DSA Automated Test Cases & Execution Panel */
            <DsaTestCasePanel
              testCases={workspaceConfig?.testCases || []}
              evaluationResult={dsaEvaluationResult}
              isRunning={isExecuting}
              customInput={customInput}
              onCustomInputChange={setCustomInput}
              singleRunResult={singleRunResult}
            />
          ) : (
            /* Default: Web Live Preview Iframe */
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-surface-neutral">
              <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto min-h-0">
                <div
                  className="h-full bg-white rounded-xl shadow-xs border border-border-subtle overflow-hidden transition-all duration-300"
                  style={{
                    width: previewViewport === 'desktop' ? '100%' : previewViewport === 'tablet' ? '768px' : '375px',
                    maxWidth: '100%'
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    title="Live Rendered Preview"
                    sandbox="allow-scripts allow-modals"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#625E75]/35 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-white p-6 shadow-xl text-text-primary animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F8F3E8] text-[#896D45] border border-[#E8D9B9]">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Reset Workspace to Starter?</h3>
                <p className="text-xs text-text-secondary mt-0.5">Restore original clean starter files</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-text-secondary leading-relaxed">
              All current edits, custom files, and unsaved changes in this workspace will be replaced with the initial starter template. This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setFiles(JSON.parse(JSON.stringify(initialFiles)));
                  setConsoleLogs([]);
                  setRuntimeError(null);
                  setPythonDataResult(null);
                  setSqlResult(null);
                  setDsaEvaluationResult(null);
                  setSingleRunResult(null);
                  setShowResetModal(false);
                  toast.info('Workspace reset to initial starter code.');
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span>Reset Workspace</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Celebration Modal on Passing Assignment */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#625E75]/35 backdrop-blur-xs p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-[#C8DFD1] p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E5F2EB] text-[#527565] ring-8 ring-[#679B7C]">
              <Award className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-text-primary">Module Assignment Passed!</h2>
              <p className="text-sm text-text-secondary">
                You scored <strong className="text-[#527565] font-extrabold">{evaluationResult?.score}%</strong>{' '}
                and met all verified rubric criteria.
              </p>
            </div>
            {evaluationResult?.nextModuleId && (
              <div className="rounded-xl bg-[#E5F2EB] border border-[#C8DFD1] p-3 text-xs text-[#527565]">
                <strong>Next Module Unlocked!</strong> You can now progress to the next module in your career curriculum.
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCelebrationModal(false)}
              >
                Review Work
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate(`/domains/${slug}`)}
              >
                <span>Continue Curriculum</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Code Visualizer Subscription Upgrade Modal */}
      <VisualizerUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeModalReason}
      />
    </div>
  );
};
