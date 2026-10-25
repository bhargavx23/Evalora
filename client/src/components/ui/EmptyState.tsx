import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/50 px-6 py-8 text-center ${className}`}>
    {icon && <div className="mb-3 text-gray-400">{icon}</div>}
    <div className="text-sm font-semibold text-neutral-950">{title}</div>
    {description && <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
