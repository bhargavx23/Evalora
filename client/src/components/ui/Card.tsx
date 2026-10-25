import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  pastelAccent?: 'blue' | 'purple' | 'mint' | 'peach' | 'amber' | 'rose' | 'none';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | string;
  className?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  pastelAccent = 'none',
  header,
  footer,
  padding = 'md',
  className = '',
  interactive,
  onClick,
  ...props
}) => {
  const isInteractive = interactive || Boolean(onClick);
  const accentBorders: Record<string, string> = {
    none: 'border-[#E8E8EF]',
    blue: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#5B5CE2]',
    purple: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#7C6FF2]',
    mint: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#10B981]',
    peach: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#F97316]',
    amber: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#F59E0B]',
    rose: 'border-[#E8E8EF] shadow-[inset_3px_0_0_#EF4444]',
  };

  const paddingClasses: Record<string, string> = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const bodyPadding = paddingClasses[padding] || padding;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[14px] border ${accentBorders[pastelAccent] || accentBorders.none} shadow-[0_4px_20px_-4px_rgba(24,24,31,0.04)] overflow-hidden transition-all duration-200 ease-out ${
        isInteractive ? 'hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-6px_rgba(24,24,31,0.08)] hover:border-[#D6DAFF] cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-[#E8E8EF] bg-[#F7F7FB]/65">
          {header}
        </div>
      )}
      <div className={bodyPadding}>{children}</div>
      {footer && (
        <div className="px-6 py-3.5 border-t border-[#E8E8EF] bg-[#F7F7FB]/65">
          {footer}
        </div>
      )}
    </div>
  );
};
