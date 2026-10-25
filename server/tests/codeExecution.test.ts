import { describe, it, expect } from 'vitest';
import { codeExecutionService } from '../src/services/codeExecutionService.js';

describe('Code Execution Service', () => {
  it('should execute Python code successfully with stdout', async () => {
    const result = await codeExecutionService.execute({
      language: 'python',
      code: `import sys
data = sys.stdin.read().strip()
print(f"Echo: {data}")`,
      stdin: 'Hello Evalora'
    });

    expect(result.verdict).toBe('ACCEPTED');
    expect(result.stdout.trim()).toBe('Echo: Hello Evalora');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should detect Python syntax error as COMPILATION_ERROR', async () => {
    const result = await codeExecutionService.execute({
      language: 'python',
      code: `def broken_syntax(
  print("Missing bracket")`,
      stdin: ''
    });

    expect(result.verdict).toBe('COMPILATION_ERROR');
    expect(result.compileError).toBeDefined();
  });

  it('should detect time limit exceeded', async () => {
    const result = await codeExecutionService.execute({
      language: 'python',
      code: `import time
while True:
    time.sleep(0.1)`,
      stdin: '',
      timeoutMs: 1000
    });

    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED');
  });

  it('should evaluate visible and hidden test cases correctly', async () => {
    const result = await codeExecutionService.evaluateTestCases({
      language: 'python',
      code: `import sys
lines = sys.stdin.read().split()
if lines:
    n1, n2 = int(lines[0]), int(lines[1])
    print(n1 + n2)`,
      visibleTestCases: [
        { input: '2 3', expectedOutput: '5' },
        { input: '10 20', expectedOutput: '30' }
      ],
      hiddenTestCases: [
        { input: '-5 5', expectedOutput: '0' },
        { input: '100 200', expectedOutput: '300' }
      ]
    });

    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passedCount).toBe(4);
    expect(result.totalTestCases).toBe(4);
    expect(result.score).toBe(100);
    expect(result.results.find(test => test.isHidden)?.actualOutput).toBe('[PASSED]');
    expect(result.results.find(test => test.isHidden)?.input).toBe('[HIDDEN]');
    expect(result.results.find(test => test.isHidden)?.expectedOutput).toBe('[HIDDEN]');
  });

  it('should return WRONG_ANSWER with a partial score', async () => {
    const result = await codeExecutionService.evaluateTestCases({
      language: 'python',
      code: 'print(1)',
      visibleTestCases: [
        { input: '', expectedOutput: '1' },
        { input: '', expectedOutput: '2' }
      ],
      hiddenTestCases: []
    });

    expect(result.verdict).toBe('WRONG_ANSWER');
    expect(result.passedCount).toBe(1);
    expect(result.score).toBe(50);
  });

  it('should return runtime and compilation failures without accepting them', async () => {
    const runtime = await codeExecutionService.evaluateTestCases({
      language: 'python',
      code: 'raise RuntimeError("boom")',
      visibleTestCases: [{ input: '', expectedOutput: '' }],
      hiddenTestCases: []
    });
    expect(runtime.verdict).toBe('RUNTIME_ERROR');
    expect(runtime.passedCount).toBe(0);

    const compilation = await codeExecutionService.evaluateTestCases({
      language: 'python',
      code: 'def broken(',
      visibleTestCases: [{ input: '', expectedOutput: '' }],
      hiddenTestCases: []
    });
    expect(compilation.verdict).toBe('COMPILATION_ERROR');
    expect(compilation.passedCount).toBe(0);
  });
});
