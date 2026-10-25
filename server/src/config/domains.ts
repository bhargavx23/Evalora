import { Domain, IDomain } from '../models/Domain.js';
import { logger } from '../utils/logger.js';

export const INITIAL_DOMAINS = [
  {
    slug: 'mern-stack',
    name: 'MERN Stack Development',
    shortDescription:
      'Learn and practise MongoDB, Express.js, React.js, Node.js, REST APIs, and full-stack application development from absolute scratch.',
    description:
      'A complete, sequential 8-stage career path starting from zero web knowledge: HTML fundamentals, CSS layouts, modern JavaScript, developer tools, React components, Node.js runtime, Express REST APIs, MongoDB modeling, and full-stack integration.',
    technologies: ['HTML5', 'CSS3', 'JavaScript', 'Git', 'React.js', 'Node.js', 'Express.js', 'MongoDB', 'REST APIs'],
    overview:
      'Master the complete JavaScript stack through structured, progressive learning: build semantic web pages, style responsive layouts, program dynamic interactivity, and deliver production full-stack systems.',
    icon: 'layers',
    badge: 'Popular Full-Stack Track',
    active: true,
    order: 1,
    modules: [
      {
        moduleId: 'mern-m1-web-fundamentals',
        title: 'Module 1: Web Fundamentals (HTML, CSS & JavaScript from Scratch)',
        description:
          'Zero-knowledge foundation: what the web is, HTML elements, semantic HTML, CSS box model & Flexbox layouts, JavaScript fundamentals, DOM manipulation, browser events, async/await, and developer tools.',
        order: 1,
        topics: [
          'What is the Web',
          'HTML',
          'HTML Document Structure',
          'Tags and Elements',
          'Semantic HTML',
          'CSS',
          'CSS Box Model & Flexbox',
          'JavaScript fundamentals',
          'DOM',
          'Browser Events & Interactivity',
          'Async/await',
          'Developer Tools & Git Basics'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 24
      },
      {
        moduleId: 'mern-m2-react',
        title: 'Module 2: React.js (Stage E — React from Scratch)',
        description:
          'Why React exists, virtual DOM, components from scratch, JSX syntax, props, state, hooks, forms, routing, and Context API.',
        order: 2,
        topics: [
          'Why React Exists & The Virtual DOM',
          'Components',
          'JSX',
          'Props and State',
          'Hooks',
          'Context API',
          'Events & Form Handling in React',
          'Conditional Rendering & Lists',
          'API Integration & Loading States'
        ],
        exerciseTypes: ['mcq', 'coding', 'project'],
        estimatedHours: 22
      },
      {
        moduleId: 'mern-m3-nodejs',
        title: 'Module 3: Node.js (Stage F — Node.js from Scratch)',
        description:
          'Server-side JavaScript from scratch: Node.js runtime, event loop, CommonJS & ESM modules, file system, streams, and npm.',
        order: 3,
        topics: [
          'Node.js Fundamentals',
          'Runtime',
          'Event loop',
          'Modules',
          'File system',
          'Streams',
          'npm Packages'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 16
      },
      {
        moduleId: 'mern-m4-express',
        title: 'Module 4: Express.js (Stage F — Express.js from Scratch)',
        description:
          'Express servers from scratch: routing, middleware pipelines, REST APIs, JSON parsing, authentication, and error handling.',
        order: 4,
        topics: [
          'Express Setup & Architecture',
          'Routing',
          'Middleware',
          'REST APIs',
          'Error handling',
          'Auth',
          'JWT Verification & Security'
        ],
        exerciseTypes: ['mcq', 'coding', 'project'],
        estimatedHours: 18
      },
      {
        moduleId: 'mern-m5-mongodb',
        title: 'Module 5: MongoDB (Stage G — MongoDB from Scratch)',
        description:
          'Databases from scratch: NoSQL concepts, MongoDB collections, CRUD operations, Mongoose schemas, queries, aggregation, and indexing.',
        order: 5,
        topics: [
          'Databases from Scratch',
          'NoSQL concepts',
          'CRUD',
          'Schemas',
          'Mongoose Models & Validation',
          'Aggregation',
          'Indexing'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 16
      },
      {
        moduleId: 'mern-m6-fullstack-integration',
        title: 'Module 6: Full-Stack Integration (Stage H — Complete MERN Development)',
        description:
          'Connecting React client to Express backend: API integration, state management, CORS, JWT authentication tokens, full-stack workflow, and error boundaries.',
        order: 6,
        topics: [
          'API integration',
          'State management',
          'CORS',
          'JWT auth',
          'Full-Stack Data Flow',
          'Error Boundaries & Production Prep'
        ],
        exerciseTypes: ['project', 'coding'],
        estimatedHours: 20
      },
      {
        moduleId: 'mern-m7-projects',
        title: 'Module 7: Projects and Practical Tasks',
        description:
          'Real-world portfolio projects built step-by-step: Todo App, Auth Interface, REST API, Notes App, and end-to-end MERN application.',
        order: 7,
        topics: [
          'Todo App Architecture',
          'Auth Interface Implementation',
          'REST API Construction',
          'Notes App Full-Stack',
          'End-to-End MERN Application'
        ],
        exerciseTypes: ['project', 'coding'],
        estimatedHours: 25
      }
    ],
    projects: [
      {
        projectId: 'mern-proj-todo',
        title: 'Todo Application',
        description: 'Build a responsive React task management interface with state persistence, filters, and counter.',
        difficulty: 'easy',
        starterFiles: [
          {
            filename: 'index.html',
            language: 'html',
            content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Todo App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="app.js"></script>\n</body>\n</html>'
          },
          {
            filename: 'style.css',
            language: 'css',
            content: 'body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }\n.todo-card { max-width: 480px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 12px; }\ninput { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: white; margin-bottom: 12px; }\nbutton { background: #6366f1; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; }\n.todo-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }'
          },
          {
            filename: 'app.js',
            language: 'javascript',
            content: 'const root = document.getElementById("root");\nroot.innerHTML = `\n  <div class="todo-card">\n    <h2>Evalora Task Manager</h2>\n    <div style="display:flex; gap:8px;">\n      <input id="todo-input" placeholder="What needs to be done?" />\n      <button id="add-btn">Add</button>\n    </div>\n    <ul id="todo-list" style="list-style:none; padding:0; margin-top:16px;"></ul>\n    <p id="counter" style="font-size:12px; color:#94a3b8;">0 items remaining</p>\n  </div>\n`;\n\nconst input = document.getElementById("todo-input");\nconst addBtn = document.getElementById("add-btn");\nconst list = document.getElementById("todo-list");\nconst counter = document.getElementById("counter");\n\nlet todos = [];\n\nfunction render() {\n  list.innerHTML = todos.map((t, i) => `\n    <li class="todo-item">\n      <span>${t}</span>\n      <button style="background:#ef4444; padding:4px 8px;" onclick="removeTodo(${i})">✕</button>\n    </li>\n  `).join("");\n  counter.innerText = `${todos.length} items remaining`;\n}\n\nwindow.removeTodo = (index) => {\n  todos.splice(index, 1);\n  render();\n};\n\naddBtn.onclick = () => {\n  const text = input.value.trim();\n  if (text) {\n    todos.push(text);\n    input.value = "";\n    render();\n  }\n};'
          }
        ],
        tasks: [
          {
            taskId: 't1',
            title: 'Build the Task Interface',
            description: 'Render the input field, add button, and task list elements inside the card container.',
            hint: 'Ensure elements have appropriate IDs (#todo-input, #add-btn, #todo-list).',
            testCriteria: 'Card contains input, button, and list elements.'
          },
          {
            taskId: 't2',
            title: 'Add & Remove Tasks dynamically',
            description: 'Implement dynamic addition of new tasks and item removal with updating remaining counter.',
            hint: 'Update state array and call render().',
            testCriteria: 'Tasks can be added and removed from the active list.'
          }
        ],
        evaluationType: 'frontend'
      },
      {
        projectId: 'mern-proj-auth',
        title: 'Authentication Interface',
        description: 'Build a secure client-side login and registration form with input validation, password toggle, and loading state.',
        difficulty: 'medium',
        starterFiles: [
          {
            filename: 'index.html',
            language: 'html',
            content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Auth Interface</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="auth-app"></div>\n  <script type="module" src="auth.js"></script>\n</body>\n</html>'
          },
          {
            filename: 'style.css',
            language: 'css',
            content: 'body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }\n.auth-card { background: #111827; border: 1px solid #1f2937; padding: 32px; border-radius: 12px; width: 100%; max-width: 400px; }\n.form-group { margin-bottom: 16px; }\nlabel { display: block; font-size: 13px; color: #9ca3af; margin-bottom: 6px; }\ninput { width: 100%; padding: 10px 12px; border: 1px solid #374151; border-radius: 6px; background: #1f2937; color: white; box-sizing: border-box; }\n.btn { width: 100%; padding: 12px; border: none; border-radius: 6px; background: #4f46e5; color: white; font-weight: 600; cursor: pointer; }\n.error-msg { color: #f87171; font-size: 12px; margin-top: 4px; display: none; }'
          },
          {
            filename: 'auth.js',
            language: 'javascript',
            content: 'const app = document.getElementById("auth-app");\napp.innerHTML = `\n  <div class="auth-card">\n    <h2>Sign In to Evalora</h2>\n    <form id="login-form">\n      <div class="form-group">\n        <label for="email">Email Address</label>\n        <input id="email" type="email" placeholder="student@example.com" required />\n        <div id="email-err" class="error-msg">Please enter a valid email.</div>\n      </div>\n      <div class="form-group">\n        <label for="password">Password</label>\n        <input id="password" type="password" placeholder="••••••••" required />\n        <div id="pwd-err" class="error-msg">Password must be at least 8 characters.</div>\n      </div>\n      <button type="submit" id="submit-btn" class="btn">Sign In</button>\n      <p id="status-msg" style="text-align:center; font-size:13px; margin-top:12px;"></p>\n    </form>\n  </div>\n`;\n\nconst form = document.getElementById("login-form");\nconst emailInput = document.getElementById("email");\nconst pwdInput = document.getElementById("password");\nconst statusMsg = document.getElementById("status-msg");\n\nform.onsubmit = (e) => {\n  e.preventDefault();\n  const email = emailInput.value;\n  const pwd = pwdInput.value;\n  let valid = true;\n  \n  if (!email.includes("@")) {\n    document.getElementById("email-err").style.display = "block";\n    valid = false;\n  } else {\n    document.getElementById("email-err").style.display = "none";\n  }\n  \n  if (pwd.length < 8) {\n    document.getElementById("pwd-err").style.display = "block";\n    valid = false;\n  } else {\n    document.getElementById("pwd-err").style.display = "none";\n  }\n  \n  if (valid) {\n    statusMsg.style.color = "#34d399";\n    statusMsg.innerText = "Validation Passed! Credentials secure.";\n  }\n};'
          }
        ],
        tasks: [
          {
            taskId: 't1',
            title: 'Input Validation & Error Feedback',
            description: 'Validate email formatting and enforce minimum password length with real-time error states.',
            hint: 'Show error-msg when validation fails.',
            testCriteria: 'Form validates email and enforces password length constraint.'
          },
          {
            taskId: 't2',
            title: 'Submission & Loading Feedback',
            description: 'Simulate asynchronous authentication request with pending and success UI states.',
            hint: 'Disable button during submit.',
            testCriteria: 'UI reflects loading and authenticated success state.'
          }
        ],
        evaluationType: 'frontend'
      },
      {
        projectId: 'mern-proj-rest-api',
        title: 'REST API & CRUD Services',
        description: 'Implement Express route handlers for product/user resource management with validation and proper HTTP codes.',
        difficulty: 'medium',
        starterFiles: [
          {
            filename: 'routes.js',
            language: 'javascript',
            content: '/**\n * Express REST API Controller for Resource Management\n */\nconst items = [\n  { id: "1", name: "Algorithm Toolkit", category: "DSA", price: 0 },\n  { id: "2", name: "System Design Handbook", category: "Architecture", price: 2 }\n];\n\nexport function getItems(req, res) {\n  res.json({ success: true, count: items.length, data: items });\n}\n\nexport function getItemById(req, res) {\n  const item = items.find(i => i.id === req.params.id);\n  if (!item) return res.status(404).json({ success: false, message: "Not found" });\n  res.json({ success: true, data: item });\n}\n\nexport function createItem(req, res) {\n  const { name, category, price } = req.body || {};\n  if (!name || typeof name !== "string") {\n    return res.status(400).json({ success: false, message: "Name is required" });\n  }\n  const newItem = { id: String(Date.now()), name, category: category || "General", price: Number(price) || 0 };\n  items.push(newItem);\n  res.status(201).json({ success: true, data: newItem });\n}\n'
          }
        ],
        tasks: [
          {
            taskId: 't1',
            title: 'Resource GET and Query Handlers',
            description: 'Implement list filtering and 404 response on missing item lookup.',
            hint: 'Use Array.prototype.find and appropriate HTTP status.',
            testCriteria: 'Returns 200 with data array and 404 for unknown IDs.'
          },
          {
            taskId: 't2',
            title: 'Resource POST with Validation',
            description: 'Validate required fields and return 201 Created on valid resource insertion.',
            hint: 'Check typeof name and return 400 when missing.',
            testCriteria: 'Returns 201 with newly created object and 400 on invalid input.'
          }
        ],
        evaluationType: 'backend'
      },
      {
        projectId: 'mern-proj-fullstack-notes',
        title: 'Full-Stack Notes Application',
        description: 'Complete end-to-end integration: React note cards, REST endpoints, and MongoDB document persistence.',
        difficulty: 'hard',
        starterFiles: [
          {
            filename: 'index.html',
            language: 'html',
            content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Full-Stack Notes</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="notes-container"></div>\n  <script type="module" src="notesApp.js"></script>\n</body>\n</html>'
          },
          {
            filename: 'style.css',
            language: 'css',
            content: 'body { font-family: system-ui; background: #0f172a; color: #e2e8f0; padding: 20px; }\n.notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 16px; }\n.note-card { background: #1e293b; border-radius: 8px; padding: 16px; border: 1px solid #334155; }\n.note-title { font-weight: bold; margin-bottom: 8px; color: #38bdf8; }'
          },
          {
            filename: 'notesApp.js',
            language: 'javascript',
            content: 'const container = document.getElementById("notes-container");\ncontainer.innerHTML = `\n  <h2>Evalora Study Notes</h2>\n  <div style="display:flex; gap:8px;">\n    <input id="note-title" placeholder="Topic title" style="padding:8px; border-radius:4px; border:1px solid #475569; background:#1e293b; color:white;" />\n    <input id="note-body" placeholder="Key takeaways..." style="padding:8px; border-radius:4px; border:1px solid #475569; background:#1e293b; color:white; flex:1;" />\n    <button id="save-note-btn" style="background:#0ea5e9; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Save Note</button>\n  </div>\n  <div id="grid" class="notes-grid"></div>\n`;\n\nconst notes = [\n  { id: "1", title: "React Virtual DOM", content: "Batched updates improve rendering performance." },\n  { id: "2", title: "MongoDB Indexes", content: "Compound indexes significantly reduce B-tree scan operations." }\n];\n\nfunction renderNotes() {\n  const grid = document.getElementById("grid");\n  grid.innerHTML = notes.map(n => `\n    <div class="note-card">\n      <div class="note-title">${n.title}</div>\n      <p style="font-size:14px; color:#94a3b8; margin:0;">${n.content}</p>\n    </div>\n  `).join("");\n}\n\ndocument.getElementById("save-note-btn").onclick = () => {\n  const t = document.getElementById("note-title").value.trim();\n  const b = document.getElementById("note-body").value.trim();\n  if (t && b) {\n    notes.unshift({ id: String(Date.now()), title: t, content: b });\n    renderNotes();\n    document.getElementById("note-title").value = "";\n    document.getElementById("note-body").value = "";\n  }\n};\n\nrenderNotes();'
          }
        ],
        tasks: [
          {
            taskId: 't1',
            title: 'Note Card UI & Form State',
            description: 'Implement note creation with title, content body, and dynamic grid rendering.',
            hint: 'Maintain notes array and re-render on save.',
            testCriteria: 'Notes grid displays saved cards with title and content.'
          },
          {
            taskId: 't2',
            title: 'Persistence Integration',
            description: 'Connect save action to API client and handle network states.',
            hint: 'Dispatch async create request and update local list on success.',
            testCriteria: 'Data persists across user sessions.'
          }
        ],
        evaluationType: 'fullstack'
      }
    ],
    assessments: [
      {
        assessmentId: 'mern-midterm-eval',
        title: 'MERN Stack Mid-Term Certification Assessment',
        description: 'Comprehensive 45-minute timed examination evaluating React components, Express routing, and MongoDB querying.',
        durationMinutes: 45,
        passingScore: 70,
        topics: ['React Components', 'Hooks', 'Express Routing', 'MongoDB Aggregation', 'Async JavaScript']
      },
      {
        assessmentId: 'mern-fullstack-final',
        title: 'MERN Full-Stack Industry Readiness Assessment',
        description: 'Rigorous 60-minute practical exam testing architectural design, security headers, CORS, JWT auth, and Mongoose indexing.',
        durationMinutes: 60,
        passingScore: 75,
        topics: ['Full-Stack Integration', 'JWT Authentication', 'Performance Optimization', 'Error Handling', 'Deployment']
      }
    ]
  },
  {
    slug: 'ai-machine-learning',
    name: 'AI and Machine Learning',
    shortDescription:
      'Master Python from scratch, essential mathematics, NumPy, feature engineering, model training, evaluation, and production deployment.',
    description:
      'Designed for absolute beginners: starts with Python fundamentals and linear algebra intuition before moving into data preparation, regression, classification, and neural pipelines.',
    technologies: ['Python', 'NumPy', 'Pandas', 'Scikit-Learn', 'Linear Algebra', 'Statistics', 'Model Evaluation'],
    overview:
      'Learn how machine learning models actually learn patterns from data: program Python from scratch, manipulate multi-dimensional vectors, and build complete Scikit-Learn pipelines.',
    icon: 'cpu',
    badge: 'High Demand',
    active: true,
    order: 2,
    modules: [
      {
        moduleId: 'aiml-m1-python-scratch',
        title: 'Module 1: Python from Scratch for AI',
        description: 'What Python is, variables, data types, print statements, control flow, functions, lists, dictionaries, and file handling.',
        order: 1,
        topics: [
          'What is Python & Setting Up',
          'Variables, Numbers & Strings',
          'Booleans & Comparison Operators',
          'If, Else & Decision Making',
          'While & For Loops',
          'Functions & Return Values',
          'Lists, Tuples & Dictionaries',
          'File Reading & Basic Error Handling'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 12
      },
      {
        moduleId: 'aiml-m2-numpy-processing',
        title: 'Module 2: Essential Mathematics, Vectors & NumPy Processing',
        description: 'Intuitive linear algebra: scalars, vectors, matrices, dot products, NumPy multidimensional arrays, slicing, broadcasting, and matrix operations.',
        order: 2,
        topics: [
          'Scalars vs Vectors Intuition',
          'Vector Addition & Dot Products',
          'Matrices & Linear Transformations',
          'Why NumPy: Fast Vectorized Math',
          'Array Shapes, Reshaping & Slicing',
          'Broadcasting Rules Explained Simply',
          'Matrix Operations with NumPy'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'aiml-m3-statistics',
        title: 'Module 3: Descriptive Statistics & Data Exploration',
        description: 'Mean, median, mode, variance, standard deviation, normal distributions, percentiles, and outlier detection.',
        order: 3,
        topics: [
          'Measures of Central Tendency',
          'Measures of Spread: Variance & Std Dev',
          'Normal Distributions & The Bell Curve',
          'Probability Basics & Bayes Theorem',
          'Detecting Outliers in Datasets'
        ],
        exerciseTypes: ['mcq', 'interview'],
        estimatedHours: 14
      },
      {
        moduleId: 'aiml-m4-data-prep',
        title: 'Module 4: Data Preparation & Feature Engineering',
        description: 'Handling missing values, categorical encoding, feature scaling, normalization, and train/test splitting.',
        order: 4,
        topics: [
          'Missing Value Imputation',
          'One-Hot & Label Encoding',
          'MinMax Scaling vs Standardization',
          'Train/Test Dataset Splitting',
          'Preventing Data Leakage'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'aiml-m5-ml-concepts',
        title: 'Module 5: Supervised & Unsupervised Machine Learning',
        description: 'Linear regression, logistic regression, decision trees, random forests, clustering, and the bias-variance tradeoff.',
        order: 5,
        topics: [
          'Supervised vs Unsupervised Learning',
          'Linear Regression & Cost Functions',
          'Logistic Regression & Binary Classification',
          'Decision Trees & Random Forests',
          'Overfitting vs Underfitting',
          'L1 and L2 Regularization'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 20
      },
      {
        moduleId: 'aiml-m6-model-eval',
        title: 'Module 6: Model Training, Evaluation & Tuning',
        description: 'Confusion matrices, precision, recall, F1 score, ROC-AUC, K-Fold cross validation, and grid search.',
        order: 6,
        topics: [
          'The Confusion Matrix Explained',
          'Precision vs Recall Tradeoffs',
          'F1 Score & ROC-AUC Curves',
          'K-Fold Cross Validation',
          'Hyperparameter Tuning with Grid Search'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'aiml-m7-deployment',
        title: 'Module 7: Practical ML Workflows & Model Deployment',
        description: 'Building end-to-end Scikit-Learn pipelines, saving models with joblib/pickle, and writing inference endpoints.',
        order: 7,
        topics: [
          'Scikit-Learn Pipelines',
          'Model Serialization with Joblib',
          'Building Prediction Functions',
          'Testing ML Models with Edge Cases',
          'Model Monitoring & Drift Concepts'
        ],
        exerciseTypes: ['project', 'coding'],
        estimatedHours: 22
      }
    ],
    projects: [
      {
        projectId: 'aiml-proj-churn',
        title: 'Customer Churn Prediction Model',
        description: 'Build a Scikit-Learn pipeline to predict customer attrition with data cleaning, feature scaling, and ROC evaluation.',
        difficulty: 'medium',
        starterFiles: [
          {
            filename: 'solution.py',
            language: 'python',
            content: 'import numpy as np\n\ndef sigmoid(z):\n    return 1 / (1 + np.exp(-z))\n\ndef compute_accuracy(y_true, y_pred):\n    return np.mean(y_true == y_pred)\n\nprint("Sigmoid at 0:", sigmoid(0))\n'
          }
        ],
        tasks: [
          {
            taskId: 't1',
            title: 'Implement Activation and Metrics',
            description: 'Write sigmoid and precision/recall evaluation functions in pure NumPy.',
            hint: 'np.sum(np.logical_and(y_true == 1, y_pred == 1))',
            testCriteria: 'Calculates metrics matching standard formulas.'
          }
        ],
        evaluationType: 'backend'
      }
    ],
    assessments: [
      {
        assessmentId: 'aiml-readiness-exam',
        title: 'AI & Machine Learning Assessment',
        description: 'Timed assessment covering feature engineering, model selection, loss functions, and evaluation metrics.',
        durationMinutes: 50,
        passingScore: 70,
        topics: ['Supervised Learning', 'NumPy Vectorization', 'Bias-Variance Tradeoff', 'Evaluation Metrics']
      }
    ]
  },
  {
    slug: 'data-science',
    name: 'Data Science',
    shortDescription:
      'Learn SQL from scratch, Pandas data wrangling, data visualization, and applied hypothesis testing.',
    description:
      'Step-by-step data science for beginners: start with fundamental SQL queries and tabular data concepts, progress through Pandas transformations, and build executive insight dashboards.',
    technologies: ['SQL', 'Python', 'Pandas', 'Matplotlib', 'Seaborn', 'Statistics', 'EDA'],
    overview:
      'Extract data from relational databases, transform messy datasets with Pandas, visualize key distributions, and test business hypotheses with statistical rigor.',
    icon: 'bar-chart',
    badge: 'Analytical Track',
    active: true,
    order: 3,
    modules: [
      {
        moduleId: 'ds-m1-sql-scratch',
        title: 'Module 1: SQL from Scratch for Data Analysis',
        description: 'What a relational database is, tables, columns, rows, SELECT, WHERE, comparison operators, ORDER BY, LIMIT, and aggregate functions.',
        order: 1,
        topics: [
          'What is a Relational Database',
          'SELECT and FROM Statements',
          'Filtering Rows with WHERE',
          'Operators: AND, OR, NOT, BETWEEN',
          'Sorting with ORDER BY & Limiting Rows',
          'Aggregate Functions: COUNT, SUM, AVG, MIN, MAX',
          'GROUP BY & HAVING Clauses'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 14
      },
      {
        moduleId: 'ds-m2-advanced-sql',
        title: 'Module 2: Relational Joins & Data Extraction',
        description: 'Combining tables with INNER JOIN, LEFT JOIN, FULL JOIN, subqueries, Common Table Expressions (CTEs), and window functions.',
        order: 2,
        topics: [
          'Why Joins Exist & Primary/Foreign Keys',
          'INNER JOIN vs LEFT JOIN',
          'Multi-Table Joins & Aliases',
          'Subqueries & Nested SELECTs',
          'Common Table Expressions (WITH CTE)',
          'Window Functions: ROW_NUMBER & RANK'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'ds-m3-pandas-scratch',
        title: 'Module 3: Python & Pandas from Scratch',
        description: 'DataFrames, Series, reading CSV files, inspecting data, selecting columns, filtering rows, and handling missing values.',
        order: 3,
        topics: [
          'What is Pandas & The DataFrame Concept',
          'Loading CSV Files into DataFrames',
          'Inspecting Data: head, info & describe',
          'Selecting Columns & Row Filtering with loc/iloc',
          'Handling Missing Values: dropna & fillna'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'ds-m4-eda-transformation',
        title: 'Module 4: Exploratory Data Analysis & Transformation',
        description: 'GroupBy operations, merging datasets, pivot tables, string operations, and date/time manipulation.',
        order: 4,
        topics: [
          'GroupBy Aggregations in Pandas',
          'Merging & Concatenating DataFrames',
          'Pivot Tables & Reshaping Data',
          'String Methods for Text Columns',
          'Working with DateTime Columns'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'ds-m5-visualization',
        title: 'Module 5: Data Visualization & Storytelling',
        description: 'Creating effective charts with Matplotlib and Seaborn: line plots, bar charts, histograms, scatter plots, and heatmaps.',
        order: 5,
        topics: [
          'Choosing the Right Chart for Your Data',
          'Matplotlib Basics: Line & Bar Charts',
          'Histograms & Distribution Plots',
          'Scatter Plots & Correlation Heatmaps with Seaborn',
          'Formatting Titles, Labels & Colors for Clarity'
        ],
        exerciseTypes: ['mcq', 'interview'],
        estimatedHours: 14
      },
      {
        moduleId: 'ds-m6-applied-statistics',
        title: 'Module 6: Applied Statistics & Hypothesis Testing',
        description: 'Confidence intervals, normal distributions, p-values, t-tests, A/B testing methodologies, and avoiding false positives.',
        order: 6,
        topics: [
          'Sampling, Populations & The Central Limit Theorem',
          'Confidence Intervals & Margin of Error',
          'Formulating Null and Alternative Hypotheses',
          'P-Values & Statistical Significance',
          'Designing and Analyzing A/B Tests'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 18
      }
    ],
    projects: [],
    assessments: []
  },
  {
    slug: 'frontend-development',
    name: 'Frontend Development',
    shortDescription:
      'Learn HTML, CSS, JavaScript, browser devtools, React, accessibility, and modern responsive design from scratch.',
    description:
      'A thorough, beginner-focused path starting with markup structure, progressive CSS styling, modern ECMAScript, and ending with component-driven React engineering.',
    technologies: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Tailwind CSS', 'Web APIs', 'Accessibility'],
    overview:
      'Build responsive, accessible, high-performance web applications that look stunning across all mobile, tablet, and desktop viewports.',
    icon: 'monitor',
    badge: 'Core Frontend',
    active: true,
    order: 4,
    modules: [
      {
        moduleId: 'fe-m1-html-scratch',
        title: 'Module 1: HTML from Scratch & Web Semantics',
        description: 'Web document structure, tags, elements, attributes, headings, links, lists, forms, semantic tags, and accessibility.',
        order: 1,
        topics: [
          'How the Browser Works',
          'HTML Document Structure',
          'Tags, Elements & Attributes',
          'Headings, Paragraphs & Text Formatting',
          'Links, Anchors & Image Elements',
          'Forms, Inputs, Labels & Buttons',
          'Semantic HTML Architecture',
          'Accessibility (ARIA & Screen Readers)'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 12
      },
      {
        moduleId: 'fe-m2-css-scratch',
        title: 'Module 2: CSS from Scratch & Responsive Layouts',
        description: 'CSS selectors, the box model, margin/padding/borders, display, Flexbox, Grid, and mobile-first media queries.',
        order: 2,
        topics: [
          'What CSS is & How It Applies to HTML',
          'CSS Selectors, Specificity & The Cascade',
          'The Box Model: Content, Padding, Border, Margin',
          'Flexbox Layouts from Scratch',
          'CSS Grid for 2D Layouts',
          'Responsive Design & Media Queries',
          'Transitions, Hover States & Clean Code'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'fe-m3-js-scratch',
        title: 'Module 3: JavaScript from Scratch & DOM Manipulation',
        description: 'Variables, data types, conditions, loops, functions, array methods, selecting DOM elements, and event listeners.',
        order: 3,
        topics: [
          'Variables, Data Types & Operators',
          'If/Else Conditions & Comparisons',
          'Functions, Parameters & Return Values',
          'Arrays, Objects & Iteration',
          'Selecting Elements: querySelector & getElementById',
          'Modifying Elements: textContent, innerHTML & classList',
          'Event Listeners & User Interaction'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'fe-m4-modern-js-async',
        title: 'Module 4: Modern JavaScript & Asynchronous APIs',
        description: 'ES6+ features, arrow functions, destructuring, promises, async/await, Fetch API, and LocalStorage.',
        order: 4,
        topics: [
          'Arrow Functions & Template Literals',
          'Destructuring & Spread Operator',
          'Array Methods: map, filter & reduce',
          'Promises & Asynchronous Programming',
          'Async/Await & Fetching Remote APIs',
          'Browser Storage: LocalStorage & SessionStorage'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 18
      },
      {
        moduleId: 'fe-m5-react-scratch',
        title: 'Module 5: React from Scratch & Component Architecture',
        description: 'Virtual DOM, JSX, components, props, useState, event handling, conditional rendering, lists, and useEffect.',
        order: 5,
        topics: [
          'Why React: Declarative UI vs Imperative DOM',
          'Components & JSX Syntax',
          'Props & Data Passing Between Components',
          'State Management with useState',
          'Handling Forms & Input Events in React',
          'Conditional Rendering & Lists with Keys',
          'Side Effects with useEffect',
          'Custom Hooks & Component Composition'
        ],
        exerciseTypes: ['mcq', 'coding', 'project'],
        estimatedHours: 22
      },
      {
        moduleId: 'fe-m6-performance-deploy',
        title: 'Module 6: Web Performance, Accessibility & Production',
        description: 'Core Web Vitals, image optimization, code splitting, bundling, and production deployment.',
        order: 6,
        topics: [
          'Core Web Vitals (LCP, INP, CLS)',
          'Image Optimization & Lazy Loading',
          'Bundle Optimization & Code Splitting',
          'End-to-End Accessibility Auditing',
          'Production Builds & Deployment'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 14
      }
    ],
    projects: [],
    assessments: []
  },
  {
    slug: 'backend-development',
    name: 'Backend Development',
    shortDescription:
      'Learn HTTP fundamentals, Node.js, Express servers, REST APIs, databases, authentication, and backend security from scratch.',
    description:
      'From how the internet works to building scalable RESTful microservices: client-server communication, Node.js event loop, Express routing, database persistence, and JWT authentication.',
    technologies: ['Node.js', 'Express', 'HTTP', 'MongoDB', 'PostgreSQL', 'JWT', 'REST APIs'],
    overview:
      'Architect robust server applications: parse incoming client requests, implement defensive validation, interact with databases, and secure endpoints with token authentication.',
    icon: 'server',
    badge: 'Architecture Track',
    active: true,
    order: 5,
    modules: [
      {
        moduleId: 'be-m1-network-http',
        title: 'Module 1: Client-Server Fundamentals & HTTP',
        description: 'How the internet works, DNS, TCP/IP, clients, servers, HTTP request/response cycle, methods, headers, and status codes.',
        order: 1,
        topics: [
          'How the Internet Works: Clients and Servers',
          'The HTTP Request/Response Cycle',
          'HTTP Methods: GET, POST, PUT, PATCH, DELETE',
          'HTTP Headers & Content-Types (JSON)',
          'HTTP Status Codes: 2xx, 3xx, 4xx, 5xx'
        ],
        exerciseTypes: ['mcq', 'interview'],
        estimatedHours: 12
      },
      {
        moduleId: 'be-m2-nodejs-scratch',
        title: 'Module 2: Node.js from Scratch & Runtime Architecture',
        description: 'The V8 JavaScript runtime, non-blocking I/O, the Event Loop, core modules (fs, path), CommonJS vs ESM, and npm.',
        order: 2,
        topics: [
          'What is Node.js & Why It Runs JavaScript Outside the Browser',
          'The Event Loop & Non-Blocking Asynchronous I/O',
          'Working with Core Modules: fs and path',
          'CommonJS (require) vs ES Modules (import)',
          'Managing Dependencies with npm and package.json'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 14
      },
      {
        moduleId: 'be-m3-express-scratch',
        title: 'Module 3: Express.js from Scratch & Route Pipelines',
        description: 'Setting up an Express server, creating route handlers, parsing JSON bodies, URL parameters, query strings, and middleware.',
        order: 3,
        topics: [
          'Creating an Express Server from Scratch',
          'Defining GET and POST Route Handlers',
          'Parsing Request Bodies with express.json()',
          'URL Route Parameters (:id) & Query Strings',
          'What Middleware is & Building Custom Middleware Chains'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'be-m4-rest-apis',
        title: 'Module 4: RESTful API Design & Request Validation',
        description: 'REST architecture principles, resource-oriented URLs, CRUD operations, input validation, error handling middleware, and status codes.',
        order: 4,
        topics: [
          'REST Architectural Principles',
          'Resource Modeling & Clean URL Conventions',
          'Implementing Complete CRUD Endpoints',
          'Defensive Input Validation & Sanitization',
          'Centralized Error Handling Middleware'
        ],
        exerciseTypes: ['mcq', 'coding', 'project'],
        estimatedHours: 18
      },
      {
        moduleId: 'be-m5-db-modeling',
        title: 'Module 5: Database Persistence & Data Modeling',
        description: 'Relational vs document databases, connecting databases to Express, schemas, queries, data validation, and indexes.',
        order: 5,
        topics: [
          'Databases Explained: Relational vs NoSQL',
          'Connecting MongoDB / PostgreSQL to Node.js',
          'Schema Design & Mongoose Modeling',
          'Query Execution, Filtering & Sorting',
          'Database Indexes & Query Performance'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'be-m6-auth-security',
        title: 'Module 6: Authentication, JWT & Security Best Practices',
        description: 'Password hashing with bcrypt, JWT token creation and verification, auth middleware, CORS, and environment variables.',
        order: 6,
        topics: [
          'Password Security & Hashing with bcrypt',
          'JSON Web Tokens (JWT) Explained Simply',
          'Building Protected Route Middleware',
          'Cross-Origin Resource Sharing (CORS) Security',
          'Environment Variables & Safe Secrets Management'
        ],
        exerciseTypes: ['mcq', 'coding', 'interview'],
        estimatedHours: 18
      }
    ],
    projects: [],
    assessments: []
  },
  {
    slug: 'dsa',
    name: 'Data Structures and Algorithms',
    shortDescription:
      'Master programming fundamentals, algorithmic complexity, data structures, recursion, trees, sorting, and dynamic programming from scratch.',
    description:
      'Designed to build deep algorithmic intuition starting with fundamental complexity analysis, basic array and string manipulation, through trees, graphs, and dynamic programming.',
    technologies: ['Algorithms', 'Data Structures', 'Big-O Analysis', 'Problem Solving', 'JavaScript', 'Python'],
    overview:
      'Develop the algorithmic problem-solving mindset required for engineering interviews: analyze computational tradeoffs, choose optimal data structures, and implement efficient solutions.',
    icon: 'cpu',
    badge: 'Interview Track',
    active: true,
    order: 6,
    modules: [
      {
        moduleId: 'dsa-m1-fundamentals-complexity',
        title: 'Module 1: Programming Fundamentals & Complexity from Scratch',
        description: 'Understanding computational resources, Big-O notation, time complexity, space complexity, and identifying common runtime bounds.',
        order: 1,
        topics: [
          'What is an Algorithm & Why Efficiency Matters',
          'Big-O Notation: The Universal Language of Complexity',
          'Constant O(1), Linear O(n), and Quadratic O(n^2) Runtimes',
          'Logarithmic O(log n) & Log-Linear O(n log n) Complexity',
          'Space Complexity & Memory Tradeoffs'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 12
      },
      {
        moduleId: 'dsa-m2-arrays-strings',
        title: 'Module 2: Arrays, Strings & Two-Pointer Techniques',
        description: 'Contiguous memory, array manipulation, string reversal, two-pointer patterns, and the sliding window technique.',
        order: 2,
        topics: [
          'How Arrays Work in Memory',
          'Basic Array Operations: Insertion, Deletion & Lookup',
          'String Manipulation & ASCII/Unicode Basics',
          'The Two-Pointer Technique (Opposite & Same Direction)',
          'The Sliding Window Pattern for Subarray Problems'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'dsa-m3-linked-lists',
        title: 'Module 3: Linked Lists & Pointer Logic',
        description: 'Nodes, pointers, singly linked lists, doubly linked lists, list traversal, reversal, and cycle detection.',
        order: 3,
        topics: [
          'Nodes & Pointers vs Contiguous Arrays',
          'Building a Singly Linked List from Scratch',
          'Insertion and Deletion at Head, Tail & Middle',
          'Reversing a Linked List Step-by-Step',
          'Fast and Slow Pointer Technique (Cycle Detection)'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 16
      },
      {
        moduleId: 'dsa-m4-stacks-queues',
        title: 'Module 4: Stacks, Queues & Monotonic Data Structures',
        description: 'LIFO stack mechanics, FIFO queue mechanics, balanced parentheses problems, and min stack implementation.',
        order: 4,
        topics: [
          'The Stack: Last-In First-Out (LIFO) Mechanics',
          'The Queue: First-In First-Out (FIFO) Mechanics',
          'Solving the Valid Parentheses Problem',
          'Designing a Min Stack in O(1) Time',
          'Queue Implementation with Two Stacks'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 14
      },
      {
        moduleId: 'dsa-m5-recursion',
        title: 'Module 5: Recursion & Backtracking Fundamentals',
        description: 'Base cases, recursive call stacks, recurrence relations, subset generation, and backtracking trees.',
        order: 5,
        topics: [
          'Understanding Recursion: Base Case vs Recursive Step',
          'Visualizing the Call Stack & Stack Overflow',
          'Factorials, Fibonacci & Recurrence Relations',
          'Backtracking: Exploring All Valid Decision Paths',
          'Generating Subsets and Permutations'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'dsa-m6-trees-bst',
        title: 'Module 6: Trees, Binary Search Trees & Traversal',
        description: 'Hierarchical tree structures, binary trees, binary search trees, DFS traversals (inorder, preorder, postorder), and BFS level-order traversal.',
        order: 6,
        topics: [
          'Tree Terminology: Roots, Nodes, Leaves & Height',
          'Binary Tree Properties & Node Representation',
          'DFS Traversals: Inorder, Preorder, and Postorder',
          'BFS Traversal: Level-Order with a Queue',
          'Binary Search Trees (BST): Search, Insert & Validate'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 20
      },
      {
        moduleId: 'dsa-m7-sorting-heaps',
        title: 'Module 7: Searching, Sorting & Priority Queues',
        description: 'Binary search on sorted arrays, merge sort, quick sort, binary heaps, and priority queue operations.',
        order: 7,
        topics: [
          'Binary Search Algorithm & Boundary Conditions',
          'Divide and Conquer: Merge Sort Implementation',
          'Partitioning: Quick Sort Mechanics',
          'Min-Heaps and Max-Heaps Concept',
          'Finding Top K Elements with a Heap'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 18
      },
      {
        moduleId: 'dsa-m8-graphs-dp',
        title: 'Module 8: Graphs, Dynamic Programming & Advanced Algorithms',
        description: 'Graph representations (adjacency list), DFS & BFS on graphs, memoization vs tabulation, and classic 1D dynamic programming.',
        order: 8,
        topics: [
          'Graph Representation: Adjacency Lists and Matrices',
          'Graph Traversal: Breadth-First & Depth-First Search',
          'Introduction to Dynamic Programming: Overlapping Subproblems',
          'Top-Down DP with Memoization vs Bottom-Up Tabulation',
          'Solving Classic DP: Climbing Stairs & Coin Change'
        ],
        exerciseTypes: ['mcq', 'coding'],
        estimatedHours: 24
      }
    ],
    projects: [],
    assessments: []
  }
];

/**
 * Resolves a module for a domain, handling legacy module IDs and aliases seamlessly.
 */
export function resolveDomainModule(domain: any, moduleId: string): { module: any | null; index: number } {
  if (!domain || !domain.modules || !Array.isArray(domain.modules)) {
    return { module: null, index: -1 };
  }

  let index = domain.modules.findIndex((m: any) => m.moduleId === moduleId);
  if (index !== -1) {
    return { module: domain.modules[index], index };
  }

  const legacyAliases: Record<string, string> = {
    'mern-m1-fundamentals': 'mern-m1-web-fundamentals',
    'mern-m2-css': 'mern-m1-web-fundamentals',
    'mern-m3-javascript': 'mern-m1-web-fundamentals',
    'mern-m4-devtools-git': 'mern-m1-web-fundamentals',
    'mern-m5-react': 'mern-m2-react',
    'mern-m6-node-express': 'mern-m4-express',
    'mern-m7-mongodb': 'mern-m5-mongodb',
    'mern-m8-fullstack-mern': 'mern-m6-fullstack-integration',
    'aiml-m1-python-foundations': 'aiml-m1-python-scratch',
    'aiml-m2-numpy-processing': 'aiml-m3-numpy-scratch',
    'ds-m1-sql': 'ds-m1-sql-scratch',
    'fe-m1-markup-style': 'fe-m1-html-scratch',
    'be-m1-server-fundamentals': 'be-m1-network-http'
  };

  const targetId = legacyAliases[moduleId];
  if (targetId) {
    index = domain.modules.findIndex((m: any) => m.moduleId === targetId);
    if (index !== -1) {
      return { module: domain.modules[index], index };
    }
  }

  return { module: null, index: -1 };
}

/**
 * Seeds or synchronizes default technology domains to MongoDB.
 */
export async function seedDefaultDomains(): Promise<void> {
  try {
    for (const d of INITIAL_DOMAINS) {
      await Domain.findOneAndUpdate(
        { slug: d.slug },
        {
          $set: {
            slug: d.slug,
            name: d.name,
            shortDescription: d.shortDescription,
            description: d.description,
            technologies: d.technologies,
            overview: d.overview,
            icon: d.icon,
            badge: d.badge,
            active: d.active,
            order: d.order,
            modules: d.modules,
            projects: d.projects,
            assessments: d.assessments
          }
        },
        { upsert: true, new: true }
      );
    }
    logger.info('DEFAULT_DOMAINS_SEEDED', {
      details: { count: INITIAL_DOMAINS.length, mernModules: 8 }
    });
  } catch (error: any) {
    logger.error('DEFAULT_DOMAINS_SEED_ERROR', { details: { message: error.message } });
  }
}
