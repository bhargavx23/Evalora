import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  X,
  Code2,
  FileCheck2,
  BarChart3,
  TrendingUp,
  Settings,
  BookOpen,
  Bot,
  Cpu,
  Users,
  Building2,
  ArrowRight,
  User,
  ShieldCheck,
} from "lucide-react";

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  category: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  roles?: string[];
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const role = user?.role || "student";

  const allItems: SearchItem[] = [
    // Student routes
    {
      id: "practice",
      title: "Adaptive Practice Builder",
      category: "Practice",
      description: "Build custom multi-section practice across DSA, Aptitude, Reasoning & Coding",
      route: "/practice",
      icon: <Code2 className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },
    {
      id: "code-visualizer",
      title: "Code Execution Visualizer",
      category: "Learning Tools",
      description: "Step through JavaScript and Python execution traces line-by-line",
      route: "/code-visualizer",
      icon: <Cpu className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },
    {
      id: "assessments",
      title: "Assigned Assessments",
      category: "Examinations",
      description: "Take assigned exams, timed tests, and department evaluations",
      route: "/assessments",
      icon: <FileCheck2 className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },
    {
      id: "results",
      title: "Results & Attempt History",
      category: "Performance",
      description: "Review test verdicts, score percentages, and integrity reports",
      route: "/results",
      icon: <BarChart3 className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },
    {
      id: "skills",
      title: "Skill Profile & Topic Mastery",
      category: "Performance",
      description: "Track accuracy, diagnostic topic weaknesses, and percentile benchmarks",
      route: "/skills",
      icon: <TrendingUp className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },
    {
      id: "settings",
      title: "Settings & Algorand Wallet",
      category: "Account",
      description: "Manage Pera Wallet connection, attempt quota, and account security",
      route: "/settings",
      icon: <Settings className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student", "faculty", "college_admin", "platform_admin"],
    },
    {
      id: "profile",
      title: "Student Profile",
      category: "Account",
      description: "View department info, roll number, and enrolled semester",
      route: "/profile",
      icon: <User className="h-4 w-4 text-[#7779C5]" />,
      roles: ["student"],
    },

    // Faculty routes
    {
      id: "faculty-assessments",
      title: "Assessment Management",
      category: "Faculty",
      description: "Schedule, configure, and publish formal assessments for student batches",
      route: "/faculty/assessments",
      icon: <FileCheck2 className="h-4 w-4 text-[#7779C5]" />,
      roles: ["faculty", "college_admin"],
    },
    {
      id: "faculty-questions",
      title: "Question Bank",
      category: "Faculty",
      description: "Browse, filter, and approve questions across all academic topics",
      route: "/faculty/questions",
      icon: <BookOpen className="h-4 w-4 text-[#7779C5]" />,
      roles: ["faculty", "college_admin", "platform_admin"],
    },
    {
      id: "faculty-ai",
      title: "AI Question Generator",
      category: "Faculty",
      description: "Generate verified question drafts using Google Gemini Pro integration",
      route: "/faculty/ai-generator",
      icon: <Bot className="h-4 w-4 text-[#7779C5]" />,
      roles: ["faculty", "college_admin"],
    },
    {
      id: "faculty-monitor",
      title: "Live Proctoring & Monitoring",
      category: "Faculty",
      description: "Observe active assessment attempts, integrity flags, and submissions in real-time",
      route: "/faculty/live-monitor",
      icon: <ShieldCheck className="h-4 w-4 text-[#7779C5]" />,
      roles: ["faculty", "college_admin"],
    },

    // Admin routes
    {
      id: "admin-users",
      title: "User Management",
      category: "Admin",
      description: "Enrolled student rosters, faculty appointments, and role assignments",
      route: "/admin/users",
      icon: <Users className="h-4 w-4 text-[#7779C5]" />,
      roles: ["college_admin", "admin", "platform_admin"],
    },
    {
      id: "admin-departments",
      title: "Department Management",
      category: "Admin",
      description: "Academic department codes, faculty counts, and enrollment allocations",
      route: "/admin/departments",
      icon: <Building2 className="h-4 w-4 text-[#7779C5]" />,
      roles: ["college_admin", "admin", "platform_admin"],
    },
    {
      id: "admin-portal",
      title: "Evalora Admin Portal",
      category: "Super Admin",
      description: "Platform KPIs, Users, Organizations, Question Bank, Practice Controls, and Algorand Payments",
      route: "/admin",
      icon: <ShieldCheck className="h-4 w-4 text-[#7779C5]" />,
      roles: ["admin", "platform_admin"],
    },
  ];

  // Filter based on user's role (admin and platform_admin are treated as superadmins)
  const isSuperAdmin = role === "admin" || role === "platform_admin";
  const availableItems = allItems.filter((item) => {
    if (!item.roles) return true;
    if (isSuperAdmin && (item.roles.includes("admin") || item.roles.includes("platform_admin"))) return true;
    return item.roles.includes(role);
  });

  const filteredItems = query.trim()
    ? availableItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : availableItems;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#49465B]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-xl rounded-2xl border border-[#E9E7F0] bg-white shadow-[0_16px_50px_-10px_rgba(82,77,119,0.18)] overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#E9E7F0] px-4 py-3.5">
          <Search className="h-4 w-4 text-[#9895A8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search practice, assessments, question bank, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#49465B] placeholder:text-[#9895A8] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded p-1 text-[#9895A8] hover:text-[#49465B]"
              aria-label="Clear query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="rounded bg-[#F1F2F8] px-2 py-0.5 text-[10px] font-mono text-[#777486]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777486]">
              No matching pages or features found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.route);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-[#F8F7FC] group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0EFF9]">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#49465B] group-hover:text-[#7779C5] transition-colors">
                          {item.title}
                        </span>
                        <span className="rounded bg-[#F1F2F8] px-1.5 py-0.2 text-[9px] font-medium text-[#777486]">
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#777486] line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[#9895A8] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-[#E9E7F0] bg-[#F8F7FC] px-4 py-2 text-[11px] text-[#777486] flex items-center justify-between">
          <span>Navigate with click or arrow keys</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
};
