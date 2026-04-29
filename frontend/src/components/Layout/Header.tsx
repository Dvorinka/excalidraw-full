import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Bell, Plus, FileText, Loader2, Sun, Moon } from 'lucide-react';
import { Button } from '@/components';
import { useThemeStore } from '@/stores';
import { api } from '@/services';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Drawing } from '@/types';
import styles from './Layout.module.scss';

export const Header: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Drawing[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.search.get(q);
      setResults(res);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowResults(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => performSearch(val), 250);
  };

  const handleSelect = (drawing: Drawing) => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    if (drawing.folder_id) {
      navigate(`/folder/${drawing.folder_id}/drawing/${drawing.id}`);
    } else {
      navigate(`/drawing/${drawing.id}`);
    }
  };

  const handleCreateDrawing = async () => {
    setIsCreating(true);
    try {
      const drawing = await api.drawings.create({
        title: 'Untitled Drawing',
        visibility: 'team',
      });
      navigate(`/drawing/${drawing.id}`);
    } catch (err) {
      console.error('Failed to create drawing:', err);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className={styles.header}>
      {children}
      <div className={styles.search} ref={searchRef} role="search" aria-label="Search drawings">
        <Search size={18} />
        <input
          type="text"
          placeholder={t('common.search') + '...'}
          value={query}
          onChange={handleChange}
          onFocus={() => query && setShowResults(true)}
          aria-label="Search drawings"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={showResults}
        />
        {isSearching && <Loader2 size={14} className={styles.searchSpinner} />}
        {showResults && (query.trim() || results.length > 0) && (
          <div id="search-results" className={styles.searchDropdown} role="listbox">
            {results.length === 0 ? (
              <div className={styles.searchEmpty}>
                {isSearching ? t('common.loading') : t('search.noResults')}
              </div>
            ) : (
              results.map((drawing) => (
                <button
                  key={drawing.id}
                  className={styles.searchResult}
                  onClick={() => handleSelect(drawing)}
                  role="option"
                  aria-label={`Open drawing ${drawing.title}`}
                >
                  <FileText size={14} aria-hidden="true" />
                  <span className={styles.searchResultTitle}>{drawing.title}</span>
                  {drawing.owner?.name && (
                    <span className={styles.searchResultMeta}>{drawing.owner.name}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      <div className={styles.actions}>
        <button className={styles.iconButton} onClick={toggleTheme} title={t('userSettings.theme')} aria-label={t('userSettings.theme')}>
          {theme === 'light' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
        <button className={styles.iconButton} aria-label="Notifications" title="Notifications">
          <Bell size={20} aria-hidden="true" />
        </button>
        <Button onClick={handleCreateDrawing} loading={isCreating}>
          <Plus size={18} />
          {t('dashboard.newDrawing')}
        </Button>
      </div>
    </header>
  );
};
