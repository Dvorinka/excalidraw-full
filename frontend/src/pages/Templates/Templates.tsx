import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FilePlus, Trash2 } from 'lucide-react';
import { Card, CardContent, Button } from '@/components';
import { useDrawingStore, useAuthStore } from '@/stores';
import { api } from '@/services';
import type { Template, TemplateScope } from '@/types';
import styles from './Templates.module.scss';

const categories: { id: TemplateScope | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'system', label: 'System' },
  { id: 'team', label: 'Team' },
  { id: 'personal', label: 'Personal' },
];

export const Templates: React.FC = () => {
  const navigate = useNavigate();
  const { templates, setTemplates, addDrawing } = useDrawingStore();
  const { user } = useAuthStore();
  const [active, setActive] = useState<TemplateScope | 'all'>('all');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.templates.list().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const filtered = active === 'all' ? templates : templates.filter((t) => t.scope === active);

  const handleUseTemplate = async (template: Template) => {
    setApplyingId(template.id);
    try {
      const drawing = await api.drawings.create({
        title: template.name,
        visibility: 'team',
      });
      // Apply template snapshot if available - store in localStorage for editor to pick up
      if (template.snapshot_path) {
        // The template data would need to be fetched separately
        // For now, just navigate to the new drawing
      }
      addDrawing(drawing);
      navigate(`/drawing/${drawing.id}`);
    } catch (err) {
      console.error('Failed to create drawing from template:', err);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setDeletingId(template.id);
    try {
      await api.templates.delete(template.id);
      setTemplates(templates.filter((t) => t.id !== template.id));
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template. You may not have permission.');
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (template: Template) => {
    return template.scope !== 'system' && template.created_by === user?.id;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Templates</h1>
          <p className={styles.subtitle}>Start from a template. Create custom templates from any drawing using the "Save as Template" button in the editor.</p>
        </div>
      </div>
      <div className={styles.categories} role="tablist">
        {categories.map((c) => (
          <button key={c.id} className={`${styles.category} ${active === c.id ? styles.active : ''}`}
            onClick={() => setActive(c.id)} role="tab" aria-selected={active === c.id}>{c.label}</button>
        ))}
      </div>
      <div className={styles.grid} role="tabpanel">
        {filtered.length === 0 ? (
          <div className={styles.empty} role="status"><Sparkles size={48} aria-hidden="true" />
            <p>No templates</p><p className={styles.emptySub}>Create your first template from any drawing</p></div>
        ) : filtered.map((t) => (
          <Card key={t.id} className={styles.templateCard} hover>
            <div className={styles.preview}>
              {t.preview_url ? <img src={t.preview_url} alt="" loading="lazy" /> : <div className={styles.placeholder} role="img" aria-label="No preview"><Sparkles size={32} aria-hidden="true" /></div>}
            </div>
            <CardContent className={styles.info}>
              <h4 className={styles.name}>{t.name}</h4>
              <p className={styles.description}>{t.description || 'No description'}</p>
              <div className={styles.meta}>
                <span className={styles.scope}>{t.scope}</span>
                <span className={styles.type}>{t.type}</span>
              </div>
              <div className={styles.actions}>
                <Button
                  size="sm"
                  className={styles.useBtn}
                  onClick={() => handleUseTemplate(t)}
                  loading={applyingId === t.id}
                  aria-label={`Use template ${t.name}`}
                >
                  <FilePlus size={14} />
                  Use Template
                </Button>
                {canDelete(t) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(t)}
                    loading={deletingId === t.id}
                    aria-label={`Delete template ${t.name}`}
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
