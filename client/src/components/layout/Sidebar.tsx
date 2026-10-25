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
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || "student";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-[#EEF0FF] text-[#34358F] font-semibold shadow-[inset_0_0_0_1px_rgba(91,92,226,0.16)]"
        : "text-[#6B6B78] hover:bg-[#F7F7FB] hover:text-[#18181F]"
    }`;

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9494A3]">
      {children}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#18181F]/30 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-16 z-40 flex h-[calc(100dvh-4rem)] w-[15.5rem] flex-col justify-between overflow-y-auto border-r border-[#E8E8EF] bg-white p-3.5 transition-transform duration-200 md:sticky ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="space-y-6">
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
                <Cpu className="w-4 h-4 text-[#5B5CE2]" />
                <div className="flex items-center justify-between w-full">
                  <span>Code Visualizer</span>
                  <span className="rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10px] font-semibold text-[#34358F] border border-[#D6DAFF]">
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
                <ShieldCheck className="w-4 h-4 text-[#5B5CE2]" />
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
        <div className="space-y-1 border-t border-[#E8E8EF] pt-4">
          <div className="px-3 py-2 text-[11px] text-[#6B6B78]">
            <div className="font-semibold text-[#18181F]">Evalora Workspace</div>
            <div>Practice & Assessment Platform</div>
          </div>
        </div>
      </aside>
    </>
  );
};

