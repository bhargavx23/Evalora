import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { LogoMark } from "../components/ui/LogoMark";

export const PublicLayout: React.FC = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-transparent text-[#1D1D1F] flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div key={location.pathname} className="site-page">
          <Outlet />
        </div>
      </main>
      <footer className="island-footer py-8 px-4 text-xs text-[#6E6E73] sm:py-10">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="hidden sm:inline text-[#D2D2D7]">|</span>
            <span className="text-[#6E6E73]">
              Practice smarter. Evaluate better. Evolve faster.
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-[#6E6E73]">
            <Link to="/login" className="hover:text-[#1D1D1F] transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-[#1D1D1F] transition-colors">
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

