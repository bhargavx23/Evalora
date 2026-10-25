import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import {
  College,
  Department,
  User,
  Question,
  Assessment,
  AssessmentAttempt,
  Submission,
  PracticeSession,
  PracticeQuestionHistory,
  StudentSkill,
  CodeSimilarityResult
} from '../models/index.js';
import { DEFAULT_STARTER_CODES } from '../shared/constants.js';

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Starting database seed...');

  // Clear existing collections
  await Promise.all([
    College.deleteMany({}),
    Department.deleteMany({}),
    User.deleteMany({}),
    Question.deleteMany({}),
    Assessment.deleteMany({}),
    AssessmentAttempt.deleteMany({}),
    Submission.deleteMany({}),
    PracticeSession.deleteMany({}),
    PracticeQuestionHistory.deleteMany({}),
    StudentSkill.deleteMany({}),
    CodeSimilarityResult.deleteMany({})
  ]);

  const defaultPasswordHash = await bcrypt.hash('Evalora@2026', 10);

  // 1. Create Colleges
  const apexCollege = await College.create({
    name: 'Apex Institute of Technology',
    code: 'APEX',
    domain: 'apex.edu',
    contactEmail: 'contact@apex.edu',
    phone: '+91 98765 43210',
    address: 'Tech Innovation Zone, Bangalore, KA, India',
    status: 'active',
    settings: {
      allowRegistration: true,
      requireDepartment: true,
      defaultDurationMinutes: 60,
      antiCheatDefaults: {
        tabSwitchLimit: 3,
        fullscreenRequired: true,
        copyPasteRestricted: true
      }
    }
  });

  const horizonCollege = await College.create({
    name: 'Horizon University of Engineering',
    code: 'HORIZON',
    domain: 'horizon.edu',
    contactEmail: 'contact@horizon.edu',
    phone: '+91 98765 88990',
    address: 'University Boulevard, Hyderabad, TS, India',
    status: 'active',
    settings: {
      allowRegistration: true,
      requireDepartment: true,
      defaultDurationMinutes: 60,
      antiCheatDefaults: {
        tabSwitchLimit: 3,
        fullscreenRequired: true,
        copyPasteRestricted: true
      }
    }
  });

  // 2. Create Departments for Apex
  const apexCSE = await Department.create({
    collegeId: apexCollege._id,
    name: 'Computer Science & Engineering',
    code: 'CSE',
    description: 'Department of Computer Science & Engineering'
  });

  const apexIT = await Department.create({
    collegeId: apexCollege._id,
    name: 'Information Technology',
    code: 'IT',
    description: 'Department of Information Technology'
  });

  const apexECE = await Department.create({
    collegeId: apexCollege._id,
    name: 'Electronics & Communication Engineering',
    code: 'ECE',
    description: 'Department of Electronics & Communication Engineering'
  });

  // Departments for Horizon
  const horizonCSE = await Department.create({
    collegeId: horizonCollege._id,
    name: 'Computer Science & Engineering',
    code: 'CSE'
  });

  // 3. Create Users
  // Authorized Admin
  const adminEmail = ENV.EVALORA_ADMIN_EMAIL || 'bhargavpasupuleti5@gmail.com';
  const adminWallet = ENV.EVALORA_ADMIN_WALLET || 'WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA';
  const superadmin = await User.create({
    name: 'Evalora Administrator',
    email: adminEmail,
    passwordHash: defaultPasswordHash,
    role: 'admin',
    collegeId: null,
    walletAddress: adminWallet,
    wallets: [
      {
        address: adminWallet,
        walletType: 'pera',
        network: 'algorand',
        verified: true,
        linkedAt: new Date(),
        lastUsedAt: new Date()
      }
    ],
    authProviders: ['password', 'wallet'],
    emailVerified: true,
    status: 'active',
    plan: 'enterprise'
  });

  // Apex College Admin
  const apexAdmin = await User.create({
    name: 'Dean Arvind Rao',
    email: 'admin@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'college_admin',
    collegeId: apexCollege._id,
    departmentId: apexCSE._id,
    employeeId: 'APEX-ADM-01',
    status: 'active'
  });

  // Apex Faculty
  const facultyDSA = await User.create({
    name: 'Prof. Ramesh Kulkarni',
    email: 'faculty.dsa@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'faculty',
    collegeId: apexCollege._id,
    departmentId: apexCSE._id,
    employeeId: 'APEX-FAC-102',
    status: 'active'
  });

  const facultyApti = await User.create({
    name: 'Dr. Meera Nambiar',
    email: 'faculty.apti@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'faculty',
    collegeId: apexCollege._id,
    departmentId: apexIT._id,
    employeeId: 'APEX-FAC-204',
    status: 'active'
  });

  // Apex Students
  const studentBhargav = await User.create({
    name: 'Bhargav Ram',
    email: 'student.bhargav@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'student',
    collegeId: apexCollege._id,
    departmentId: apexCSE._id,
    studentId: '22CSE045',
    status: 'active'
  });

  const studentAnanya = await User.create({
    name: 'Ananya Sharma',
    email: 'student.ananya@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'student',
    collegeId: apexCollege._id,
    departmentId: apexCSE._id,
    studentId: '22CSE078',
    status: 'active'
  });

  const studentRahul = await User.create({
    name: 'Rahul Verma',
    email: 'student.rahul@apex.edu',
    passwordHash: defaultPasswordHash,
    role: 'student',
    collegeId: apexCollege._id,
    departmentId: apexIT._id,
    studentId: '22IT012',
    status: 'active'
  });

  // Horizon Users
  await User.create({
    name: 'Prof. Sneha Deshmukh',
    email: 'faculty@horizon.edu',
    passwordHash: defaultPasswordHash,
    role: 'faculty',
    collegeId: horizonCollege._id,
    departmentId: horizonCSE._id,
    status: 'active'
  });

  await User.create({
    name: 'Priya Iyer',
    email: 'student.priya@horizon.edu',
    passwordHash: defaultPasswordHash,
    role: 'student',
    collegeId: horizonCollege._id,
    departmentId: horizonCSE._id,
    studentId: '22HOR089',
    status: 'active'
  });

  // 4. Create 20+ Coding Questions
  const codingQuestionsData = [
    {
      title: 'Two Sum Problem',
      topic: 'Arrays',
      subtopic: 'Hash Maps & Two Pointers',
      difficulty: 'easy',
      description: 'Given an array of integers `nums` and an integer `target`, return the 0-indexed positions of the two numbers such that they add up to `target` separated by a space.',
      inputFormat: 'First line contains N and target.\nSecond line contains N space-separated integers.',
      outputFormat: 'Print the two indices separated by a space in increasing order.',
      constraints: '2 <= N <= 10^4, -10^9 <= nums[i], target <= 10^9',
      examples: [{ input: '4 9\n2 7 11 15', output: '0 1', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' }],
      visibleTestCases: [
        { input: '4 9\n2 7 11 15', expectedOutput: '0 1' },
        { input: '3 6\n3 2 4', expectedOutput: '1 2' }
      ],
      hiddenTestCases: [
        { input: '2 6\n3 3', expectedOutput: '0 1' },
        { input: '5 10\n1 2 3 7 11', expectedOutput: '2 3' }
      ],
      conceptId: 'concept_two_sum',
      variantName: 'Variant A (Indices)',
      explanation: 'Use a hash map to store seen elements and look up target - nums[i] in O(1) time.'
    },
    {
      title: 'Maximum Subarray (Kadane\'s Algorithm)',
      topic: 'Arrays',
      subtopic: 'Dynamic Programming',
      difficulty: 'medium',
      description: 'Given an integer array `nums`, find the contiguous subarray (containing at least one number) which has the largest sum and print its sum.',
      inputFormat: 'First line contains N.\nSecond line contains N integers.',
      outputFormat: 'Print the maximum subarray sum.',
      constraints: '1 <= N <= 10^5, -10^4 <= nums[i] <= 10^4',
      examples: [{ input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: '[4, -1, 2, 1] has the largest sum = 6.' }],
      visibleTestCases: [
        { input: '9\n-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
        { input: '1\n1', expectedOutput: '1' }
      ],
      hiddenTestCases: [
        { input: '5\n5 4 -1 7 8', expectedOutput: '23' },
        { input: '4\n-3 -2 -5 -1', expectedOutput: '-1' }
      ],
      conceptId: 'concept_max_subarray',
      variantName: 'Variant A (Standard)',
      explanation: "Kadane's algorithm keeps a running current sum and updates the global maximum in O(N) time."
    },
    {
      title: 'Maximum Circular Subarray Sum',
      topic: 'Arrays',
      subtopic: 'Dynamic Programming',
      difficulty: 'hard',
      description: 'Given a circular integer array `nums` of length n, return the maximum possible sum of a non-empty subarray of `nums`.',
      inputFormat: 'First line contains N.\nSecond line contains N integers.',
      outputFormat: 'Print the maximum circular subarray sum.',
      constraints: '1 <= N <= 3 * 10^4, -3 * 10^4 <= nums[i] <= 3 * 10^4',
      examples: [{ input: '3\n1 -2 3 -2', output: '3', explanation: 'Subarray [3] has maximum sum 3.' }],
      visibleTestCases: [
        { input: '3\n1 -2 3 -2', expectedOutput: '3' },
        { input: '4\n5 -3 5', expectedOutput: '10' }
      ],
      hiddenTestCases: [
        { input: '3\n-3 -2 -3', expectedOutput: '-2' },
        { input: '5\n3 -1 2 -1 4', expectedOutput: '8' }
      ],
      conceptId: 'concept_max_subarray',
      variantName: 'Variant B (Circular)',
      explanation: 'Max circular sum is max(Standard Max Subarray, Total Sum - Min Subarray).'
    },
    {
      title: 'Valid Palindrome Checker',
      topic: 'Strings',
      subtopic: 'Two Pointers',
      difficulty: 'easy',
      description: 'Given a string s, return 1 if it is a palindrome considering only alphanumeric characters and ignoring cases, otherwise return 0.',
      inputFormat: 'A single string s.',
      outputFormat: 'Print 1 if palindrome, else 0.',
      constraints: '1 <= length <= 2 * 10^5',
      examples: [{ input: 'A man, a plan, a canal: Panama', output: '1', explanation: '"amanaplanacanalpanama" is a palindrome.' }],
      visibleTestCases: [
        { input: 'A man, a plan, a canal: Panama', expectedOutput: '1' },
        { input: 'race a car', expectedOutput: '0' }
      ],
      hiddenTestCases: [
        { input: ' ', expectedOutput: '1' },
        { input: '0P', expectedOutput: '0' }
      ],
      conceptId: 'concept_palindrome',
      variantName: 'Alphanumeric Filtered Palindrome',
      explanation: 'Two pointers converging from both ends while filtering non-alphanumerics.'
    },
    {
      title: 'Longest Substring Without Repeating Characters',
      topic: 'Strings',
      subtopic: 'Sliding Window',
      difficulty: 'medium',
      description: 'Given a string s, find the length of the longest substring without repeating characters.',
      inputFormat: 'A single string s on one line.',
      outputFormat: 'Print the integer length of the longest unique substring.',
      constraints: '0 <= s.length <= 5 * 10^4',
      examples: [{ input: 'abcabcbb', output: '3', explanation: '"abc" has length 3.' }],
      visibleTestCases: [
        { input: 'abcabcbb', expectedOutput: '3' },
        { input: 'bbbbb', expectedOutput: '1' }
      ],
      hiddenTestCases: [
        { input: 'pwwkew', expectedOutput: '3' },
        { input: '', expectedOutput: '0' }
      ],
      conceptId: 'concept_sliding_window_str',
      variantName: 'Unique Substring Window',
      explanation: 'Sliding window with character index hash table in O(N) time.'
    },
    {
      title: 'Reverse a Singly Linked List',
      topic: 'Linked Lists',
      subtopic: 'Pointers',
      difficulty: 'easy',
      description: 'Given the elements of a singly linked list, reverse the list and print the elements separated by space.',
      inputFormat: 'First line contains N.\nSecond line contains N integers.',
      outputFormat: 'Print the reversed list elements separated by space.',
      constraints: '0 <= N <= 5000',
      examples: [{ input: '5\n1 2 3 4 5', output: '5 4 3 2 1', explanation: 'The list 1->2->3->4->5 becomes 5->4->3->2->1.' }],
      visibleTestCases: [
        { input: '5\n1 2 3 4 5', expectedOutput: '5 4 3 2 1' },
        { input: '2\n1 2', expectedOutput: '2 1' }
      ],
      hiddenTestCases: [
        { input: '1\n99', expectedOutput: '99' },
        { input: '4\n10 20 30 40', expectedOutput: '40 30 20 10' }
      ],
      conceptId: 'concept_reverse_ll',
      variantName: 'Iterative List Reversal',
      explanation: 'Iterate with prev, curr, and next pointers.'
    },
    {
      title: 'Detect Cycle in Linked List',
      topic: 'Linked Lists',
      subtopic: "Floyd's Cycle-Finding",
      difficulty: 'medium',
      description: 'Given a linked list representation where N integers are followed by an index `pos` where the tail links to (-1 if no cycle), print 1 if cycle exists, else 0.',
      inputFormat: 'First line contains N and pos.\nSecond line contains N integers.',
      outputFormat: 'Print 1 if cycle detected, else 0.',
      constraints: '0 <= N <= 10^4, -1 <= pos < N',
      examples: [{ input: '4 1\n3 2 0 -4', output: '1', explanation: 'Cycle exists since pos=1 connects tail to node index 1.' }],
      visibleTestCases: [
        { input: '4 1\n3 2 0 -4', expectedOutput: '1' },
        { input: '2 0\n1 2', expectedOutput: '1' }
      ],
      hiddenTestCases: [
        { input: '1 -1\n1', expectedOutput: '0' },
        { input: '3 -1\n10 20 30', expectedOutput: '0' }
      ],
      conceptId: 'concept_cycle_ll',
      variantName: "Tortoise and Hare Algorithm",
      explanation: "Floyd's algorithm uses slow and fast pointers moving at 1x and 2x speeds."
    },
    {
      title: 'Maximum Depth of Binary Tree',
      topic: 'Trees',
      subtopic: 'Tree Traversal',
      difficulty: 'easy',
      description: 'Given the level-order traversal of a binary tree (-1 represents null node), calculate its maximum depth (number of nodes along longest path from root to leaf).',
      inputFormat: 'First line contains N.\nSecond line contains N integers representing level order traversal.',
      outputFormat: 'Print the maximum depth as an integer.',
      constraints: '0 <= N <= 10^4',
      examples: [{ input: '7\n3 9 20 -1 -1 15 7', output: '3', explanation: 'Root 3 has depth 1, left 9 (depth 2), right 20 -> 15, 7 (depth 3).' }],
      visibleTestCases: [
        { input: '7\n3 9 20 -1 -1 15 7', expectedOutput: '3' },
        { input: '2\n1 -1', expectedOutput: '1' }
      ],
      hiddenTestCases: [
        { input: '1\n1', expectedOutput: '1' },
        { input: '5\n1 2 3 4 -1', expectedOutput: '3' }
      ],
      conceptId: 'concept_tree_depth',
      variantName: 'Recursive Depth',
      explanation: '1 + max(depth(left), depth(right)).'
    },
    {
      title: 'Lowest Common Ancestor in Binary Search Tree',
      topic: 'Trees',
      subtopic: 'BST Properties',
      difficulty: 'medium',
      description: 'Given a BST and two node values p and q, find the lowest common ancestor (LCA) node value.',
      inputFormat: 'First line contains N, p, q.\nSecond line contains N values in BST.',
      outputFormat: 'Print the value of the LCA node.',
      constraints: '2 <= N <= 10^5',
      examples: [{ input: '7 2 8\n6 2 8 0 4 7 9', output: '6', explanation: 'LCA of 2 and 8 is root 6.' }],
      visibleTestCases: [
        { input: '7 2 8\n6 2 8 0 4 7 9', expectedOutput: '6' },
        { input: '7 2 4\n6 2 8 0 4 7 9', expectedOutput: '2' }
      ],
      hiddenTestCases: [
        { input: '2 1 2\n2 1', expectedOutput: '2' },
        { input: '5 3 5\n4 2 6 1 3 5 7', expectedOutput: '4' }
      ],
      conceptId: 'concept_lca_bst',
      variantName: 'BST Ancestor Search',
      explanation: 'Traverse down: if both p and q are smaller than root, go left; if both larger, go right; else split point is LCA.'
    },
    {
      title: 'Number of Connected Components in Graph',
      topic: 'Graphs',
      subtopic: 'Disjoint Set & BFS',
      difficulty: 'medium',
      description: 'Given n nodes labeled from 0 to n - 1 and a list of undirected edges, find the number of connected components in the graph.',
      inputFormat: 'First line contains n and e (number of edges).\nFollowing e lines contain u v.',
      outputFormat: 'Print the number of connected components.',
      constraints: '1 <= n <= 2000, 0 <= e <= 5000',
      examples: [{ input: '5 2\n0 1\n1 2', output: '3', explanation: 'Components are {0,1,2}, {3}, {4}. Total 3.' }],
      visibleTestCases: [
        { input: '5 2\n0 1\n1 2', expectedOutput: '3' },
        { input: '5 4\n0 1\n1 2\n2 3\n3 4', expectedOutput: '1' }
      ],
      hiddenTestCases: [
        { input: '4 0', expectedOutput: '4' },
        { input: '6 3\n0 1\n2 3\n4 5', expectedOutput: '3' }
      ],
      conceptId: 'concept_connected_components',
      variantName: 'Union Find / BFS Components',
      explanation: 'Use BFS/DFS or Disjoint Set Union (Union-Find) to count independent components.'
    },
    {
      title: 'Shortest Path in Unweighted Graph (BFS)',
      topic: 'Graphs',
      subtopic: 'Breadth First Search',
      difficulty: 'medium',
      description: 'Given an unweighted graph with N vertices and M edges, find the length of the shortest path from source S to destination D. Print -1 if unreachable.',
      inputFormat: 'First line contains N, M, S, D.\nFollowing M lines contain u v.',
      outputFormat: 'Print the shortest path distance.',
      constraints: '1 <= N <= 10^4, 0 <= M <= 5 * 10^4',
      examples: [{ input: '4 4 0 3\n0 1\n1 2\n2 3\n0 3', output: '1', explanation: 'Direct edge 0 -> 3 has length 1.' }],
      visibleTestCases: [
        { input: '4 4 0 3\n0 1\n1 2\n2 3\n0 3', expectedOutput: '1' },
        { input: '4 2 0 3\n0 1\n2 3', expectedOutput: '-1' }
      ],
      hiddenTestCases: [
        { input: '5 4 0 4\n0 1\n1 2\n2 3\n3 4', expectedOutput: '4' },
        { input: '3 1 0 2\n0 1', expectedOutput: '-1' }
      ],
      conceptId: 'concept_shortest_path_bfs',
      variantName: 'Unweighted BFS',
      explanation: 'Breadth-First Search naturally explores nodes level by level, ensuring shortest path discovery.'
    },
    {
      title: 'Climbing Stairs (Fibonacci DP)',
      topic: 'Recursion',
      subtopic: 'Memoization',
      difficulty: 'easy',
      description: 'You are climbing a staircase. It takes n steps to reach the top. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top?',
      inputFormat: 'A single integer n.',
      outputFormat: 'Print the total number of distinct ways.',
      constraints: '1 <= n <= 45',
      examples: [{ input: '3', output: '3', explanation: 'Ways: 1+1+1, 1+2, 2+1' }],
      visibleTestCases: [
        { input: '2', expectedOutput: '2' },
        { input: '3', expectedOutput: '3' }
      ],
      hiddenTestCases: [
        { input: '4', expectedOutput: '5' },
        { input: '5', expectedOutput: '8' }
      ],
      conceptId: 'concept_fibonacci_dp',
      variantName: 'Climbing Stairs',
      explanation: 'ways(n) = ways(n-1) + ways(n-2) with base cases ways(1)=1, ways(2)=2.'
    },
    {
      title: 'Coin Change Problem (Minimum Coins)',
      topic: 'Dynamic Programming',
      subtopic: 'Unbounded Knapsack',
      difficulty: 'medium',
      description: 'Given an array of coin denominations and an integer amount, compute the fewest number of coins that you need to make up that amount. If impossible, print -1.',
      inputFormat: 'First line contains N and amount.\nSecond line contains N coin values.',
      outputFormat: 'Print the minimum coin count or -1.',
      constraints: '1 <= N <= 12, 0 <= amount <= 10^4',
      examples: [{ input: '3 11\n1 2 5', output: '3', explanation: '11 = 5 + 5 + 1 (3 coins)' }],
      visibleTestCases: [
        { input: '3 11\n1 2 5', expectedOutput: '3' },
        { input: '1 3\n2', expectedOutput: '-1' }
      ],
      hiddenTestCases: [
        { input: '1 0\n1', expectedOutput: '0' },
        { input: '4 6249\n186 419 83 408', expectedOutput: '20' }
      ],
      conceptId: 'concept_coin_change',
      variantName: 'Minimum Coin DP',
      explanation: 'dp[i] = min(dp[i], dp[i - coin] + 1) initialized to infinity with dp[0] = 0.'
    },
    {
      title: '0/1 Knapsack Problem',
      topic: 'Dynamic Programming',
      subtopic: 'Bounded Knapsack',
      difficulty: 'medium',
      description: 'Given weights and values of N items and a knapsack of capacity W, find the maximum value that can be put into the knapsack.',
      inputFormat: 'First line contains N and W.\nSecond line contains N values.\nThird line contains N weights.',
      outputFormat: 'Print the maximum total value.',
      constraints: '1 <= N <= 1000, 1 <= W <= 1000',
      examples: [{ input: '3 4\n1 2 3\n4 5 1', output: '3', explanation: 'Pick item 3 with weight 1 and value 3.' }],
      visibleTestCases: [
        { input: '3 4\n1 2 3\n4 5 1', expectedOutput: '3' },
        { input: '3 50\n60 100 120\n10 20 30', expectedOutput: '220' }
      ],
      hiddenTestCases: [
        { input: '2 3\n20 30\n1 2', expectedOutput: '50' },
        { input: '1 5\n10\n10', expectedOutput: '0' }
      ],
      conceptId: 'concept_01_knapsack',
      variantName: 'Standard 0-1 Knapsack',
      explanation: 'dp[i][w] = max(dp[i-1][w], val[i-1] + dp[i-1][w-wt[i-1]]).'
    },
    {
      title: 'Merge Intervals',
      topic: 'Arrays',
      subtopic: 'Intervals & Sorting',
      difficulty: 'medium',
      description: 'Given a collection of intervals, merge all overlapping intervals and print them sorted by start time.',
      inputFormat: 'First line contains N.\nFollowing N lines contain start end.',
      outputFormat: 'Print merged intervals each on a new line as "start end".',
      constraints: '1 <= N <= 10^4',
      examples: [{ input: '4\n1 3\n2 6\n8 10\n15 18', output: '1 6\n8 10\n15 18', explanation: '[1,3] and [2,6] overlap into [1,6].' }],
      visibleTestCases: [
        { input: '4\n1 3\n2 6\n8 10\n15 18', expectedOutput: '1 6\n8 10\n15 18' },
        { input: '2\n1 4\n4 5', expectedOutput: '1 5' }
      ],
      hiddenTestCases: [
        { input: '1\n1 5', expectedOutput: '1 5' },
        { input: '3\n1 4\n0 4\n3 5', expectedOutput: '0 5' }
      ],
      conceptId: 'concept_merge_intervals',
      variantName: 'Overlapping Interval Merging',
      explanation: 'Sort intervals by starting point and merge consecutively in O(N log N).'
    },
    {
      title: 'Kth Largest Element in an Array',
      topic: 'Arrays',
      subtopic: 'Heaps & Quickselect',
      difficulty: 'medium',
      description: 'Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array.',
      inputFormat: 'First line contains N and k.\nSecond line contains N integers.',
      outputFormat: 'Print the kth largest integer.',
      constraints: '1 <= k <= N <= 10^5',
      examples: [{ input: '6 2\n3 2 1 5 6 4', output: '5', explanation: 'Largest is 6, 2nd largest is 5.' }],
      visibleTestCases: [
        { input: '6 2\n3 2 1 5 6 4', expectedOutput: '5' },
        { input: '9 4\n3 2 3 1 2 4 5 5 6', expectedOutput: '4' }
      ],
      hiddenTestCases: [
        { input: '1 1\n42', expectedOutput: '42' },
        { input: '4 1\n10 20 30 40', expectedOutput: '40' }
      ],
      conceptId: 'concept_kth_element',
      variantName: 'Kth Selection',
      explanation: 'Use a min-heap of size k or Quickselect in average O(N) time.'
    },
    {
      title: 'Valid Parentheses String',
      topic: 'Strings',
      subtopic: 'Stack',
      difficulty: 'easy',
      description: 'Given a string containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. Print 1 if valid, else 0.',
      inputFormat: 'A single string s.',
      outputFormat: 'Print 1 if valid, else 0.',
      constraints: '1 <= s.length <= 10^4',
      examples: [{ input: '()[]{}', output: '1', explanation: 'All brackets match and close properly.' }],
      visibleTestCases: [
        { input: '()[]{}', expectedOutput: '1' },
        { input: '(]', expectedOutput: '0' }
      ],
      hiddenTestCases: [
        { input: '([{}])', expectedOutput: '1' },
        { input: '(((((', expectedOutput: '0' }
      ],
      conceptId: 'concept_parentheses_stack',
      variantName: 'Bracket Stack Matching',
      explanation: 'Push open brackets to stack, pop and match on closing brackets.'
    },
    {
      title: 'Subsets Generation (Power Set)',
      topic: 'Recursion',
      subtopic: 'Backtracking',
      difficulty: 'medium',
      description: 'Given an integer array of unique elements, print the total number of distinct subsets (including the empty set).',
      inputFormat: 'First line contains N.\nSecond line contains N integers.',
      outputFormat: 'Print the count of subsets (2^N).',
      constraints: '0 <= N <= 20',
      examples: [{ input: '3\n1 2 3', output: '8', explanation: 'Power set size is 2^3 = 8.' }],
      visibleTestCases: [
        { input: '3\n1 2 3', expectedOutput: '8' },
        { input: '1\n0', expectedOutput: '2' }
      ],
      hiddenTestCases: [
        { input: '0\n', expectedOutput: '1' },
        { input: '5\n1 2 3 4 5', expectedOutput: '32' }
      ],
      conceptId: 'concept_subsets_power_set',
      variantName: 'Power Set Size',
      explanation: 'Backtracking explores inclusion/exclusion branches for 2^N states.'
    },
    {
      title: 'Implement Queue using Stacks',
      topic: 'OOP',
      subtopic: 'Data Structure Design',
      difficulty: 'easy',
      description: 'Simulate queue operations (1 x: push x, 2: pop and print front). Given Q queries, process them.',
      inputFormat: 'First line contains Q.\nFollowing Q lines contain operation.',
      outputFormat: 'Print popped elements separated by newline.',
      constraints: '1 <= Q <= 10^4',
      examples: [{ input: '4\n1 10\n1 20\n2\n2', output: '10\n20', explanation: 'FIFO order preserved.' }],
      visibleTestCases: [
        { input: '4\n1 10\n1 20\n2\n2', expectedOutput: '10\n20' },
        { input: '3\n1 5\n2\n1 7', expectedOutput: '5' }
      ],
      hiddenTestCases: [
        { input: '2\n1 99\n2', expectedOutput: '99' },
        { input: '5\n1 1\n1 2\n1 3\n2\n2', expectedOutput: '1\n2' }
      ],
      conceptId: 'concept_queue_stacks',
      variantName: 'Two Stack Queue',
      explanation: 'Use two stacks (input and output stack) with amortized O(1) operations.'
    },
    {
      title: 'Rotting Oranges (Multi-Source BFS)',
      topic: 'Graphs',
      subtopic: 'Grid BFS',
      difficulty: 'medium',
      description: 'Given an m x n grid where 0 is empty, 1 is fresh, and 2 is rotten orange. Every minute, any fresh orange adjacent to a rotten orange becomes rotten. Return minimum minutes until no fresh orange remains, or -1 if impossible.',
      inputFormat: 'First line contains m and n.\nFollowing m lines contain n integers.',
      outputFormat: 'Print the minimum minutes or -1.',
      constraints: '1 <= m, n <= 10',
      examples: [{ input: '3 3\n2 1 1\n1 1 0\n0 1 1', output: '4', explanation: '4 minutes needed to rot all oranges.' }],
      visibleTestCases: [
        { input: '3 3\n2 1 1\n1 1 0\n0 1 1', expectedOutput: '4' },
        { input: '3 3\n2 1 1\n0 1 1\n1 0 1', expectedOutput: '-1' }
      ],
      hiddenTestCases: [
        { input: '1 2\n0 2', expectedOutput: '0' },
        { input: '2 2\n2 1\n1 2', expectedOutput: '1' }
      ],
      conceptId: 'concept_grid_bfs',
      variantName: 'Rotting Oranges Grid BFS',
      explanation: 'Multi-source BFS using a queue initialized with all rotten orange coordinates.'
    }
  ];

  const createdCodingQuestions: any[] = [];
  for (const q of codingQuestionsData) {
    const doc = await Question.create({
      collegeId: apexCollege._id,
      creatorId: facultyDSA._id,
      title: q.title,
      description: q.description,
      type: 'coding',
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      marks: q.difficulty === 'hard' ? 20 : q.difficulty === 'medium' ? 15 : 10,
      negativeMarks: 0,
      estimatedTimeMinutes: 25,
      tags: [q.topic.toLowerCase(), q.subtopic.toLowerCase(), q.difficulty],
      codingDetails: {
        supportedLanguages: ['c', 'cpp', 'python', 'java'],
        starterCode: DEFAULT_STARTER_CODES,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        constraints: q.constraints,
        examples: q.examples,
        visibleTestCases: q.visibleTestCases,
        hiddenTestCases: q.hiddenTestCases,
        timeLimitMs: 3000,
        memoryLimitMb: 256
      },
      explanation: q.explanation,
      conceptId: q.conceptId,
      variantName: q.variantName,
      status: 'verified',
      attemptCount: 18,
      correctCount: 12,
      avgTimeSeconds: 420
    });
    createdCodingQuestions.push(doc);
  }

  // 5. Create 30+ Realistic MCQ & Technical Questions
  const mcqQuestionsData = [
    // Quantitative Aptitude
    {
      title: 'Work and Time Problem',
      topic: 'Quantitative Aptitude',
      subtopic: 'Time and Work',
      difficulty: 'easy',
      description: 'A can complete a piece of work in 12 days and B can do it in 24 days. How many days will they take working together?',
      options: [
        { id: 'opt_1', text: '8 days', isCorrect: true },
        { id: 'opt_2', text: '6 days', isCorrect: false },
        { id: 'opt_3', text: '10 days', isCorrect: false },
        { id: 'opt_4', text: '9 days', isCorrect: false }
      ],
      explanation: '1/12 + 1/24 = 3/24 = 1/8 work per day. Total time = 8 days.'
    },
    {
      title: 'Speed, Distance, and Time',
      topic: 'Quantitative Aptitude',
      subtopic: 'Speed & Distance',
      difficulty: 'medium',
      description: 'A train 180 meters long runs at 72 km/h. How much time does it take to cross an electric pole?',
      options: [
        { id: 'opt_1', text: '9 seconds', isCorrect: true },
        { id: 'opt_2', text: '12 seconds', isCorrect: false },
        { id: 'opt_3', text: '15 seconds', isCorrect: false },
        { id: 'opt_4', text: '7.5 seconds', isCorrect: false }
      ],
      explanation: 'Speed = 72 * (5/18) = 20 m/s. Time = 180 / 20 = 9 seconds.'
    },
    {
      title: 'Profit and Loss Calculation',
      topic: 'Quantitative Aptitude',
      subtopic: 'Profit & Loss',
      difficulty: 'easy',
      description: 'An article is purchased for $400 and sold for $480. What is the profit percentage?',
      options: [
        { id: 'opt_1', text: '20%', isCorrect: true },
        { id: 'opt_2', text: '25%', isCorrect: false },
        { id: 'opt_3', text: '15%', isCorrect: false },
        { id: 'opt_4', text: '18%', isCorrect: false }
      ],
      explanation: 'Profit = 80. Profit % = (80 / 400) * 100 = 20%.'
    },
    // Logical Reasoning
    {
      title: 'Number Series Completion',
      topic: 'Logical Reasoning',
      subtopic: 'Series',
      difficulty: 'easy',
      description: 'Find the next term in the sequence: 2, 6, 12, 20, 30, ?',
      options: [
        { id: 'opt_1', text: '42', isCorrect: true },
        { id: 'opt_2', text: '40', isCorrect: false },
        { id: 'opt_3', text: '44', isCorrect: false },
        { id: 'opt_4', text: '38', isCorrect: false }
      ],
      explanation: 'Differences: +4, +6, +8, +10, +12 -> 30 + 12 = 42.'
    },
    {
      title: 'Syllogism Analysis',
      topic: 'Logical Reasoning',
      subtopic: 'Deductive Logic',
      difficulty: 'medium',
      description: 'Statements: All laptops are devices. Some devices are phones. Conclusions: I. Some laptops are phones. II. All phones are devices.',
      options: [
        { id: 'opt_1', text: 'Neither conclusion I nor II follows', isCorrect: true },
        { id: 'opt_2', text: 'Only conclusion I follows', isCorrect: false },
        { id: 'opt_3', text: 'Only conclusion II follows', isCorrect: false },
        { id: 'opt_4', text: 'Both conclusions follow', isCorrect: false }
      ],
      explanation: 'No direct universal relationship between laptops and phones; some devices being phones does not imply all phones are devices.'
    },
    // Verbal Ability
    {
      title: 'Sentence Correction & Grammar',
      topic: 'Verbal Ability',
      subtopic: 'Grammar',
      difficulty: 'easy',
      description: 'Choose the grammatically correct option: "Neither the professor nor the students ____ present at the symposium."',
      options: [
        { id: 'opt_1', text: 'were', isCorrect: true },
        { id: 'opt_2', text: 'was', isCorrect: false },
        { id: 'opt_3', text: 'is', isCorrect: false },
        { id: 'opt_4', text: 'are', isCorrect: false }
      ],
      explanation: 'With "neither...nor", the verb agrees with the closer subject ("the students" -> plural "were").'
    },
    // DBMS
    {
      title: 'ACID Properties in Transactions',
      topic: 'DBMS',
      subtopic: 'Transactions',
      difficulty: 'easy',
      description: 'Which ACID property ensures that all transaction modifications are preserved even in the event of a system crash?',
      options: [
        { id: 'opt_1', text: 'Durability', isCorrect: true },
        { id: 'opt_2', text: 'Atomicity', isCorrect: false },
        { id: 'opt_3', text: 'Consistency', isCorrect: false },
        { id: 'opt_4', text: 'Isolation', isCorrect: false }
      ],
      explanation: 'Durability guarantees that committed transactions persist in non-volatile storage.'
    },
    {
      title: 'Database Normalization Forms',
      topic: 'DBMS',
      subtopic: 'Normalization',
      difficulty: 'medium',
      description: 'A relation is in BCNF (Boyce-Codd Normal Form) if and only if for every non-trivial functional dependency X -> Y:',
      options: [
        { id: 'opt_1', text: 'X is a superkey', isCorrect: true },
        { id: 'opt_2', text: 'Y is a prime attribute', isCorrect: false },
        { id: 'opt_3', text: 'X is a foreign key', isCorrect: false },
        { id: 'opt_4', text: 'Y is functionally independent of X', isCorrect: false }
      ],
      explanation: 'In BCNF, the determinant X must strictly be a superkey.'
    },
    {
      title: 'SQL Indexing B+ Tree Structure',
      topic: 'DBMS',
      subtopic: 'Indexing',
      difficulty: 'medium',
      description: 'In a B+ Tree index, where are actual record pointers or table rows stored?',
      options: [
        { id: 'opt_1', text: 'Only in the leaf nodes', isCorrect: true },
        { id: 'opt_2', text: 'In all internal and leaf nodes', isCorrect: false },
        { id: 'opt_3', text: 'Only at the root node', isCorrect: false },
        { id: 'opt_4', text: 'Alternating levels', isCorrect: false }
      ],
      explanation: 'B+ trees store keys and data pointers exclusively at leaf nodes linked sequentially.'
    },
    // Operating Systems
    {
      title: 'Deadlock Necessary Conditions',
      topic: 'Operating Systems',
      subtopic: 'Deadlocks',
      difficulty: 'medium',
      description: 'Which of the following is NOT one of Coffman’s four necessary conditions for deadlock?',
      options: [
        { id: 'opt_1', text: 'Preemption allowed', isCorrect: true },
        { id: 'opt_2', text: 'Mutual Exclusion', isCorrect: false },
        { id: 'opt_3', text: 'Hold and Wait', isCorrect: false },
        { id: 'opt_4', text: 'Circular Wait', isCorrect: false }
      ],
      explanation: 'No preemption is the condition. Allowing preemption breaks deadlocks.'
    },
    {
      title: 'Virtual Memory Page Fault Handling',
      topic: 'Operating Systems',
      subtopic: 'Memory Management',
      difficulty: 'easy',
      description: 'What happens when a CPU references a page whose valid-invalid bit is set to 0 (invalid)?',
      options: [
        { id: 'opt_1', text: 'A page fault trap is generated to the OS', isCorrect: true },
        { id: 'opt_2', text: 'The program is immediately terminated', isCorrect: false },
        { id: 'opt_3', text: 'The CPU performs a branch instruction', isCorrect: false },
        { id: 'opt_4', text: 'The hard drive resets', isCorrect: false }
      ],
      explanation: 'Invalid bit triggers a page fault interrupt, invoking the OS page replacement routine.'
    },
    // Computer Networks
    {
      title: 'OSI Layer Protocol Mapping',
      topic: 'Computer Networks',
      subtopic: 'OSI Model',
      difficulty: 'easy',
      description: 'At which OSI layer does the TCP protocol operate?',
      options: [
        { id: 'opt_1', text: 'Transport Layer', isCorrect: true },
        { id: 'opt_2', text: 'Network Layer', isCorrect: false },
        { id: 'opt_3', text: 'Data Link Layer', isCorrect: false },
        { id: 'opt_4', text: 'Application Layer', isCorrect: false }
      ],
      explanation: 'TCP and UDP operate at Layer 4 (Transport Layer).'
    },
    {
      title: 'TCP Three-Way Handshake',
      topic: 'Computer Networks',
      subtopic: 'TCP/IP',
      difficulty: 'medium',
      description: 'What is the correct sequence of packet flags sent during a standard TCP connection establishment?',
      options: [
        { id: 'opt_1', text: 'SYN -> SYN-ACK -> ACK', isCorrect: true },
        { id: 'opt_2', text: 'ACK -> SYN -> SYN-ACK', isCorrect: false },
        { id: 'opt_3', text: 'SYN -> ACK -> DATA', isCorrect: false },
        { id: 'opt_4', text: 'FIN -> ACK -> SYN', isCorrect: false }
      ],
      explanation: 'Client sends SYN, Server replies SYN-ACK, Client acknowledges with ACK.'
    },
    // OOP
    {
      title: 'Polymorphism Concept in OOP',
      topic: 'OOP',
      subtopic: 'Polymorphism',
      difficulty: 'easy',
      description: 'Method overriding in object-oriented programming is an example of:',
      options: [
        { id: 'opt_1', text: 'Runtime (Dynamic) Polymorphism', isCorrect: true },
        { id: 'opt_2', text: 'Compile-time Polymorphism', isCorrect: false },
        { id: 'opt_3', text: 'Static Binding', isCorrect: false },
        { id: 'opt_4', text: 'Macro Expansion', isCorrect: false }
      ],
      explanation: 'Method overriding resolution is performed dynamically at runtime via virtual tables.'
    },
    {
      title: 'Diamond Problem Resolution',
      topic: 'OOP',
      subtopic: 'Inheritance',
      difficulty: 'medium',
      description: 'How does C++ solve the diamond problem in multiple inheritance?',
      options: [
        { id: 'opt_1', text: 'Virtual base classes', isCorrect: true },
        { id: 'opt_2', text: 'Interface segregation', isCorrect: false },
        { id: 'opt_3', text: 'Final specifier', isCorrect: false },
        { id: 'opt_4', text: 'Operator overloading', isCorrect: false }
      ],
      explanation: 'Using `virtual` inheritance ensures only one instance of the base class exists.'
    }
  ];

  const createdMcqQuestions: any[] = [];
  for (const q of mcqQuestionsData) {
    const doc = await Question.create({
      collegeId: apexCollege._id,
      creatorId: facultyApti._id,
      title: q.title,
      description: q.description,
      type: 'mcq',
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      marks: q.difficulty === 'hard' ? 4 : q.difficulty === 'medium' ? 2 : 1,
      negativeMarks: 0.25,
      estimatedTimeMinutes: 2,
      tags: [q.topic.toLowerCase(), q.subtopic.toLowerCase(), q.difficulty],
      options: q.options,
      explanation: q.explanation,
      status: 'verified',
      attemptCount: 24,
      correctCount: 16,
      avgTimeSeconds: 40
    });
    createdMcqQuestions.push(doc);
  }

  // 6. Create Realistic Assessments
  const sampleAssessment = await Assessment.create({
    collegeId: apexCollege._id,
    creatorId: facultyDSA._id,
    title: 'DSA Placement Mock #04',
    description: 'Comprehensive placement readiness mock covering Arrays, Linked Lists, Trees, and Core Aptitude.',
    instructions: '1. Fullscreen mode is strictly monitored.\n2. Do not switch tabs or minimize the window.\n3. Coding answers are evaluated against hidden test cases.',
    durationMinutes: 60,
    totalMarks: 50,
    passPercentage: 50,
    status: 'published',
    startDate: new Date(Date.now() - 24 * 3600 * 1000), // started yesterday
    endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000), // ends next week
    sections: [
      {
        id: 'sec_aptitude',
        name: 'Aptitude & Analytical Reasoning',
        type: 'aptitude',
        questionIds: createdMcqQuestions.slice(0, 5).map(q => q._id),
        marksPerQuestion: 2,
        totalMarks: 10
      },
      {
        id: 'sec_technical',
        name: 'Core Technical CS (DBMS, OS, CN)',
        type: 'technical',
        questionIds: createdMcqQuestions.slice(5, 10).map(q => q._id),
        marksPerQuestion: 2,
        totalMarks: 10
      },
      {
        id: 'sec_coding',
        name: 'Coding Evaluation',
        type: 'coding',
        questionIds: [createdCodingQuestions[0]._id, createdCodingQuestions[1]._id],
        marksPerQuestion: 15,
        totalMarks: 30
      }
    ],
    rules: {
      shuffleQuestions: false,
      shuffleOptions: false,
      negativeMarking: true,
      fullscreenRequired: true,
      tabSwitchLimit: 3,
      copyPasteRestricted: true,
      maxAttempts: 2
    },
    assignedDepartments: [apexCSE._id, apexIT._id],
    assignedStudents: []
  });

  // Second published assessment: "Core CS Diagnostic Assessment"
  await Assessment.create({
    collegeId: apexCollege._id,
    creatorId: facultyDSA._id,
    title: 'Core CS Diagnostic Assessment',
    description: 'Mid-semester assessment on Operating Systems, Networks, and Algorithms.',
    instructions: 'Time allowed is 45 minutes.',
    durationMinutes: 45,
    totalMarks: 40,
    passPercentage: 40,
    status: 'published',
    startDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    endDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
    sections: [
      {
        id: 'sec_tech',
        name: 'Technical MCQs',
        type: 'technical',
        questionIds: createdMcqQuestions.slice(6, 12).map(q => q._id),
        marksPerQuestion: 2,
        totalMarks: 12
      },
      {
        id: 'sec_coding',
        name: 'Algorithms',
        type: 'coding',
        questionIds: [createdCodingQuestions[3]._id, createdCodingQuestions[4]._id],
        marksPerQuestion: 14,
        totalMarks: 28
      }
    ],
    rules: {
      shuffleQuestions: true,
      shuffleOptions: false,
      negativeMarking: false,
      fullscreenRequired: true,
      tabSwitchLimit: 3,
      copyPasteRestricted: true,
      maxAttempts: 1
    },
    assignedDepartments: [apexCSE._id],
    assignedStudents: []
  });

  console.log('[Seed] Database seeded successfully with:');
  console.log(' - 2 Colleges (Apex & Horizon)');
  console.log(' - 4 Departments');
  console.log(' - 8 Users across all roles (Password: Evalora@2026)');
  console.log(` - ${createdCodingQuestions.length} Coding questions with multi-language starter code and test cases`);
  console.log(` - ${createdMcqQuestions.length} MCQ and Technical questions`);
  console.log(' - 2 Published assessments without precomputed result analytics');
}

if (process.argv[1]?.includes('seedData')) {
  connectDB().then(async () => {
    const { seedDefaultPlans } = await import('../config/plans.js');
    const { seedDefaultDomains } = await import('../config/domains.js');
    const { seedDefaultVisualizerSamples } = await import('../config/visualizerSamples.js');
    await seedDefaultPlans();
    await seedDefaultDomains();
    await seedDefaultVisualizerSamples();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  });
}
