import React from 'react';

export const ProgressBar: React.FC<{ value: number; color?: string; className?: string }> = ({
  value,
  color = '#5288B8',
  className = ''
}) => {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-stone-100 ${className}`}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
};
