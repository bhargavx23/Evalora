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
    'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 ease-out active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#007AFF]/15 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-[#007AFF] text-white hover:bg-[#2F6FE5] active:bg-[#0056CC] border border-[#007AFF] shadow-[0_7px_18px_-8px_rgba(63,104,156,0.48)] hover:-translate-y-0.5 active:translate-y-px',
    secondary:
      'bg-[#E5F1FF] text-[#0056CC] hover:bg-[#DCE8F5] border border-[#D4E0EF] active:translate-y-px',
    accent:
      'bg-[#E5F2EB] text-[#4C765D] hover:bg-[#D6EADF] border border-[#C6DFD2] active:translate-y-px',
    success:
      'bg-[#679B7C] text-white hover:bg-[#56866B] border border-[#679B7C] shadow-xs active:translate-y-px',
    warm:
      'bg-[#F8EEE8] text-[#8A7047] hover:bg-[#F3DFD2] border border-[#EBD0BE] active:translate-y-px',
    danger:
      'bg-[#F8EAE7] text-[#A36162] hover:bg-[#F2D9D5] border border-[#EACBC4] active:translate-y-px',
    outline:
      'bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] border border-[#D2D2D7] shadow-[0_1px_2px_rgba(82,77,119,0.03)] active:translate-y-px',
    ghost:
      'bg-transparent text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] border border-transparent',
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
