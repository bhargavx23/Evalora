import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env.js';
import { CodingLanguage, SubmissionVerdict } from '../shared/types.js';
import { WORKSPACE_DATASETS, SQL_SAMPLE_SCHEMA } from '../config/workspaceDatasets.js';

export interface ExecutionRequest {
  language: CodingLanguage;
  code: string;
  stdin: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface ExecutionResult {
  verdict: SubmissionVerdict;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryKb: number;
  compileError?: string;
}

export interface TestCaseEvaluationRequest {
  language: CodingLanguage;
  code: string;
  visibleTestCases: Array<{ input: string; expectedOutput: string }>;
  hiddenTestCases: Array<{ input: string; expectedOutput: string }>;
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

export interface TestCaseResult {
  testCaseIndex: number;
  passed: boolean;
  verdict: SubmissionVerdict;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTimeMs: number;
  error?: string;
  isHidden: boolean;
}

export interface MultiTestCaseResult {
  verdict: SubmissionVerdict;
  totalTestCases: number;
  passedCount: number;
  score: number; // 0 to 100 percentage
  results: TestCaseResult[];
  avgExecutionTimeMs: number;
  maxMemoryKb: number;
  compileError?: string;
  stderr?: string;
}

export interface PythonDataExecutionRequest {
  code: string;
  stdin?: string;
  datasetId?: string;
  timeoutMs?: number;
}

export interface PythonDataExecutionResult extends ExecutionResult {
  plots?: string[]; // base64 PNG images
  tableData?: {
    columns: string[];
    rows: any[][];
  } | null;
  metrics?: Record<string, string | number> | null;
}

export interface SqlExecutionRequest {
  query: string;
  timeoutMs?: number;
}

export interface SqlExecutionResult {
  success?: boolean;
  verdict: SubmissionVerdict;
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface ICodeExecutionRunner {
  execute(req: ExecutionRequest): Promise<ExecutionResult>;
  evaluateTestCases(req: TestCaseEvaluationRequest): Promise<MultiTestCaseResult>;
  executePythonData(req: PythonDataExecutionRequest): Promise<PythonDataExecutionResult>;
  executeSql(req: SqlExecutionRequest): Promise<SqlExecutionResult>;
}

export class LocalIsolatedRunner implements ICodeExecutionRunner {
  private baseTempDir: string;

  constructor() {
    this.baseTempDir = path.join(os.tmpdir(), 'evalora-sandboxes');
    fs.mkdir(this.baseTempDir, { recursive: true }).catch(() => {});
  }

  private normalizeOutput(output: string): string {
    return output
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  private async createTempWorkspace(): Promise<string> {
    const runId = uuidv4();
    const workDir = path.join(this.baseTempDir, `run-${runId}`);
    await fs.mkdir(workDir, { recursive: true });
    return workDir;
  }

  private async cleanupWorkspace(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error in temp
    }
  }

  private runProcessWithTimeout(
    command: string,
    args: string[],
    cwd: string,
    stdinData: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; code: number | null; durationMs: number; timedOut: boolean }> {
    return new Promise(resolve => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;

      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, timeoutMs);

      if (stdinData) {
        try {
          child.stdin.write(stdinData);
          child.stdin.end();
        } catch {
          // stdin closed
        }
      } else {
        child.stdin.end();
      }

      child.stdout.on('data', chunk => {
        if (stdout.length < ENV.MAX_OUTPUT_SIZE_BYTES) {
          stdout += chunk.toString();
        }
      });

      child.stderr.on('data', chunk => {
        if (stderr.length < ENV.MAX_OUTPUT_SIZE_BYTES) {
          stderr += chunk.toString();
        }
      });

      child.on('close', code => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({ stdout, stderr, code, durationMs, timedOut });
      });

      child.on('error', err => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({ stdout, stderr: stderr + '\n' + err.message, code: 1, durationMs, timedOut: false });
      });
    });
  }

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const workDir = await this.createTempWorkspace();
    const timeoutMs = req.timeoutMs || ENV.EXECUTION_TIMEOUT_MS;

    try {
      if (req.language === 'c') {
        const srcFile = path.join(workDir, 'solution.c');
        const exeFile = path.join(workDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
        await fs.writeFile(srcFile, req.code, 'utf-8');

        // Compile
        const compileRes = await this.runProcessWithTimeout('gcc', ['-O2', 'solution.c', '-o', exeFile], workDir, '', 8000);
        if (compileRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            stdout: '',
            stderr: compileRes.stderr,
            compileError: compileRes.stderr,
            executionTimeMs: 0,
            memoryKb: 0
          };
        }

        // Run
        const runRes = await this.runProcessWithTimeout(exeFile, [], workDir, req.stdin, timeoutMs);
        if (runRes.timedOut) {
          return { verdict: 'TIME_LIMIT_EXCEEDED', stdout: runRes.stdout, stderr: 'Time Limit Exceeded', executionTimeMs: timeoutMs, memoryKb: 1024 };
        }
        if (runRes.code !== 0) {
          return { verdict: 'RUNTIME_ERROR', stdout: runRes.stdout, stderr: runRes.stderr || 'Runtime Error', executionTimeMs: runRes.durationMs, memoryKb: 1024 };
        }
        return { verdict: 'ACCEPTED', stdout: runRes.stdout, stderr: runRes.stderr, executionTimeMs: runRes.durationMs, memoryKb: 1024 };
      }

      if (req.language === 'cpp') {
        const srcFile = path.join(workDir, 'solution.cpp');
        const exeFile = path.join(workDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
        await fs.writeFile(srcFile, req.code, 'utf-8');

        // Compile
        const compileRes = await this.runProcessWithTimeout('g++', ['-O2', 'solution.cpp', '-o', exeFile], workDir, '', 8000);
        if (compileRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            stdout: '',
            stderr: compileRes.stderr,
            compileError: compileRes.stderr,
            executionTimeMs: 0,
            memoryKb: 0
          };
        }

        // Run
        const runRes = await this.runProcessWithTimeout(exeFile, [], workDir, req.stdin, timeoutMs);
        if (runRes.timedOut) {
          return { verdict: 'TIME_LIMIT_EXCEEDED', stdout: runRes.stdout, stderr: 'Time Limit Exceeded', executionTimeMs: timeoutMs, memoryKb: 1024 };
        }
        if (runRes.code !== 0) {
          return { verdict: 'RUNTIME_ERROR', stdout: runRes.stdout, stderr: runRes.stderr || 'Runtime Error', executionTimeMs: runRes.durationMs, memoryKb: 1024 };
        }
        return { verdict: 'ACCEPTED', stdout: runRes.stdout, stderr: runRes.stderr, executionTimeMs: runRes.durationMs, memoryKb: 1024 };
      }

      if (req.language === 'python') {
        const srcFile = path.join(workDir, 'solution.py');
        await fs.writeFile(srcFile, req.code, 'utf-8');

        // Run Python directly
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const runRes = await this.runProcessWithTimeout(pythonCmd, ['solution.py'], workDir, req.stdin, timeoutMs);

        if (runRes.timedOut) {
          return { verdict: 'TIME_LIMIT_EXCEEDED', stdout: runRes.stdout, stderr: 'Time Limit Exceeded', executionTimeMs: timeoutMs, memoryKb: 4096 };
        }
        if (runRes.code !== 0) {
          const isSyntax = runRes.stderr.includes('SyntaxError') || runRes.stderr.includes('IndentationError');
          return {
            verdict: isSyntax ? 'COMPILATION_ERROR' : 'RUNTIME_ERROR',
            stdout: runRes.stdout,
            stderr: runRes.stderr,
            compileError: isSyntax ? runRes.stderr : undefined,
            executionTimeMs: runRes.durationMs,
            memoryKb: 4096
          };
        }
        return { verdict: 'ACCEPTED', stdout: runRes.stdout, stderr: runRes.stderr, executionTimeMs: runRes.durationMs, memoryKb: 4096 };
      }

      if (req.language === 'java') {
        const srcFile = path.join(workDir, 'Solution.java');
        await fs.writeFile(srcFile, req.code, 'utf-8');

        // Compile
        const compileRes = await this.runProcessWithTimeout('javac', ['Solution.java'], workDir, '', 10000);
        if (compileRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            stdout: '',
            stderr: compileRes.stderr,
            compileError: compileRes.stderr,
            executionTimeMs: 0,
            memoryKb: 0
          };
        }

        // Run
        const runRes = await this.runProcessWithTimeout('java', ['-Xmx256m', 'Solution'], workDir, req.stdin, timeoutMs);
        if (runRes.timedOut) {
          return { verdict: 'TIME_LIMIT_EXCEEDED', stdout: runRes.stdout, stderr: 'Time Limit Exceeded', executionTimeMs: timeoutMs, memoryKb: 16384 };
        }
        if (runRes.code !== 0) {
          return { verdict: 'RUNTIME_ERROR', stdout: runRes.stdout, stderr: runRes.stderr || 'Runtime Error', executionTimeMs: runRes.durationMs, memoryKb: 16384 };
        }
        return { verdict: 'ACCEPTED', stdout: runRes.stdout, stderr: runRes.stderr, executionTimeMs: runRes.durationMs, memoryKb: 16384 };
      }

      if (req.language === 'javascript' || (req.language as any) === 'nodejs') {
        const srcFile = path.join(workDir, 'solution.js');
        await fs.writeFile(srcFile, req.code, 'utf-8');

        const runRes = await this.runProcessWithTimeout('node', ['--max-old-space-size=128', 'solution.js'], workDir, req.stdin, timeoutMs);
        if (runRes.timedOut) {
          return { verdict: 'TIME_LIMIT_EXCEEDED', stdout: runRes.stdout, stderr: 'Time Limit Exceeded', executionTimeMs: timeoutMs, memoryKb: 4096 };
        }
        if (runRes.code !== 0) {
          const isSyntax = runRes.stderr.includes('SyntaxError');
          return {
            verdict: isSyntax ? 'COMPILATION_ERROR' : 'RUNTIME_ERROR',
            stdout: runRes.stdout,
            stderr: runRes.stderr,
            compileError: isSyntax ? runRes.stderr : undefined,
            executionTimeMs: runRes.durationMs,
            memoryKb: 4096
          };
        }
        return { verdict: 'ACCEPTED', stdout: runRes.stdout, stderr: runRes.stderr, executionTimeMs: runRes.durationMs, memoryKb: 4096 };
      }

      if (req.language === 'sql') {
        const sqlRes = await this.executeSql({ query: req.code, timeoutMs });
        return {
          verdict: sqlRes.verdict,
          stdout: sqlRes.stdout,
          stderr: sqlRes.stderr,
          compileError: sqlRes.error,
          executionTimeMs: sqlRes.executionTimeMs,
          memoryKb: 2048
        };
      }

      throw new Error(`Unsupported language: ${req.language}`);
    } finally {
      await this.cleanupWorkspace(workDir);
    }
  }

  async evaluateTestCases(req: TestCaseEvaluationRequest): Promise<MultiTestCaseResult> {
    const workDir = await this.createTempWorkspace();
    const timeoutMs = req.timeLimitMs || ENV.EXECUTION_TIMEOUT_MS;

    try {
      let runExecutable = '';
      let runArgs: string[] = [];

      // Step 1: Pre-compile once for compiled languages (C, C++, Java)
      if (req.language === 'c') {
        const src = path.join(workDir, 'solution.c');
        const exe = path.join(workDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
        await fs.writeFile(src, req.code, 'utf-8');
        const cRes = await this.runProcessWithTimeout('gcc', ['-O2', 'solution.c', '-o', exe], workDir, '', 8000);
        if (cRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            totalTestCases: req.visibleTestCases.length + req.hiddenTestCases.length,
            passedCount: 0,
            score: 0,
            results: [],
            avgExecutionTimeMs: 0,
            maxMemoryKb: 0,
            compileError: cRes.stderr
          };
        }
        runExecutable = exe;
        runArgs = [];
      } else if (req.language === 'cpp') {
        const src = path.join(workDir, 'solution.cpp');
        const exe = path.join(workDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
        await fs.writeFile(src, req.code, 'utf-8');
        const cRes = await this.runProcessWithTimeout('g++', ['-O2', 'solution.cpp', '-o', exe], workDir, '', 8000);
        if (cRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            totalTestCases: req.visibleTestCases.length + req.hiddenTestCases.length,
            passedCount: 0,
            score: 0,
            results: [],
            avgExecutionTimeMs: 0,
            maxMemoryKb: 0,
            compileError: cRes.stderr
          };
        }
        runExecutable = exe;
        runArgs = [];
      } else if (req.language === 'java') {
        const src = path.join(workDir, 'Solution.java');
        await fs.writeFile(src, req.code, 'utf-8');
        const cRes = await this.runProcessWithTimeout('javac', ['Solution.java'], workDir, '', 10000);
        if (cRes.code !== 0) {
          return {
            verdict: 'COMPILATION_ERROR',
            totalTestCases: req.visibleTestCases.length + req.hiddenTestCases.length,
            passedCount: 0,
            score: 0,
            results: [],
            avgExecutionTimeMs: 0,
            maxMemoryKb: 0,
            compileError: cRes.stderr
          };
        }
        runExecutable = 'java';
        runArgs = ['-Xmx256m', 'Solution'];
      } else if (req.language === 'python') {
        const src = path.join(workDir, 'solution.py');
        await fs.writeFile(src, req.code, 'utf-8');
        runExecutable = process.platform === 'win32' ? 'python' : 'python3';
        runArgs = ['solution.py'];
      } else if (req.language === 'javascript' || (req.language as any) === 'nodejs') {
        const src = path.join(workDir, 'solution.js');
        await fs.writeFile(src, req.code, 'utf-8');
        runExecutable = 'node';
        runArgs = ['--max-old-space-size=128', 'solution.js'];
      }

      // Step 2: Combine visible and hidden test cases
      const allTestCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }> = [
        ...req.visibleTestCases.map(tc => ({ ...tc, isHidden: false })),
        ...req.hiddenTestCases.map(tc => ({ ...tc, isHidden: true }))
      ];

      const testResults: TestCaseResult[] = [];
      let totalDuration = 0;
      let worstVerdict: SubmissionVerdict = 'ACCEPTED';

      for (let i = 0; i < allTestCases.length; i++) {
        const tc = allTestCases[i];
        const res = await this.runProcessWithTimeout(runExecutable, runArgs, workDir, tc.input, timeoutMs);
        totalDuration += res.durationMs;

        let verdict: SubmissionVerdict = 'ACCEPTED';
        let passed = false;

        if (res.timedOut) {
          verdict = 'TIME_LIMIT_EXCEEDED';
          if (worstVerdict === 'ACCEPTED') worstVerdict = 'TIME_LIMIT_EXCEEDED';
        } else if (res.code !== 0) {
          const isSyntax = res.stderr.includes('SyntaxError') || res.stderr.includes('IndentationError');
          verdict = isSyntax ? 'COMPILATION_ERROR' : 'RUNTIME_ERROR';
          if (worstVerdict === 'ACCEPTED') worstVerdict = verdict;
        } else {
          const normalizedActual = this.normalizeOutput(res.stdout);
          const normalizedExpected = this.normalizeOutput(tc.expectedOutput);
          if (normalizedActual === normalizedExpected) {
            passed = true;
            verdict = 'ACCEPTED';
          } else {
            passed = false;
            verdict = 'WRONG_ANSWER';
            if (worstVerdict === 'ACCEPTED') worstVerdict = 'WRONG_ANSWER';
          }
        }

        testResults.push({
          testCaseIndex: i + 1,
          passed,
          verdict,
          input: tc.isHidden ? '[HIDDEN]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: tc.isHidden ? (passed ? '[PASSED]' : '[OUTPUT MISMATCH]') : res.stdout,
          executionTimeMs: res.durationMs,
          error: res.stderr || undefined,
          isHidden: tc.isHidden
        });
      }

      const passedCount = testResults.filter(r => r.passed).length;
      const totalCount = allTestCases.length;
      const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
      const overallVerdict = passedCount === totalCount ? 'ACCEPTED' : worstVerdict;

      return {
        verdict: overallVerdict,
        totalTestCases: totalCount,
        passedCount,
        score,
        results: testResults,
        avgExecutionTimeMs: totalCount > 0 ? Math.round(totalDuration / totalCount) : 0,
        maxMemoryKb: 2048
      };
    } finally {
      await this.cleanupWorkspace(workDir);
    }
  }

  /**
   * Executes Python code in an isolated workspace with preloaded datasets,
   * captures stdout, stderr, execution plots (via Matplotlib), tabular outputs (Pandas),
   * and evaluation metrics (e.g. Accuracy, MSE, Loss).
   */
  async executePythonData(req: PythonDataExecutionRequest): Promise<PythonDataExecutionResult> {
    const workDir = await this.createTempWorkspace();
    const timeoutMs = req.timeoutMs || 8000;

    try {
      // 1. Write available sample datasets to the sandbox directory
      for (const dataset of Object.values(WORKSPACE_DATASETS)) {
        await fs.writeFile(path.join(workDir, dataset.filename), dataset.csvContent, 'utf-8');
      }

      // 2. Prepare harness that intercepts matplotlib plots cleanly
      const harnessScript = `
import sys, os
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as _plt
except Exception:
    pass

# --- User Script Starts ---
${req.code}
# --- User Script Ends ---

# --- Evalora Plot & Output Harvest ---
try:
    import matplotlib.pyplot as _plt
    import io, base64
    _fignums = _plt.get_fignums()
    if _fignums:
        for _num in _fignums:
            _fig = _plt.figure(_num)
            _buf = io.BytesIO()
            _fig.savefig(_buf, format='png', bbox_inches='tight')
            _b64 = base64.b64encode(_buf.getvalue()).decode('utf-8')
            print(f"\\n__EVALORA_PLOT__:{_b64}")
except Exception:
    pass
`;

      const srcFile = path.join(workDir, 'data_solution.py');
      await fs.writeFile(srcFile, harnessScript, 'utf-8');

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const runRes = await this.runProcessWithTimeout(pythonCmd, ['data_solution.py'], workDir, req.stdin || '', timeoutMs);

      if (runRes.timedOut) {
        return {
          verdict: 'TIME_LIMIT_EXCEEDED',
          stdout: runRes.stdout,
          stderr: 'Time Limit Exceeded (8 seconds)',
          executionTimeMs: timeoutMs,
          memoryKb: 8192
        };
      }

      // 3. Extract any intercepted plots from stdout
      const plots: string[] = [];
      const cleanStdoutLines: string[] = [];
      const lines = runRes.stdout.split('\n');

      for (const line of lines) {
        if (line.includes('__EVALORA_PLOT__:')) {
          const plotB64 = line.split('__EVALORA_PLOT__:')[1]?.trim();
          if (plotB64) {
            plots.push(plotB64);
          }
        } else {
          cleanStdoutLines.push(line);
        }
      }

      const cleanStdout = cleanStdoutLines.join('\n').trim();

      // 4. Extract metrics like Accuracy: 0.95 or Loss: 0.12 or R2: 0.88
      const metrics: Record<string, string | number> = {};
      const metricLineRegex = /^([A-Za-z0-9_\s()-]{2,28})\s*[:=]\s*([0-9.]+%?|[0-9]+(?:\/[0-9]+)?)$/;

      for (const line of cleanStdoutLines) {
        const trimmed = line.trim();
        const match = trimmed.match(metricLineRegex);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim();
          if (!key.toLowerCase().startsWith('line') && !key.toLowerCase().startsWith('step')) {
            const numVal = Number(val);
            const resolvedVal = !isNaN(numVal) && !val.includes('%') ? numVal : val;
            metrics[key] = resolvedVal;
            metrics[key.toLowerCase()] = resolvedVal;
          }
        }
      }

      // 5. Extract Tabular data if formatted with delimiters
      let tableData: { columns: string[]; rows: any[][] } | null = null;
      for (let i = 0; i < cleanStdoutLines.length; i++) {
        const line = cleanStdoutLines[i].trim();
        if (line.includes(',') && !line.startsWith('#') && i < cleanStdoutLines.length - 1) {
          const possibleCols = line.split(',').map(c => c.trim()).filter(Boolean);
          if (possibleCols.length >= 2) {
            const nextLine = cleanStdoutLines[i + 1].trim();
            const nextParts = nextLine.split(',').map(c => c.trim());
            if (nextParts.length === possibleCols.length) {
              const rows: any[][] = [];
              for (let j = i + 1; j < Math.min(cleanStdoutLines.length, i + 25); j++) {
                const rParts = cleanStdoutLines[j].trim().split(',').map(c => c.trim());
                if (rParts.length === possibleCols.length) {
                  rows.push(rParts.map(val => (!isNaN(Number(val)) ? Number(val) : val)));
                } else {
                  break;
                }
              }
              if (rows.length > 0) {
                tableData = { columns: possibleCols, rows };
                break;
              }
            }
          }
        }
      }

      if (runRes.code !== 0) {
        const isSyntax = runRes.stderr.includes('SyntaxError') || runRes.stderr.includes('IndentationError');
        return {
          verdict: isSyntax ? 'COMPILATION_ERROR' : 'RUNTIME_ERROR',
          stdout: cleanStdout,
          stderr: runRes.stderr,
          compileError: isSyntax ? runRes.stderr : undefined,
          executionTimeMs: runRes.durationMs,
          memoryKb: 8192,
          plots: plots.length > 0 ? plots : undefined,
          tableData: tableData || undefined,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined
        };
      }

      return {
        verdict: 'ACCEPTED',
        stdout: cleanStdout,
        stderr: runRes.stderr,
        executionTimeMs: runRes.durationMs,
        memoryKb: 8192,
        plots: plots.length > 0 ? plots : undefined,
        tableData: tableData || undefined,
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined
      };
    } finally {
      await this.cleanupWorkspace(workDir);
    }
  }

  /**
   * Executes SQL query against an in-memory SQLite sandbox with preloaded tables.
   */
  async executeSql(req: SqlExecutionRequest): Promise<SqlExecutionResult> {
    const workDir = await this.createTempWorkspace();
    const timeoutMs = req.timeoutMs || 5000;

    try {
      const schemasScript = SQL_SAMPLE_SCHEMA.map(s => `${s.createSql}\n${s.seedSql}`).join('\n\n');

      const runnerCode = `
import sqlite3, sys, json, time

try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    cursor.executescript('''${schemasScript.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}''')
    conn.commit()
    
    user_query = sys.stdin.read().strip()
    if not user_query:
        print(json.dumps({"success": False, "error": "Empty SQL query provided."}))
        sys.exit(0)
    
    start_time = time.time()
    cursor.execute(user_query)
    
    if cursor.description:
        cols = [d[0] for d in cursor.description]
        raw_rows = cursor.fetchall()
        duration_ms = round((time.time() - start_time) * 1000, 2)
        rows = [[str(item) if isinstance(item, (bytes, bytearray)) else item for item in row] for row in raw_rows]
        print(json.dumps({
            "success": True,
            "columns": cols,
            "rows": rows,
            "rowCount": len(rows),
            "executionTimeMs": duration_ms
        }))
    else:
        conn.commit()
        duration_ms = round((time.time() - start_time) * 1000, 2)
        print(json.dumps({
            "success": True,
            "columns": ["Result"],
            "rows": [["Query executed successfully. (" + str(cursor.rowcount) + " rows affected)"]],
            "rowCount": cursor.rowcount,
            "executionTimeMs": duration_ms
        }))
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
`;

      const srcFile = path.join(workDir, 'sql_runner.py');
      await fs.writeFile(srcFile, runnerCode, 'utf-8');

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const runRes = await this.runProcessWithTimeout(pythonCmd, ['sql_runner.py'], workDir, req.query, timeoutMs);

      if (runRes.timedOut) {
        return {
          verdict: 'TIME_LIMIT_EXCEEDED',
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: timeoutMs,
          stdout: '',
          stderr: 'Time Limit Exceeded (5 seconds)',
          error: 'Query execution timed out.'
        };
      }

      try {
        const parsed = JSON.parse(runRes.stdout.trim());
        if (parsed.success) {
          return {
            success: true,
            verdict: 'ACCEPTED',
            columns: parsed.columns || [],
            rows: parsed.rows || [],
            rowCount: parsed.rowCount || 0,
            executionTimeMs: parsed.executionTimeMs || runRes.durationMs,
            stdout: `Query executed successfully (${parsed.rowCount} rows in ${parsed.executionTimeMs}ms)`,
            stderr: ''
          };
        } else {
          return {
            success: false,
            verdict: 'RUNTIME_ERROR',
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: runRes.durationMs,
            stdout: '',
            stderr: parsed.error || 'SQL execution failed.',
            error: parsed.error || 'SQL execution failed.'
          };
        }
      } catch {
        return {
          success: false,
          verdict: 'RUNTIME_ERROR',
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: runRes.durationMs,
          stdout: runRes.stdout,
          stderr: runRes.stderr || 'Invalid runner output.',
          error: runRes.stderr || 'SQL runner failure.'
        };
      }
    } finally {
      await this.cleanupWorkspace(workDir);
    }
  }
}

// Export singleton instance
export const codeExecutionService: ICodeExecutionRunner = new LocalIsolatedRunner();
