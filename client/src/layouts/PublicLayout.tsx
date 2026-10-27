import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { LogoMark } from "../components/ui/LogoMark";

export const PublicLayout: React.FC = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-transparent text-[#49465B] flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div key={location.pathname} className="site-page">
          <Outlet />
        </div>
      </main>
      <footer className="py-10 px-4 border-t border-[#E9E7F0] bg-white text-xs text-[#777486]">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="hidden sm:inline text-[#E9E7F0]">|</span>
            <span className="text-[#777486]">
              Practice smarter. Evaluate better. Evolve faster.
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-[#777486]">
            <Link to="/login" className="hover:text-[#49465B] transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-[#49465B] transition-colors">
              Get Started
            </Link>
            <span className="text-[#9895A8]">
              &copy; {new Date().getFullYear()} Evalora
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

