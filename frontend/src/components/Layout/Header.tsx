import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Bell, Plus, FileText, Loader2, Sun, Moon, Check, X } from 'lucide-react';
import { Button } from '@/components';
import { useThemeStore } from '@/stores';
import { api } from '@/services';
import type { Drawing } from '@/types';
import styles from './Layout.module.scss';

interface AppNotification {
  id: string;
  type: 'share' | 'comment' | 'mention' | 'update';
  title: string;
  description: string;
  time: string;
  read: boolean;
  drawingId?: string;
}

export const Header: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Drawing[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.notifications.list();
        setNotifications(res as unknown as AppNotification[]);
      } catch {
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

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

  const handleCreateDrawing = () => {
    setNewDrawingName('');
    setShowNameModal(true);
  };

  const confirmCreateDrawing = async () => {
    const title = newDrawingName.trim() || 'Untitled Drawing';
    setIsCreating(true);
    setShowNameModal(false);
    try {
      const drawing = await api.drawings.create({
        title,
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
      if (!notifRef.current?.contains(e.target as Node)) {
        setShowNotifications(false);
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
      
      <div className={styles.actions} ref={notifRef}>
        <button className={styles.iconButton} onClick={toggleTheme} title={t('userSettings.theme')} aria-label={t('userSettings.theme')}>
          {theme === 'light' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
        <button className={styles.iconButton} aria-label="Notifications" title="Notifications" onClick={() => setShowNotifications((v) => !v)}>
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 && <span className={styles.notifBadge}>{unreadCount}</span>}
        </button>
        {showNotifications && (
          <div className={styles.notifDropdown}>
            <div className={styles.notifHeader}>
              <span className={styles.notifTitle}>Notifications</span>
              <button className={styles.notifMarkAll} onClick={markAllRead} aria-label="Mark all as read">
                <Check size={14} aria-hidden="true" /> All read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className={styles.notifEmpty}>No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}>
                  <div className={styles.notifContent}>
                    <div className={styles.notifItemTitle}>{n.title}</div>
                    <div className={styles.notifItemDesc}>{n.description}</div>
                    <div className={styles.notifItemTime}>{n.time}</div>
                  </div>
                  <button className={styles.notifDismiss} onClick={() => dismissNotification(n.id)} aria-label="Dismiss notification">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        <Button onClick={handleCreateDrawing} loading={isCreating}>
          <Plus size={18} />
          {t('dashboard.newDrawing')}
        </Button>
      </div>

      {showNameModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowNameModal(false); }}>
          <div className={styles.nameModal}>
            <h3>New Drawing</h3>
            <input
              autoFocus
              type="text"
              placeholder="Drawing name..."
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmCreateDrawing();
                if (e.key === 'Escape') setShowNameModal(false);
              }}
              className={styles.nameInput}
            />
            <div className={styles.nameModalActions}>
              <button className={styles.nameModalCancel} onClick={() => setShowNameModal(false)}>Cancel</button>
              <button className={styles.nameModalConfirm} onClick={confirmCreateDrawing}>Create</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
