import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.tsx';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
  className = '',
  showLabel = false,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Passer en mode clair (Light Mode)' : 'Passer en mode sombre (Dark Mode)'}
      className={`relative inline-flex items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer ${
        isDark
          ? 'bg-slate-800/90 border-slate-700 text-amber-300 hover:bg-slate-750 hover:text-amber-200 hover:border-slate-600 shadow-2xs'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-2xs'
      } ${compact ? 'h-8.5 w-8.5 p-1.5' : 'px-3 py-1.5 gap-2 text-xs font-bold'} ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 transition-transform duration-200 rotate-0 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 transition-transform duration-200 rotate-0 text-slate-600" />
      )}
      {showLabel && (
        <span className="font-bold text-xs select-none">
          {isDark ? 'Mode Clair' : 'Mode Sombre'}
        </span>
      )}
    </button>
  );
};
