import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'warm' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 ease-out active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#7779C5]/15 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-[#7779C5] text-white hover:bg-[#686AAE] active:bg-[#555780] border border-[#7779C5] shadow-[0_5px_14px_-6px_rgba(103,101,159,0.42)] hover:-translate-y-0.5 active:translate-y-px',
    secondary:
      'bg-[#F0EFF9] text-[#555780] hover:bg-[#E1E5FF] border border-[#DEDDF0] active:translate-y-px',
    accent:
      'bg-[#E6F6F0] text-[#527565] hover:bg-[#D5EFE5] border border-[#C0E5D7] active:translate-y-px',
    success:
      'bg-[#78A88F] text-white hover:bg-[#68977F] border border-[#78A88F] shadow-xs active:translate-y-px',
    warm:
      'bg-[#FDF3EB] text-[#896D45] hover:bg-[#F9E7D8] border border-[#F2D9C4] active:translate-y-px',
    danger:
      'bg-[#FDECEC] text-[#9A646D] hover:bg-[#F9DADA] border border-[#F3C5C5] active:translate-y-px',
    outline:
      'bg-white text-[#49465B] hover:bg-[#F8F7FC] border border-[#E9E7F0] shadow-[0_1px_2px_rgba(82,77,119,0.03)] active:translate-y-px',
    ghost:
      'bg-transparent text-[#777486] hover:bg-[#EFEFF7] hover:text-[#49465B] border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-5 py-3 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
