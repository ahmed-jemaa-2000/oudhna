import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-app-surface border border-app-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto relative animate-fade-in shadow-2xl shadow-brand-primary/10">
        <div className="flex justify-between items-center p-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h3 className="font-bold text-lg text-app-text">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-app-surface-2 rounded-full text-app-muted hover:text-app-text transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-app-text">
          {children}
        </div>
      </div>
    </div>
  );
};