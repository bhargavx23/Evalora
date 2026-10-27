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
    none: 'border-[#E9E7F0]',
    blue: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#7779C5]',
    purple: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#9691CC]',
    mint: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#78A88F]',
    peach: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#C88C6C]',
    amber: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#C6A466]',
    rose: 'border-[#E9E7F0] shadow-[inset_3px_0_0_#CB888F]',
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
      className={`bg-white rounded-2xl border ${accentBorders[pastelAccent] || accentBorders.none} shadow-[0_8px_28px_-18px_rgba(82,77,119,0.28)] overflow-hidden transition-all duration-300 ease-out ${
        isInteractive ? 'hover:-translate-y-1 hover:shadow-[0_18px_38px_-20px_rgba(82,77,119,0.32)] hover:border-[#DEDDF0] cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-[#E9E7F0] bg-[#F8F7FC]/65">
          {header}
        </div>
      )}
      <div className={bodyPadding}>{children}</div>
      {footer && (
        <div className="px-6 py-3.5 border-t border-[#E9E7F0] bg-[#F8F7FC]/65">
          {footer}
        </div>
      )}
    </div>
  );
};
