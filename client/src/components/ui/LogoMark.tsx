import React from 'react';

export const LogoMark: React.FC<{ size?: 'sm' | 'md' | 'lg'; showWordmark?: boolean }> = ({
  size = 'md',
  showWordmark = true
}) => {
  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${sizes[size]} relative flex items-center justify-center rounded-[9px] border border-[#CFE2DC] bg-[#E5F1FF] shadow-[0_1px_2px_rgba(119,121,197,0.12)]`}>
        <span className="absolute left-1.5 right-1.5 top-2 h-1 rounded-full bg-[#0056CC]" />
        <span className="absolute bottom-2 left-1.5 h-1 w-2.5 rounded-full bg-[#007AFF]" />
        <span className="absolute bottom-2 right-1.5 h-1 w-2 rounded-full bg-[#007AFF]" />
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight text-[#1D1D1F]">Evalora</div>
          <div className="logo-tagline mt-0.5 text-[10px] font-medium text-[#6E6E73]">Practice smarter. Evaluate better.</div>
        </div>
      )}
    </div>
  );
};
