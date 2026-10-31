import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { LogoMark } from "../ui/LogoMark";
import { QuickSearchModal } from "./QuickSearchModal";
import {
  Activity,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarExpanded?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarExpanded = false,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const islandRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setIsIslandExpanded(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIsIslandExpanded(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setIsIslandExpanded(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsProfileOpen(false);
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
  const readablePath = pathLabel.replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <header className="nav-island-header sticky top-0 z-40 h-16 w-full px-2.5 py-1 sm:px-4">
      <nav
        ref={islandRef}
        aria-label="Main navigation"
        className={`nav-island relative mx-auto w-full max-w-[800px] rounded-[26px] border p-1.5 transition-[border-radius,box-shadow] duration-300 ${isIslandExpanded ? "nav-island-expanded rounded-[24px]" : ""}`}
      >
        <div className="flex min-h-11 items-center gap-1.5 sm:gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="nav-island-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#0056CC]"
              aria-label={isSidebarExpanded ? "Close navigation sidebar" : "Open navigation sidebar"}
              aria-controls="app-sidebar"
              aria-expanded={isSidebarExpanded}
              title={isSidebarExpanded ? "Close sidebar" : "Open sidebar"}
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          )}

          <Link to="/" className="nav-island-brand flex min-w-0 shrink-0 items-center rounded-full px-1.5 py-1">
            <span className="hidden sm:block"><LogoMark size="sm" /></span>
            <span className="sm:hidden"><LogoMark size="sm" showWordmark={false} /></span>
          </Link>

          <span className="nav-island-divider h-7 w-px shrink-0 bg-[#D2D2D7]" />

          <button
            type="button"
            className="nav-island-location flex min-w-0 flex-1 items-center gap-2 rounded-full px-2.5 py-2 text-left hover:bg-[#F5F5F7] sm:flex-none sm:px-3"
            aria-expanded={isIslandExpanded}
            aria-controls="nav-island-details"
            onClick={() => setIsIslandExpanded((expanded) => !expanded)}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#007AFF]/30" />
              <span className="relative h-2 w-2 rounded-full bg-[#007AFF] ring-2 ring-[#E5F1FF]" />
            </span>
            <span className="min-w-0 flex-1 sm:flex-none">
              <span className="block whitespace-normal break-words text-[11px] font-semibold leading-tight text-[#1D1D1F] sm:text-xs">{readablePath}</span>
              <span className="hidden max-w-[150px] truncate text-[10px] text-[#6E6E73] lg:block">{user ? collegeName : "Practice smarter. Evolve faster."}</span>
            </span>
            <ChevronDown className={`hidden h-3.5 w-3.5 shrink-0 text-[#8490A2] transition-transform duration-300 sm:block ${isIslandExpanded ? "rotate-180" : ""}`} />
          </button>

          {user ? (
            <>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="nav-island-search hidden h-9 items-center gap-2 rounded-full border border-[#D2D2D7]/80 bg-[#F5F5F7]/90 px-3 text-[11px] text-[#6E6E73] transition-colors hover:border-[#C7D8EA] hover:bg-white md:flex"
                title="Quick Search (Ctrl + K)"
              >
                <Search className="h-3.5 w-3.5 text-[#007AFF]" />
                <span>Search</span>
                <span className="rounded-md border border-[#D2D2D7] bg-white px-1.5 py-0.5 font-mono text-[9px] text-[#8490A2]">Ctrl K</span>
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="nav-island-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#007AFF] md:hidden"
                aria-label="Open search"
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>

              <div className="relative shrink-0">
                <button
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="nav-island-profile flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-1 sm:pr-2 hover:border-[#D2D2D7] hover:bg-[#F5F5F7]"
                  aria-label={`Account menu for ${user.name}`}
                  aria-expanded={isProfileOpen}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#E5F1FF] to-[#F5F0FA] text-xs font-bold text-[#0056CC] ring-1 ring-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[150px] text-left md:block">
                    <span className="block whitespace-normal break-words text-[11px] font-semibold leading-tight text-[#1D1D1F]">{user.name}</span>
                    <span className="block truncate text-[9px] capitalize text-[#6E6E73]">{user.role.replace("_", " ")}</span>
                  </span>
                  <ChevronDown className={`hidden h-3 w-3 text-[#8490A2] transition-transform md:block ${isProfileOpen ? "rotate-180" : ""}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-56 origin-top-right animate-in fade-in zoom-in-95 rounded-2xl border border-[#D2D2D7] bg-white/95 p-1.5 shadow-[0_18px_44px_-18px_rgba(61,82,121,0.32)] backdrop-blur-xl duration-150">
                    <div className="mb-1 border-b border-[#D2D2D7] px-3 py-2.5">
                      <p className="truncate text-xs font-semibold text-[#1D1D1F]">{user.name}</p>
                      <p className="truncate text-[10px] capitalize text-[#6E6E73]">{user.role.replace("_", " ")}</p>
                    </div>
                    <button onClick={() => { setIsProfileOpen(false); navigate("/profile"); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]">
                      <User className="h-3.5 w-3.5 text-[#6E6E73]" /> Profile
                    </button>
                    <button onClick={() => { setIsProfileOpen(false); navigate("/settings"); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]">
                      <Settings className="h-3.5 w-3.5 text-[#6E6E73]" /> Settings &amp; Wallet
                    </button>
                    {(user.role === "admin" || user.role === "platform_admin") && (
                      <button onClick={() => { setIsProfileOpen(false); navigate("/admin"); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#0056CC] hover:bg-[#E5F1FF]">
                        <ShieldCheck className="h-3.5 w-3.5" /> Admin Portal
                      </button>
                    )}
                    <button className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs text-[#8490A2]" disabled title="Documentation">
                      <HelpCircle className="h-3.5 w-3.5" /> Help
                    </button>
                    <div className="my-1 border-t border-[#D2D2D7]" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#A36162] hover:bg-[#F9EAE8]">
                      <LogOut className="h-3.5 w-3.5" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>Sign in</Button>
              <Button variant="primary" size="sm" className="px-3 sm:px-4" onClick={() => navigate("/login?redirect=/practice")}>
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Start Practicing</span>
              </Button>
            </div>
          )}
        </div>

        {isIslandExpanded && (
          <div id="nav-island-details" className="nav-island-details mt-1.5 border-t border-[#D2D2D7]/80 px-2 pb-2 pt-3 sm:px-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-[#E5F1FF] via-white to-[#F5F0FA] px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#007AFF] shadow-sm"><Activity className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block whitespace-normal break-words text-xs font-semibold text-[#1D1D1F]">{readablePath}</span>
                  <span className="block whitespace-normal break-words text-[10px] text-[#6E6E73]">{user ? `${user.role.replace("_", " ")} · ${collegeName}` : "Practice smarter. Evaluate better. Evolve faster."}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {user && onToggleSidebar && (
                  <button onClick={() => { onToggleSidebar(); setIsIslandExpanded(false); }} className="flex items-center justify-center gap-2 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#1D1D1F] hover:border-[#C7D8EA] hover:bg-[#F5F5F7]">
                    <Menu className="h-3.5 w-3.5 text-[#007AFF]" /> Navigation
                  </button>
                )}
                {user ? (
                  <button onClick={() => { setIsSearchOpen(true); setIsIslandExpanded(false); }} className="flex items-center justify-center gap-2 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#1D1D1F] hover:border-[#C7D8EA] hover:bg-[#F5F5F7]">
                    <Search className="h-3.5 w-3.5 text-[#007AFF]" /> Search
                  </button>
                ) : (
                  <button onClick={() => { setIsIslandExpanded(false); navigate("/pricing"); }} className="flex items-center justify-center gap-2 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#1D1D1F] hover:border-[#C7D8EA] hover:bg-[#F5F5F7]">
                    <Activity className="h-3.5 w-3.5 text-[#007AFF]" /> Explore plans
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => setIsIslandExpanded(false)} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[#8490A2] hover:bg-white sm:hidden" aria-label="Collapse navigation island">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </nav>

      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
};
