import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  ArrowRight,
  Code2,
  Database,
  Layers3,
  Sigma,
  Plus,
  Trash2,
  AlertTriangle,
  Compass,
  Layers,
  Sliders,
  Wallet,
  CheckCircle2,
  Check,
  Search,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { DifficultyLevel } from "../../shared/types";
import { AlgoPaymentPanel } from "../../components/payment/AlgoPaymentPanel";

export interface PracticeSectionRow {
  id: string;
  category: string;
  topic: string;
  difficulty: DifficultyLevel | "mixed";
  count: number;
  type: "mcq" | "coding" | "mixed";
}

const TOPIC_GROUPS = [
  {
    label: "DSA",
    description: "Data Structures & Core Algorithms",
    topics: [
      "Arrays",
      "Strings",
      "Linked Lists",
      "Trees",
      "Graphs",
      "Recursion",
      "Dynamic Programming",
    ],
    icon: Layers3,
  },
  {
    label: "Aptitude",
    description: "Quantitative & Numerical Ability",
    topics: [
      "Quantitative Aptitude",
      "Percentages",
      "Profit and Loss",
      "Time and Work",
      "Number Systems",
      "Verbal Ability",
    ],
    icon: Sigma,
  },
  {
    label: "Reasoning",
    description: "Logical & Analytical Deduction",
    topics: [
      "Logical Reasoning",
      "Blood Relations",
      "Syllogisms",
      "Direction Sense",
      "Puzzles",
    ],
    icon: Compass,
  },
  {
    label: "Coding",
    description: "Algorithm Implementation & Tests",
    topics: ["Arrays", "Strings", "Dynamic Programming", "Graphs", "Trees"],
    icon: Code2,
  },
  {
    label: "Placement / Core CS",
    description: "OS, DBMS, Networks, OOP",
    topics: ["DBMS", "Operating Systems", "Computer Networks", "OOP"],
    icon: Database,
  },
];

const PRESET_COMBINATIONS = [
  // 4 Single-Category Presets
  {
    name: "DSA Only",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 10, type: "mixed" as const },
    ],
  },
  {
    name: "Aptitude Only",
    sections: [
      { category: "Aptitude", topic: "Quantitative Aptitude", difficulty: "medium" as const, count: 10, type: "mcq" as const },
    ],
  },
  {
    name: "Reasoning Only",
    sections: [
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 10, type: "mcq" as const },
    ],
  },
  {
    name: "Coding Only",
    sections: [
      { category: "Coding", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "coding" as const },
    ],
  },
  // 6 Two-Domain Combinations
  {
    name: "DSA + Aptitude",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Aptitude", topic: "Percentages", difficulty: "easy" as const, count: 5, type: "mcq" as const },
    ],
  },
  {
    name: "DSA + Reasoning",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
    ],
  },
  {
    name: "DSA + Coding",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Coding", topic: "Arrays", difficulty: "medium" as const, count: 3, type: "coding" as const },
    ],
  },
  {
    name: "Aptitude + Reasoning",
    sections: [
      { category: "Aptitude", topic: "Quantitative Aptitude", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
    ],
  },
  {
    name: "Aptitude + Coding",
    sections: [
      { category: "Aptitude", topic: "Percentages", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Strings", difficulty: "medium" as const, count: 3, type: "coding" as const },
    ],
  },
  {
    name: "Reasoning + Coding",
    sections: [
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Strings", difficulty: "medium" as const, count: 3, type: "coding" as const },
    ],
  },
  // 4 Three-Domain Combinations
  {
    name: "DSA + Aptitude + Reasoning",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Aptitude", topic: "Quantitative Aptitude", difficulty: "easy" as const, count: 5, type: "mcq" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
    ],
  },
  {
    name: "DSA + Aptitude + Coding",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Aptitude", topic: "Quantitative Aptitude", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Arrays", difficulty: "medium" as const, count: 2, type: "coding" as const },
    ],
  },
  {
    name: "DSA + Reasoning + Coding",
    sections: [
      { category: "DSA", topic: "Trees", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Arrays", difficulty: "medium" as const, count: 2, type: "coding" as const },
    ],
  },
  {
    name: "Aptitude + Reasoning + Coding",
    sections: [
      { category: "Aptitude", topic: "Percentages", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Strings", difficulty: "medium" as const, count: 2, type: "coding" as const },
    ],
  },
  // Complete 4-Domain Grand Assessment
  {
    name: "DSA + Aptitude + Reasoning + Coding (Grand Assessment)",
    sections: [
      { category: "DSA", topic: "Arrays", difficulty: "medium" as const, count: 5, type: "mixed" as const },
      { category: "Aptitude", topic: "Quantitative Aptitude", difficulty: "easy" as const, count: 5, type: "mcq" as const },
      { category: "Reasoning", topic: "Logical Reasoning", difficulty: "medium" as const, count: 5, type: "mcq" as const },
      { category: "Coding", topic: "Arrays", difficulty: "medium" as const, count: 2, type: "coding" as const },
    ],
  },
];

export const PracticeSetup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshProfile } = useAuth();

  const initialTopic = searchParams.get("topic") || "Arrays";
  const initialGroup =
    TOPIC_GROUPS.find((group) => group.topics.includes(initialTopic))?.label ||
    "DSA";

  // Default to multi-section builder with Quick Topic toggle
  const [builderMode, setBuilderMode] = useState<"multi" | "single">("multi");

  // Single mode states
  const [selectedGroup, setSelectedGroup] = useState(initialGroup);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    DifficultyLevel | "mixed"
  >((searchParams.get("difficulty") as any) || "medium");
  const [questionCount, setQuestionCount] = useState<number>(
    searchParams.get("count") ? parseInt(searchParams.get("count")!, 10) : 10
  );
  const [practiceType, setPracticeType] = useState<"mcq" | "coding" | "mixed">(
    "mixed"
  );

  // Section-based custom builder state
  const [sections, setSections] = useState<PracticeSectionRow[]>([
    {
      id: "sec_1",
      category: initialGroup,
      topic: initialTopic,
      difficulty: (searchParams.get("difficulty") as any) || "medium",
      count: searchParams.get("count")
        ? parseInt(searchParams.get("count")!, 10)
        : 10,
      type: "mixed",
    },
  ]);

  // Validation & Availability states - default to enabling full question count fulfillment
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [allowRepeatFallback, setAllowRepeatFallback] = useState(true);
  const [expandDifficulty, setExpandDifficulty] = useState(true);
  const [broadenCategory, setBroadenCategory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);

  const freeRemaining = Math.max(
    0,
    (user?.freeAttempts?.total ?? 10) - (user?.freeAttempts?.used ?? 0)
  );
  const paidRemaining = Math.max(
    0,
    (user?.paidAttempts?.total ?? 0) - (user?.paidAttempts?.used ?? 0)
  );
  const totalRemainingAttempts = freeRemaining + paidRemaining;

  const activeGroup =
    TOPIC_GROUPS.find((group) => group.label === selectedGroup) ||
    TOPIC_GROUPS[0];

  const filteredTopics = useMemo(() => {
    if (!topicSearchQuery.trim()) return activeGroup.topics;
    const q = topicSearchQuery.toLowerCase().trim();
    return activeGroup.topics.filter((t) => t.toLowerCase().includes(q));
  }, [activeGroup, topicSearchQuery]);

  const checkFreshAvailability = async (sectionsToCheck: any[]) => {
    setIsValidating(true);
    try {
      const res = await api.post("/practice/validate-selection", {
        sections: sectionsToCheck.map((s) => ({
          category: s.category,
          topic: s.topic,
          difficulty: s.difficulty,
          count: s.count,
          type: s.type,
        })),
      });
      if (res.data.success) {
        setValidationSummary(res.data.summary);
      }
    } catch {
      // Fallback silently if validation network error
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (builderMode === "single") {
        checkFreshAvailability([
          {
            category: selectedGroup,
            topic: selectedTopic,
            difficulty: selectedDifficulty,
            count: questionCount,
            type: practiceType,
          },
        ]);
      } else {
        checkFreshAvailability(sections);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    builderMode,
    selectedGroup,
    selectedTopic,
    selectedDifficulty,
    questionCount,
    practiceType,
    sections,
  ]);

  const addSection = () => {
    if (sections.length >= 10) {
      toast.info("Maximum 10 sections per practice session.");
      return;
    }
    const newSec: PracticeSectionRow = {
      id: `sec_${Date.now()}`,
      category: "Aptitude",
      topic: "Percentages",
      difficulty: "easy",
      count: 10,
      type: "mcq",
    };
    setSections([...sections, newSec]);
  };

  const applyPreset = (preset: (typeof PRESET_COMBINATIONS)[0]) => {
    const newSections: PracticeSectionRow[] = preset.sections.map((s, idx) => ({
      id: `sec_preset_${idx}_${Date.now()}`,
      category: s.category,
      topic: s.topic,
      difficulty: s.difficulty,
      count: s.count,
      type: s.type,
    }));
    setSections(newSections);
    setBuilderMode("multi");
    toast.success(`Configured preset: ${preset.name}`);
  };

  const updateSection = (id: string, updates: Partial<PracticeSectionRow>) => {
    setSections(
      sections.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        if (updates.category && updates.category !== s.category) {
          const group = TOPIC_GROUPS.find((g) => g.label === updates.category);
          if (group && group.topics.length > 0) {
            updated.topic = group.topics[0];
          }
        }
        return updated;
      })
    );
  };

  const removeSection = (id: string) => {
    if (sections.length <= 1) {
      toast.info("At least one section is required.");
      return;
    }
    setSections(sections.filter((s) => s.id !== id));
  };

  const activeCategories = useMemo(() => {
    return Array.from(new Set(sections.map((s) => s.category)));
  }, [sections]);

  const toggleCategory = (categoryName: string) => {
    const isPresent = sections.some((s) => s.category === categoryName);
    if (isPresent) {
      if (sections.length <= 1) {
        toast.info("At least one section must remain configured.");
        return;
      }
      setSections(sections.filter((s) => s.category !== categoryName));
      toast.info(`Removed ${categoryName} from practice combination.`);
    } else {
      if (sections.length >= 10) {
        toast.info("Maximum 10 sections allowed.");
        return;
      }
      const group =
        TOPIC_GROUPS.find((g) => g.label === categoryName) || TOPIC_GROUPS[0];
      const defaultTopic = group.topics[0] || "General";
      const defaultType: "mcq" | "coding" | "mixed" =
        categoryName === "Coding"
          ? "coding"
          : categoryName === "Aptitude" || categoryName === "Reasoning"
          ? "mcq"
          : "mixed";
      const newSec: PracticeSectionRow = {
        id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: categoryName,
        topic: defaultTopic,
        difficulty: "medium",
        count: categoryName === "Coding" ? 3 : 5,
        type: defaultType,
      };
      setSections([...sections, newSec]);
      toast.success(`Added ${categoryName} to practice combination.`);
    }
  };

  const selectAllFourDomains = () => {
    const quad = PRESET_COMBINATIONS.find((p) =>
      p.name.includes("Grand Assessment")
    );
    if (quad) {
      applyPreset(quad);
    }
  };

  const currentCombinationFormula = useMemo(() => {
    const uniqueCats = Array.from(new Set(sections.map((s) => s.category)));
    return uniqueCats.join(" + ");
  }, [sections]);

  const handleGenerate = async (overrideOptions?: {
    acceptAvailableFresh?: boolean;
    expandDifficulty?: boolean;
    broadenCategory?: boolean;
    allowRepeatFallback?: boolean;
  }) => {
    if (totalRemainingAttempts <= 0) {
      setShowPaymentPanel(true);
      toast.warning(
        "You have used all available practice attempts. Unlock more with Pera Wallet."
      );
      return;
    }

    setIsGenerating(true);
    try {
      let payload: any;

      if (builderMode === "multi") {
        payload = {
          sections: sections.map((s) => ({
            category: s.category,
            topic: s.topic,
            difficulty: s.difficulty,
            count: s.count,
            type: s.type,
          })),
          allowRepeatFallback: overrideOptions?.allowRepeatFallback ?? allowRepeatFallback,
          expandDifficulty: overrideOptions?.expandDifficulty ?? expandDifficulty,
          broadenCategory: overrideOptions?.broadenCategory ?? broadenCategory,
          acceptAvailableFresh: overrideOptions?.acceptAvailableFresh ?? true,
        };
      } else {
        payload = {
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          questionCount,
          type: practiceType,
          allowRepeatFallback: overrideOptions?.allowRepeatFallback ?? allowRepeatFallback,
          expandDifficulty: overrideOptions?.expandDifficulty ?? expandDifficulty,
          broadenCategory: overrideOptions?.broadenCategory ?? broadenCategory,
          acceptAvailableFresh: overrideOptions?.acceptAvailableFresh ?? true,
          sections: [
            {
              category: selectedGroup,
              topic: selectedTopic,
              difficulty: selectedDifficulty,
              count: questionCount,
              type: practiceType,
            },
          ],
          ...overrideOptions,
        };
      }

      const res = await api.post("/practice/generate", payload);

      if (res.data.success) {
        await refreshProfile();
        if (res.data.hasShortfall) {
          toast.info(
            res.data.message ||
              `Practice session created with ${res.data.totalDelivered} fresh questions.`
          );
        } else {
          toast.success("Practice session created successfully.");
        }
        navigate(`/practice/${res.data.session._id}/room`, {
          state: {
            session: res.data.session,
            questions: res.data.questions,
          },
        });
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to generate practice session"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const totalQuestions =
    builderMode === "single"
      ? questionCount
      : sections.reduce((sum, s) => sum + s.count, 0);

  const hasInsufficientWarning =
    validationSummary && !validationSummary.overallSufficient;

  return (
    <div className="practice-builder-shell space-y-6">
      {/* Header */}
      <header className="practice-builder-hero flex flex-col justify-between gap-4 border-b border-[#E0E5EF] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5288B8]">
            Adaptive Practice Engine
          </p>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#3C4B63] md:text-4xl mt-1">
            Practice Builder
          </h1>
          <p className="mt-1 text-sm text-[#748199]">
            Your first session starts with curated topic questions. Returning learners get a fresh Gemini set matched to each selected topic and format.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl border border-[#E0E5EF] bg-white text-xs text-[#3C4B63] flex items-center gap-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  totalRemainingAttempts > 0 ? "bg-[#E5F2EB]" : "bg-[#F8EDEF]"
                }`}
              />
              <span className="font-semibold text-text-primary">
                Available: {totalRemainingAttempts}
              </span>
            </div>
            <span className="text-[#D0D0DC]">|</span>
            <div className="flex items-center gap-2 text-text-secondary text-[11px]">
              <span>Free: <strong className="text-text-primary font-medium">{freeRemaining}</strong></span>
              <span>&bull;</span>
              <span>Purchased: <strong className="text-[#4C765D] font-medium">+{paidRemaining}</strong></span>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Wallet className="w-3.5 h-3.5" />}
            onClick={() => setShowPaymentPanel((prev) => !prev)}
          >
            Unlock Attempts (ALGO)
          </Button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E0E5EF] shadow-xs">
            <button
              type="button"
              onClick={() => setBuilderMode("multi")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                builderMode === "multi"
                  ? "bg-[#EAF1F9] text-[#3C648E] shadow-[inset_0_0_0_1px_rgba(119,121,197,0.16)]"
                  : "text-[#748199] hover:text-[#3C4B63]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Section Builder
            </button>
            <button
              type="button"
              onClick={() => setBuilderMode("single")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                builderMode === "single"
                  ? "bg-[#EAF1F9] text-[#3C648E] shadow-[inset_0_0_0_1px_rgba(119,121,197,0.16)]"
                  : "text-[#748199] hover:text-[#3C4B63]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Quick Topic
            </button>
          </div>
        </div>
      </header>

      {(showPaymentPanel || totalRemainingAttempts === 0) && (
        <AlgoPaymentPanel
          onClose={() => setShowPaymentPanel(false)}
          onSuccess={() => setShowPaymentPanel(false)}
        />
      )}

      {/* Fresh Question Availability Warning Banner */}
      {hasInsufficientWarning && (
        <div className="p-4 rounded-xl border border-[#E9DAB5] bg-[#F8F3E8]/80 text-[#8A7047] space-y-3 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#8A7047] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Fresh Question Availability:{" "}
                </span>
                <span>
                  {validationSummary.totalFreshAvailable > 0
                    ? `${validationSummary.totalFreshAvailable} fresh unattempted questions match your exact selection (requested ${validationSummary.totalRequested}). AI generation or fallback rules can fill remaining questions.`
                    : `You have attempted all ${validationSummary.totalAvailable} questions matching this exact selection.`}
                </span>
              </div>
            </div>

            {validationSummary.totalFreshAvailable > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleGenerate({
                    acceptAvailableFresh: true,
                    expandDifficulty: false,
                    broadenCategory: false,
                    allowRepeatFallback: false,
                  })
                }
                isLoading={isGenerating}
              >
                Start with {validationSummary.totalFreshAvailable} Fresh
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E9DAB5]/70">
            <span className="font-semibold text-[#8A7047]">
              Fallback Options:
            </span>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3C4B63] bg-white px-2.5 py-1 rounded-lg border border-[#E9DAB5]">
              <input
                type="checkbox"
                checked={expandDifficulty}
                onChange={(e) => setExpandDifficulty(e.target.checked)}
              />
              Expand difficulty within topic
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3C4B63] bg-white px-2.5 py-1 rounded-lg border border-[#E9DAB5]">
              <input
                type="checkbox"
                checked={broadenCategory}
                onChange={(e) => setBroadenCategory(e.target.checked)}
              />
              Broaden to related category topics
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3C4B63] bg-white px-2.5 py-1 rounded-lg border border-[#E9DAB5]">
              <input
                type="checkbox"
                checked={allowRepeatFallback}
                onChange={(e) => setAllowRepeatFallback(e.target.checked)}
              />
              Allow repeating attempted questions
            </label>
          </div>
        </div>
      )}

      {builderMode === "multi" ? (
        /* Section-Based Custom Practice Builder */
        <div className="practice-builder-card rounded-2xl border border-[#E0E5EF] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(82,77,119,0.04)] space-y-6">
          {/* 1. Quick Category Combiner (1-Click Multi-Domain Selection) */}
          <div className="rounded-xl border border-[#D4D6F7] bg-[#F5F6FE] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#5288B8]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#3C648E]">
                  Quick Category Combiner (Select Any Combination)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllFourDomains}
                  className="text-xs font-semibold text-[#5288B8] hover:text-[#3C648E] transition-colors underline"
                >
                  Select All 4 Core Domains
                </button>
              </div>
            </div>

            {/* Interactive Domain Toggle Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {TOPIC_GROUPS.map((group) => {
                const isSelected = activeCategories.includes(group.label);
                const Icon = group.icon;
                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => toggleCategory(group.label)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-[#5288B8] text-white border-[#5288B8] shadow-sm"
                        : "bg-white text-[#748199] border-[#E0E5EF] hover:border-[#5288B8] hover:bg-[#EAF1F9] hover:text-[#3C648E]"
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-[#8490A2]" />
                    )}
                    <Icon className="h-3.5 w-3.5" />
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Combination Formula Display */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E0E2F8] text-xs">
              <div className="flex items-center gap-2 text-[#3C648E]">
                <span className="font-semibold">Active Combination:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#D4D6F7] font-semibold text-[#3C4B63]">
                  {currentCombinationFormula || "None"}
                </span>
              </div>
              <div className="text-[11px] text-[#748199]">
                {activeCategories.length} Domains Active • {sections.length} Section{sections.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* 2. All 15 Presets & Pre-Built Combinations */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#748199]">
                All Preset Combinations (Single, Dual, Triple & Grand)
              </span>
              <span className="text-[11px] text-[#8490A2]">
                {PRESET_COMBINATIONS.length} Pre-built combinations available
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COMBINATIONS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all flex items-center gap-1 ${
                    preset.name.includes("Grand")
                      ? "border-[#5288B8] bg-[#EAF1F9] text-[#3C648E] font-semibold shadow-xs hover:bg-[#5288B8] hover:text-white"
                      : "border-[#E0E5EF] bg-[#F7F8FC] text-[#3C4B63] hover:border-[#5288B8] hover:bg-[#EAF1F9] hover:text-[#3C648E]"
                  }`}
                >
                  <Plus className="h-2.5 w-2.5 text-[#5288B8]" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#E0E5EF]">
            <div>
              <h2 className="text-base font-semibold text-[#3C4B63]">
                Configured Sections
              </h2>
              <p className="text-xs text-[#748199] mt-0.5">
                Customize topic, difficulty, question count, and format for each section.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={addSection}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              + Add Section
            </Button>
          </div>

          <div className="space-y-4">
            {sections.map((section, idx) => {
              const group =
                TOPIC_GROUPS.find((g) => g.label === section.category) ||
                TOPIC_GROUPS[0];
              const sectionValidation = validationSummary?.sections?.[idx];

              return (
                <div
                  key={section.id}
                  className="p-4 sm:p-5 rounded-xl border border-[#E0E5EF] bg-[#F7F8FC] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#5288B8] text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-[#3C4B63]">
                        Section {idx + 1}
                      </span>
                      <span className="text-xs text-[#748199] truncate hidden sm:inline">
                        • {section.category} / {section.topic}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {sectionValidation && (
                        <Badge
                          variant={
                            sectionValidation.isSufficient ? "green" : "amber"
                          }
                        >
                          {sectionValidation.freshAvailable} fresh
                        </Badge>
                      )}
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className="text-[#8490A2] hover:text-[#A36162] transition-colors p-1"
                          title="Remove section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#748199]">
                        Category
                      </label>
                      <select
                        value={section.category}
                        onChange={(e) =>
                          updateSection(section.id, {
                            category: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-[#E0E5EF] bg-white px-3 py-2 text-xs font-medium text-[#3C4B63] focus:border-[#5288B8] focus:outline-none"
                      >
                        {TOPIC_GROUPS.map((g) => (
                          <option key={g.label} value={g.label}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#748199]">
                        Topic
                      </label>
                      <select
                        value={section.topic}
                        onChange={(e) =>
                          updateSection(section.id, { topic: e.target.value })
                        }
                        className="w-full rounded-lg border border-[#E0E5EF] bg-white px-3 py-2 text-xs font-medium text-[#3C4B63] focus:border-[#5288B8] focus:outline-none"
                      >
                        {group.topics.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#748199]">
                        Difficulty
                      </label>
                      <select
                        value={section.difficulty}
                        onChange={(e) =>
                          updateSection(section.id, {
                            difficulty: e.target.value as any,
                          })
                        }
                        className="w-full rounded-lg border border-[#E0E5EF] bg-white px-3 py-2 text-xs font-medium text-[#3C4B63] focus:border-[#5288B8] focus:outline-none"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#748199]">
                        Questions
                      </label>
                      <select
                        value={section.count}
                        onChange={(e) =>
                          updateSection(section.id, {
                            count: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-[#E0E5EF] bg-white px-3 py-2 text-xs font-medium text-[#3C4B63] focus:border-[#5288B8] focus:outline-none"
                      >
                        <option value={5}>5 Questions</option>
                        <option value={10}>10 Questions</option>
                        <option value={15}>15 Questions</option>
                        <option value={20}>20 Questions</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#748199]">
                        Format
                      </label>
                      <select
                        value={section.type}
                        onChange={(e) =>
                          updateSection(section.id, {
                            type: e.target.value as any,
                          })
                        }
                        className="w-full rounded-lg border border-[#E0E5EF] bg-white px-3 py-2 text-xs font-medium text-[#3C4B63] focus:border-[#5288B8] focus:outline-none"
                      >
                        <option value="mixed">Mixed (MCQ + Code)</option>
                        <option value="mcq">MCQ Only</option>
                        <option value="coding">Coding Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-brand-accent/25 bg-gradient-to-r from-brand-light/55 to-white p-3.5 text-xs text-brand-dark">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary shadow-sm"><Sparkles className="h-4 w-4" /></span>
            <p className="leading-relaxed"><strong>Adaptive question rotation.</strong> First-time learners use the curated topic bank. After a learner has attempted a question, Gemini creates a validated fresh set for each matching section on future sessions.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-[#E0E5EF]">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#748199]">
              <span>
                Sections: <strong className="text-[#3C4B63]">{sections.length}</strong>
              </span>
              <span className="text-[#D0DDD7]">•</span>
              <span>
                Total Questions: <strong className="text-[#3C4B63]">{totalQuestions}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={addSection}
                icon={<Plus className="h-4 w-4" />}
              >
                + Add Section
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => handleGenerate()}
                isLoading={isGenerating || isValidating}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Start Practice Session
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Redesigned Responsive Quick Topic Mode */
        <div className="practice-builder-card rounded-2xl border border-[#E0E5EF] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(82,77,119,0.04)] space-y-6">
          {/* Category Tabs */}
          <div>
            <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-[#748199]">
              Select Category
            </span>
            <div className="flex flex-wrap gap-2">
              {TOPIC_GROUPS.map((group) => {
                const Icon = group.icon;
                const isSelected = selectedGroup === group.label;
                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group.label);
                      setSelectedTopic(group.topics[0]);
                      setTopicSearchQuery("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-[#5288B8] text-white shadow-xs"
                        : "bg-[#F7F8FC] text-[#748199] hover:bg-[#EAF1F9] hover:text-[#3C648E] border border-[#E0E5EF]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Topic Selection with Search */}
          <div className="space-y-3 pt-3 border-t border-[#E0E5EF]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#748199]">
                Topics in {selectedGroup} ({filteredTopics.length})
              </span>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8490A2]" />
                <input
                  type="text"
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                  placeholder="Filter topics..."
                  className="w-full rounded-lg border border-[#E0E5EF] bg-[#F7F8FC] py-1.5 pl-8 pr-3 text-xs text-[#3C4B63] focus:border-[#5288B8] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {filteredTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredTopics.map((topic) => {
                  const isSelected = selectedTopic === topic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setSelectedTopic(topic)}
                      className={`min-w-0 rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? "border-[#5288B8] bg-[#EAF1F9] text-[#3C648E] font-semibold ring-1 ring-[#5288B8]/30 shadow-xs"
                          : "border-[#E0E5EF] bg-white text-[#748199] hover:bg-[#F7F8FC] hover:text-[#3C4B63]"
                      }`}
                    >
                      <span className="truncate text-xs">{topic}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-[#5288B8] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E0E5EF] p-6 text-center text-xs text-[#8490A2]">
                No topics match &quot;{topicSearchQuery}&quot; in {selectedGroup}.
              </div>
            )}
          </div>

          {/* Quick Topic Parameters & Summary */}
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 pt-4 border-t border-[#E0E5EF]">
            <div className="space-y-5">
              <Segmented
                label="Difficulty Level"
                value={selectedDifficulty}
                options={[
                  ["easy", "Easy"],
                  ["medium", "Medium"],
                  ["hard", "Hard"],
                  ["mixed", "Mixed"],
                ]}
                onChange={(value) =>
                  setSelectedDifficulty(value as DifficultyLevel | "mixed")
                }
              />

              <Segmented
                label="Question Count"
                value={String(questionCount)}
                options={[
                  ["5", "5 Questions"],
                  ["10", "10 Questions"],
                  ["15", "15 Questions"],
                  ["20", "20 Questions"],
                ]}
                onChange={(value) => setQuestionCount(Number(value))}
              />

              <Segmented
                label="Question Format"
                value={practiceType}
                options={[
                  ["mixed", "Mixed (MCQ + Code)"],
                  ["coding", "Coding Only"],
                  ["mcq", "MCQ Only"],
                ]}
                onChange={(value) =>
                  setPracticeType(value as "mcq" | "coding" | "mixed")
                }
              />
            </div>

            {/* Session Summary Card */}
            <div className="flex flex-col justify-between rounded-xl border border-[#E0E5EF] bg-[#F7F8FC] p-5">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E0E5EF]">
                  <span className="text-xs font-semibold text-[#3C4B63]">
                    Session Overview
                  </span>
                  {validationSummary?.sections?.[0] && (
                    <Badge variant={validationSummary.sections[0].freshAvailable > 0 ? "green" : "amber"}>
                      {validationSummary.sections[0].freshAvailable} fresh available
                    </Badge>
                  )}
                </div>

                <div className="mt-3 space-y-2.5 text-xs">
                  <Summary label="Category" value={selectedGroup} />
                  <Summary label="Topic" value={selectedTopic} />
                  <Summary label="Difficulty" value={selectedDifficulty} />
                  <Summary label="Questions" value={`${questionCount} Questions`} />
                  <Summary label="Format" value={practiceType} />
                </div>
              </div>

              <div className="mt-5 space-y-3 pt-4 border-t border-[#E0E5EF]">
                <div className="flex items-start gap-2 rounded-xl bg-[#F5F6FE] px-3 py-2.5 text-[11px] leading-relaxed text-[#4B4C9F]"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />Fresh Gemini questions are automatically used for returning learners, matched to this topic and selection.</div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => handleGenerate()}
                  isLoading={isGenerating || isValidating}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Start Practice Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Segmented: React.FC<{
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#748199]">
      {label}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`min-w-0 rounded-xl border px-3 py-2 text-xs font-medium transition-all truncate text-center ${
            value === id
              ? "border-[#5288B8] bg-[#5288B8] text-white font-semibold shadow-xs"
              : "border-[#E0E5EF] bg-white text-[#748199] hover:bg-[#F7F8FC] hover:text-[#3C4B63]"
          }`}
          title={text}
        >
          {text}
        </button>
      ))}
    </div>
  </div>
);

const Summary: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between border-b border-[#E0E5EF]/60 pb-2 last:border-b-0">
    <span className="text-[#748199]">{label}</span>
    <span className="font-semibold capitalize text-[#3C4B63] truncate ml-2 text-right">
      {value}
    </span>
  </div>
);
