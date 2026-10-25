import mongoose, { Document, Schema } from 'mongoose';

export interface IAssignmentStarterFile {
  filename: string;
  language: string;
  content: string;
}

export interface IAssignmentRubricItem {
  id: string;
  title: string;
  description: string;
  weight: number; // percentage (e.g. 25)
  verificationType:
    | 'html_dom'
    | 'css_property'
    | 'js_function'
    | 'stdout'
    | 'unit_test'
    | 'keyword_match';
  targetIdentifier?: string;
  expectedValue?: string;
}

export interface IAssignmentTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
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

export interface IDomainAssignment extends Document {
  assignmentId: string;
  domainSlug: string;
  moduleId: string;
  title: string;
  description: string;
  objective: string;
  type: 'web_coding' | 'backend_coding' | 'algorithmic' | 'fullstack';
  passingScore: number; // e.g. 70
  instructions: string[];
  starterFiles: IAssignmentStarterFile[];
  rubric: IAssignmentRubricItem[];
  testCases?: IAssignmentTestCase[];
  workspaceConfig?: IWorkspaceConfig;
  estimatedMinutes: number;
  status: 'published' | 'draft';
  source: 'ai_generated' | 'curriculum_curated';
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentStarterFileSchema = new Schema<IAssignmentStarterFile>(
  {
    filename: { type: String, required: true },
    language: { type: String, required: true },
    content: { type: String, default: '' }
  },
  { _id: false }
);

const AssignmentRubricItemSchema = new Schema<IAssignmentRubricItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    weight: { type: Number, required: true, default: 25 },
    verificationType: {
      type: String,
      enum: [
        'html_dom',
        'css_property',
        'js_function',
        'stdout',
        'unit_test',
        'keyword_match'
      ],
      required: true
    },
    targetIdentifier: { type: String },
    expectedValue: { type: String }
  },
  { _id: false }
);

const AssignmentTestCaseSchema = new Schema<IAssignmentTestCase>(
  {
    input: { type: String, default: '' },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false }
  },
  { _id: false }
);

const DomainAssignmentSchema = new Schema<IDomainAssignment>(
  {
    assignmentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    domainSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    moduleId: {
      type: String,
      required: true,
      index: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    objective: { type: String, required: true },
    type: {
      type: String,
      enum: ['web_coding', 'backend_coding', 'algorithmic', 'fullstack'],
      default: 'web_coding'
    },
    passingScore: { type: Number, default: 70 },
    instructions: { type: [String], default: [] },
    starterFiles: { type: [AssignmentStarterFileSchema], default: [] },
    rubric: { type: [AssignmentRubricItemSchema], default: [] },
    testCases: { type: [AssignmentTestCaseSchema], default: [] },
    workspaceConfig: { type: Schema.Types.Mixed },
    estimatedMinutes: { type: Number, default: 45 },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published'
    },
    source: {
      type: String,
      enum: ['ai_generated', 'curriculum_curated'],
      default: 'ai_generated'
    }
  },
  {
    timestamps: true
  }
);

DomainAssignmentSchema.index({ domainSlug: 1, moduleId: 1 }, { unique: true });

export const DomainAssignment = mongoose.model<IDomainAssignment>(
  'DomainAssignment',
  DomainAssignmentSchema
);
