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
      <div className={`${sizes[size]} relative flex items-center justify-center rounded-[9px] border border-[#CFE2DC] bg-[#EAF1F9] shadow-[0_1px_2px_rgba(119,121,197,0.12)]`}>
        <span className="absolute left-1.5 right-1.5 top-2 h-1 rounded-full bg-[#3C648E]" />
        <span className="absolute bottom-2 left-1.5 h-1 w-2.5 rounded-full bg-[#5288B8]" />
        <span className="absolute bottom-2 right-1.5 h-1 w-2 rounded-full bg-[#D98768]" />
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight text-[#3C4B63]">Evalora</div>
          <div className="logo-tagline mt-0.5 text-[10px] font-medium text-[#748199]">Practice smarter. Evaluate better.</div>
        </div>
      )}
    </div>
  );
};
