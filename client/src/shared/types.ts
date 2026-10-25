export type UserRole = 'admin' | 'platform_admin' | 'college_admin' | 'faculty' | 'student';

export type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'coding';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type CodingLanguage = 'c' | 'cpp' | 'python' | 'java' | 'javascript' | 'nodejs' | 'sql' | 'html' | 'css';

export type SubmissionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED';

export type AssessmentStatus = 'draft' | 'published' | 'archived';

export type AttemptStatus = 'in_progress' | 'submitted' | 'evaluated' | 'auto_submitted' | 'terminated';

export type IntegrityEventType =
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'window_blur';

export interface TestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  weight?: number;
  explanation?: string;
  isHidden?: boolean;
}

export interface ExampleCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface StarterCodes {
  c: string;
  cpp: string;
  python: string;
  java: string;
  javascript?: string;
  nodejs?: string;
  [key: string]: string | undefined;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean; // Hidden for students in assessment mode
}

export interface CodingDetails {
  supportedLanguages: CodingLanguage[];
  starterCode: StarterCodes;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: ExampleCase[];
  visibleTestCases: TestCase[];
  hiddenTestCases?: TestCase[]; // Hidden for students
  timeLimitMs: number;
  memoryLimitMb: number;
  expectedComplexity?: {
    time?: string;
    space?: string;
  };
}

export interface QuestionSummary {
  _id: string;
  title: string;
  description: string;
  type: QuestionType;
  topic: string;
  subtopic: string;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  estimatedTimeMinutes: number;
  tags: string[];
  options?: QuestionOption[];
  codingDetails?: Omit<CodingDetails, 'hiddenTestCases'>;
  explanation?: string;
  authorId?: string;
  collegeId?: string | null;
  status: 'draft' | 'verified' | 'archived';
  usageCount?: number;
  discriminationIndex?: number;
  failureRate?: number;
  flagReason?: string;
  conceptId?: string;
  variantName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSection {
  id: string;
  name: string;
  type: 'aptitude' | 'technical' | 'coding' | 'mixed';
  questions: string[]; // Question IDs
  marksPerQuestion: number;
  totalMarks: number;
}

export interface AssessmentRules {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
  fullscreenRequired: boolean;
  tabSwitchLimit: number;
  copyPasteRestricted: boolean;
  maxAttempts: number;
}

export interface AssessmentSummary {
  _id: string;
  title: string;
  description: string;
  instructions: string;
  collegeId: string;
  creatorId: {
    _id: string;
    name: string;
    email: string;
  } | string;
  durationMinutes: number;
  totalMarks: number;
  passPercentage: number;
  status: AssessmentStatus;
  startDate: string;
  endDate: string;
  sections: AssessmentSection[];
  rules: AssessmentRules;
  assignedDepartments: string[];
  assignedStudents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentSkillMetric {
  topic: string;
  scorePercentage: number;
  totalAttempted: number;
  totalCorrect: number;
  difficultyLevel: DifficultyLevel;
  lastPracticedAt: string;
  status: 'strong' | 'needs_improvement' | 'moderate';
}

export interface PracticeSessionConfig {
  topic: string;
  subtopic?: string;
  difficulty: DifficultyLevel | 'mixed';
  questionCount: number;
  type: 'mcq' | 'coding' | 'mixed';
  language?: CodingLanguage;
}

export interface PlanEntitlements {
  domainPreparation: boolean;
  allowedDomains: string[];
  subscriptionDurationDays: number;
  unlimitedDomainPractice: boolean;
  aiAdaptivePractice?: boolean;
  codeWorkspacesEnabled?: boolean;
  codeVisualization?: boolean;
  performanceReportsPdf?: boolean;
  priorityExecution?: boolean;
}

export interface IExecutionStep {
  step: number;
  line: number;
  explanation: string;
  variables: Record<string, any>;
  callStack?: Array<{ functionName: string; line: number }>;
  stdout?: string;
  eventType?: 'statement' | 'call' | 'return' | 'loop' | 'error';
  error?: string;
  warning?: string;
}

export interface IVisualizationResult {
  success: boolean;
  supported?: boolean;
  language: string;
  totalSteps: number;
  steps: IExecutionStep[];
  stdout: string;
  error?: string;
  warning?: string;
  message?: string;
}

export interface PracticePlanItem {
  id: string;
  planId?: string;
  name: string;
  description: string;
  price: number;
  priceAlgo: number;
  priceMicroAlgos: number;
  attempts: number;
  paidAttempts: number;
  currency: 'ALGO';
  popular?: boolean;
  features: string[];
  exclusions?: string[];
  entitlements: PlanEntitlements;
}

export interface SubscriptionSummary {
  _id: string;
  userId: string;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  startDate: string;
  expiresAt: string;
  pricePaidAlgo: number;
  currency: 'ALGO';
  transactionId: string;
  entitlements: PlanEntitlements;
}

export interface ITopicLesson {
  lessonId: string;
  title: string;
  concept: string;
  whatIsIt?: string;
  whyNeeded?: string;
  realWorldAnalogy?: string;
  syntaxBreakdown?: Array<{
    element: string;
    explanation: string;
  }>;
  codeExamples: Array<{
    title: string;
    language: string;
    code: string;
    explanation: string;
    expectedResult?: string;
    lineByLineExplanation?: Array<{
      line: string | number;
      explanation: string;
    }>;
  }>;
  keyTakeaways: string[];
}

export interface ITopicExercise {
  exerciseId: string;
  title: string;
  instruction: string;
  type: 'coding' | 'debugging' | 'output_prediction' | 'knowledge_check';
  difficulty: 'easy' | 'medium' | 'hard';
  starterCode?: string;
  solutionSnippet?: string;
  language?: string;
  hints?: string[];
  testCriteria?: string;
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  explanation?: string;
  workspaceConfig?: IWorkspaceConfig;
}

export interface IDomainTopicContent {
  _id?: string;
  domainSlug: string;
  moduleId: string;
  topic: string;
  overview: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  lessons: ITopicLesson[];
  exercises: ITopicExercise[];
  status: 'draft' | 'validated' | 'published';
  source?: string;
}

export interface IAssignmentStarterFile {
  filename: string;
  language: string;
  content: string;
}

export interface IAssignmentRubricItem {
  id: string;
  title: string;
  description: string;
  weight: number;
  verificationType: string;
  targetIdentifier?: string;
  expectedValue?: string;
}

export interface IWorkspaceConfig {
  workspaceType: 'web' | 'python_data' | 'dsa' | 'sql' | 'theory';
  editorType: 'multi_file' | 'single_file' | 'sql_editor';
  executionEnvironment: 'browser_preview' | 'python_isolated' | 'compiled_sandbox' | 'sqlite_sandbox' | 'none';
  supportedLanguages: string[];
  defaultLanguage: string;
  inputPanels: Array<'instructions' | 'dataset' | 'custom_input' | 'schema' | 'rubric'>;
  outputPanels: Array<'preview' | 'console' | 'test_cases' | 'data_table' | 'chart' | 'metrics' | 'query_results' | 'visualizer'>;
  availableDatasets?: Array<{
    id: string;
    name: string;
    filename: string;
    description: string;
    rowCount: number;
    sampleRows: any[];
  }>;
  databaseSchema?: Array<{
    tableName: string;
    description: string;
    columns: Array<{ name: string; type: string; isPrimary?: boolean }>;
    sampleRows: any[];
  }>;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    explanation?: string;
  }>;
  gradingStrategy: 'rubric' | 'test_cases' | 'query_match' | 'output_match' | 'manual';
}

export interface IDomainAssignment {
  _id?: string;
  assignmentId: string;
  domainSlug: string;
  moduleId: string;
  title: string;
  description: string;
  objective: string;
  type: 'web_coding' | 'backend_coding' | 'algorithmic' | 'fullstack';
  passingScore: number;
  instructions: string[];
  starterFiles: IAssignmentStarterFile[];
  rubric: IAssignmentRubricItem[];
  estimatedMinutes: number;
  status: 'published' | 'draft';
  workspaceConfig?: IWorkspaceConfig;
}


