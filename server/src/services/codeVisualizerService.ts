import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { IExecutionStep, IVisualizationResult } from '../shared/types.js';
import { logger } from '../utils/logger.js';

export interface VisualizeOptions {
  code: string;
  language: string;
  timeoutMs?: number;
  maxSteps?: number;
}

export class CodeVisualizerService {
  private baseTempDir: string;
  private maxSteps: number;
  private defaultTimeoutMs: number;

  constructor() {
    this.baseTempDir = path.join(os.tmpdir(), 'evalora-visualizer');
    this.maxSteps = 250;
    this.defaultTimeoutMs = 3000;
    fs.mkdir(this.baseTempDir, { recursive: true }).catch(() => {});
  }

  /**
   * Generates step-by-step execution trace for supported languages (JavaScript, Python).
   */
  async visualize(options: VisualizeOptions): Promise<IVisualizationResult> {
    const { code, language, timeoutMs = this.defaultTimeoutMs } = options;
    const cleanLang = (language || '').toLowerCase().trim();

    if (!code || !code.trim()) {
      return {
        success: false,
        supported: true,
        language: cleanLang,
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: 'No code provided for visualization.'
      };
    }

    if (cleanLang === 'javascript' || cleanLang === 'js' || cleanLang === 'jsx' || cleanLang === 'node') {
      return this.visualizeJavaScript(code, timeoutMs);
    }

    if (cleanLang === 'python' || cleanLang === 'py') {
      return this.visualizePython(code, timeoutMs);
    }

    // Honest handling of unsupported languages per requirement 4
    return {
      success: false,
      supported: false,
      language: cleanLang,
      totalSteps: 0,
      steps: [],
      stdout: '',
      message: `Interactive step-by-step execution visualization is currently available for JavaScript and Python. For ${cleanLang.toUpperCase()}, please use the test-case execution runner.`
    };
  }

  /**
   * Generates genuine execution trace for JavaScript code via statement-level instrumentation.
   */
  private async visualizeJavaScript(code: string, timeoutMs: number): Promise<IVisualizationResult> {
    const runId = uuidv4();
    const workDir = path.join(this.baseTempDir, `js-${runId}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
      const lines = code.split('\n');

      // Extract variable identifiers
      const varNames = Array.from(
        new Set([
          ...Array.from(code.matchAll(/\b(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)).map((m) => m[1]),
          ...Array.from(code.matchAll(/\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)).map((m) => m[1])
        ])
      );

      const snapExpr = `() => { const s = {}; ${varNames.map((v) => `try { s[${JSON.stringify(v)}] = ${v}; } catch {}`).join(' ')} return s; }`;

      const instrumentedLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (
          !trimmed ||
          trimmed === '{' ||
          trimmed === '}' ||
          trimmed === '};' ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')
        ) {
          instrumentedLines.push(rawLine);
          continue;
        }

        const indent = rawLine.match(/^\s*/)?.[0] || '';
        instrumentedLines.push(`${indent}__trace__(${lineNum}, ${snapExpr});`);
        instrumentedLines.push(rawLine);
      }

      const scriptContent = `
const __steps__ = [];
let __stepCount__ = 0;
const __maxSteps__ = ${this.maxSteps};
const __stdoutLogs__ = [];

// Intercept console.log
const origLog = console.log;
console.log = function(...args) {
  origLog.apply(console, args);
  __stdoutLogs__.push(args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' '));
};

function __safeSerialize__(val) {
  if (typeof val === 'function') return '[Function' + (val.name ? ': ' + val.name : '') + ']';
  if (val === undefined) return undefined;
  if (typeof val === 'bigint') return val.toString() + 'n';
  if (typeof val === 'object' && val !== null) {
    try {
      return JSON.parse(JSON.stringify(val));
    } catch {
      return String(val);
    }
  }
  return val;
}

function __trace__(lineNum, getSnap) {
  if (__stepCount__ >= __maxSteps__) {
    throw new Error('__MAX_STEPS_EXCEEDED__');
  }
  __stepCount__++;
  const vars = {};
  if (typeof getSnap === 'function') {
    try {
      const raw = getSnap();
      for (const k in raw) {
        vars[k] = __safeSerialize__(raw[k]);
      }
    } catch {}
  }
  __steps__.push({
    step: __stepCount__,
    line: lineNum,
    variables: vars,
    stdout: __stdoutLogs__.join('\\n')
  });
}

try {
${instrumentedLines.join('\n')}
  // Final state
  __trace__(${lines.length}, ${snapExpr});
} catch (err) {
  if (err && err.message === '__MAX_STEPS_EXCEEDED__') {
    __steps__.push({
      step: __stepCount__ + 1,
      line: __steps__.length > 0 ? __steps__[__steps__.length - 1].line : 1,
      variables: __steps__.length > 0 ? __steps__[__steps__.length - 1].variables : {},
      eventType: 'loop',
      warning: 'Execution paused: Maximum 250 steps reached (infinite loop guard).'
    });
  } else {
    __steps__.push({
      step: __stepCount__ + 1,
      line: __steps__.length > 0 ? __steps__[__steps__.length - 1].line : 1,
      variables: __steps__.length > 0 ? __steps__[__steps__.length - 1].variables : {},
      eventType: 'error',
      error: err ? err.message : 'Runtime error'
    });
  }
}

process.stdout.write('__EVALORA_TRACE_START__' + JSON.stringify(__steps__) + '__EVALORA_TRACE_END__');
`;

      const scriptPath = path.join(workDir, 'runner.js');
      await fs.writeFile(scriptPath, scriptContent, 'utf-8');

      const traceOutput = await this.runProcess(process.execPath, [scriptPath], workDir, timeoutMs);
      return this.parseTraceOutput(traceOutput, 'javascript', lines);
    } catch (err: any) {
      logger.error('JS_VISUALIZE_ERROR', { details: { message: err.message } });
      return {
        success: false,
        supported: true,
        language: 'javascript',
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: err.message || 'Execution error during visualization.'
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Generates genuine execution trace for Python code via sys.settrace.
   */
  private async visualizePython(code: string, timeoutMs: number): Promise<IVisualizationResult> {
    const runId = uuidv4();
    const workDir = path.join(this.baseTempDir, `py-${runId}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
      const lines = code.split('\n');
      const harnessScript = `
import sys, json

trace = []
max_steps = ${this.maxSteps}
step = 0
output_lines = []

class OutputCapture:
    def write(self, s):
        if s:
            output_lines.append(s)
            sys.__stdout__.write(s)
    def flush(self):
        sys.__stdout__.flush()

sys.stdout = OutputCapture()

def tracer(frame, event, arg):
    global step
    if frame.f_code.co_filename != '<user_code>':
        return tracer
    if step >= max_steps:
        raise Exception('__MAX_STEPS_EXCEEDED__')
    step += 1
    
    local_vars = {}
    for k, v in frame.f_locals.items():
        if k.startswith('__') or k in ('tracer', 'trace', 'max_steps', 'step', 'output_lines', 'OutputCapture'):
            continue
        try:
            if isinstance(v, (int, float, str, bool, list, dict, type(None))):
                local_vars[k] = json.loads(json.dumps(v))
            else:
                local_vars[k] = str(v)
        except:
            local_vars[k] = str(v)
            
    stack = []
    curr = frame
    while curr and curr.f_code.co_filename == '<user_code>':
        stack.append({'functionName': curr.f_code.co_name, 'line': curr.f_lineno})
        curr = curr.f_back

    trace.append({
        'step': step,
        'line': frame.f_lineno,
        'eventType': event,
        'variables': local_vars,
        'callStack': stack,
        'stdout': "".join(output_lines)
    })
    return tracer

user_code = ${JSON.stringify(code)}
compiled = compile(user_code, '<user_code>', 'exec')
sys.settrace(tracer)

try:
    exec(compiled, {})
except Exception as e:
    if str(e) == '__MAX_STEPS_EXCEEDED__':
        trace.append({
            'step': step + 1,
            'line': trace[-1]['line'] if trace else 1,
            'eventType': 'loop',
            'warning': 'Execution paused: Maximum 250 steps reached (infinite loop guard).',
            'variables': trace[-1]['variables'] if trace else {},
            'callStack': []
        })
    else:
        trace.append({
            'step': step + 1,
            'line': getattr(e, 'lineno', trace[-1]['line'] if trace else 1),
            'eventType': 'error',
            'error': str(e),
            'variables': trace[-1]['variables'] if trace else {},
            'callStack': []
        })
finally:
    sys.settrace(None)
    sys.__stdout__.write('__EVALORA_TRACE_START__' + json.dumps(trace) + '__EVALORA_TRACE_END__')
`;

      const scriptPath = path.join(workDir, 'runner.py');
      await fs.writeFile(scriptPath, harnessScript, 'utf-8');

      const traceOutput = await this.runProcess('python', [scriptPath], workDir, timeoutMs);
      return this.parseTraceOutput(traceOutput, 'python', lines);
    } catch (err: any) {
      logger.error('PY_VISUALIZE_ERROR', { details: { message: err.message } });
      return {
        success: false,
        supported: true,
        language: 'python',
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: err.message || 'Execution error during Python visualization.'
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Spawns an isolated process and captures output within the given timeout.
   */
  private runProcess(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, timeoutMs);

      child.stdout.on('data', (d) => {
        if (stdout.length < 500000) {
          stdout += d.toString();
        }
      });

      child.stderr.on('data', (d) => {
        if (stderr.length < 500000) {
          stderr += d.toString();
        }
      });

      child.on('close', () => {
        clearTimeout(timer);
        resolve({ stdout, stderr, timedOut });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        stderr += err.message;
        resolve({ stdout, stderr, timedOut });
      });
    });
  }

  /**
   * Parses JSON trace blocks from process stdout and enriches each step with beginner-friendly explanations.
   */
  private parseTraceOutput(
    procResult: { stdout: string; stderr: string; timedOut: boolean },
    language: string,
    sourceLines: string[]
  ): IVisualizationResult {
    if (procResult.timedOut) {
      return {
        success: false,
        supported: true,
        language,
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: 'Execution timed out. Please verify that your code terminates.'
      };
    }

    const { stdout, stderr } = procResult;
    const startIndex = stdout.indexOf('__EVALORA_TRACE_START__');
    const endIndex = stdout.indexOf('__EVALORA_TRACE_END__');

    if (startIndex === -1 || endIndex === -1) {
      return {
        success: false,
        supported: true,
        language,
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: stderr || 'Failed to capture execution trace. Check for syntax or runtime errors.'
      };
    }

    const rawJson = stdout.slice(startIndex + '__EVALORA_TRACE_START__'.length, endIndex).trim();
    let rawSteps: any[] = [];
    try {
      rawSteps = JSON.parse(rawJson);
    } catch {
      return {
        success: false,
        supported: true,
        language,
        totalSteps: 0,
        steps: [],
        stdout: '',
        error: 'Malformed execution trace output.'
      };
    }

    // Enrich steps with beginner-friendly explanations
    const enrichedSteps: IExecutionStep[] = [];
    let prevVariables: Record<string, any> = {};

    for (let i = 0; i < rawSteps.length; i++) {
      const step = rawSteps[i];
      const lineNum = Math.min(Math.max(1, step.line || 1), sourceLines.length);
      const codeLine = (sourceLines[lineNum - 1] || '').trim();

      let explanation = step.explanation || '';
      if (!explanation) {
        if (step.error) {
          explanation = `Runtime Error on Line ${lineNum}: ${step.error}`;
        } else if (step.warning) {
          explanation = step.warning;
        } else {
          // Compare variables with previous step
          const changedKeys = Object.keys(step.variables || {}).filter(
            (k) => JSON.stringify(step.variables[k]) !== JSON.stringify(prevVariables[k])
          );

          if (changedKeys.length > 0) {
            const changes = changedKeys.map((k) => {
              const val = step.variables[k];
              const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
              if (prevVariables[k] === undefined) {
                return `Created ${k} = ${valStr}`;
              }
              return `Updated ${k} to ${valStr}`;
            });
            explanation = `Line ${lineNum}: ${changes.join(', ')}`;
          } else if (/^(for|while)\b/.test(codeLine)) {
            explanation = `Line ${lineNum}: Checking loop condition`;
          } else if (/^if\b/.test(codeLine)) {
            explanation = `Line ${lineNum}: Evaluating conditional branch`;
          } else if (/^return\b/.test(codeLine)) {
            explanation = `Line ${lineNum}: Returning from execution`;
          } else {
            explanation = `Line ${lineNum}: Executing statement (${codeLine.slice(0, 45)}${codeLine.length > 45 ? '...' : ''})`;
          }
        }
      }

      enrichedSteps.push({
        step: i + 1,
        line: lineNum,
        explanation,
        variables: step.variables || {},
        callStack: step.callStack || [{ functionName: 'main', line: lineNum }],
        stdout: step.stdout || '',
        eventType: step.eventType || (step.error ? 'error' : 'statement'),
        error: step.error
      });

      prevVariables = { ...(step.variables || {}) };
    }

    const lastStep = enrichedSteps[enrichedSteps.length - 1];

    return {
      success: true,
      supported: true,
      language,
      totalSteps: enrichedSteps.length,
      steps: enrichedSteps,
      stdout: lastStep?.stdout || '',
      error: lastStep?.error,
      warning: lastStep?.eventType === 'loop' ? 'Maximum execution trace steps reached.' : undefined
    };
  }
}

export const codeVisualizerService = new CodeVisualizerService();
