/**
 * Pre-configured real-world datasets and relational schemas for Evalora domain workspaces.
 * Used in Data Science (Pandas, SQL) and AI/Machine Learning (NumPy, Scikit-Learn).
 */

export interface IWorkspaceDataset {
  id: string;
  name: string;
  filename: string;
  description: string;
  csvContent: string;
  columns: string[];
  rowCount: number;
  sampleRows: Record<string, any>[];
}

export interface ISqlSchemaTable {
  tableName: string;
  description: string;
  createSql: string;
  seedSql: string;
  columns: Array<{ name: string; type: string; isPrimary?: boolean }>;
  sampleRows: Record<string, any>[];
}

export const WORKSPACE_DATASETS: Record<string, IWorkspaceDataset> = {
  student_scores: {
    id: 'student_scores',
    name: 'Student Exam Performance',
    filename: 'student_scores.csv',
    description: 'Study hours, attendance percentage, previous quiz scores, and final exam performance for 20 students.',
    columns: ['student_id', 'hours_studied', 'attendance_pct', 'previous_score', 'exam_score'],
    rowCount: 20,
    csvContent: `student_id,hours_studied,attendance_pct,previous_score,exam_score
1,4.5,88,72,78
2,6.0,95,84,88
3,2.0,65,55,58
4,8.5,98,91,95
5,3.0,72,60,65
6,5.5,90,79,83
7,1.5,50,48,52
8,7.0,92,86,90
9,4.0,80,70,74
10,6.5,94,88,91
11,3.5,75,64,69
12,5.0,85,75,81
13,8.0,96,92,94
14,2.5,70,58,62
15,7.5,95,89,92
16,4.8,88,76,80
17,6.2,91,85,89
18,1.8,60,50,54
19,5.8,89,82,86
20,3.2,74,62,67`,
    sampleRows: [
      { student_id: 1, hours_studied: 4.5, attendance_pct: 88, previous_score: 72, exam_score: 78 },
      { student_id: 2, hours_studied: 6.0, attendance_pct: 95, previous_score: 84, exam_score: 88 },
      { student_id: 3, hours_studied: 2.0, attendance_pct: 65, previous_score: 55, exam_score: 58 },
      { student_id: 4, hours_studied: 8.5, attendance_pct: 98, previous_score: 91, exam_score: 95 },
      { student_id: 5, hours_studied: 3.0, attendance_pct: 72, previous_score: 60, exam_score: 65 }
    ]
  },
  housing_prices: {
    id: 'housing_prices',
    name: 'Residential Real Estate',
    filename: 'housing_prices.csv',
    description: 'Living area in square feet, bedrooms, bathrooms, location rating, and market selling price ($K).',
    columns: ['house_id', 'area_sqft', 'bedrooms', 'bathrooms', 'location_score', 'price_in_k'],
    rowCount: 15,
    csvContent: `house_id,area_sqft,bedrooms,bathrooms,location_score,price_in_k
101,1450,3,2,8.5,320
102,1850,4,2.5,9.0,410
103,950,2,1,7.0,210
104,2200,4,3,9.5,520
105,1200,3,1.5,7.8,275
106,1600,3,2,8.2,350
107,2600,5,3.5,9.8,610
108,1100,2,1,7.2,235
109,1750,3,2,8.7,390
110,2050,4,2.5,9.1,465
111,1350,3,2,8.0,295
112,2400,4,3,9.4,560
113,880,1,1,6.8,185
114,1950,4,2.5,8.9,435
115,1500,3,2,8.4,335`,
    sampleRows: [
      { house_id: 101, area_sqft: 1450, bedrooms: 3, bathrooms: 2, location_score: 8.5, price_in_k: 320 },
      { house_id: 102, area_sqft: 1850, bedrooms: 4, bathrooms: 2.5, location_score: 9.0, price_in_k: 410 },
      { house_id: 103, area_sqft: 950, bedrooms: 2, bathrooms: 1, location_score: 7.0, price_in_k: 210 },
      { house_id: 104, area_sqft: 2200, bedrooms: 4, bathrooms: 3, location_score: 9.5, price_in_k: 520 },
      { house_id: 105, area_sqft: 1200, bedrooms: 3, bathrooms: 1.5, location_score: 7.8, price_in_k: 275 }
    ]
  },
  customer_churn: {
    id: 'customer_churn',
    name: 'Customer Retention & Churn',
    filename: 'customer_churn.csv',
    description: 'Customer subscription tenure, monthly charges, customer service calls, and churn status (0 = Retained, 1 = Churned).',
    columns: ['customer_id', 'tenure_months', 'monthly_charges', 'support_calls', 'churn'],
    rowCount: 15,
    csvContent: `customer_id,tenure_months,monthly_charges,support_calls,churn
1001,24,65.5,1,0
1002,3,89.0,4,1
1003,36,45.0,0,0
1004,1,95.5,5,1
1005,18,70.2,2,0
1006,6,82.0,3,1
1007,48,55.0,1,0
1008,12,68.0,2,0
1009,2,99.0,4,1
1010,30,60.5,0,0
1011,8,75.0,3,1
1012,42,50.0,1,0
1013,15,64.0,2,0
1014,5,91.0,4,1
1015,22,67.5,1,0`,
    sampleRows: [
      { customer_id: 1001, tenure_months: 24, monthly_charges: 65.5, support_calls: 1, churn: 0 },
      { customer_id: 1002, tenure_months: 3, monthly_charges: 89.0, support_calls: 4, churn: 1 },
      { customer_id: 1003, tenure_months: 36, monthly_charges: 45.0, support_calls: 0, churn: 0 },
      { customer_id: 1004, tenure_months: 1, monthly_charges: 95.5, support_calls: 5, churn: 1 },
      { customer_id: 1005, tenure_months: 18, monthly_charges: 70.2, support_calls: 2, churn: 0 }
    ]
  }
};

export const SQL_SAMPLE_SCHEMA: ISqlSchemaTable[] = [
  {
    tableName: 'students',
    description: 'Undergraduate student roster with academic majors and grade point averages.',
    createSql: `CREATE TABLE IF NOT EXISTS students (
  student_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  gpa REAL NOT NULL,
  enrollment_year INTEGER NOT NULL
);`,
    seedSql: `INSERT INTO students VALUES 
(1, 'Alice', 'Chen', 'alice.chen@evalora.edu', 'Computer Science', 3.85, 2023),
(2, 'Bob', 'Kumar', 'bob.k@evalora.edu', 'Data Science', 3.62, 2022),
(3, 'Carla', 'Santos', 'carla.s@evalora.edu', 'Computer Science', 3.92, 2023),
(4, 'David', 'Miller', 'david.m@evalora.edu', 'Information Systems', 3.41, 2021),
(5, 'Elena', 'Rostova', 'elena.r@evalora.edu', 'Data Science', 3.78, 2022),
(6, 'Farhan', 'Ali', 'farhan.a@evalora.edu', 'Computer Science', 3.55, 2023),
(7, 'Grace', 'Hopper', 'grace.h@evalora.edu', 'Computer Science', 4.00, 2021),
(8, 'Henry', 'Tate', 'henry.t@evalora.edu', 'Information Systems', 3.25, 2022);`,
    columns: [
      { name: 'student_id', type: 'INTEGER', isPrimary: true },
      { name: 'first_name', type: 'TEXT' },
      { name: 'last_name', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'department', type: 'TEXT' },
      { name: 'gpa', type: 'REAL' },
      { name: 'enrollment_year', type: 'INTEGER' }
    ],
    sampleRows: [
      { student_id: 1, first_name: 'Alice', last_name: 'Chen', email: 'alice.chen@evalora.edu', department: 'Computer Science', gpa: 3.85, enrollment_year: 2023 },
      { student_id: 2, first_name: 'Bob', last_name: 'Kumar', email: 'bob.k@evalora.edu', department: 'Data Science', gpa: 3.62, enrollment_year: 2022 },
      { student_id: 3, first_name: 'Carla', last_name: 'Santos', email: 'carla.s@evalora.edu', department: 'Computer Science', gpa: 3.92, enrollment_year: 2023 }
    ]
  },
  {
    tableName: 'courses',
    description: 'Academic course catalog across departments.',
    createSql: `CREATE TABLE IF NOT EXISTS courses (
  course_id INTEGER PRIMARY KEY,
  course_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL,
  department TEXT NOT NULL
);`,
    seedSql: `INSERT INTO courses VALUES 
(101, 'CS101', 'Intro to Computer Science', 4, 'Computer Science'),
(102, 'CS201', 'Data Structures & Algorithms', 4, 'Computer Science'),
(103, 'DS101', 'Foundations of Data Science', 3, 'Data Science'),
(104, 'DS205', 'Applied Machine Learning', 4, 'Data Science'),
(105, 'IS301', 'Database Management Systems', 3, 'Information Systems');`,
    columns: [
      { name: 'course_id', type: 'INTEGER', isPrimary: true },
      { name: 'course_code', type: 'TEXT' },
      { name: 'title', type: 'TEXT' },
      { name: 'credits', type: 'INTEGER' },
      { name: 'department', type: 'TEXT' }
    ],
    sampleRows: [
      { course_id: 101, course_code: 'CS101', title: 'Intro to Computer Science', credits: 4, department: 'Computer Science' },
      { course_id: 102, course_code: 'CS201', title: 'Data Structures & Algorithms', credits: 4, department: 'Computer Science' },
      { course_id: 103, course_code: 'DS101', title: 'Foundations of Data Science', credits: 3, department: 'Data Science' }
    ]
  },
  {
    tableName: 'enrollments',
    description: 'Student course registrations and final letter grades.',
    createSql: `CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade TEXT NOT NULL,
  semester TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);`,
    seedSql: `INSERT INTO enrollments VALUES 
(1, 1, 101, 'A', 'Fall 2023'),
(2, 1, 102, 'A-', 'Spring 2024'),
(3, 2, 103, 'B+', 'Fall 2023'),
(4, 2, 104, 'A', 'Spring 2024'),
(5, 3, 101, 'A', 'Fall 2023'),
(6, 4, 105, 'B', 'Fall 2023'),
(7, 5, 103, 'A', 'Fall 2023'),
(8, 7, 102, 'A+', 'Spring 2024');`,
    columns: [
      { name: 'enrollment_id', type: 'INTEGER', isPrimary: true },
      { name: 'student_id', type: 'INTEGER' },
      { name: 'course_id', type: 'INTEGER' },
      { name: 'grade', type: 'TEXT' },
      { name: 'semester', type: 'TEXT' }
    ],
    sampleRows: [
      { enrollment_id: 1, student_id: 1, course_id: 101, grade: 'A', semester: 'Fall 2023' },
      { enrollment_id: 2, student_id: 1, course_id: 102, grade: 'A-', semester: 'Spring 2024' },
      { enrollment_id: 3, student_id: 2, course_id: 103, grade: 'B+', semester: 'Fall 2023' }
    ]
  },
  {
    tableName: 'employees',
    description: 'Staff directory with departmental salary compensation.',
    createSql: `CREATE TABLE IF NOT EXISTS employees (
  employee_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  salary INTEGER NOT NULL,
  hire_date TEXT NOT NULL
);`,
    seedSql: `INSERT INTO employees VALUES 
(1, 'Jordan Smith', 'Engineering', 95000, '2021-03-15'),
(2, 'Morgan Vance', 'Engineering', 105000, '2019-06-01'),
(3, 'Sam Taylor', 'Data Science', 98000, '2020-11-12'),
(4, 'Robin Lee', 'Design', 82000, '2022-01-10'),
(5, 'Casey Brown', 'Data Science', 112000, '2018-08-20'),
(6, 'Dana White', 'Marketing', 78000, '2023-04-05'),
(7, 'Alex Rivera', 'Engineering', 115000, '2017-09-14');`,
    columns: [
      { name: 'employee_id', type: 'INTEGER', isPrimary: true },
      { name: 'name', type: 'TEXT' },
      { name: 'department', type: 'TEXT' },
      { name: 'salary', type: 'INTEGER' },
      { name: 'hire_date', type: 'TEXT' }
    ],
    sampleRows: [
      { employee_id: 1, name: 'Jordan Smith', department: 'Engineering', salary: 95000, hire_date: '2021-03-15' },
      { employee_id: 2, name: 'Morgan Vance', department: 'Engineering', salary: 105000, hire_date: '2019-06-01' },
      { employee_id: 3, name: 'Sam Taylor', department: 'Data Science', salary: 98000, hire_date: '2020-11-12' }
    ]
  }
];
