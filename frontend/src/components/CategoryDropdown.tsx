import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { TaskCategory, CATEGORIES, getCategoryConfig } from '../types';

interface CategoryDropdownProps {
  value: TaskCategory | string | undefined | null;
  onChange: (category: TaskCategory) => void | Promise<void>;
  variant?: 'pill' | 'badge';
  disabled?: boolean;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  value,
  onChange,
  variant = 'pill',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentConfig = getCategoryConfig(value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (catId: TaskCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    await onChange(catId);
  };

  return (
    <div
      ref={dropdownRef}
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      {variant === 'pill' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/90 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition shadow-xs select-none"
        >
          <span className={`w-2 h-2 rounded-full ${currentConfig.dotBg} flex-shrink-0`} />
          <span>{currentConfig.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-slate-600 dark:text-slate-200' : ''
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition select-none ${currentConfig.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${currentConfig.dotBg} flex-shrink-0`} />
          <span>{currentConfig.label}</span>
          <ChevronDown
            className={`w-3 h-3 opacity-60 transition-transform duration-200 ${
              isOpen ? 'rotate-180 opacity-100' : ''
            }`}
          />
        </button>
      )}

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-36 rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none">
          {CATEGORIES.map((cat) => {
            const isSelected = (value || 'work') === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => handleSelect(cat.id, e)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cat.dotBg} flex-shrink-0`} />
                  <span>{cat.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
