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
    'inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-150 ease-out active:scale-[0.985] focus:outline-none focus:ring-3 focus:ring-[#5B5CE2]/25 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-[#5B5CE2] text-white hover:bg-[#4B4CD2] active:bg-[#34358F] border border-[#5B5CE2] shadow-[0_1px_2px_rgba(91,92,226,0.22)] active:translate-y-px',
    secondary:
      'bg-[#EEF0FF] text-[#34358F] hover:bg-[#E1E5FF] border border-[#D6DAFF] active:translate-y-px',
    accent:
      'bg-[#E6F6F0] text-emerald-950 hover:bg-[#D5EFE5] border border-[#C0E5D7] active:translate-y-px',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 shadow-xs active:translate-y-px',
    warm:
      'bg-[#FDF3EB] text-amber-950 hover:bg-[#F9E7D8] border border-[#F2D9C4] active:translate-y-px',
    danger:
      'bg-[#FDECEC] text-rose-950 hover:bg-[#F9DADA] border border-[#F3C5C5] active:translate-y-px',
    outline:
      'bg-white text-[#18181F] hover:bg-[#F7F7FB] border border-[#E8E8EF] shadow-[0_1px_2px_rgba(24,24,31,0.03)] active:translate-y-px',
    ghost:
      'bg-transparent text-[#6B6B78] hover:bg-[#EFEFF7] hover:text-[#18181F] border border-transparent',
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
