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
    blue: 'bg-[#EAF1F9] text-[#3C648E] border-[#CFE2DC]',
    purple: 'bg-[#F0EDF7] text-[#665D8C] border-[#DDD6EB]',
    green: 'bg-[#E5F2EB] text-[#4C765D] border-[#C3E8D8]',
    amber: 'bg-[#F8F2E4] text-[#8A7047] border-[#E9DAB5]',
    rose: 'bg-[#F8EAE7] text-[#A36162] border-[#F5C6C6]',
    neutral: 'bg-[#EFF2F8] text-[#526563] border-[#E0E5EF]'
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
