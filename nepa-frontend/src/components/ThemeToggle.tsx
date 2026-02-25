import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ariaLabels, getAriaAttributes, keyboardKeys } from '../utils/accessibility';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, setTheme, resolvedTheme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case keyboardKeys.ENTER:
      case keyboardKeys.SPACE:
        e.preventDefault();
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
        } else {
          toggleTheme();
        }
        break;
      case keyboardKeys.ESCAPE:
        setIsDropdownOpen(false);
        break;
      case keyboardKeys.ARROW_DOWN:
        if (!isDropdownOpen) {
          e.preventDefault();
          setIsDropdownOpen(true);
        }
        break;
      case keyboardKeys.ARROW_UP:
        if (isDropdownOpen) {
          e.preventDefault();
          setIsDropdownOpen(false);
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = () => {
    if (theme === 'system') {
      return resolvedTheme === 'dark' ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    }
    
    return theme === 'dark' ? (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return `System (${resolvedTheme})`;
      default:
        return 'Theme';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10"
        aria-label={`${ariaLabels.themeToggle}. Current theme: ${getLabel()}`}
        title={`Current theme: ${getLabel()}. Press Enter or Space to toggle. Press Arrow Down for more options.`}
        {...getAriaAttributes.expanded(isDropdownOpen)}
      >
        <span className="sr-only">Toggle theme</span>
        {getIcon()}
      </button>
      
      {showLabel && (
        <span className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {getLabel()}
        </span>
      )}
      
      {/* Dropdown for more precise control */}
      <div ref={dropdownRef} className="relative group">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          onKeyDown={handleKeyDown}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 opacity-0 group-hover:opacity-100"
          aria-label="Theme options"
          aria-expanded={isDropdownOpen.toString()}
          aria-haspopup="menu"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div 
          className={`absolute right-0 top-full mt-1 w-48 rounded-md border bg-popover text-popover-foreground shadow-md transition-all duration-200 z-50 ${
            isDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
          role="menu"
          aria-label="Theme selection menu"
        >
          <div className="p-1">
            <button
              onClick={() => { setTheme('light'); setIsDropdownOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === keyboardKeys.ENTER || e.key === keyboardKeys.SPACE) {
                  e.preventDefault();
                  setTheme('light');
                  setIsDropdownOpen(false);
                }
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none ${
                theme === 'light' ? 'bg-accent text-accent-foreground' : ''
              }`}
              role="menuitem"
              aria-selected={theme === 'light'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Light
            </button>
            <button
              onClick={() => { setTheme('dark'); setIsDropdownOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === keyboardKeys.ENTER || e.key === keyboardKeys.SPACE) {
                  e.preventDefault();
                  setTheme('dark');
                  setIsDropdownOpen(false);
                }
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none ${
                theme === 'dark' ? 'bg-accent text-accent-foreground' : ''
              }`}
              role="menuitem"
              aria-selected={theme === 'dark'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Dark
            </button>
            <button
              onClick={() => { setTheme('system'); setIsDropdownOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === keyboardKeys.ENTER || e.key === keyboardKeys.SPACE) {
                  e.preventDefault();
                  setTheme('system');
                  setIsDropdownOpen(false);
                }
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none ${
                theme === 'system' ? 'bg-accent text-accent-foreground' : ''
              }`}
              role="menuitem"
              aria-selected={theme === 'system'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
