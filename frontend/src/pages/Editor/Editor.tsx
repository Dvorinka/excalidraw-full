import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Check, Loader2, History, ChevronRight, StickyNote, LayoutTemplate, MonitorPlay, X, Plus } from 'lucide-react';
import { Button } from '@/components';
import { BUILTIN_TEMPLATES } from '@/components/TemplatePicker/TemplatePicker';
import { useThemeStore } from '@/stores';
import { api } from '@/services';
import type { Drawing, DrawingRevision } from '@/types';
import styles from './Editor.module.scss';

// Dynamic import for Excalidraw to avoid SSR issues
const ExcalidrawWithLibrary = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => {
    const { Excalidraw } = mod;
    const ExcalidrawWrapper: React.FC<any> = (props) => {
      return <Excalidraw {...props} />;
    };
    return { default: ExcalidrawWrapper };
  })
);

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
  const groupIdMap = new Map<string, string>();
  sourceElements.forEach((el) => {
    idMap.set(el.id as string, `${el.type}-${Math.random().toString(36).slice(2, 9)}`);
    const gids = ((el as { groupIds?: string[] }).groupIds) || [];
    gids.forEach((gid) => {
      if (!groupIdMap.has(gid)) {
        groupIdMap.set(gid, `group-${Math.random().toString(36).slice(2, 9)}`);
      }
    });
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
    const gids = (newEl as { groupIds?: string[] }).groupIds;
    if (gids && gids.length) {
      (newEl as { groupIds?: string[] }).groupIds = gids.map((gid) => groupIdMap.get(gid) || gid);
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
  const [presentationMode, setPresentationMode] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load drawing data
  useEffect(() => {
    const loadDrawing = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const drawingData = await api.drawings.get(id);
        setDrawing(drawingData);

        // Load revisions
        let revisionsData: DrawingRevision[] = [];
        try {
          revisionsData = await api.revisions.list(id);
          setRevisions(revisionsData);
        } catch (revErr) {
          console.warn('Failed to load revisions, starting with empty canvas:', revErr);
        }

        // Load latest revision data if available
        if (revisionsData.length > 0 && revisionsData[0].snapshot) {
          try {
            const rawSnapshot = revisionsData[0].snapshot;
            const snapshot = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot) : rawSnapshot;
            setInitialData({
              elements: snapshot.elements || [],
              appState: appStateWithoutGrid(snapshot.appState || {}),
              files: snapshot.files || {},
            });
            lastSavedDataRef.current = JSON.stringify(snapshot);
          } catch (parseErr) {
            console.error('Failed to parse revision snapshot:', parseErr);
            setInitialData({
              elements: [],
              appState: appStateWithoutGrid(),
              files: {},
            });
            lastSavedDataRef.current = JSON.stringify({ elements: [], appState: {}, files: {} });
          }
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
        console.error('Failed to load drawing:', err);
        setError('Failed to load drawing');
      } finally {
        setIsLoading(false);
      }
    };
    loadDrawing();
  }, [id]);

  // Sync Excalidraw theme with global theme
  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ appState: { theme: appTheme === 'dark' ? 'dark' : 'light' } });
    }
  }, [appTheme, excalidrawAPI]);

  // Handle changes from Excalidraw
  const handleExcalidrawChange = useCallback((elements: readonly ExcalidrawElement[], appState: Record<string, unknown>, files: Record<string, { dataURL: string; mimeType: string }>) => {
    const selectedIds = Object.keys((appState.selectedElementIds as Record<string, boolean> | undefined) || {});
    const selectedEl = selectedIds.length === 1
      ? elements.find((el) => el.id === selectedIds[0] && !el.isDeleted)
      : null;

    // Handle checkbox toggle
    if (selectedEl && (selectedEl.customData as Record<string, unknown> | undefined)?.templateRole === 'checkbox') {
      if (excalidrawAPI && lastToggledCheckboxRef.current !== selectedEl.id) {
        lastToggledCheckboxRef.current = selectedEl.id;
        const nextChecked = !((selectedEl.customData as Record<string, unknown> | undefined)?.checked as boolean);
        const nextElements = elements.map((el) => (
          el.id === selectedEl.id
            ? {
                ...el,
                backgroundColor: nextChecked ? '#a5eba8' : 'transparent',
                fillStyle: (nextChecked ? 'solid' : 'hachure') as 'solid' | 'hachure',
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
    } else {
      lastToggledCheckboxRef.current = null;
    }

    // Handle "+" add button click
    if (selectedEl && (selectedEl.customData as Record<string, unknown> | undefined)?.action === 'add' && excalidrawAPI) {
      const customData = (selectedEl.customData as Record<string, unknown>) || {};
      const role = customData.templateRole as string;
      const btnX = (selectedEl.x as number) || 0;
      const btnY = (selectedEl.y as number) || 0;
      const newElements: LooseElement[] = [];
      const uid = () => `el-${Math.random().toString(36).slice(2)}`;
      const tid = () => `txt-${Math.random().toString(36).slice(2)}`;

      if (role.startsWith('todo-add') || role.startsWith('checklist-add')) {
        // Add a new checkbox + text row below the button
        const newY = btnY + 30;
        newElements.push({
          id: uid(), type: 'rectangle', x: btnX, y: newY, width: 20, height: 20,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
          frameId: null, roundness: { type: 3, value: 32 }, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          customData: { templateRole: 'checkbox', checked: false },
        });
        newElements.push({
          id: tid(), type: 'text', x: btnX + 30, y: newY + 2, width: 120, height: 24,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
          frameId: null, roundness: null, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          text: 'New task', fontSize: 18, fontFamily: 1, textAlign: 'left', verticalAlign: 'top',
          baseline: 16, containerId: null, originalText: 'New task', lineHeight: 1.25,
        });
        // Move the add button down
        const updated = elements.map((el) =>
          el.id === selectedEl.id
            ? { ...el, y: newY + 40, version: el.version + 1, versionNonce: Math.floor(Math.random() * 1000000), updated: Date.now() }
            : el
        );
        excalidrawAPI.updateScene({ elements: [...updated, ...newElements] as ExcalidrawElement[] });
        setSaveStatus('unsaved');
        return;
      }

      if (role.startsWith('kanban-add')) {
        // Add a new card in the column
        const cardW = 140, cardH = 60;
        const newY = btnY - 70;
        const colX = btnX - 20;
        const gid = `card-${uid()}`;
        newElements.push({
          id: uid(), type: 'rectangle', x: colX, y: newY, width: cardW, height: cardH,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [gid],
          frameId: null, roundness: { type: 3, value: 32 }, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
        });
        newElements.push({
          id: tid(), type: 'text', x: colX + 15, y: newY + 20, width: 100, height: 22,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [gid],
          frameId: null, roundness: null, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          text: 'New card', fontSize: 16, fontFamily: 1, textAlign: 'left', verticalAlign: 'top',
          baseline: 14, containerId: null, originalText: 'New card', lineHeight: 1.25,
        });
        // Move the add button down
        const updated = elements.map((el) =>
          el.id === selectedEl.id
            ? { ...el, y: newY + cardH + 10, version: el.version + 1, versionNonce: Math.floor(Math.random() * 1000000), updated: Date.now() }
            : el
        );
        excalidrawAPI.updateScene({ elements: [...updated, ...newElements] as ExcalidrawElement[] });
        setSaveStatus('unsaved');
        return;
      }

      if (role.startsWith('mindmap-add')) {
        // Add a new branch node below the current one
        const nodeW = 150, nodeH = 55;
        const newY = btnY + 20;
        const gid = `branch-${uid()}`;
        newElements.push({
          id: uid(), type: 'rectangle', x: btnX, y: newY, width: nodeW, height: nodeH,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [gid],
          frameId: null, roundness: { type: 3, value: 32 }, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
        });
        newElements.push({
          id: tid(), type: 'text', x: btnX + 25, y: newY + 16, width: 100, height: 22,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [gid],
          frameId: null, roundness: null, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          text: 'New branch', fontSize: 18, fontFamily: 1, textAlign: 'left', verticalAlign: 'top',
          baseline: 16, containerId: null, originalText: 'New branch', lineHeight: 1.25,
        });
        // Add connecting arrow from parent to new node
        const parentCenterX = btnX + nodeW / 2;
        const parentBottomY = btnY - 20;
        newElements.push({
          id: `arrow-${Math.random().toString(36).slice(2)}`, type: 'arrow',
          x: parentCenterX, y: parentBottomY, width: 0, height: newY - parentBottomY,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
          frameId: null, roundness: { type: 2 }, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          startBinding: null, endBinding: null, lastCommittedPoint: null,
          startArrowhead: null, endArrowhead: 'arrow',
          points: [[0, 0], [0, newY - parentBottomY]],
        });
        // Move the add button down
        const updated = elements.map((el) =>
          el.id === selectedEl.id
            ? { ...el, y: newY + nodeH + 10, version: el.version + 1, versionNonce: Math.floor(Math.random() * 1000000), updated: Date.now() }
            : el
        );
        excalidrawAPI.updateScene({ elements: [...updated, ...newElements] as ExcalidrawElement[] });
        setSaveStatus('unsaved');
        return;
      }

      // Generic add: add a text line below
      if (role.startsWith('list-add') || role.startsWith('meeting-add') || role.startsWith('flow-add') ||
          role.startsWith('brainstorm-add') || role.startsWith('retro-add') || role.startsWith('swot-add') ||
          role.startsWith('storymap-add') || role.startsWith('wireframe-add') || role.startsWith('timeline-add') ||
          role.startsWith('architecture-add')) {
        const newY = btnY + 30;
        newElements.push({
          id: tid(), type: 'text', x: btnX + 30, y: newY, width: 150, height: 22,
          angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'hachure',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
          frameId: null, roundness: null, seed: Math.floor(Math.random() * 10000),
          version: 2, versionNonce: Math.floor(Math.random() * 100000), isDeleted: false,
          boundElements: [], updated: Date.now(), link: null, locked: false,
          text: role.startsWith('list-add') ? '• New item' : '- New item',
          fontSize: 16, fontFamily: 1, textAlign: 'left', verticalAlign: 'top',
          baseline: 14, containerId: null, originalText: role.startsWith('list-add') ? '• New item' : '- New item', lineHeight: 1.25,
        });
        const updated = elements.map((el) =>
          el.id === selectedEl.id
            ? { ...el, y: newY + 30, version: el.version + 1, versionNonce: Math.floor(Math.random() * 1000000), updated: Date.now() }
            : el
        );
        excalidrawAPI.updateScene({ elements: [...updated, ...newElements] as ExcalidrawElement[] });
        setSaveStatus('unsaved');
        return;
      }
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
      const snapshot = typeof revision.snapshot === 'string' ? JSON.parse(revision.snapshot) : revision.snapshot;
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

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveStatus !== 'saved' && !isSaving) {
          saveDrawing();
        }
      }
      if (e.key === 'Escape' && presentationMode) {
        setPresentationMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveStatus, isSaving, saveDrawing, presentationMode]);

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
    { id: 'todo', label: 'To-Do List', description: 'Checkbox tasks with +', icon: null },
    { id: 'checklist', label: 'Checklist', description: 'Status checklist with +', icon: null },
    { id: 'list', label: 'Bullet List', description: 'Bulleted notes with +', icon: null },
    { id: 'flow', label: 'Flow Chart', description: 'Process diagram with +', icon: null },
    { id: 'kanban', label: 'Kanban Board', description: 'Backlog, doing, done with +', icon: null },
    { id: 'meeting', label: 'Meeting Notes', description: 'Agenda, decisions, actions', icon: null },
    { id: 'wireframe', label: 'Wireframe', description: 'Editable page layout', icon: null },
    { id: 'mindmap', label: 'Mind Map', description: 'Central idea with + branches', icon: null },
    { id: 'brainstorm', label: 'Brainstorm', description: 'Ideas around a topic', icon: null },
    { id: 'retrospective', label: 'Retrospective', description: 'Went well, improve, actions', icon: null },
    { id: 'swot', label: 'SWOT Analysis', description: 'Strengths, weaknesses, opps, threats', icon: null },
    { id: 'storymap', label: 'User Story Map', description: 'Epics, steps, and stories', icon: null },
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
      <div className={`${styles.toolbar} ${presentationMode ? styles.toolbarHidden : ''}`}>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPresentationMode(true)}
            title="Presentation mode"
            aria-label="Start presentation mode"
          >
            <MonitorPlay size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setTemplateName(drawing?.title || ''); setTemplateDesc(''); setShowSaveTemplate(true); }}
            title="Save as template"
            aria-label="Save current drawing as a custom template"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>
      <div className={styles.canvasWrapper}>
        <div className={`${styles.canvas} ${(showRevisions || showNotes || showTemplates) ? styles.canvasNarrow : ''}`}>
          {initialData && (
            <React.Suspense fallback={<div className={styles.loadingCanvas}>{t('editor.loadingCanvas')}</div>}>
              <ExcalidrawWithLibrary
                excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={handleExcalidrawChange}
                theme={appTheme === 'dark' ? 'dark' : 'light'}
                gridModeEnabled={false}
                viewModeEnabled={presentationMode}
                zenModeEnabled={presentationMode}
                validateEmbeddable={() => true}
                validateLibraryUrl={() => true}
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

        {presentationMode && (
          <div className={styles.presentationOverlay} role="presentation">
            <div className={styles.presentationToolbar}>
              <span className={styles.presentationLabel}>Presentation Mode — Press Esc to exit</span>
              <Button variant="ghost" size="sm" onClick={() => setPresentationMode(false)} aria-label="Exit presentation">
                <X size={16} />
              </Button>
            </div>
          </div>
        )}

        {showSaveTemplate && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="save-template-title" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveTemplate(false); }}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3 id="save-template-title">Save as Template</h3>
                <button className={styles.modalClose} onClick={() => setShowSaveTemplate(false)} aria-label="Close">&times;</button>
              </div>
              <div className={styles.modalBody}>
                <label htmlFor="template-name">Template Name</label>
                <input
                  id="template-name"
                  type="text"
                  autoFocus
                  placeholder="My Custom Template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className={styles.modalInput}
                />
                <label htmlFor="template-desc" style={{ marginTop: 'var(--space-3)' }}>Description (optional)</label>
                <input
                  id="template-desc"
                  type="text"
                  placeholder="Brief description..."
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.modalBtnSecondary} onClick={() => setShowSaveTemplate(false)}>Cancel</button>
                <button
                  className={styles.modalBtnPrimary}
                  onClick={async () => {
                    if (!templateName.trim() || !excalidrawAPI) return;
                    setIsSavingTemplate(true);
                    try {
                      const elements = excalidrawAPI.getSceneElements();
                      const appState = excalidrawAPI.getAppState();
                      const files = excalidrawAPI.getFiles();
                      const snapshot = { type: 'excalidraw', version: 2, source: window.location.hostname, elements, appState, files };
                      await api.templates.create({
                        name: templateName.trim(),
                        description: templateDesc.trim(),
                        snapshot,
                        metadata: { category: 'custom' },
                      });
                      setShowSaveTemplate(false);
                      alert('Template saved successfully!');
                    } catch (err) {
                      console.error('Failed to save template:', err);
                      alert('Failed to save template. Please try again.');
                    } finally {
                      setIsSavingTemplate(false);
                    }
                  }}
                  disabled={isSavingTemplate || !templateName.trim()}
                >
                  {isSavingTemplate ? <Loader2 size={16} className={styles.spinner} /> : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
