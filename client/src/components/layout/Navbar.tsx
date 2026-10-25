import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { LogoMark } from "../ui/LogoMark";
import { QuickSearchModal } from "./QuickSearchModal";
import {
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";

export const Navbar: React.FC<{ onToggleSidebar?: () => void }> = ({
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const collegeName =
    typeof user?.collegeId === "object"
      ? user?.collegeId?.name
      : "Evalora Platform";
  const pathLabel =
    location.pathname
      .split("/")
      .filter(Boolean)
      .slice(-1)[0]
      ?.replace(/-/g, " ") || "overview";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E8E8EF] bg-white/90 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-[#6B6B78] hover:bg-[#F7F7FB] hover:text-[#18181F] md:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link to="/" className="group flex items-center gap-2.5">
          <LogoMark size="md" />
        </Link>

        {user?.collegeId && (
          <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-[#E8E8EF]">
            <span className="text-xs font-medium capitalize text-[#6B6B78]">
              {pathLabel}
            </span>
            <span className="text-[#D4D4E0]">/</span>
            <span className="text-xs font-semibold text-[#18181F]">
              {collegeName}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            {/* Desktop Quick Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden md:flex h-9 w-64 items-center justify-between rounded-lg border border-[#E8E8EF] bg-[#F7F7FB] px-3 text-xs text-[#6B6B78] hover:border-[#D6DAFF] hover:bg-white transition-all shadow-[0_1px_2px_rgba(24,24,31,0.02)] group"
              title="Quick Search (Ctrl + K)"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-[#9494A3] group-hover:text-[#5B5CE2] transition-colors" />
                <span>Search features, exams...</span>
              </div>
              <span className="rounded border border-[#E8E8EF] bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#9494A3] shadow-xs">
                ⌘K
              </span>
            </button>

            {/* Mobile Search Icon Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-[#E8E8EF] text-[#6B6B78] hover:bg-[#F7F7FB]"
              aria-label="Open Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </>
        )}

        {user ? (
          <div className="relative flex items-center gap-1.5" ref={profileRef}>
            <button
              className="rounded-lg p-2 text-[#9494A3] hover:bg-[#F7F7FB]"
              aria-label="Notifications"
              disabled
              title="Notifications are up to date"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-xl border border-[#E8E8EF] bg-white px-2.5 py-1.5 transition-all duration-150 hover:border-[#D6D8F8] hover:bg-[#F7F7FB] active:scale-[0.98]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF0FF] text-xs font-semibold text-[#34358F]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left md:block">
                <div className="text-xs font-semibold text-[#18181F]">
                  {user.name}
                </div>
                <div className="text-[10px] capitalize text-[#6B6B78]">
                  {user.role.replace("_", " ")}
                </div>
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-52 rounded-xl border border-[#E8E8EF] bg-white p-1.5 shadow-[0_10px_30px_-5px_rgba(24,24,31,0.08)] animate-in fade-in zoom-in-95 duration-150 origin-top-right ease-out z-50">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate("/profile");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#18181F] hover:bg-[#F7F7FB]"
                >
                  <User className="h-3.5 w-3.5 text-[#6B6B78]" /> Profile
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#18181F] hover:bg-[#F7F7FB]"
                >
                  <Settings className="h-3.5 w-3.5 text-[#6B6B78]" /> Settings & Wallet
                </button>
                {(user.role === "admin" || user.role === "platform_admin") && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/admin");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#5B5CE2] hover:bg-[#EEF0FF]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#5B5CE2]" /> Admin Portal
                  </button>
                )}
                <button
                  className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-[#9494A3]"
                  disabled
                  title="Documentation"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> Help
                </button>
                <div className="my-1 border-t border-[#E8E8EF]" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/login?redirect=/practice")}
            >
              Start Practicing
            </Button>
          </div>
        )}
      </div>

      {/* Global Command / Quick Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </header>
  );
};

