import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Compass,
  FileCheck2,
  Code2,
  Bot,
  BarChart3,
  BookOpen,
  Activity,
  Layers,
  Users,
  ShieldAlert,
  Building2,
  TrendingUp,
  Cpu,
  UserRound,
  BriefcaseBusiness,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { LogoMark } from "../ui/LogoMark";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsed = false, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || "student";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-[#E5F1FF] text-[#0056CC] font-semibold shadow-[inset_0_0_0_1px_rgba(82,136,184,0.14)]"
        : "text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
    }`;

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8490A2]">
      {children}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1D1D1F]/30 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
          id="app-sidebar"
          aria-hidden={isCollapsed && !isOpen}
          className={`fixed left-0 top-16 z-40 flex h-[calc(100dvh-4rem)] w-[min(17rem,calc(100vw-1.25rem))] min-h-0 flex-col justify-between overflow-hidden border-r border-[#D2D2D7] bg-white/90 p-3.5 shadow-[8px_0_28px_-24px_rgba(82,77,119,0.25)] backdrop-blur-xl transition-[transform,width,padding] duration-300 ease-out lg:sticky lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-r-0 lg:p-0 lg:shadow-none' : 'lg:w-[17rem] lg:shrink-0'}`}
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-4">
          <div className="hidden px-2 pt-1 md:block">
            <LogoMark size="sm" showWordmark={false} />
          </div>

          {/* Student Navigation */}
          {role === "student" && (
            <div className="space-y-1">
              <SectionLabel>Student</SectionLabel>
              <NavLink
                to="/dashboard"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>
              <NavLink
                to="/assessments"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Assessments</span>
              </NavLink>
              <NavLink
                to="/domains"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Compass className="w-4 h-4" />
                <span>Tech Domains</span>
              </NavLink>
              <NavLink
                to="/practice"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Code2 className="w-4 h-4" />
                <span>Practice</span>
              </NavLink>
              <NavLink
                to="/code-visualizer"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Cpu className="w-4 h-4 text-[#007AFF]" />
                <div className="flex items-center justify-between w-full">
                  <span>Code Visualizer</span>
                  <span className="rounded-full bg-[#E5F1FF] px-2 py-0.5 text-[10px] font-semibold text-[#0056CC] border border-[#CFE2DC]">
                    PRO
                  </span>
                </div>
              </NavLink>
              <NavLink
                to="/results"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Results</span>
              </NavLink>
              <NavLink
                to="/skills"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Skill Profile</span>
              </NavLink>
              <NavLink to="/career" className={linkClass} onClick={onCloseMobile}>
                <BriefcaseBusiness className="w-4 h-4" />
                <span>Career</span>
              </NavLink>
              <NavLink to="/profile" className={linkClass} onClick={onCloseMobile}>
                <UserRound className="w-4 h-4" />
                <span>Profile</span>
              </NavLink>
              <NavLink to="/settings" className={linkClass} onClick={onCloseMobile}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </NavLink>
            </div>
          )}

          {/* Faculty Navigation */}
          {(role === "faculty" || role === "college_admin") && (
            <div className="space-y-1">
              <SectionLabel>Faculty</SectionLabel>
              <NavLink
                to="/faculty/dashboard"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>
              <NavLink
                to="/faculty/assessments"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Assessments</span>
              </NavLink>
              <NavLink
                to="/faculty/questions"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BookOpen className="w-4 h-4" />
                <span>Question Bank</span>
              </NavLink>
              <NavLink
                to="/faculty/ai-generator"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Bot className="w-4 h-4" />
                <span>AI Generator</span>
              </NavLink>
              <NavLink
                to="/faculty/live-monitor"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Activity className="w-4 h-4" />
                <span>Live Proctoring</span>
              </NavLink>
              <NavLink
                to="/faculty/similarity"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Reports</span>
              </NavLink>

              <SectionLabel>Analytics</SectionLabel>
              <NavLink
                to="/faculty/batch-analytics"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Students</span>
              </NavLink>
              <NavLink
                to="/faculty/question-analytics"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Layers className="w-4 h-4" />
                <span>Question Insights</span>
              </NavLink>
            </div>
          )}

          {/* College Admin Navigation */}
          {role === "college_admin" && (
            <div className="space-y-1">
              <SectionLabel>Admin</SectionLabel>
              <NavLink
                to="/admin/dashboard"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>
              <NavLink
                to="/admin/departments"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Building2 className="w-4 h-4" />
                <span>Departments</span>
              </NavLink>
              <NavLink
                to="/admin/users"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Users className="w-4 h-4" />
                <span>Users</span>
              </NavLink>
              <NavLink
                to="/faculty/assessments"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Assessments</span>
              </NavLink>
              <NavLink
                to="/faculty/questions"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BookOpen className="w-4 h-4" />
                <span>Question Bank</span>
              </NavLink>
              <NavLink
                to="/faculty/batch-analytics"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </NavLink>
            </div>
          )}

          {/* Platform / Super Admin Navigation */}
          {(role === "admin" || role === "platform_admin") && (
            <div className="space-y-1">
              <SectionLabel>Administration</SectionLabel>
              <NavLink
                to="/admin"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <ShieldCheck className="w-4 h-4 text-[#007AFF]" />
                <span>Admin Portal</span>
              </NavLink>
              <NavLink
                to="/superadmin/dashboard"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Cpu className="w-4 h-4" />
                <span>Platform Overview</span>
              </NavLink>
              <NavLink
                to="/superadmin/colleges"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <Building2 className="w-4 h-4" />
                <span>Institutions</span>
              </NavLink>
              <NavLink
                to="/faculty/questions"
                className={linkClass}
                onClick={onCloseMobile}
              >
                <BookOpen className="w-4 h-4" />
                <span>Global Questions</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="shrink-0 space-y-1 border-t border-[#D2D2D7] pt-3">
          <div className="break-words px-3 py-2 text-[11px] leading-relaxed text-[#6E6E73]">
            <div className="font-semibold text-[#1D1D1F]">Evalora Workspace</div>
            <div>Practice &amp; Assessment Platform</div>
          </div>
        </div>
      </aside>
    </>
  );
};

