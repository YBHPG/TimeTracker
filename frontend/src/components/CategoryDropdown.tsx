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

  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % CATEGORIES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < CATEGORIES.length) {
          e.preventDefault();
          const selectedCat = CATEGORIES[focusedIndex];
          handleSelect(selectedCat.id);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, focusedIndex]);

  const handleSelect = async (catId: TaskCategory, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
    await onChange(catId);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      const currentIdx = CATEGORIES.findIndex((c) => c.id === (value || 'work'));
      setFocusedIndex(currentIdx >= 0 ? currentIdx : 0);
    }
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
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Выбрать категорию (текущая: ${currentConfig.label})`}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleTriggerKeyDown}
          className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/90 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition shadow-xs select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
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
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Категория: ${currentConfig.label}`}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleTriggerKeyDown}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] ${currentConfig.badgeClass}`}
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
        <div
          role="listbox"
          aria-label="Категории"
          className="absolute left-0 mt-1.5 w-36 rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {CATEGORIES.map((cat, idx) => {
            const isSelected = (value || 'work') === cat.id;
            const isFocused = focusedIndex === idx;
            return (
              <button
                key={cat.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(e) => handleSelect(cat.id, e)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none ${
                  isFocused || isSelected
                    ? 'bg-slate-100/90 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
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
