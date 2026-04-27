import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, X, Loader2, FilePlus } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components';
import { useDrawingStore } from '@/stores';
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
  const [active, setActive] = useState<TemplateScope | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.templates.list().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const filtered = active === 'all' ? templates : templates.filter((t) => t.scope === active);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name required'); return; }
    setCreating(true); setError('');
    try {
      const t = await api.templates.create({ name: name.trim(), type: 'empty', scope: 'personal' });
      setTemplates([t, ...templates]); setShowModal(false); setName('');
    } catch (err) { setError('Create failed'); }
    finally { setCreating(false); }
  };

  const handleUseTemplate = async (template: Template) => {
    setApplyingId(template.id);
    try {
      const drawing = await api.drawings.create({
        title: template.name,
        visibility: 'team',
      });
      addDrawing(drawing);
      navigate(`/drawing/${drawing.id}`);
    } catch (err) {
      console.error('Failed to create drawing from template:', err);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div><h1>Templates</h1><p className={styles.subtitle}>Start from a template or create your own</p></div>
        <Button onClick={() => setShowModal(true)}><Plus size={18} />Create</Button>
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
            <p>No templates</p><p className={styles.emptySub}>Create your first template</p></div>
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
            </CardContent>
          </Card>
        ))}
      </div>
      {showModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="tm-title" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}><h2 id="tm-title">Create Template</h2><button onClick={() => setShowModal(false)} aria-label="Close"><X size={18} /></button></div>
            <div className={styles.modalBody}>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
              {creating ? <Loader2 className={styles.spinner} size={20} /> : <Button onClick={handleCreate}>Create</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
