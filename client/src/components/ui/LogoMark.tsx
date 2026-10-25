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
      <div className={`${sizes[size]} relative flex items-center justify-center rounded-[9px] border border-[#D6DAFF] bg-[#EEF0FF] shadow-[0_1px_2px_rgba(91,92,226,0.12)]`}>
        <span className="absolute left-1.5 right-1.5 top-2 h-1 rounded-full bg-[#34358F]" />
        <span className="absolute bottom-2 left-1.5 h-1 w-2.5 rounded-full bg-[#5B5CE2]" />
        <span className="absolute bottom-2 right-1.5 h-1 w-2 rounded-full bg-[#7C6FF2]" />
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight text-[#18181F]">Evalora</div>
          <div className="mt-0.5 text-[10px] font-medium text-[#6B6B78]">Practice smarter. Evaluate better.</div>
        </div>
      )}
    </div>
  );
};
