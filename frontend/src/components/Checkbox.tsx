import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string | React.ReactNode;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Выбрать'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded-lg border transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] focus-visible:ring-offset-2 ${
          checked
            ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-sm'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </button>

      {label && (
        <span
          onClick={() => onChange(!checked)}
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </span>
      )}
    </label>
  );
};

export const Switch: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Переключатель'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] focus-visible:ring-offset-2 ${
          checked ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm transition duration-200 ease-in-out ${
            checked
              ? 'translate-x-4 bg-white dark:bg-slate-900'
              : 'translate-x-0 bg-white dark:bg-slate-300'
          }`}
        />
      </button>

      {label && (
        <span
          onClick={() => onChange(!checked)}
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </span>
      )}
    </label>
  );
};
