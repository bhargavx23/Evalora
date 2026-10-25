import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { LogoMark } from "../components/ui/LogoMark";

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F7FB] text-[#18181F] flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-10 px-4 border-t border-[#E8E8EF] bg-white text-xs text-[#6B6B78]">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="hidden sm:inline text-[#E8E8EF]">|</span>
            <span className="text-[#6B6B78]">
              Practice smarter. Evaluate better. Evolve faster.
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-[#6B6B78]">
            <Link to="/login" className="hover:text-[#18181F] transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-[#18181F] transition-colors">
              Get Started
            </Link>
            <span className="text-[#9494A3]">
              &copy; {new Date().getFullYear()} Evalora
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

