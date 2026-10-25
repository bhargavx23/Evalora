import { describe, it, expect } from 'vitest';
import { codeExecutionService } from '../src/services/codeExecutionService.js';
import { domainCurriculumService } from '../src/services/domainCurriculumService.js';
import { WORKSPACE_DATASETS, SQL_SAMPLE_SCHEMA } from '../src/config/workspaceDatasets.js';

describe('Domain-Aware Workspaces & Sandboxed Execution', () => {
  it('should have pre-configured real datasets and SQL schemas available', () => {
    const datasetList = Object.values(WORKSPACE_DATASETS);
    expect(datasetList.length).toBeGreaterThanOrEqual(3);
    const scoreDs = datasetList.find(d => d.id === 'student_scores');
    expect(scoreDs).toBeDefined();
    expect(scoreDs?.sampleRows.length).toBeGreaterThan(0);

    expect(SQL_SAMPLE_SCHEMA.length).toBeGreaterThanOrEqual(4);
    const studentTable = SQL_SAMPLE_SCHEMA.find(t => t.tableName === 'students');
    expect(studentTable).toBeDefined();
    expect(studentTable?.columns.length).toBeGreaterThan(0);
  });

  it('should execute Python Data Science script and generate real Matplotlib plot', async () => {
    const code = `
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 50)
y = np.sin(x)
plt.plot(x, y, label='Sine Wave')
plt.title('Test Plot')
plt.show()

print("ACCURACY: 0.9520")
print("MSE: 0.0412")
`;

    const res = await codeExecutionService.executePythonData({
      code,
      timeoutMs: 10000
    });

    expect(res.verdict).toBe('ACCEPTED');
    expect(res.plots).toBeDefined();
    expect(res.plots?.length).toBeGreaterThanOrEqual(1);
    expect(res.plots?.[0]).toMatch(/^[A-Za-z0-9+/=]+$/); // valid base64
    expect(res.metrics).toBeDefined();
    expect(res.metrics?.accuracy).toBeCloseTo(0.952, 2);
    expect(res.metrics?.mse).toBeCloseTo(0.0412, 3);
  }, 15000);

  it('should execute SQL query against SQLite sandbox and return rows & columns', async () => {
    const query = `
SELECT student_id, first_name, last_name, department, gpa
FROM students
WHERE gpa >= 3.7
ORDER BY gpa DESC;
`;

    const res = await codeExecutionService.executeSql({
      query,
      timeoutMs: 5000
    });

    expect(res.success).toBe(true);
    expect(res.columns).toEqual(['student_id', 'first_name', 'last_name', 'department', 'gpa']);
    expect(res.rowCount).toBeGreaterThan(0);
    expect(res.rows.length).toBe(res.rowCount);
    expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(res.error).toBeUndefined();
  });

  it('should catch SQL syntax errors cleanly and return friendly error message', async () => {
    const query = `SELECT * FORM non_existent_table;`; // deliberate typo FORM

    const res = await codeExecutionService.executeSql({ query });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.rowCount).toBe(0);
  });

  it('should build dynamic domain-aware workspaceConfig for all technical domains', () => {
    // 1. Web
    const webConfig = domainCurriculumService.buildWorkspaceConfig({
      domainSlug: 'full-stack-mern-development',
      moduleId: 'mern-m1-html-css-dom',
      topic: 'Semantic HTML',
      language: 'html'
    });
    expect(webConfig.workspaceType).toBe('web');
    expect(webConfig.executionEnvironment).toBe('browser_preview');
    expect(webConfig.supportedLanguages).toContain('html');

    // 2. Python Data Science / ML
    const dataConfig = domainCurriculumService.buildWorkspaceConfig({
      domainSlug: 'data-science-machine-learning',
      moduleId: 'ds-m2-data-wrangling',
      topic: 'Pandas DataFrames and Feature Engineering',
      language: 'python'
    });
    expect(dataConfig.workspaceType).toBe('python_data');
    expect(dataConfig.executionEnvironment).toBe('python_isolated');
    expect(dataConfig.availableDatasets?.length).toBeGreaterThan(0);

    // 3. SQL
    const sqlConfig = domainCurriculumService.buildWorkspaceConfig({
      domainSlug: 'data-science-machine-learning',
      moduleId: 'ds-m1-sql-scratch',
      topic: 'SQL Queries and Joins',
      language: 'sql'
    });
    expect(sqlConfig.workspaceType).toBe('sql');
    expect(sqlConfig.executionEnvironment).toBe('sqlite_sandbox');
    expect(sqlConfig.databaseSchema?.length).toBeGreaterThan(0);

    // 4. DSA
    const dsaConfig = domainCurriculumService.buildWorkspaceConfig({
      domainSlug: 'dsa-competitive-programming',
      moduleId: 'dsa-m1-arrays',
      topic: 'Two Pointer Technique',
      language: 'cpp'
    });
    expect(dsaConfig.workspaceType).toBe('dsa');
    expect(dsaConfig.executionEnvironment).toBe('compiled_sandbox');
    expect(dsaConfig.testCases?.length).toBeGreaterThan(0);
  });
});
