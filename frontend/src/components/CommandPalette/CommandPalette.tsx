import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Command, FileText, FolderOpen, Users, Settings, FileCode, LayoutDashboard } from 'lucide-react';
import styles from './CommandPalette.module.scss';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ElementType;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      label: t('sidebar.dashboard'),
      icon: LayoutDashboard,
      action: () => navigate('/'),
    },
    {
      id: 'files',
      label: t('sidebar.files'),
      icon: FolderOpen,
      action: () => navigate('/files'),
    },
    {
      id: 'templates',
      label: t('sidebar.templates'),
      icon: FileCode,
      action: () => navigate('/templates'),
    },
    {
      id: 'team',
      label: t('sidebar.team'),
      icon: Users,
      action: () => navigate('/team'),
    },
    {
      id: 'settings',
      label: t('sidebar.settings'),
      icon: Settings,
      action: () => navigate('/settings'),
    },
    {
      id: 'new-drawing',
      label: t('dashboard.newDrawing'),
      icon: FileText,
      action: () => navigate('/drawing/new'),
    },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const openPalette = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') {
        closePalette();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openPalette, closePalette]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) {
          cmd.action();
          closePalette();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filtered, selectedIndex, closePalette]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Search size={18} className={styles.inputIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={filtered[selectedIndex] ? `cmd-${filtered[selectedIndex].id}` : undefined}
          />
          <span className={styles.kbd} aria-label="Keyboard shortcut">
            <Command size={12} aria-hidden="true" /> K
          </span>
        </div>
        <div ref={listRef} className={styles.list} id="command-list" role="listbox">
          {filtered.length === 0 ? (
            <div className={styles.empty}>{t('commandPalette.noResults')}</div>
          ) : (
            filtered.map((cmd, index) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  id={`cmd-${cmd.id}`}
                  className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    cmd.action();
                    closePalette();
                  }}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  {Icon && <Icon size={16} className={styles.itemIcon} aria-hidden="true" />}
                  <span className={styles.itemLabel}>{cmd.label}</span>
                  {cmd.shortcut && <span className={styles.itemShortcut}>{cmd.shortcut}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
