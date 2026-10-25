import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'purple' | 'green' | 'amber' | 'rose' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = ''
}) => {
  const variants = {
    blue: 'bg-[#EEF0FF] text-[#34358F] border-[#D6DAFF]',
    purple: 'bg-[#F1EEFF] text-[#4C3FB8] border-[#DFD8FF]',
    green: 'bg-[#E6F6F0] text-emerald-900 border-[#C3E8D8]',
    amber: 'bg-[#FEF7E6] text-amber-900 border-[#F7E0B2]',
    rose: 'bg-[#FDECEC] text-rose-900 border-[#F5C6C6]',
    neutral: 'bg-[#F1F2F8] text-[#4A4A57] border-[#E8E8EF]'
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border tracking-tight ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const d = difficulty?.toLowerCase();
  if (d === 'easy') return <Badge variant="green">Easy</Badge>;
  if (d === 'medium') return <Badge variant="amber">Medium</Badge>;
  if (d === 'hard') return <Badge variant="rose">Hard</Badge>;
  return <Badge variant="neutral">{difficulty}</Badge>;
};

export const VerdictBadge: React.FC<{ verdict: string }> = ({ verdict }) => {
  if (verdict === 'ACCEPTED') {
    return <Badge variant="green">Accepted</Badge>;
  }
  if (verdict === 'WRONG_ANSWER') {
    return <Badge variant="rose">Wrong Answer</Badge>;
  }
  if (verdict === 'TIME_LIMIT_EXCEEDED') {
    return <Badge variant="amber">TLE</Badge>;
  }
  if (verdict === 'COMPILATION_ERROR') {
    return <Badge variant="rose">Compilation Error</Badge>;
  }
  if (verdict === 'RUNTIME_ERROR') {
    return <Badge variant="rose">Runtime Error</Badge>;
  }
  return <Badge variant="neutral">{verdict}</Badge>;
};
