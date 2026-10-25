import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LogoMark } from "../../components/ui/LogoMark";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  FileCheck2,
  Layers,
  ShieldCheck,
  Wallet,
  Play,
  RotateCcw,
  Sliders,
  Check,
  ChevronRight,
  Zap,
  Lock,
  Cpu,
  Award,
  Terminal,
  Brain,
  HelpCircle,
  BookOpen,
  Minus,
} from "lucide-react";

type HeroPreviewTab = "practice" | "question" | "coding" | "analytics";
type PracticeCategory = "dsa" | "aptitude" | "reasoning" | "coding";
type DifficultyLevel = "easy" | "medium" | "hard";

interface DemoProblem {
  category: string;
  topic: string;
  difficulty: DifficultyLevel;
  type: "mcq" | "coding";
  title: string;
  statement: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
  codeSnippet?: {
    python: string;
    cpp: string;
    java: string;
  };
  sampleOutput?: string;
}

const DEMO_PROBLEMS: Record<PracticeCategory, Record<DifficultyLevel, DemoProblem>> = {
  dsa: {
    easy: {
      category: "DSA",
      topic: "Arrays & Two Pointers",
      difficulty: "easy",
      type: "mcq",
      title: "Target Sum in Sorted Array",
      statement: "Given a sorted array of distinct integers and a target sum, which technique achieves the optimal O(n) runtime with O(1) auxiliary space?",
      options: [
        { id: "a", text: "Two-pointer approach inward from both ends", isCorrect: true },
        { id: "b", text: "Nested loops comparing all pairs", isCorrect: false },
        { id: "c", text: "Hashing each element into an auxiliary hash table", isCorrect: false },
        { id: "d", text: "Recursive divide and conquer", isCorrect: false },
      ],
      explanation: "Because the array is sorted, maintaining left and right pointers and advancing based on sum comparison achieves O(n) time and O(1) space.",
    },
    medium: {
      category: "DSA",
      topic: "Sliding Window",
      difficulty: "medium",
      type: "mcq",
      title: "Longest Substring Without Repeating Characters",
      statement: "When tracking unique characters in a sliding window [L, R] using a frequency map or last-seen index array, what is the tightest upper bound on pointer moves?",
      options: [
        { id: "a", text: "O(n) where both L and R advance at most n times", isCorrect: true },
        { id: "b", text: "O(n log n) due to repeated map resizing", isCorrect: false },
        { id: "c", text: "O(n²) whenever repeating characters occur near the end", isCorrect: false },
        { id: "d", text: "O(2^n) worst case with ASCII strings", isCorrect: false },
      ],
      explanation: "Each character is visited at most twice: once when R expands and once when L contracts, ensuring strict linear O(n) amortized performance.",
    },
    hard: {
      category: "DSA",
      topic: "Dynamic Programming",
      difficulty: "hard",
      type: "mcq",
      title: "Longest Increasing Subsequence with Binary Search",
      statement: "How can the classic O(n²) LIS dynamic programming algorithm be optimized to O(n log n)?",
      options: [
        { id: "a", text: "Patience sorting / tails array with binary search (std::lower_bound)", isCorrect: true },
        { id: "b", text: "Segment tree with range maximum queries on sorted values only", isCorrect: false },
        { id: "c", text: "Greedy selection of minimal adjacent pairs", isCorrect: false },
        { id: "d", text: "Breadth-first search over graph DAG vertices", isCorrect: false },
      ],
      explanation: "Maintaining an array where tails[i] stores the smallest tail of all increasing subsequences of length i + 1 allows O(log n) binary search per element.",
    },
  },
  aptitude: {
    easy: {
      category: "Quantitative Aptitude",
      topic: "Percentages & Ratios",
      difficulty: "easy",
      type: "mcq",
      title: "Successive Percentage Changes",
      statement: "A quantity increases by 20% and then decreases by 20%. What is the net overall percentage change?",
      options: [
        { id: "a", text: "4% decrease", isCorrect: true },
        { id: "b", text: "0% (remains unchanged)", isCorrect: false },
        { id: "c", text: "2% decrease", isCorrect: false },
        { id: "d", text: "4% increase", isCorrect: false },
      ],
      explanation: "Net change = x + y + (xy / 100) = 20 - 20 - 400/100 = -4%, which is a 4% net reduction.",
    },
    medium: {
      category: "Quantitative Aptitude",
      topic: "Time & Work",
      difficulty: "medium",
      type: "mcq",
      title: "Combined Pipe & Cistern Efficiency",
      statement: "Pipe A fills a tank in 12 hours, while Pipe B empties it in 18 hours. If both run simultaneously, how many hours are needed to fill the empty tank?",
      options: [
        { id: "a", text: "36 hours", isCorrect: true },
        { id: "b", text: "30 hours", isCorrect: false },
        { id: "c", text: "24 hours", isCorrect: false },
        { id: "d", text: "45 hours", isCorrect: false },
      ],
      explanation: "Net rate per hour = 1/12 - 1/18 = (3 - 2)/36 = 1/36. Thus, 36 hours are required to completely fill the tank.",
    },
    hard: {
      category: "Quantitative Aptitude",
      topic: "Probability & Permutations",
      difficulty: "hard",
      type: "mcq",
      title: "Conditional Urn Probability",
      statement: "An urn contains 4 red and 6 green balls. Two balls are drawn successively without replacement. What is the probability that both balls are red?",
      options: [
        { id: "a", text: "2/15", isCorrect: true },
        { id: "b", text: "4/25", isCorrect: false },
        { id: "c", text: "1/5", isCorrect: false },
        { id: "d", text: "3/10", isCorrect: false },
      ],
      explanation: "P(1st Red) = 4/10. P(2nd Red | 1st Red) = 3/9. Product = (4/10) × (3/9) = (2/5) × (1/3) = 2/15.",
    },
  },
  reasoning: {
    easy: {
      category: "Logical Reasoning",
      topic: "Blood Relations",
      difficulty: "easy",
      type: "mcq",
      title: "Direct Family Relations",
      statement: "Pointing to a man, a woman says: 'His mother is the only daughter of my mother.' How is the woman related to the man?",
      options: [
        { id: "a", text: "Mother", isCorrect: true },
        { id: "b", text: "Sister", isCorrect: false },
        { id: "c", text: "Maternal Aunt", isCorrect: false },
        { id: "d", text: "Grandmother", isCorrect: false },
      ],
      explanation: "The only daughter of the woman's mother is the woman herself. Therefore, his mother is the woman, making her his mother.",
    },
    medium: {
      category: "Logical Reasoning",
      topic: "Syllogisms",
      difficulty: "medium",
      type: "mcq",
      title: "Logical Deductions",
      statement: "Statements: All routers are gateways. Some gateways are firewalls. Which conclusion definitely follows?",
      options: [
        { id: "a", text: "Some gateways are routers", isCorrect: true },
        { id: "b", text: "All routers are firewalls", isCorrect: false },
        { id: "c", text: "No router is a firewall", isCorrect: false },
        { id: "d", text: "All firewalls are gateways", isCorrect: false },
      ],
      explanation: "From 'All routers are gateways', conversion gives 'Some gateways are routers'. The relation between routers and firewalls cannot be determined with certainty.",
    },
    hard: {
      category: "Logical Reasoning",
      topic: "Seating Arrangement",
      difficulty: "hard",
      type: "mcq",
      title: "Circular Arrangement with Dual Facing",
      statement: "Eight people sit in a circle. Four face center, four face outward. If A sits third to the right of B who faces center, where is A facing if C sits adjacent to A and opposite B?",
      options: [
        { id: "a", text: "A faces outward and is opposite E", isCorrect: true },
        { id: "b", text: "A faces center directly", isCorrect: false },
        { id: "c", text: "A's orientation cannot be determined", isCorrect: false },
        { id: "d", text: "A sits immediate left of B", isCorrect: false },
      ],
      explanation: "Following circular step-derivation with parity constraints on inward/outward count establishes A's exact position and outward facing vector.",
    },
  },
  coding: {
    easy: {
      category: "Coding",
      topic: "Prefix Sums",
      difficulty: "easy",
      type: "coding",
      title: "Running Sum of 1D Array",
      statement: "Given an array nums, return the running sum where runningSum[i] = sum(nums[0]...nums[i]). Evaluate in O(n) time.",
      explanation: "Accumulating the prefix in-place yields O(n) runtime and O(1) auxiliary space.",
      codeSnippet: {
        python: "def running_sum(nums):\n    for i in range(1, len(nums)):\n        nums[i] += nums[i - 1]\n    return nums",
        cpp: "vector<int> runningSum(vector<int>& nums) {\n    for(int i = 1; i < nums.size(); ++i)\n        nums[i] += nums[i - 1];\n    return nums;\n}",
        java: "public int[] runningSum(int[] nums) {\n    for (int i = 1; i < nums.length; i++) {\n        nums[i] += nums[i - 1];\n    }\n    return nums;\n}"
      },
      sampleOutput: "Input: [1,2,3,4] -> Output: [1,3,6,10] (All 8 Testcases Passed)",
    },
    medium: {
      category: "Coding",
      topic: "Two Pointers",
      difficulty: "medium",
      type: "coding",
      title: "Container With Most Water",
      statement: "Find two lines from height array that together with x-axis forms a container containing the maximum area.",
      explanation: "Using inward two pointers moving the smaller boundary guarantees finding the global maximum in O(n) time.",
      codeSnippet: {
        python: "def max_area(height):\n    l, r, ans = 0, len(height) - 1, 0\n    while l < r:\n        ans = max(ans, min(height[l], height[r]) * (r - l))\n        if height[l] < height[r]: l += 1\n        else: r -= 1\n    return ans",
        cpp: "int maxArea(vector<int>& h) {\n    int l = 0, r = h.size() - 1, ans = 0;\n    while(l < r) {\n        ans = max(ans, min(h[l], h[r]) * (r - l));\n        h[l] < h[r] ? l++ : r--;\n    }\n    return ans;\n}",
        java: "public int maxArea(int[] h) {\n    int l = 0, r = h.length - 1, max = 0;\n    while (l < r) {\n        max = Math.max(max, Math.min(h[l], h[r]) * (r - l));\n        if (h[l] < h[r]) l++; else r--;\n    }\n    return max;\n}"
      },
      sampleOutput: "Input: [1,8,6,2,5,4,8,3,7] -> Output: 49 (Runtime: 18ms, Memory: 14.2MB)",
    },
    hard: {
      category: "Coding",
      topic: "Monotonic Queue",
      difficulty: "hard",
      type: "coding",
      title: "Sliding Window Maximum",
      statement: "Given an array nums and window size k, return the maximum sliding window element for each step in O(n) total time.",
      explanation: "Maintaining a monotonically decreasing deque of indices allows O(1) amortized queries per window shift.",
      codeSnippet: {
        python: "from collections import deque\ndef max_sliding_window(nums, k):\n    q, ans = deque(), []\n    for i, x in enumerate(nums):\n        while q and nums[q[-1]] <= x: q.pop()\n        q.append(i)\n        if q[0] <= i - k: q.popleft()\n        if i >= k - 1: ans.append(nums[q[0]])\n    return ans",
        cpp: "vector<int> maxSlidingWindow(vector<int>& nums, int k) {\n    deque<int> dq; vector<int> res;\n    for(int i = 0; i < nums.size(); ++i) {\n        while(!dq.empty() && nums[dq.back()] <= nums[i]) dq.pop_back();\n        dq.push_back(i);\n        if(dq.front() <= i - k) dq.pop_front();\n        if(i >= k - 1) res.push_back(nums[dq.front()]);\n    }\n    return res;\n}",
        java: "public int[] maxSlidingWindow(int[] nums, int k) {\n    Deque<Integer> q = new ArrayDeque<>();\n    int[] res = new int[nums.length - k + 1];\n    for (int i = 0; i < nums.length; i++) {\n        while (!q.isEmpty() && nums[q.peekLast()] <= nums[i]) q.pollLast();\n        q.offerLast(i);\n        if (q.peekFirst() <= i - k) q.pollFirst();\n        if (i >= k - 1) res[i - k + 1] = nums[q.peekFirst()];\n    }\n    return res;\n}"
      },
      sampleOutput: "Input: [1,3,-1,-3,5,3,6,7], k=3 -> Output: [3,3,5,5,6,7] (15/15 Hidden Suites Passed)",
    },
  },
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, authStatus } = useAuth();

  const handleStartPractice = () => {
    if (isLoading || authStatus === "initializing") {
      return;
    }
    if (isAuthenticated && user) {
      if (user.role === "student") navigate("/practice");
      else if (user.role === "admin" || user.role === "platform_admin") navigate("/admin");
      else if (user.role === "faculty") navigate("/faculty/dashboard");
      else if (user.role === "college_admin") navigate("/admin/dashboard");
      else navigate("/practice");
    } else {
      navigate("/login?redirect=/practice");
    }
  };

  const handleExploreAssessments = () => {
    if (isLoading || authStatus === "initializing") {
      return;
    }
    if (isAuthenticated && user) {
      if (user.role === "student") navigate("/assessments");
      else if (user.role === "admin" || user.role === "platform_admin") navigate("/admin");
      else if (user.role === "faculty" || user.role === "college_admin") navigate("/faculty/assessments");
      else navigate("/assessments");
    } else {
      navigate("/login?redirect=/assessments");
    }
  };

  const handleDashboard = () => {
    if (isLoading || authStatus === "initializing") {
      return;
    }
    if (isAuthenticated && user) {
      if (user.role === "student") navigate("/dashboard");
      else if (user.role === "admin" || user.role === "platform_admin") navigate("/admin");
      else if (user.role === "faculty") navigate("/faculty/dashboard");
      else if (user.role === "college_admin") navigate("/admin/dashboard");
      else navigate("/dashboard");
    } else {
      navigate("/register");
    }
  };

  // Hero interactive state
  const [heroTab, setHeroTab] = useState<HeroPreviewTab>("practice");
  const [heroTrack, setHeroTrack] = useState<"dsa" | "aptitude" | "reasoning">("dsa");
  const [heroSelectedOption, setHeroSelectedOption] = useState<string | null>(null);
  const [heroLang, setHeroLang] = useState<"python" | "cpp" | "java">("python");

  // Interactive Demo section state
  const [demoCategory, setDemoCategory] = useState<PracticeCategory>("dsa");
  const [demoDifficulty, setDemoDifficulty] = useState<DifficultyLevel>("medium");
  const [demoCount, setDemoCount] = useState<number>(10);
  const [aiReplenish, setAiReplenish] = useState<boolean>(true);
  const [activeDemoProblem, setActiveDemoProblem] = useState<DemoProblem>(DEMO_PROBLEMS.dsa.medium);
  const [selectedDemoAnswer, setSelectedDemoAnswer] = useState<string | null>(null);
  const [demoCodingLang, setDemoCodingLang] = useState<"python" | "cpp" | "java">("python");
  const [isDemoGenerated, setIsDemoGenerated] = useState<boolean>(true);

  // How it works interactive step
  const [activeStep, setActiveStep] = useState<number>(1);

  // Feature showcase tab
  const [featureTab, setFeatureTab] = useState<"practice" | "coding" | "assessments" | "blockchain">("practice");

  const handleGenerateDemo = () => {
    const next = DEMO_PROBLEMS[demoCategory][demoDifficulty];
    setActiveDemoProblem(next);
    setSelectedDemoAnswer(null);
    setIsDemoGenerated(true);
  };

  return (
    <div className="space-y-24 px-4 pb-20 sm:px-6">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH TASTEFUL INTERACTIVE WORKSPACE PREVIEW               */}
      {/* ========================================================================= */}
      <section className="mx-auto grid min-h-[calc(100vh-8.5rem)] max-w-[1240px] grid-cols-1 items-center gap-12 pt-6 sm:pt-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D6DAFF] bg-[#EEF0FF] px-3.5 py-1.5 text-xs font-semibold text-[#34358F]">
            <Brain className="h-3.5 w-3.5 text-[#5B5CE2]" />
            <span>Evalora — Next-Gen Adaptive Practice &amp; Assessment</span>
          </div>

          <div className="space-y-4">
            <h1 className="display-heading max-w-2xl text-[2.75rem] leading-[1.04] text-[#18181F] sm:text-6xl">
              Practice smarter.
              <span className="block text-[#5B5CE2]">Evaluate better.</span>
              <span className="block text-[#34358F]">Evolve faster.</span>
            </h1>
            <p className="max-w-xl text-base leading-7 text-[#6B6B78] md:text-lg">
              Structured multi-track practice across DSA, Aptitude, Reasoning, and Coding.
              Guaranteed zero repetitive questions with Google Gemini AI replenishment and sandboxed multi-language judge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <Button
              size="lg"
              variant="primary"
              onClick={handleStartPractice}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              {isAuthenticated ? "Continue Practicing" : "Start Practicing Free (10 Attempts)"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/domains')}
              icon={<BookOpen className="h-4 w-4 text-[#5B5CE2]" />}
            >
              Explore Domains
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/pricing')}
              icon={<Wallet className="h-4 w-4 text-[#5B5CE2]" />}
            >
              View Plans (&lt; 9 ALGO)
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-[#6B6B78]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#5B5CE2]" />
              <span>10 complimentary attempts included</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#5B5CE2]" />
              <span>Email + password and Pera Wallet login</span>
            </div>
          </div>
        </div>

        {/* Interactive Workspace Preview Surface */}
        <div className="surface-rule overflow-hidden rounded-[16px] border border-[#E8E8EF] shadow-[0_12px_40px_-8px_rgba(52,53,143,0.08)]">
          {/* Surface Top Header Bar */}
          <div className="flex items-center justify-between border-b border-[#E8E8EF] bg-[#F7F7FB] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <LogoMark size="sm" />
              <span className="hidden text-[11px] font-medium text-[#9494A3] sm:inline">
                interactive workspace preview
              </span>
            </div>

            {/* Preview View Switcher Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-[#E8E8EF] bg-white p-1 text-[11px] font-medium text-[#6B6B78]">
              <button
                onClick={() => setHeroTab("practice")}
                className={`rounded px-2.5 py-1 transition-all ${
                  heroTab === "practice"
                    ? "bg-[#EEF0FF] text-[#34358F] font-semibold"
                    : "hover:text-[#18181F]"
                }`}
              >
                Builder
              </button>
              <button
                onClick={() => setHeroTab("question")}
                className={`rounded px-2.5 py-1 transition-all ${
                  heroTab === "question"
                    ? "bg-[#EEF0FF] text-[#34358F] font-semibold"
                    : "hover:text-[#18181F]"
                }`}
              >
                Question
              </button>
              <button
                onClick={() => setHeroTab("coding")}
                className={`rounded px-2.5 py-1 transition-all ${
                  heroTab === "coding"
                    ? "bg-[#EEF0FF] text-[#34358F] font-semibold"
                    : "hover:text-[#18181F]"
                }`}
              >
                Sandbox
              </button>
              <button
                onClick={() => setHeroTab("analytics")}
                className={`rounded px-2.5 py-1 transition-all ${
                  heroTab === "analytics"
                    ? "bg-[#EEF0FF] text-[#34358F] font-semibold"
                    : "hover:text-[#18181F]"
                }`}
              >
                Analytics
              </button>
            </div>
          </div>

          {/* Interactive Workspace Body */}
          <div className="min-h-[420px] bg-white p-5 sm:p-6">
            {/* VIEW 1: PRACTICE BUILDER PREVIEW */}
            {heroTab === "practice" && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#18181F]">
                      Multi-Section Adaptive Practice
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6B6B78]">
                      Click a category track below to simulate instant section composition.
                    </p>
                  </div>
                  <Badge variant="blue">Dynamic Pool</Badge>
                </div>

                {/* Track selector chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "dsa", label: "DSA & Algorithms", count: "10 Qs", diff: "Medium" },
                    { id: "aptitude", label: "Quantitative Aptitude", count: "10 Qs", diff: "Easy" },
                    { id: "reasoning", label: "Logical Reasoning", count: "10 Qs", diff: "Medium" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setHeroTrack(t.id as any)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
                        heroTrack === t.id
                          ? "border-[#5B5CE2] bg-[#EEF0FF] font-semibold text-[#34358F] shadow-xs"
                          : "border-[#E8E8EF] bg-[#F7F7FB] text-[#6B6B78] hover:border-[#D6DAFF]"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5 text-[#5B5CE2]" />
                      <span>{t.label}</span>
                      <span className="text-[10px] opacity-75">• {t.diff}</span>
                    </button>
                  ))}
                </div>

                {/* Simulated Section Card Breakdown */}
                <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-4 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E8E8EF] pb-2.5">
                    <span className="font-semibold text-[#18181F]">
                      Active Configuration: {heroTrack.toUpperCase()} Track
                    </span>
                    <span className="font-mono text-[#5B5CE2]">30 Questions Total</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="rounded-lg border border-[#E8E8EF] bg-white p-2.5">
                      <div className="text-[11px] text-[#6B6B78]">Fresh Question Pool</div>
                      <div className="mt-1 text-sm font-semibold text-[#18181F]">100% Guaranteed</div>
                    </div>
                    <div className="rounded-lg border border-[#E8E8EF] bg-white p-2.5">
                      <div className="text-[11px] text-[#6B6B78]">AI Auto-Replenish</div>
                      <div className="mt-1 text-sm font-semibold text-[#34358F]">Gemini Pro Active</div>
                    </div>
                    <div className="rounded-lg border border-[#E8E8EF] bg-white p-2.5">
                      <div className="text-[11px] text-[#6B6B78]">Attempt Quota</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">1 Attempt Deducted</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#6B6B78]">
                    Try clicking <strong>Question</strong> or <strong>Sandbox</strong> above to preview student room
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setHeroTab("question")}
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    View Question Mode
                  </Button>
                </div>
              </div>
            )}

            {/* VIEW 2: QUESTION SOLVER PREVIEW */}
            {heroTab === "question" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">Question 1 of 10</Badge>
                    <Badge variant="purple">DSA • Sliding Window</Badge>
                  </div>
                  <span className="font-mono text-xs text-[#6B6B78]">Est: 2m</span>
                </div>

                <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-4 text-xs">
                  <p className="font-medium text-[#18181F]">
                    Given an array of integers, which sliding window technique handles variable window sizes with non-negative sums in linear time?
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    { id: "opt_1", text: "Expand right pointer until sum exceeded, then contract left pointer", correct: true },
                    { id: "opt_2", text: "Reset both pointers to zero whenever a negative value is encountered", correct: false },
                    { id: "opt_3", text: "Run nested quadratic loop over all subarrays", correct: false },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setHeroSelectedOption(opt.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all ${
                        heroSelectedOption === opt.id
                          ? opt.correct
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold"
                            : "border-rose-400 bg-rose-50 text-rose-950 font-semibold"
                          : "border-[#E8E8EF] bg-white text-[#18181F] hover:bg-[#F7F7FB]"
                      }`}
                    >
                      <span>{opt.text}</span>
                      {heroSelectedOption === opt.id && (
                        opt.correct ? (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="text-[10px] text-rose-600 font-semibold">Try another</span>
                        )
                      )}
                    </button>
                  ))}
                </div>

                {heroSelectedOption && (
                  <div className="rounded-lg border border-[#D6DAFF] bg-[#EEF0FF] p-3 text-[11px] text-[#34358F]">
                    <strong>Instant Explanation:</strong> The two-pointer expansion and contraction pattern ensures each element enters and exits the window at most once, achieving strict O(n) amortized runtime.
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: DEVELOPER CODE SANDBOX PREVIEW */}
            {heroTab === "coding" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#18181F]">Sandbox Execution</span>
                    <Badge variant="green">Compiler Online</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    {(["python", "cpp", "java"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setHeroLang(lang)}
                        className={`rounded px-2 py-0.5 capitalize transition-all ${
                          heroLang === lang
                            ? "bg-[#5B5CE2] text-white font-semibold"
                            : "bg-[#F7F7FB] text-[#6B6B78] hover:text-[#18181F]"
                        }`}
                      >
                        {lang === "cpp" ? "C++ 20" : lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E8E8EF] bg-[#18181F] p-4 font-mono text-xs text-slate-200">
                  <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-400">
                    <span>solution.{heroLang === "python" ? "py" : heroLang === "cpp" ? "cpp" : "java"}</span>
                    <span className="text-emerald-400">All 14 Hidden Testcases Passed</span>
                  </div>
                  <pre className="overflow-x-auto text-[11.5px] leading-relaxed">
                    {heroLang === "python" && (
                      `def solve(nums, target):\n    seen = {0: -1}\n    acc = 0\n    for i, x in enumerate(nums):\n        acc += x\n        if acc - target in seen:\n            return True\n        seen[acc] = i\n    return False`
                    )}
                    {heroLang === "cpp" && (
                      `bool solve(vector<int>& nums, int target) {\n    unordered_map<int, int> seen{{0, -1}};\n    int acc = 0;\n    for(int i = 0; i < nums.size(); ++i) {\n        acc += nums[i];\n        if(seen.count(acc - target)) return true;\n        seen[acc] = i;\n    }\n    return false;\n}`
                    )}
                    {heroLang === "java" && (
                      `public boolean solve(int[] nums, int target) {\n    Map<Integer, Integer> seen = new HashMap<>();\n    seen.put(0, -1);\n    int acc = 0;\n    for(int i = 0; i < nums.length; i++) {\n        acc += nums[i];\n        if(seen.containsKey(acc - target)) return true;\n        seen.put(acc, i);\n    }\n    return false;\n}`
                    )}
                  </pre>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[#E8E8EF] bg-[#F7F7FB] px-3.5 py-2 text-xs">
                  <span className="text-[#6B6B78]">Runtime: <strong className="text-[#18181F]">18 ms</strong> • Memory: <strong className="text-[#18181F]">14.1 MB</strong></span>
                  <span className="text-emerald-700 font-semibold">100 / 100 Score</span>
                </div>
              </div>
            )}

            {/* VIEW 4: ANALYTICS & SKILL PROFILE PREVIEW */}
            {heroTab === "analytics" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#18181F]">Student Topic Mastery Matrix</span>
                  <Badge variant="blue">+10 XP Earned</Badge>
                </div>

                <div className="space-y-3">
                  {[
                    { topic: "Data Structures & Arrays", pct: 92, badge: "Mastered" },
                    { topic: "Dynamic Programming & Trees", pct: 74, badge: "Proficient" },
                    { topic: "Quantitative Ratios & Time-Work", pct: 88, badge: "Mastered" },
                    { topic: "Logical Syllogisms & Seating", pct: 81, badge: "Advanced" },
                  ].map((m) => (
                    <div key={m.topic} className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-3 text-xs">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-semibold text-[#18181F]">{m.topic}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[#5B5CE2]">{m.pct}%</span>
                          <span className="text-[10px] text-[#6B6B78]">({m.badge})</span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E8EF]">
                        <div
                          className="h-full rounded-full bg-[#5B5CE2] transition-all duration-500"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-[#6B6B78]">
                  <span>Algorand Certifiable Skill Credential Ready</span>
                  <span className="font-semibold text-[#34358F]">Verified On-Chain</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. WHAT EVALORA SOLVES — DIRECT COMPARISON                                */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="mb-12 max-w-2xl space-y-3">
          <div className="page-kicker">Core Differentiation</div>
          <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
            Engineered to eliminate repetitive drills and shallow assessment.
          </h2>
          <p className="text-sm leading-6 text-[#6B6B78]">
            Traditional placement portals rely on stagnant question banks that students memorize. Evalora guarantees fresh challenges tailored to individual growth.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Legacy Pitfalls Card */}
          <div className="rounded-[16px] border border-[#E8E8EF] bg-[#FAFAFD] p-7">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700">✕</span>
              Legacy Placement Portals
            </div>
            <ul className="space-y-3.5 text-xs text-[#6B6B78] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">•</span>
                <span><strong>Stale Question Banks:</strong> Same 50 questions repeated every exam, encouraging rote memorization rather than actual skill.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">•</span>
                <span><strong>No Real Coding Judge:</strong> Multiple-choice approximations that fail to test edge cases, runtime complexity, or sandboxed execution.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">•</span>
                <span><strong>Unverified Certificates:</strong> Easily forged PDF receipts with zero cryptographic validation.</span>
              </li>
            </ul>
          </div>

          {/* Evalora Advantage Card */}
          <div className="rounded-[16px] border border-[#D6DAFF] bg-white p-7 shadow-[0_6px_28px_-6px_rgba(91,92,226,0.12)]">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#34358F]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF0FF] text-[#5B5CE2]">✓</span>
              Evalora Architecture
            </div>
            <ul className="space-y-3.5 text-xs text-[#18181F] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#5B5CE2] shrink-0 mt-0.5" />
                <span><strong>Freshness Guarantee:</strong> Algorithmic history tracking ensures you never see a repeated question unless explicitly requested.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#5B5CE2] shrink-0 mt-0.5" />
                <span><strong>Google Gemini AI Replenishment:</strong> Automatic synthesis of high-fidelity questions with reference solutions and testcases.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#5B5CE2] shrink-0 mt-0.5" />
                <span><strong>Algorand Cryptographic Anchoring:</strong> Pera Wallet login, QR authentication, and tamper-proof attempt unlocking.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE PRACTICE DEMO — HANDS-ON DEMONSTRATION                     */}
      {/* ========================================================================= */}
      <section id="interactive-demo" className="mx-auto max-w-[1240px] scroll-mt-24 border-t border-[#E8E8EF] pt-20">
        <div className="mb-10 max-w-2xl space-y-3">
          <div className="page-kicker">Interactive Demonstration</div>
          <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
            Test the adaptive engine directly in your browser.
          </h2>
          <p className="text-sm leading-6 text-[#6B6B78]">
            Configure track, difficulty, and question parameters below to experience how Evalora synthesizes personalized practice sets.
          </p>
        </div>

        {/* Demo Playground Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
          {/* Controls Column */}
          <div className="rounded-[16px] border border-[#E8E8EF] bg-white p-6 shadow-sm space-y-6">
            <div>
              <label className="text-xs font-semibold text-[#18181F] uppercase tracking-wider block mb-2.5">
                1. Select Track
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "dsa", label: "DSA", icon: Code2 },
                  { id: "aptitude", label: "Aptitude", icon: Layers },
                  { id: "reasoning", label: "Reasoning", icon: FileCheck2 },
                  { id: "coding", label: "Coding Judge", icon: Terminal },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setDemoCategory(item.id as PracticeCategory);
                      setActiveDemoProblem(DEMO_PROBLEMS[item.id as PracticeCategory][demoDifficulty]);
                      setSelectedDemoAnswer(null);
                    }}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs transition-all ${
                      demoCategory === item.id
                        ? "border-[#5B5CE2] bg-[#EEF0FF] font-semibold text-[#34358F]"
                        : "border-[#E8E8EF] bg-[#F7F7FB] text-[#6B6B78] hover:border-[#D6DAFF]"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 text-[#5B5CE2]" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#18181F] uppercase tracking-wider block mb-2.5">
                2. Target Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => {
                      setDemoDifficulty(diff);
                      setActiveDemoProblem(DEMO_PROBLEMS[demoCategory][diff]);
                      setSelectedDemoAnswer(null);
                    }}
                    className={`rounded-xl border py-2 text-xs capitalize transition-all ${
                      demoDifficulty === diff
                        ? "border-[#5B5CE2] bg-[#EEF0FF] font-semibold text-[#34358F]"
                        : "border-[#E8E8EF] bg-[#F7F7FB] text-[#6B6B78] hover:border-[#D6DAFF]"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#18181F] uppercase tracking-wider block mb-2.5">
                3. Session Question Count
              </label>
              <div className="flex gap-2">
                {[5, 10, 20].map((count) => (
                  <button
                    key={count}
                    onClick={() => setDemoCount(count)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-mono transition-all ${
                      demoCount === count
                        ? "border-[#5B5CE2] bg-[#EEF0FF] font-bold text-[#34358F]"
                        : "border-[#E8E8EF] bg-[#F7F7FB] text-[#6B6B78] hover:border-[#D6DAFF]"
                    }`}
                  >
                    {count} Qs
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#18181F]">AI Replenishment</span>
                <button
                  onClick={() => setAiReplenish(!aiReplenish)}
                  className={`h-5 w-9 rounded-full transition-colors p-0.5 ${
                    aiReplenish ? "bg-[#5B5CE2]" : "bg-[#D4D4E0]"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      aiReplenish ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-[#6B6B78]">
                {aiReplenish ? "Google Gemini Pro guarantees fresh problem generation if pool is depleted." : "Only pull from pre-existing verified question pool."}
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleGenerateDemo}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Generate Demo Session
            </Button>
          </div>

          {/* Interactive Problem Viewer */}
          <div className="surface-rule overflow-hidden rounded-[16px] border border-[#E8E8EF] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8EF] pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="blue">{activeDemoProblem.category}</Badge>
                <Badge variant="purple">{activeDemoProblem.topic}</Badge>
                <Badge variant={activeDemoProblem.difficulty === "easy" ? "green" : activeDemoProblem.difficulty === "medium" ? "amber" : "rose"}>
                  {activeDemoProblem.difficulty.toUpperCase()}
                </Badge>
              </div>
              <span className="text-xs text-[#6B6B78] font-mono">
                Interactive Preview Mode
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#18181F]">
                  {activeDemoProblem.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#4A4A57]">
                  {activeDemoProblem.statement}
                </p>
              </div>

              {/* If MCQ type: interactive options */}
              {activeDemoProblem.type === "mcq" && activeDemoProblem.options && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold text-[#9494A3] uppercase tracking-wider">
                    Select an answer to inspect instant evaluation:
                  </div>
                  {activeDemoProblem.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedDemoAnswer(opt.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-xs transition-all ${
                        selectedDemoAnswer === opt.id
                          ? opt.isCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold"
                            : "border-rose-400 bg-rose-50 text-rose-950 font-semibold"
                          : "border-[#E8E8EF] bg-[#F7F7FB] text-[#18181F] hover:border-[#D6DAFF] hover:bg-white"
                      }`}
                    >
                      <span className="pr-4">{opt.text}</span>
                      {selectedDemoAnswer === opt.id && (
                        opt.isCorrect ? (
                          <Badge variant="green">Correct</Badge>
                        ) : (
                          <Badge variant="rose">Incorrect</Badge>
                        )
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* If Coding type: language code preview and sandbox output */}
              {activeDemoProblem.type === "coding" && activeDemoProblem.codeSnippet && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9494A3] uppercase tracking-wider">
                      Reference Solution ({demoCodingLang}):
                    </span>
                    <div className="flex gap-1 text-[10px]">
                      {(["python", "cpp", "java"] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setDemoCodingLang(l)}
                          className={`rounded px-2 py-0.5 uppercase ${
                            demoCodingLang === l
                              ? "bg-[#5B5CE2] text-white font-semibold"
                              : "bg-[#F7F7FB] text-[#6B6B78] hover:text-[#18181F]"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre className="rounded-xl border border-[#E8E8EF] bg-[#18181F] p-4 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
                    {activeDemoProblem.codeSnippet[demoCodingLang]}
                  </pre>
                  {activeDemoProblem.sampleOutput && (
                    <div className="rounded-lg border border-[#D6DAFF] bg-[#EEF0FF] p-3 text-xs font-mono text-[#34358F]">
                      {activeDemoProblem.sampleOutput}
                    </div>
                  )}
                </div>
              )}

              {/* Solution explanation */}
              {selectedDemoAnswer && (
                <div className="rounded-xl border border-[#D6DAFF] bg-[#EEF0FF] p-4 text-xs text-[#34358F]">
                  <div className="font-semibold text-[#18181F] mb-1">
                    Verified Solution Analysis
                  </div>
                  <p className="leading-relaxed">{activeDemoProblem.explanation}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E8E8EF] pt-4">
                <span className="text-xs text-[#6B6B78]">
                  Ready to launch an official graded session with real timer and analytics?
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleStartPractice}
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  {isAuthenticated ? "Launch Graded Session" : "Start Official Session"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE HOW EVALORA WORKS (4-STEP WALKTHROUGH)                     */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="mb-12 max-w-2xl space-y-3">
          <div className="page-kicker">Workflow Architecture</div>
          <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
            From topic selection to certified skill verification.
          </h2>
          <p className="text-sm leading-6 text-[#6B6B78]">
            Click any step to inspect the underlying system mechanics.
          </p>
        </div>

        {/* 4 Interactive Steps Switcher */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {[
            { step: 1, label: "01 Scope", title: "Targeted Composition" },
            { step: 2, label: "02 Fresh Engine", title: "Zero Repetition" },
            { step: 3, label: "03 Judge & Score", title: "Sandbox Testing" },
            { step: 4, label: "04 Credential", title: "Blockchain Record" },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setActiveStep(item.step)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                activeStep === item.step
                  ? "border-[#5B5CE2] bg-[#EEF0FF] shadow-xs"
                  : "border-[#E8E8EF] bg-white hover:border-[#D6DAFF] hover:bg-[#F7F7FB]"
              }`}
            >
              <div className={`text-xs font-mono font-semibold ${
                activeStep === item.step ? "text-[#5B5CE2]" : "text-[#9494A3]"
              }`}>
                {item.label}
              </div>
              <div className={`mt-1 text-sm font-semibold ${
                activeStep === item.step ? "text-[#34358F]" : "text-[#18181F]"
              }`}>
                {item.title}
              </div>
            </button>
          ))}
        </div>

        {/* Dynamic Detail Card Based on Active Step */}
        <div className="rounded-[16px] border border-[#E8E8EF] bg-white p-7 shadow-sm">
          {activeStep === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-center">
              <div className="space-y-3">
                <Badge variant="blue">Step 01 • Configuration</Badge>
                <h3 className="display-heading text-2xl text-[#18181F]">
                  Multi-Section Practice Builder
                </h3>
                <p className="text-xs leading-relaxed text-[#6B6B78]">
                  Combine DSA, Aptitude, Reasoning, and Coding in one synchronized exam. Set individual difficulties, target questions, and time limits per section with atomic quota validation.
                </p>
                <div className="pt-2 text-xs font-medium text-[#5B5CE2]">
                  Supports up to 5 concurrent sections per attempt
                </div>
              </div>
              <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-5 text-xs font-mono space-y-2">
                <div className="text-[#34358F] font-semibold">// POST /api/practice/generate</div>
                <div className="text-[#18181F]">sections: [</div>
                <div className="pl-4 text-[#6B6B78]">&#123; category: 'DSA', topic: 'Arrays', difficulty: 'medium', count: 10 &#125;,</div>
                <div className="pl-4 text-[#6B6B78]">&#123; category: 'Aptitude', topic: 'Percentages', difficulty: 'easy', count: 10 &#125;</div>
                <div className="text-[#18181F]">]</div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-center">
              <div className="space-y-3">
                <Badge variant="purple">Step 02 • Adaptive Freshness</Badge>
                <h3 className="display-heading text-2xl text-[#18181F]">
                  Continuous Fresh-Question Engine & AI Replenish
                </h3>
                <p className="text-xs leading-relaxed text-[#6B6B78]">
                  Evalora audits your complete historical attempt log in MongoDB. If the verified pool has insufficient fresh questions, the Google Gemini Pro provider synthesizes, validates, and stores verified candidates on the fly.
                </p>
                <div className="pt-2 text-xs font-medium text-[#5B5CE2]">
                  Guaranteed zero repeated questions unless review mode enabled
                </div>
              </div>
              <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-5 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-[#E8E8EF] pb-2">
                  <span className="font-semibold text-[#18181F]">Fresh Selection Audit</span>
                  <Badge variant="green">Verified Fresh</Badge>
                </div>
                <div className="text-xs text-[#6B6B78] space-y-1">
                  <div>• Attempt history queried: 142 completed questions</div>
                  <div>• Duplicates automatically excluded from active candidate pool</div>
                  <div>• Gemini 3.5 Pro standby ready for instant replenishment</div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-center">
              <div className="space-y-3">
                <Badge variant="green">Step 03 • Code Execution</Badge>
                <h3 className="display-heading text-2xl text-[#18181F]">
                  Developer Monaco Workspace & Sandbox Judge
                </h3>
                <p className="text-xs leading-relaxed text-[#6B6B78]">
                  Write C, C++, Python, and Java code in Monaco Editor. Execute against custom stdin or submit for complete isolated sandbox testing against hidden edge cases with CPU and memory limits.
                </p>
                <div className="pt-2 text-xs font-medium text-[#5B5CE2]">
                  Strict 2000ms time limits, 256MB memory caps, and zero network escapes
                </div>
              </div>
              <div className="rounded-xl border border-[#E8E8EF] bg-[#18181F] p-4 text-xs font-mono text-slate-200 space-y-2">
                <div className="flex justify-between text-slate-400 text-[11px] border-b border-white/10 pb-1.5">
                  <span>POST /api/submissions/evaluate</span>
                  <span className="text-emerald-400">Exit Code: 0</span>
                </div>
                <div>Testcase 1: Passed (14ms, 8.2MB)</div>
                <div>Testcase 2: Passed (19ms, 8.4MB)</div>
                <div>Testcase 3 (Hidden Edge): Passed (21ms, 8.9MB)</div>
                <div className="text-emerald-400 font-bold pt-1">Verdict: ACCEPTED (100%)</div>
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-center">
              <div className="space-y-3">
                <Badge variant="blue">Step 04 • Verification</Badge>
                <h3 className="display-heading text-2xl text-[#18181F]">
                  Actionable Analytics & Algorand Trust
                </h3>
                <p className="text-xs leading-relaxed text-[#6B6B78]">
                  Review in-depth topic breakdown, percentile tracking, and time management metrics. Connect your Algorand wallet or unlock paid attempts with instant micro-payments.
                </p>
                <div className="pt-2 text-xs font-medium text-[#5B5CE2]">
                  Pera Wallet QR login + transparent Algorand blockchain ledger
                </div>
              </div>
              <div className="rounded-xl border border-[#D6DAFF] bg-[#EEF0FF] p-5 text-xs text-[#34358F] space-y-2">
                <div className="flex items-center justify-between border-b border-[#D6DAFF] pb-2">
                  <span className="font-semibold text-[#18181F]">Algorand Verification Status</span>
                  <Badge variant="blue">Pera Connected</Badge>
                </div>
                <div>• Cryptographic Challenge Signature Verified</div>
                <div>• Attempts Balance: 10 Free + 60 Pro Unlocked</div>
                <div>• Transaction ID: 2F4K...89XP verified on Algorand Testnet</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE FEATURE SHOWCASE (TABS)                                   */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="mb-10 max-w-2xl space-y-3">
          <div className="page-kicker">Platform Features</div>
          <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
            Comprehensive tools for students, faculty, and institutions.
          </h2>
        </div>

        {/* Feature Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#E8E8EF] pb-4">
          {[
            { id: "practice", label: "Adaptive Practice" },
            { id: "coding", label: "Coding Workspace" },
            { id: "assessments", label: "Institutional Assessments" },
            { id: "blockchain", label: "Algorand Multi-Wallet" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFeatureTab(tab.id as any)}
              className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                featureTab === tab.id
                  ? "bg-[#5B5CE2] text-white font-semibold shadow-xs"
                  : "bg-white text-[#6B6B78] hover:bg-[#F7F7FB] hover:text-[#18181F] border border-[#E8E8EF]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="mt-8 rounded-[16px] border border-[#E8E8EF] bg-white p-7 shadow-sm">
          {featureTab === "practice" && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Layers className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Multi-Track Combiner</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Design practice sessions pairing algorithmic coding with quantitative percentages and logical syllogisms.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Brain className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">AI Replenishment</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Powered by Google Gemini 3.5 Pro to synthesize new questions when existing pools run low, complete with verified explanations.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Atomic Quota Safety</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Race-condition-proof attempt deductions prevent accidental losses and guarantee seamless session resumption.
                </p>
              </div>
            </div>
          )}

          {featureTab === "coding" && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Terminal className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Multi-Language Support</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  First-class support for Python 3, C++ 20, C17, and Java 25 with language-specific starter boilerplate and types.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Cpu className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Isolated Sandbox</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Sandboxed process isolation guarding against malicious code execution with strict timeout and resource limits.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Hidden Test Verification</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Evaluate solutions against hidden edge cases, boundary parameters, and performance stress tests.
                </p>
              </div>
            </div>
          )}

          {featureTab === "assessments" && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Faculty Assessment Builder</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Construct exams with custom pass marks, scheduled availability windows, and Department-based student targeting.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Lock className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Anti-Cheat Proctoring</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Full-screen enforcement, tab-switch monitoring, copy-paste guards, and real-time live proctoring dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Batch Analytics</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Analyze cohort performance, difficulty drop-offs, and department-level question discrimination indices.
                </p>
              </div>
            </div>
          )}

          {featureTab === "blockchain" && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Wallet className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Desktop QR Wallet Login</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Sign in instantly by scanning a desktop QR code using your Pera Wallet mobile app on Algorand.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Zero Private Credential Storage</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Evalora never requests or stores seed phrases or private keys. All authentication uses cryptographic challenge verification.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                  <Award className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#18181F]">Algorand Micro-Payments</h4>
                <p className="text-xs text-[#6B6B78] leading-relaxed">
                  Unlock practice attempts with instant ALGO blockchain payments verified directly against the Algorand network.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. PREMIUM TECHNOLOGY DOMAIN PREPARATION                                  */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <div className="page-kicker">Multi-Domain Preparation</div>
            <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
              Specialized preparation paths for in-demand tech roles.
            </h2>
            <p className="text-sm leading-relaxed text-[#6B6B78]">
              Prepare for real-world engineering careers with structured roadmaps, interactive multi-tab code editors, and live criteria evaluation.
            </p>
          </div>
          <Button
            size="md"
            variant="outline"
            onClick={() => navigate('/domains')}
            icon={<ArrowRight className="h-4 w-4 text-[#5B5CE2]" />}
          >
            Explore All Domains
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              slug: 'mern-stack',
              name: 'MERN Stack Development',
              desc: 'MongoDB, Express.js, React.js, Node.js with real-time practical apps.',
              modules: 7,
              tag: 'Full Curriculum',
              highlight: 'Live <iframe> preview + Node.js sandbox'
            },
            {
              slug: 'ai-machine-learning',
              name: 'Artificial Intelligence & ML',
              desc: 'NumPy, Pandas, Scikit-learn, neural networks, and model evaluation.',
              modules: 5,
              tag: 'Advanced AI',
              highlight: 'Python 3 data pipelines & algorithms'
            },
            {
              slug: 'data-science',
              name: 'Data Science & Analytics',
              desc: 'Exploratory data analysis, SQL joins, aggregations, and statistics.',
              modules: 5,
              tag: 'High Demand',
              highlight: 'Relational data modeling & visualization'
            },
            {
              slug: 'frontend-development',
              name: 'Frontend Engineering',
              desc: 'Modern CSS Flexbox/Grid, TypeScript, React components, and hooks.',
              modules: 5,
              tag: 'Web Standards',
              highlight: 'Responsive multi-device viewport testing'
            },
            {
              slug: 'backend-development',
              name: 'Backend Engineering',
              desc: 'RESTful API architectures, JWT security, PostgreSQL, and Docker.',
              modules: 5,
              tag: 'Core Systems',
              highlight: 'Sandboxed API routing & schema design'
            },
            {
              slug: 'fullstack-development',
              name: 'Full-Stack Engineering',
              desc: 'End-to-end cloud applications, state syncing, and system design.',
              modules: 6,
              tag: 'Comprehensive',
              highlight: 'Production build pipelines & deployment'
            }
          ].map((domain) => (
            <div
              key={domain.slug}
              className="flex flex-col justify-between rounded-2xl border border-[#E8E8EF] bg-white p-6 shadow-xs hover:border-[#D6DAFF] hover:shadow-md transition-all duration-150"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="blue" size="sm">{domain.tag}</Badge>
                  <span className="text-[11px] font-semibold text-[#5B5CE2]">{domain.modules} Modules</span>
                </div>
                <h3 className="text-base font-bold text-[#18181F]">{domain.name}</h3>
                <p className="text-xs text-[#6B6B78] leading-relaxed">{domain.desc}</p>
                <div className="rounded-lg bg-[#F7F7FB] border border-[#E8E8EF] p-2 text-[10px] text-[#34358F] font-mono">
                  {domain.highlight}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E8E8EF] flex items-center justify-between">
                <span className="text-[11px] text-[#6B6B78]">Syllabus Preview Available</span>
                <button
                  onClick={() => navigate(`/domains/${domain.slug}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B5CE2] hover:text-[#34358F]"
                >
                  <span>View Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FREE VS PREMIUM SUBSCRIPTION COMPARISON                                */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="mb-12 max-w-2xl space-y-3">
          <div className="page-kicker">Honest & Transparent Model</div>
          <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
            Free practice for all. Premium for deep technical mastery.
          </h2>
          <p className="text-sm leading-relaxed text-[#6B6B78]">
            No hidden fees, no automatic recurring lock-ins. Subscribe with Pera Wallet only when you want to unlock extra attempts or domain preparation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Free Tier Card */}
          <div className="rounded-2xl border border-[#E8E8EF] bg-white p-7 space-y-5 shadow-xs">
            <div className="space-y-2">
              <Badge variant="blue">Free Forever</Badge>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[#18181F]">0 ALGO</span>
                <span className="text-xs text-[#6B6B78]">/ 10 Complimentary Attempts</span>
              </div>
              <p className="text-xs text-[#6B6B78] leading-relaxed">
                Ideal for evaluating platform capabilities, taking institutional assessments, and personal practice.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-[#18181F] pt-2 border-t border-[#E8E8EF]">
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>10 Practice Sessions</strong> with full question scoring</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>All Standard Categories</strong>: DSA, Aptitude, Reasoning, Coding</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Isolated Code Sandbox</strong>: Python, C, C++, Java execution</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Downloadable Performance Report</strong> (PDF analysis)</span>
              </div>
              <div className="flex items-start gap-2.5 text-[#9494A3]">
                <Minus className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Technology Domain Practice (Syllabus preview only)</span>
              </div>
              <div className="flex items-start gap-2.5 text-[#9494A3]">
                <Minus className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Interactive Multi-tab Web Workspaces & Live Preview</span>
              </div>
            </div>

            <div className="pt-4">
              <Button
                size="md"
                variant="outline"
                className="w-full justify-center"
                onClick={handleStartPractice}
              >
                Start Practicing Free
              </Button>
            </div>
          </div>

          {/* Premium Subscriptions Card */}
          <div className="rounded-2xl border-2 border-[#5B5CE2] bg-gradient-to-br from-white to-[#EEF0FF]/40 p-7 space-y-5 shadow-md relative">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="purple">Subscribed Tier</Badge>
                <span className="text-[10px] font-semibold text-[#5B5CE2] uppercase tracking-wider">
                  Always &lt; 9 ALGO
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-[#18181F]">1 to 8 ALGO</span>
                <span className="text-xs text-[#5B5CE2] font-semibold">/ +15 to +150 Attempts + Domain Pass</span>
              </div>
              <p className="text-xs text-[#6B6B78] leading-relaxed">
                Bundles additional lifetime practice attempts with 30-90 days access to all technology domain preparation tracks.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-[#18181F] pt-2 border-t border-[#D6DAFF]">
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Benefit A: Extra Lifetime Attempts</strong> (+15 to +150 attempts, never expire)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Benefit B: All Tech Domains</strong> (MERN, AI/ML, Frontend, Backend, Full-Stack)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Multi-Tab Web Code Editor</strong>: HTML/CSS/JS with live sandboxed preview</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Real Portfolio Projects</strong> with milestone automated tests</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>48-Hour AI Adaptive Question Pool</strong> (Zero repetition)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Cryptographic Payment Receipt (PDF)</strong> with verified Algorand TxID</span>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <Button
                size="md"
                variant="primary"
                className="w-full justify-center"
                onClick={() => navigate('/pricing')}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                View Plans & Compare
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. SUBSCRIPTION PREVIEW & POPULAR PLANS HIGHLIGHT                         */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <div className="page-kicker">Instant Pera Wallet Payments</div>
            <h2 className="display-heading text-3xl text-[#18181F] sm:text-4xl">
              Compare plans. Choose your preparation intensity.
            </h2>
            <p className="text-sm leading-relaxed text-[#6B6B78]">
              Every plan strictly satisfies 0 &lt; price &lt; 9 ALGO. No subscription auto-renewal; pay only when you need it.
            </p>
          </div>
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate('/pricing')}
            icon={<Wallet className="h-4 w-4 text-[#5B5CE2]" />}
          >
            Full Comparison Matrix
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              id: 'trial',
              name: 'Testnet Practice Pass',
              price: 1,
              attempts: 15,
              domains: 'Standard Practice Only',
              badge: 'Testnet'
            },
            {
              id: 'starter',
              name: 'Starter Practice Pack',
              price: 3,
              attempts: 35,
              domains: 'Standard Practice Only',
              badge: 'Practice Pack'
            },
            {
              id: 'domain_pass',
              name: 'Domain Preparation Pass',
              price: 4,
              attempts: 25,
              domains: 'All Tech Domains (30 Days)',
              badge: 'Domain Pass'
            },
            {
              id: 'pro',
              name: 'Pro Interview Bundle',
              price: 5,
              attempts: 75,
              domains: 'All Tech Domains (30 Days)',
              badge: 'Most Popular',
              popular: true
            }
          ].map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                plan.popular
                  ? 'border-[#5B5CE2] bg-[#EEF0FF]/30 shadow-md ring-2 ring-[#5B5CE2]/20'
                  : 'border-[#E8E8EF] bg-white hover:border-[#D6DAFF]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={plan.popular ? 'green' : 'blue'} size="sm">
                    {plan.badge}
                  </Badge>
                  <span className="text-xs font-bold text-[#5B5CE2]">{plan.price} ALGO</span>
                </div>
                <h4 className="font-bold text-sm text-[#18181F]">{plan.name}</h4>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-emerald-700">+{plan.attempts} Practice Attempts</div>
                  <div className="text-[11px] text-[#6B6B78]">{plan.domains}</div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E8E8EF]">
                <Button
                  size="sm"
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => navigate('/pricing')}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. BOTTOM CALL TO ACTION                                                  */}
      {/* ========================================================================= */}
      <section className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 rounded-[16px] border border-[#D6DAFF] bg-white p-8 shadow-[0_4px_24px_-4px_rgba(91,92,226,0.12)] md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B5CE2]">
            Ready to Begin
          </div>
          <h3 className="display-heading text-2xl text-[#18181F] sm:text-3xl">
            Start your personalized practice session today.
          </h3>
          <p className="max-w-2xl text-xs sm:text-sm text-[#6B6B78]">
            Master DSA, Quantitative Aptitude, Logical Reasoning, and Developer Coding with 10 free complimentary sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="primary"
            onClick={handleStartPractice}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            {isAuthenticated ? "Continue Practicing" : "Start Practicing"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={handleDashboard}
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Account"}
          </Button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. CLEAN RESTRAINED FOOTER                                                */}
      {/* ========================================================================= */}
      <footer className="mx-auto max-w-[1240px] border-t border-[#E8E8EF] pt-8 text-xs text-[#6B6B78] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LogoMark size="sm" />
          <span>© {new Date().getFullYear()} Evalora Inc. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          {isAuthenticated ? (
            <>
              <button onClick={handleDashboard} className="hover:text-[#18181F]">Dashboard</button>
              <button onClick={handleStartPractice} className="hover:text-[#18181F]">Practice</button>
              <button onClick={handleExploreAssessments} className="hover:text-[#18181F]">Assessments</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate("/login")} className="hover:text-[#18181F]">Sign In</button>
              <button onClick={() => navigate("/register")} className="hover:text-[#18181F]">Register</button>
              <button onClick={() => navigate("/register/college")} className="hover:text-[#18181F]">Institution Onboarding</button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
