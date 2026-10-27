import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { Sidebar } from "../components/layout/Sidebar";

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isFullWidthWorkspace =
    location.pathname.startsWith('/code-visualizer') ||
    location.pathname.startsWith('/visualizer');

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-transparent text-[#49465B]">
      <Navbar onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
        <main
          className={`min-w-0 w-full flex-1 overflow-x-hidden ${
            isFullWidthWorkspace
            ? 'p-2 sm:p-3 md:p-4 flex flex-col min-h-0'
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
