import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { LogoMark } from "../components/ui/LogoMark";

export const PublicLayout: React.FC = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-transparent text-[#3C4B63] flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div key={location.pathname} className="site-page">
          <Outlet />
        </div>
      </main>
      <footer className="island-footer py-8 px-4 text-xs text-[#748199] sm:py-10">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="hidden sm:inline text-[#E0E5EF]">|</span>
            <span className="text-[#748199]">
              Practice smarter. Evaluate better. Evolve faster.
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-[#748199]">
            <Link to="/login" className="hover:text-[#3C4B63] transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-[#3C4B63] transition-colors">
              Get Started
            </Link>
            <span className="text-[#8490A2]">
              &copy; {new Date().getFullYear()} Evalora
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

