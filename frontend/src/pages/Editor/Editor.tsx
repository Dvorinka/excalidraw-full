import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Check, Loader2, History, ChevronRight, StickyNote, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components';
import { BUILTIN_TEMPLATES } from '@/components/TemplatePicker/TemplatePicker';
import { useThemeStore } from '@/stores';
import { api } from '@/services';
import type { Drawing, DrawingRevision } from '@/types';
import styles from './Editor.module.scss';

// Dynamic import for Excalidraw to avoid SSR issues
const Excalidraw = React.lazy(() => import('@excalidraw/excalidraw').then(mod => ({ default: mod.Excalidraw })));

import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types/types';

type LooseElement = Record<string, unknown>;

interface EditorState {
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, { dataURL: string; mimeType: string }>;
}

function prepareElementsForImport(sourceElements: LooseElement[], offsetX: number, offsetY: number): LooseElement[] {
  if (!sourceElements || !sourceElements.length) return [];
  const idMap = new Map<string, string>();
  sourceElements.forEach((el) => {
    idMap.set(el.id as string, `${el.type}-${Math.random().toString(36).slice(2, 9)}`);
  });
  return sourceElements.map((el) => {
    const newEl: LooseElement = { ...el };
    newEl.id = idMap.get(el.id as string) || el.id;
    newEl.x = ((el.x as number) || 0) + offsetX;
    newEl.y = ((el.y as number) || 0) + offsetY;
    newEl.version = ((el.version as number) || 1) + 1;
    newEl.versionNonce = Math.floor(Math.random() * 1000000);
    newEl.updated = Date.now();
    newEl.seed = Math.floor(Math.random() * 100000);
    if (newEl.boundElements) {
      newEl.boundElements = (newEl.boundElements as LooseElement[]).map((be) => ({
        ...be,
        id: idMap.get(be.id as string) || be.id,
      }));
    }
    if (newEl.containerId && idMap.has(newEl.containerId as string)) {
      newEl.containerId = idMap.get(newEl.containerId as string);
    }
    return newEl;
  });
}

function appStateWithoutGrid(appState: Record<string, unknown> = {}) {
  return {
    ...appState,
    gridModeEnabled: false,
    gridSize: null,
    gridStep: null,
  };
}

export const Editor: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [revisions, setRevisions] = useState<DrawingRevision[]>([]);
  const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const { theme: appTheme } = useThemeStore();
  const currentStateRef = useRef<EditorState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const lastToggledCheckboxRef = useRef<string | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const [showTemplates, setShowTemplates] = useState(false);

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
            appState: appStateWithoutGrid(snapshot.appState || {}),
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
              appState: appStateWithoutGrid(tpl.appState || {}),
              files: tpl.files || {},
            });
            lastSavedDataRef.current = JSON.stringify(tpl);
            localStorage.removeItem(`template_${id}`);
          } else {
            // Start with empty canvas
            setInitialData({
              elements: [],
              appState: appStateWithoutGrid(),
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
  const handleExcalidrawChange = useCallback((elements: readonly ExcalidrawElement[], appState: Record<string, unknown>, files: Record<string, { dataURL: string; mimeType: string }>) => {
    const selectedIds = Object.keys((appState.selectedElementIds as Record<string, boolean> | undefined) || {});
    const selectedCheckbox = selectedIds.length === 1
      ? elements.find((el) => (
          el.id === selectedIds[0] &&
          !el.isDeleted &&
          (el.customData as Record<string, unknown> | undefined)?.templateRole === 'checkbox'
        ))
      : null;

    if (!selectedCheckbox) {
      lastToggledCheckboxRef.current = null;
    } else if (excalidrawAPI && lastToggledCheckboxRef.current !== selectedCheckbox.id) {
      lastToggledCheckboxRef.current = selectedCheckbox.id;
      const nextChecked = !((selectedCheckbox.customData as Record<string, unknown> | undefined)?.checked as boolean);
      const nextElements = elements.map((el) => (
        el.id === selectedCheckbox.id
          ? {
              ...el,
              backgroundColor: nextChecked ? '#a5eba8' : 'transparent',
              customData: {
                ...((el.customData as Record<string, unknown> | undefined) || {}),
                checked: nextChecked,
              },
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 1000000),
              updated: Date.now(),
            }
          : el
      ));
      excalidrawAPI.updateScene({ elements: nextElements as ExcalidrawElement[] });
      currentStateRef.current = {
        elements: nextElements,
        appState: appStateWithoutGrid(appState),
        files,
      };
      setSaveStatus('unsaved');
      return;
    }

    currentStateRef.current = {
      elements: elements as unknown as ExcalidrawElement[],
      appState: appStateWithoutGrid(appState),
      files,
    };
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDrawing();
    }, 2000);
  }, [excalidrawAPI]);

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
        appState: appStateWithoutGrid(snapshot.appState || {}),
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

  const handleLoadTemplate = (templateKey: string) => {
    const templateElements = BUILTIN_TEMPLATES[templateKey as keyof typeof BUILTIN_TEMPLATES];
    if (!templateElements || !excalidrawAPI) return;
    const currentElements = excalidrawAPI.getSceneElements?.() || [];
    let offsetX = 100;
    const offsetY = 100;
    if (currentElements.length > 0) {
      const maxX = Math.max(...currentElements.map((el) => (el.x + el.width)));
      offsetX = maxX + 100;
    }
    const newElements = prepareElementsForImport(templateElements, offsetX, offsetY);
    const mergedElements = [...currentElements, ...newElements];
    excalidrawAPI.updateScene({ elements: mergedElements as ExcalidrawElement[] });
    setShowTemplates(false);
    setSaveStatus('unsaved');
  };

  const templateOptions = [
    { id: 'blank', label: 'Blank', description: 'Empty canvas start', icon: null },
    { id: 'todo', label: 'To-Do List', description: 'Checkbox tasks', icon: null },
    { id: 'checklist', label: 'Checklist', description: 'Status checklist', icon: null },
    { id: 'list', label: 'Bullet List', description: 'Bulleted notes', icon: null },
    { id: 'flow', label: 'Flow Chart', description: 'Process diagram', icon: null },
    { id: 'kanban', label: 'Kanban Board', description: 'Backlog, doing, done columns', icon: null },
    { id: 'meeting', label: 'Meeting Notes', description: 'Agenda, decisions, actions', icon: null },
    { id: 'wireframe', label: 'Wireframe', description: 'Editable page layout', icon: null },
    { id: 'mindmap', label: 'Mind Map', description: 'Central idea with branches', icon: null },
  ];

  useEffect(() => {
    if (!excalidrawAPI?.onPointerUp) return undefined;

    return excalidrawAPI.onPointerUp((activeTool: { type?: string; locked?: boolean }) => {
      if ((activeTool.type === 'line' || activeTool.type === 'arrow') && !activeTool.locked) {
        window.setTimeout(() => {
          excalidrawAPI.setActiveTool?.({ type: 'selection' });
        }, 0);
      }
    });
  }, [excalidrawAPI]);

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
            onClick={() => setShowTemplates(!showTemplates)}
            title="Templates"
            aria-pressed={showTemplates}
            aria-label="Toggle templates panel"
          >
            <LayoutTemplate size={16} />
          </Button>
        </div>
      </div>
      <div className={styles.canvasWrapper}>
        <div className={`${styles.canvas} ${(showRevisions || showNotes || showTemplates) ? styles.canvasNarrow : ''}`}>
          {initialData && (
            <React.Suspense fallback={<div className={styles.loadingCanvas}>{t('editor.loadingCanvas')}</div>}>
              <Excalidraw
                excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={handleExcalidrawChange}
                theme={appTheme === 'dark' ? 'dark' : 'light'}
                gridModeEnabled={false}
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

      </div>
    </div>
  );
};
