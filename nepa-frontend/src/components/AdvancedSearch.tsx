import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ariaLabels, keyboardKeys, announceToScreenReader } from '../utils/accessibility';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'meter' | 'payment' | 'user' | 'history';
  metadata?: Record<string, any>;
}

interface SearchFilter {
  id: string;
  label: string;
  field: string;
  type: 'select' | 'range' | 'date';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  filters: Record<string, any>;
  timestamp: Date;
  resultCount?: number;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: Record<string, any>) => void;
  placeholder?: string;
  className?: string;
  suggestions?: SearchSuggestion[];
  filters?: SearchFilter[];
  showHistory?: boolean;
  maxSuggestions?: number;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  placeholder = 'Search payments, meters, or users...',
  className = '',
  suggestions: externalSuggestions = [],
  filters: availableFilters = [],
  showHistory = true,
  maxSuggestions = 8,
}) => {
  const { resolvedTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchHistoryItem[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const debouncedQueryRef = useRef<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Load search history from localStorage
  useEffect(() => {
    if (showHistory) {
      const history = localStorage.getItem('searchHistory');
      const saved = localStorage.getItem('savedSearches');
      
      if (history) {
        try {
          setSearchHistory(JSON.parse(history));
        } catch (e) {
          console.error('Failed to load search history:', e);
        }
      }
      
      if (saved) {
        try {
          setSavedSearches(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load saved searches:', e);
        }
      }
    }
  }, [showHistory]);

  // Debounced search suggestions
  const updateSuggestions = useCallback((searchQuery: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      debouncedQueryRef.current = searchQuery;
      
      if (searchQuery.length < 2) {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Combine external suggestions with history
      const historySuggestions: SearchSuggestion[] = searchHistory
        .filter(item => item.query.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 3)
        .map(item => ({
          id: `history-${item.id}`,
          text: item.query,
          type: 'history' as const,
          metadata: { timestamp: item.timestamp, resultCount: item.resultCount }
        }));

      const externalFiltered = externalSuggestions
        .filter(suggestion => 
          suggestion.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, maxSuggestions - historySuggestions.length);

      const allSuggestions = [...historySuggestions, ...externalFiltered];
      setFilteredSuggestions(allSuggestions);
      setShowSuggestions(allSuggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    }, 300);
  }, [externalSuggestions, searchHistory, maxSuggestions]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    updateSuggestions(value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case keyboardKeys.ARROW_DOWN:
        e.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;
        
      case keyboardKeys.ARROW_UP:
        e.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
        }
        break;
        
      case keyboardKeys.ENTER:
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
        } else {
          performSearch();
        }
        break;
        
      case keyboardKeys.ESCAPE:
        setShowSuggestions(false);
        setShowFilters(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.focus();
        break;
        
      case keyboardKeys.TAB:
        if (showSuggestions) {
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        break;
    }
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Announce to screen reader
    announceToScreenReader(`Selected: ${suggestion.text}`);
    
    // Focus back to input
    inputRef.current?.focus();
    
    // Auto-search after selecting suggestion
    setTimeout(() => performSearch(), 100);
  };

  // Perform search
  const performSearch = () => {
    if (!query.trim()) return;

    // Add to search history
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      filters: { ...activeFilters },
      timestamp: new Date(),
    };

    const updatedHistory = [historyItem, ...searchHistory.filter(h => h.query !== query.trim())].slice(0, 20);
    setSearchHistory(updatedHistory);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));

    // Announce search
    announceToScreenReader(`Searching for: ${query}`);

    // Call search callback
    onSearch(query.trim(), activeFilters);
    
    // Hide suggestions
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Save search
  const saveSearch = () => {
    if (!query.trim()) return;

    const savedItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      filters: { ...activeFilters },
      timestamp: new Date(),
    };

    const updatedSaved = [savedItem, ...savedSearches.filter(s => s.query !== query.trim())].slice(0, 10);
    setSavedSearches(updatedSaved);
    localStorage.setItem('savedSearches', JSON.stringify(updatedSaved));
    
    announceToScreenReader('Search saved successfully');
  };

  // Load saved search
  const loadSavedSearch = (savedSearch: SearchHistoryItem) => {
    setQuery(savedSearch.query);
    setActiveFilters(savedSearch.filters);
    setShowSuggestions(false);
    inputRef.current?.focus();
    
    announceToScreenReader(`Loaded saved search: ${savedSearch.query}`);
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setActiveFilters({});
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
    
    announceToScreenReader('Search cleared');
  };

  // Update filter
  const updateFilter = (filterId: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: value,
    }));
  };

  // Remove filter
  const removeFilter = (filterId: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterId];
      return newFilters;
    });
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'meter':
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'payment':
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'user':
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'history':
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      {/* Main search input */}
      <div className="relative">
        <div className="flex items-center">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query.length >= 2 && setShowSuggestions(true)}
              placeholder={placeholder}
              className="w-full px-4 py-3 pr-12 border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              aria-label={ariaLabels.searchInput}
              aria-expanded={showSuggestions.toString()}
              aria-haspopup="listbox"
              role="combobox"
              aria-autocomplete="list"
            />
            
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Clear button */}
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-2">
            {availableFilters.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Toggle search filters"
                aria-expanded={showFilters.toString()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-4.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            )}
            
            <button
              onClick={performSearch}
              className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Perform search"
            >
              Search
            </button>
          </div>
        </div>
        
        {/* Active filters */}
        {Object.keys(activeFilters).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" role="list" aria-label="Active search filters">
            {Object.entries(activeFilters).map(([filterId, value]) => {
              const filter = availableFilters.find(f => f.id === filterId);
              if (!filter) return null;
              
              return (
                <div
                  key={filterId}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm"
                  role="listitem"
                >
                  <span>{filter.label}: {String(value)}</span>
                  <button
                    onClick={() => removeFilter(filterId)}
                    className="p-1 rounded-full hover:bg-accent/50"
                    aria-label={`Remove ${filter.label} filter`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Search suggestions dropdown */}
      {showSuggestions && (
        <ul
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          role="listbox"
          aria-label="Search suggestions"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              className={`px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-accent ${
                index === selectedSuggestionIndex ? 'bg-accent' : ''
              }`}
              onClick={() => selectSuggestion(suggestion)}
            >
              {getSuggestionIcon(suggestion.type)}
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{suggestion.text}</div>
                {suggestion.type === 'history' && suggestion.metadata && (
                  <div className="text-xs text-muted-foreground">
                    {suggestion.metadata.resultCount ? `${suggestion.metadata.resultCount} results` : 'Previous search'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      
      {/* Advanced filters panel */}
      {showFilters && availableFilters.length > 0 && (
        <div
          ref={filtersRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-4"
          role="region"
          aria-label="Advanced search filters"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Advanced Filters</h3>
          <div className="space-y-4">
            {availableFilters.map(filter => (
              <div key={filter.id} className="space-y-2">
                <label className="text-sm font-medium text-foreground">{filter.label}</label>
                
                {filter.type === 'select' && (
                  <select
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => updateFilter(filter.id, e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All</option>
                    {filter.options?.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                
                {filter.type === 'range' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={filter.min}
                      max={filter.max}
                      value={activeFilters[filter.id]?.min || filter.min || ''}
                      onChange={(e) => updateFilter(filter.id, { 
                        ...activeFilters[filter.id], 
                        min: e.target.value 
                      })}
                      className="w-20 px-2 py-1 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Min"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="number"
                      min={filter.min}
                      max={filter.max}
                      value={activeFilters[filter.id]?.max || filter.max || ''}
                      onChange={(e) => updateFilter(filter.id, { 
                        ...activeFilters[filter.id], 
                        max: e.target.value 
                      })}
                      className="w-20 px-2 py-1 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Max"
                    />
                  </div>
                )}
                
                {filter.type === 'date' && (
                  <input
                    type="date"
                    value={activeFilters[filter.id] || ''}
                    onChange={(e) => updateFilter(filter.id, e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
            <button
              onClick={saveSearch}
              className="text-sm text-primary hover:text-primary/80"
              aria-label="Save current search"
            >
              Save Search
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveFilters({});
                  setShowFilters(false);
                }}
                className="px-3 py-1 text-sm border border-border rounded-md hover:bg-accent"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Saved searches dropdown */}
      {savedSearches.length > 0 && (
        <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 w-64">
          <h3 className="text-sm font-semibold text-foreground px-4 py-2 border-b border-border">
            Saved Searches
          </h3>
          <div className="max-h-48 overflow-y-auto">
            {savedSearches.map(saved => (
              <button
                key={saved.id}
                onClick={() => loadSavedSearch(saved)}
                className="w-full px-4 py-2 text-left hover:bg-accent flex items-center justify-between"
              >
                <span className="text-sm text-foreground">{saved.query}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(saved.timestamp).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
