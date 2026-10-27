import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'lg'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#625E75]/32 backdrop-blur-sm transition-opacity animate-in fade-in duration-200 ease-out"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative flex max-h-[calc(100dvh-1.5rem)] w-full ${maxWidthClasses[maxWidth]} flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200 ease-out sm:max-h-[calc(100dvh-2rem)]`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-100 bg-[#FAFAF8] sm:px-6">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-150 active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-4 sm:gap-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
};
