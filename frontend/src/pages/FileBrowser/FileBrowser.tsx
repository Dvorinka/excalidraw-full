import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Folder, ChevronRight, Grid, List, MoreVertical, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Card, Button, Modal } from '@/components';
import { useDrawingStore } from '@/stores';
import { api } from '@/services';
import type { Drawing } from '@/types';
import styles from './FileBrowser.module.scss';

export const FileBrowser: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const urlParams = useParams<{ folderId?: string }>();
  const { drawings, folders, setDrawings, setFolders, removeDrawing } = useDrawingStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'team' | 'public-link'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(urlParams.folderId || null);

  // Dropdown menu state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // New project (folder) state
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectError, setProjectError] = useState('');

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Move state
  const [movingId, setMovingId] = useState<string | null>(null);

  // New drawing name modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    type: 'confirm' | 'alert' | 'info';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({ open: false, type: 'info', title: '', message: '' });

  const showModal = (type: 'confirm' | 'alert' | 'info', title: string, message: string, onConfirm?: () => void) => {
    setModal({ open: true, type, title, message, onConfirm, onCancel: () => setModal(m => ({ ...m, open: false })) });
  };

  // Load real data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [drawingsData, foldersData] = await Promise.all([
          api.drawings.list(),
          api.folders.list(),
        ]);
        setDrawings(drawingsData);
        setFolders(foldersData);
      } catch (err) {
        console.error('Failed to load file browser data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [setDrawings, setFolders]);

  // Update active folder when URL changes
  useEffect(() => {
    setActiveFolderId(urlParams.folderId || null);
  }, [urlParams.folderId]);

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  // Filter drawings by active folder + visibility, then sort
  let visibleDrawings = activeFolderId
    ? drawings.filter((d) => d.folder_id === activeFolderId)
    : drawings;

  if (visibilityFilter !== 'all') {
    visibleDrawings = visibleDrawings.filter((d) => d.visibility === visibilityFilter);
  }

  visibleDrawings = [...visibleDrawings].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.title.localeCompare(b.title);
    else if (sortBy === 'updated') cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    else if (sortBy === 'created') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const handleFolderClick = useCallback(
    (folderId: string | null) => {
      setActiveFolderId(folderId);
      if (folderId) {
        navigate(`/files/folder/${folderId}`);
      } else {
        navigate('/files');
      }
    },
    [navigate]
  );

  const handleDrawingClick = useCallback(
    (drawing: Drawing) => {
      if (drawing.folder_id) {
        navigate(`/folder/${drawing.folder_id}/drawing/${drawing.id}`);
      } else {
        navigate(`/drawing/${drawing.id}`);
      }
    },
    [navigate]
  );

  const handleCreateDrawing = () => {
    setNewDrawingName('');
    setShowNameModal(true);
  };

  const confirmCreateDrawing = async () => {
    const title = newDrawingName.trim() || 'Untitled Drawing';
    setIsCreating(true);
    setShowNameModal(false);
    try {
      const newDrawing = await api.drawings.create({
        title,
        visibility: 'team',
        folder_id: activeFolderId || null,
      });
      setDrawings([newDrawing, ...drawings]);
      if (newDrawing.folder_id) {
        navigate(`/folder/${newDrawing.folder_id}/drawing/${newDrawing.id}`);
      } else {
        navigate(`/drawing/${newDrawing.id}`);
      }
    } catch (err) {
      console.error('Failed to create drawing:', err);
      showModal('alert', 'Error', 'Failed to create drawing. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setProjectError('');
    try {
      const newFolder = await api.folders.create({ name, visibility: 'team' });
      setFolders([...folders, newFolder]);
      setShowNewProject(false);
      setNewProjectName('');
      navigate(`/files/folder/${newFolder.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setProjectError('We could not create that project. Check the name and try again.');
      showModal('alert', 'Error', 'Failed to create project. Please try again.');
    }
  };

  const handleDeleteDrawing = (drawing: Drawing) => {
    showModal('confirm', 'Delete Drawing', `Delete "${drawing.title}"? This cannot be undone.`, async () => {
      try {
        await api.drawings.delete(drawing.id);
        removeDrawing(drawing.id);
        setActiveMenu(null);
        setModal(m => ({ ...m, open: false }));
      } catch (err) {
        console.error('Failed to delete drawing:', err);
        setModal(m => ({ ...m, open: false }));
        setTimeout(() => showModal('alert', 'Error', 'Failed to delete drawing.'), 100);
      }
    });
  };

  const handleDuplicateDrawing = async (drawing: Drawing) => {
    try {
      const newDrawing = await api.drawings.create({
        title: `Copy of ${drawing.title}`,
        visibility: drawing.visibility,
        folder_id: drawing.folder_id || null,
      });
      setDrawings([newDrawing, ...drawings]);
      setActiveMenu(null);
      navigate(`/drawing/${newDrawing.id}`);
    } catch (err) {
      console.error('Failed to duplicate drawing:', err);
      showModal('alert', 'Error', 'Failed to duplicate drawing. Please try again.');
    }
  };

  const handleRenameDrawing = async (drawing: Drawing) => {
    const title = renameValue.trim();
    if (!title || title === drawing.title) {
      setRenamingId(null);
      return;
    }
    try {
      await api.drawings.update(drawing.id, { title });
      setDrawings(drawings.map(d => d.id === drawing.id ? { ...d, title } : d));
      setRenamingId(null);
    } catch (err) {
      console.error('Failed to rename drawing:', err);
      showModal('alert', 'Error', 'Failed to rename drawing. Please try again.');
    }
  };

  const handleMoveDrawing = async (drawing: Drawing, folderId: string | null) => {
    try {
      await api.drawings.update(drawing.id, { folder_id: folderId });
      setDrawings(drawings.map(d => d.id === drawing.id ? { ...d, folder_id: folderId } : d));
      setMovingId(null);
      setActiveMenu(null);
    } catch (err) {
      console.error('Failed to move drawing:', err);
      showModal('alert', 'Error', 'Failed to move drawing. Please try again.');
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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

  return (
    <>
      <Modal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        confirmText={modal.type === 'confirm' ? 'Delete' : 'OK'}
      />
      <div className={styles.container} role="region" aria-label={t('fileBrowser.title')}>
        <div className={styles.header}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <button
            className={styles.breadcrumbLink}
            onClick={() => handleFolderClick(null)}
            aria-current={!activeFolderId ? 'page' : undefined}
          >
            All Projects
          </button>
          {activeFolder && (
            <>
              <ChevronRight size={16} aria-hidden="true" />
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {activeFolder.name}
              </span>
            </>
          )}
        </nav>
        <div className={styles.actions}>
          <select
            className={styles.filterSelect}
            value={visibilityFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all' || v === 'private' || v === 'team' || v === 'public-link') {
                setVisibilityFilter(v);
              }
            }}
            aria-label="Filter by visibility"
            title="Filter by visibility"
          >
            <option value="all">All</option>
            <option value="private">Private</option>
            <option value="team">Team</option>
            <option value="public-link">Public</option>
          </select>
          <select
            className={styles.filterSelect}
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-');
              if (sb === 'name' || sb === 'updated' || sb === 'created') {
                setSortBy(sb);
              }
              if (so === 'asc' || so === 'desc') {
                setSortOrder(so);
              }
            }}
            aria-label="Sort drawings"
            title="Sort drawings"
          >
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="created-desc">Recently created</option>
            <option value="created-asc">Oldest created</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
          <button
            className={`${styles.viewToggle} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid size={18} />
          </button>
          <button
            className={`${styles.viewToggle} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List size={18} />
          </button>
          <Button onClick={handleCreateDrawing} loading={isCreating} aria-label="Create new drawing">
            <Plus size={16} />
            New Drawing
          </Button>
          <Button variant="secondary" onClick={() => { setShowNewProject(true); setNewProjectName(''); setProjectError(''); }} aria-label="Create new project">
            <Folder size={16} />
            New Project
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <aside className={styles.sidebar} role="navigation" aria-label="Project tree">
          {showNewProject && (
            <div className={styles.newProjectForm}>
              <input
                type="text"
                autoFocus
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); setProjectError(''); }
                }}
                className={styles.newProjectInput}
              />
              <button className={styles.newProjectBtn} onClick={handleCreateFolder}>Create</button>
              <button className={styles.newProjectBtnCancel} onClick={() => { setShowNewProject(false); setNewProjectName(''); setProjectError(''); }}>Cancel</button>
              {projectError && (
                <div className={styles.inlineError} role="alert">
                  <AlertCircle size={14} />
                  {projectError}
                </div>
              )}
            </div>
          )}
          <ul className={styles.folderTree} role="tree">
            <li>
              <button
                className={`${styles.folderItem} ${!activeFolderId ? styles.folderActive : ''}`}
                onClick={() => handleFolderClick(null)}
                aria-current={!activeFolderId ? 'true' : undefined}
                role="treeitem"
              >
                <Folder size={18} aria-hidden="true" />
                <span>All Projects</span>
              </button>
            </li>
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  className={`${styles.folderItem} ${activeFolderId === folder.id ? styles.folderActive : ''}`}
                  onClick={() => handleFolderClick(folder.id)}
                  aria-current={activeFolderId === folder.id ? 'true' : undefined}
                  role="treeitem"
                >
                  <Folder size={18} aria-hidden="true" />
                  <span>{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className={viewMode === 'grid' ? styles.grid : styles.list} role="list" aria-label="Drawing list">
          {visibleDrawings.length === 0 ? (
            <div className={styles.empty} role="status">
              <p>No drawings yet</p>
              <p className={styles.emptySub}>
                {activeFolder ? 'Create a new drawing in this project' : 'Create a new drawing or import existing files'}
              </p>
            </div>
          ) : (
            visibleDrawings.map((drawing) => (
              <Card
                key={drawing.id}
                className={styles.drawingCard}
                hover
                role="listitem"
                tabIndex={0}
                onClick={() => handleDrawingClick(drawing)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDrawingClick(drawing);
                  }
                }}
                aria-label={`Open drawing ${drawing.title}`}
              >
                <div className={styles.thumbnail}>
                  {drawing.thumbnail_url ? (
                    <img src={drawing.thumbnail_url} alt="" loading="lazy" />
                  ) : (
                    <img
                      src={`/api/drawings/${drawing.id}/thumbnail`}
                      alt=""
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className={styles.info}>
                  {renamingId === drawing.id ? (
                    <input
                      autoFocus
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameDrawing(drawing);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => handleRenameDrawing(drawing)}
                    />
                  ) : (
                    <>
                      <h4 className={styles.title}>{drawing.title}</h4>
                      <p className={styles.meta}>
                        Edited {new Date(drawing.updated_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
                <div className={styles.moreWrap} ref={activeMenu === drawing.id ? menuRef : undefined}>
                  <button
                    className={styles.more}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === drawing.id ? null : drawing.id);
                      setRenamingId(null);
                    }}
                    aria-label={`More options for ${drawing.title}`}
                    aria-expanded={activeMenu === drawing.id}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {activeMenu === drawing.id && (
                    <div className={styles.dropdown}>
                      <button onClick={(e) => { e.stopPropagation(); handleDrawingClick(drawing); setActiveMenu(null); }} className={styles.dropdownItem}>Open</button>
                      <button onClick={(e) => { e.stopPropagation(); setRenamingId(drawing.id); setRenameValue(drawing.title); setActiveMenu(null); }} className={styles.dropdownItem}>Rename</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicateDrawing(drawing); }} className={styles.dropdownItem}>Duplicate</button>
                      {movingId === drawing.id ? (
                        <div className={styles.dropdownSubmenu}>
                          <button className={styles.dropdownSubheader}>Move to:</button>
                          <button onClick={(e) => { e.stopPropagation(); handleMoveDrawing(drawing, null); }} className={styles.dropdownItem}>All Projects</button>
                          {folders.map(f => (
                            <button key={f.id} onClick={(e) => { e.stopPropagation(); handleMoveDrawing(drawing, f.id); }} className={styles.dropdownItem}>{f.name}</button>
                          ))}
                          <button onClick={(e) => { e.stopPropagation(); setMovingId(null); }} className={styles.dropdownItem}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setMovingId(drawing.id); }} className={styles.dropdownItem}>Move to...</button>
                      )}
                      <div className={styles.dropdownDivider} />
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteDrawing(drawing); }} className={`${styles.dropdownItem} ${styles.dropdownDanger}`}>Delete</button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </main>
      </div>

      {showNameModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="new-drawing-title" onClick={(e) => { if (e.target === e.currentTarget) setShowNameModal(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 id="new-drawing-title">New Drawing</h3>
              <button className={styles.modalClose} onClick={() => setShowNameModal(false)} aria-label="Close">&times;</button>
            </div>
            <div className={styles.modalBody}>
              <label htmlFor="drawing-name">Name</label>
              <input
                id="drawing-name"
                type="text"
                autoFocus
                placeholder="Untitled Drawing"
                value={newDrawingName}
                onChange={(e) => setNewDrawingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCreateDrawing(); if (e.key === 'Escape') setShowNameModal(false); }}
                className={styles.modalInput}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnSecondary} onClick={() => setShowNameModal(false)}>Cancel</button>
              <button className={styles.modalBtnPrimary} onClick={confirmCreateDrawing} disabled={isCreating}>
                {isCreating ? <Loader2 size={16} className={styles.spinner} /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
