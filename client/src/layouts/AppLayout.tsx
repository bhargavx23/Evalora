import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { Sidebar } from "../components/layout/Sidebar";

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const location = useLocation();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener('change', updateLayout);
    return () => mediaQuery.removeEventListener('change', updateLayout);
  }, []);

  const toggleSidebar = () => {
    if (isDesktopLayout) {
      setIsSidebarCollapsed((collapsed) => !collapsed);
    } else {
      setIsSidebarOpen((open) => !open);
    }
  };
  const isFullWidthWorkspace =
    location.pathname.startsWith('/code-visualizer') ||
    location.pathname.startsWith('/visualizer');

  return (
    <div className="app-layout-shell flex h-screen min-h-0 min-w-0 flex-col overflow-hidden bg-transparent text-[#3C4B63]">
      <Navbar
        onToggleSidebar={toggleSidebar}
        isSidebarExpanded={isDesktopLayout ? !isSidebarCollapsed : isSidebarOpen}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
        <main
          className={`min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto ${
            isFullWidthWorkspace
            ? 'p-2 sm:p-3 md:p-4 flex flex-col min-h-0 overflow-y-hidden'
              : 'max-w-[1280px] px-4 py-6 sm:px-6 md:px-8 md:py-8 xl:px-10'
          }`}
        >
          <div key={location.pathname} className={`site-page ${isFullWidthWorkspace ? 'site-page-workspace w-full flex-1' : ''}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
