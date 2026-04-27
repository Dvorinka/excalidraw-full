import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Check, Loader2, History, ChevronRight, Bot, StickyNote, LayoutTemplate, BookOpen, Search } from 'lucide-react';
import { Button, ChatPanel } from '@/components';
import { BUILTIN_TEMPLATES } from '@/components/TemplatePicker/TemplatePicker';
import { useThemeStore } from '@/stores';
import { api } from '@/services';
import type { Drawing, DrawingRevision } from '@/types';
import styles from './Editor.module.scss';

// Dynamic import for Excalidraw to avoid SSR issues
const Excalidraw = React.lazy(() => import('@excalidraw/excalidraw').then(mod => ({ default: mod.Excalidraw })));

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

interface ExcalidrawState {
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, { dataURL: string; mimeType: string }>;
}

function prepareElementsForImport(sourceElements: any[], offsetX: number, offsetY: number): any[] {
  if (!sourceElements || !sourceElements.length) return [];
  const idMap = new Map<string, string>();
  sourceElements.forEach((el: any) => {
    idMap.set(el.id, `${el.type}-${Math.random().toString(36).slice(2, 9)}`);
  });
  return sourceElements.map((el: any) => {
    const newEl = { ...el };
    newEl.id = idMap.get(el.id) || el.id;
    newEl.x = (el.x || 0) + offsetX;
    newEl.y = (el.y || 0) + offsetY;
    newEl.version = (el.version || 1) + 1;
    newEl.versionNonce = Math.floor(Math.random() * 1000000);
    newEl.updated = Date.now();
    newEl.seed = Math.floor(Math.random() * 100000);
    if (newEl.boundElements) {
      newEl.boundElements = newEl.boundElements.map((be: any) => ({
        ...be,
        id: idMap.get(be.id) || be.id,
      }));
    }
    if (newEl.containerId && idMap.has(newEl.containerId)) {
      newEl.containerId = idMap.get(newEl.containerId);
    }
    return newEl;
  });
}

export const Editor: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [revisions, setRevisions] = useState<DrawingRevision[]>([]);
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const { theme: appTheme } = useThemeStore();
  const currentStateRef = useRef<ExcalidrawState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryFiltered, setLibraryFiltered] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('All');

  // Load drawing data
  useEffect(() => {
    const loadDrawing = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const [drawingData, revisionsData] = await Promise.all([
          api.drawings.get(id),
          api.revisions.list(id),
        ]);
        setDrawing(drawingData);
        setRevisions(revisionsData);

        // Load latest revision data if available
        if (revisionsData.length > 0 && revisionsData[0].snapshot) {
          const snapshot = JSON.parse(String(revisionsData[0].snapshot));
          setInitialData({
            elements: snapshot.elements || [],
            appState: snapshot.appState || {},
            files: snapshot.files || {},
          });
          lastSavedDataRef.current = JSON.stringify(snapshot);
        } else {
          // Check for pending template from dashboard
          const pendingTemplate = localStorage.getItem(`template_${id}`);
          if (pendingTemplate) {
            const tpl = JSON.parse(pendingTemplate);
            setInitialData({
              elements: tpl.elements || [],
              appState: tpl.appState || {},
              files: tpl.files || {},
            });
            lastSavedDataRef.current = JSON.stringify(tpl);
            localStorage.removeItem(`template_${id}`);
          } else {
            // Start with empty canvas
            setInitialData({
              elements: [],
              appState: {},
              files: {},
            });
            lastSavedDataRef.current = JSON.stringify({ elements: [], appState: {}, files: {} });
          }
        }
      } catch (err) {
        setError('Failed to load drawing');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDrawing();
  }, [id]);

  // Handle changes from Excalidraw
  const handleExcalidrawChange = useCallback((elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, { dataURL: string; mimeType: string }>) => {
    currentStateRef.current = {
      elements: elements as ExcalidrawElement[],
      appState,
      files,
    };
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDrawing();
    }, 2000);
  }, []);

  // Auto-save functionality
  const saveDrawing = useCallback(async () => {
    if (!id || !currentStateRef.current || isSaving) return;

    const { elements, appState, files } = currentStateRef.current;

    const snapshot = {
      type: 'excalidraw',
      version: 2,
      source: window.location.hostname,
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
        gridStep: appState.gridStep,
        gridModeEnabled: appState.gridModeEnabled,
        theme: appState.theme,
        zenModeEnabled: appState.zenModeEnabled,
        viewModeEnabled: appState.viewModeEnabled,
        editingGroup: appState.editingGroup,
        selectedElementIds: appState.selectedElementIds,
      },
      files,
    };

    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson === lastSavedDataRef.current) {
      setSaveStatus('saved');
      return;
    }

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      await api.revisions.create(id, snapshot, 'Auto-save');
      lastSavedDataRef.current = snapshotJson;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  }, [id, isSaving]);

  // Remove unused revisions warning by displaying count in UI
  const revisionCount = revisions.length;

  // Restore a specific revision
  const handleRestoreRevision = (revision: DrawingRevision) => {
    if (!revision.snapshot) return;
    try {
      const snapshot = JSON.parse(String(revision.snapshot));
      setInitialData({
        elements: snapshot.elements || [],
        appState: snapshot.appState || {},
        files: snapshot.files || {},
      });
      lastSavedDataRef.current = JSON.stringify(snapshot);
      setSelectedRevision(revision.id);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to restore revision:', err);
    }
  };

  // Manual save
  const handleManualSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveDrawing();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Load library marketplace when panel opens
  useEffect(() => {
    if (!showLibrary || libraryItems.length > 0) return;
    const load = async () => {
      setLibraryLoading(true);
      try {
        const res = await fetch('https://libraries.excalidraw.com/libraries.json', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to load libraries');
        const data = await res.json();
        const items = Object.entries(data).map(([key, lib]: [string, any]) => ({
          key,
          name: lib.name || key,
          description: lib.description || '',
          authors: lib.authors || [{ name: 'Unknown' }],
          source: `https://libraries.excalidraw.com/${key}.excalidrawlib`,
          preview: lib.preview?.startsWith('http') ? lib.preview : `https://libraries.excalidraw.com/${key}.png`,
          tags: lib.tags || [],
          downloads: lib.downloads || 0,
        }));
        setLibraryItems(items);
        setLibraryFiltered(items);
      } catch (err) {
        console.error(err);
        setLibraryError('Could not load library marketplace.');
      } finally {
        setLibraryLoading(false);
      }
    };
    load();
  }, [showLibrary, libraryItems.length]);

  // Filter library items
  useEffect(() => {
    let result = libraryItems;
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      result = result.filter((l: any) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.tags.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    if (libraryCategory !== 'All') {
      result = result.filter((l: any) => l.tags.some((t: string) => t.toLowerCase() === libraryCategory.toLowerCase()));
    }
    setLibraryFiltered(result);
  }, [librarySearch, libraryCategory, libraryItems]);

  const handleLoadTemplate = (templateKey: string) => {
    const templateElements = BUILTIN_TEMPLATES[templateKey as keyof typeof BUILTIN_TEMPLATES];
    if (!templateElements || !excalidrawAPI) return;
    const currentElements = excalidrawAPI.getSceneElements?.() || [];
    let offsetX = 100;
    let offsetY = 100;
    if (currentElements.length > 0) {
      const maxX = Math.max(...currentElements.map((el: any) => (el.x || 0) + (el.width || 0)));
      offsetX = maxX + 100;
    }
    const newElements = prepareElementsForImport(templateElements, offsetX, offsetY);
    const mergedElements = [...currentElements, ...newElements];
    excalidrawAPI.updateScene({ elements: mergedElements });
    setShowTemplates(false);
    setSaveStatus('unsaved');
  };

  const handleLoadLibraryItem = async (item: any) => {
    if (!excalidrawAPI || !item.source) return;
    try {
      const res = await fetch(item.source);
      if (!res.ok) throw new Error('Failed to load library');
      const libData = await res.json();
      let sourceElements: any[] = [];
      if (libData.libraryItems && Array.isArray(libData.libraryItems)) {
        sourceElements = libData.libraryItems[0]?.elements || [];
      } else if (Array.isArray(libData)) {
        sourceElements = libData;
      } else if (libData.elements && Array.isArray(libData.elements)) {
        sourceElements = libData.elements;
      }
      if (!sourceElements.length) {
        alert('This library appears to be empty');
        return;
      }
      const currentElements = excalidrawAPI.getSceneElements?.() || [];
      let offsetX = 100;
      let offsetY = 100;
      if (currentElements.length > 0) {
        const maxX = Math.max(...currentElements.map((el: any) => (el.x || 0) + (el.width || 0)));
        offsetX = maxX + 100;
      }
      const newElements = prepareElementsForImport(sourceElements, offsetX, offsetY);
      const mergedElements = [...currentElements, ...newElements];
      excalidrawAPI.updateScene({ elements: mergedElements });
      setShowLibrary(false);
      setSaveStatus('unsaved');
    } catch (err) {
      console.error('Failed to load library item:', err);
      alert('Failed to load library item');
    }
  };

  const templateOptions = [
    { id: 'blank', label: 'Blank', description: 'Empty canvas start', icon: null },
    { id: 'todo', label: 'To-Do List', description: 'Checkbox tasks', icon: null },
    { id: 'checklist', label: 'Checklist', description: 'Status checklist', icon: null },
    { id: 'list', label: 'Bullet List', description: 'Bulleted notes', icon: null },
    { id: 'flow', label: 'Flow Chart', description: 'Process diagram', icon: null },
  ];

  const libraryCategories = ['All', 'Arrows', 'Charts', 'Cloud', 'Devops', 'Diagrams', 'Education', 'Food', 'Frames', 'Gaming', 'Icons', 'Illustrations', 'Machines', 'Misc', 'People', 'Software', 'Systems', 'Tech', 'Workflow'];

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !drawing) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error || t('editor.notFound')}</p>
          <Button onClick={() => navigate('/')}>{t('editor.goToDashboard')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            {t('editor.back')}
          </Button>
          <span className={styles.title}>{drawing.title}</span>
          <span className={styles.saveStatus}>
            {saveStatus === 'saving' && <><Loader2 size={14} className={styles.spinner} /> {t('editor.saving')}</>}
            {saveStatus === 'saved' && <><Check size={14} /> {t('editor.saved')} {revisionCount > 0 && `(${revisionCount} ${t('editor.revisions')})`}</>}
            {saveStatus === 'unsaved' && <span className={styles.unsaved}>{t('editor.unsaved')}</span>}
          </span>
        </div>
        <div className={styles.right}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChat(!showChat)}
            title="AI Assistant"
            aria-pressed={showChat}
            aria-label="Toggle AI chat panel"
          >
            <Bot size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
            title="Presenter notes"
            aria-pressed={showNotes}
            aria-label="Toggle presenter notes"
          >
            <StickyNote size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRevisions(!showRevisions)}
            title={t('editor.revisionBrowser')}
            aria-pressed={showRevisions}
            aria-label="Toggle revision browser"
          >
            <History size={16} />
            {revisionCount > 0 && <span className={styles.revisionBadge}>{revisionCount}</span>}
          </Button>
          <Button
            size="sm"
            onClick={handleManualSave}
            loading={isSaving}
            disabled={saveStatus === 'saved'}
          >
            <Save size={16} />
            {t('editor.saveNow')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowTemplates(!showTemplates); setShowLibrary(false); }}
            title="Templates"
            aria-pressed={showTemplates}
            aria-label="Toggle templates panel"
          >
            <LayoutTemplate size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowLibrary(!showLibrary); setShowTemplates(false); }}
            title="Library Marketplace"
            aria-pressed={showLibrary}
            aria-label="Toggle library panel"
          >
            <BookOpen size={16} />
          </Button>
        </div>
      </div>
      <div className={styles.canvasWrapper}>
        <div className={`${styles.canvas} ${(showRevisions || showNotes || showTemplates || showLibrary) ? styles.canvasNarrow : ''}`}>
          {initialData && (
            <React.Suspense fallback={<div className={styles.loadingCanvas}>{t('editor.loadingCanvas')}</div>}>
              <Excalidraw
                excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={handleExcalidrawChange}
                theme={appTheme === 'dark' ? 'dark' : 'light'}
                gridModeEnabled={true}
                UIOptions={{
                  canvasActions: {
                    saveToActiveFile: false,
                    loadScene: false,
                    export: { saveFileToDisk: false },
                  },
                }}
              />
            </React.Suspense>
          )}
        </div>

        {showRevisions && (
          <div className={styles.revisionPanel}>
            <div className={styles.revisionHeader}>
              <h3>{t('editor.revisionBrowser')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowRevisions(false)}>
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className={styles.revisionList}>
              {revisions.length === 0 ? (
                <p className={styles.revisionEmpty}>{t('editor.noRevisions')}</p>
              ) : (
                revisions.map((rev) => (
                  <button
                    key={rev.id}
                    className={`${styles.revisionItem} ${selectedRevision === rev.id ? styles.revisionActive : ''}`}
                    onClick={() => handleRestoreRevision(rev)}
                  >
                    <div className={styles.revisionMeta}>
                      <span className={styles.revisionLabel}>{rev.change_summary || t('editor.revision')}</span>
                      <span className={styles.revisionDate}>
                        {new Date(rev.created_at).toLocaleString()}
                      </span>
                    </div>
                    {rev.created_by && (
                      <span className={styles.revisionEditor}>{rev.created_by.slice(0, 8)}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {showNotes && (
          <div className={styles.notesPanel} role="complementary" aria-label={t('editor.presenterNotes')}>
            <div className={styles.notesHeader}>
              <h3>{t('editor.presenterNotes')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNotes(false)} aria-label={t('common.close')}>
                <ChevronRight size={16} />
              </Button>
            </div>
            <textarea
              className={styles.notesTextarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('editor.notesPlaceholder')}
              aria-label={t('editor.presenterNotes')}
            />
          </div>
        )}

        {showTemplates && (
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHeader}>
              <h3>Templates</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)} aria-label="Close">
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className={styles.sidePanelContent}>
              {templateOptions.map((opt) => (
                <button
                  key={opt.id}
                  className={styles.sidePanelItem}
                  onClick={() => handleLoadTemplate(opt.id)}
                >
                  <span className={styles.sidePanelItemTitle}>{opt.label}</span>
                  <span className={styles.sidePanelItemDesc}>{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showLibrary && (
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHeader}>
              <h3>Library Marketplace</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowLibrary(false)} aria-label="Close">
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className={styles.sidePanelContent}>
              <div className={styles.sidePanelSearch}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search libraries..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className={styles.sidePanelInput}
                />
              </div>
              <select
                className={styles.sidePanelSelect}
                value={libraryCategory}
                onChange={(e) => setLibraryCategory(e.target.value)}
              >
                {libraryCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {libraryLoading && (
                <div className={styles.sidePanelLoading}>
                  <Loader2 size={20} className={styles.spinner} />
                  <span>Loading...</span>
                </div>
              )}
              {libraryError && (
                <div className={styles.sidePanelError}>{libraryError}</div>
              )}
              {!libraryLoading && !libraryError && libraryFiltered.length === 0 && (
                <div className={styles.sidePanelEmpty}>No libraries found</div>
              )}
              {!libraryLoading && libraryFiltered.map((item: any) => (
                <button
                  key={item.key}
                  className={styles.sidePanelItem}
                  onClick={() => handleLoadLibraryItem(item)}
                >
                  <span className={styles.sidePanelItemTitle}>{item.name}</span>
                  <span className={styles.sidePanelItemDesc}>{item.description || item.tags.slice(0, 3).join(', ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <ChatPanel
            onClose={() => setShowChat(false)}
            drawingContext={drawing?.title}
          />
        )}
      </div>
    </div>
  );
};
