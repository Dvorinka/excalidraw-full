import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Loader2, BookOpen, ExternalLink, Heart, Filter } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components';
import { api } from '@/services';
import styles from './LibraryMarketplace.module.scss';

interface LibraryItem {
  name: string;
  description: string;
  authors: { name: string; github?: string }[];
  source: string;
  preview?: string;
  tags: string[];
  downloads: number;
}

const CATEGORIES = ['All', 'Arrows', 'Charts', 'Cloud', 'Devops', 'Diagrams', 'Education', 'Food', 'Frames', 'Gaming', 'Icons', 'Illustrations', 'Machines', 'Misc', 'People', 'Software', 'Systems', 'Tech', 'Workflow'];

export const LibraryMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [filtered, setFiltered] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Try to fetch from excalidraw libraries
        const res = await fetch('https://libraries.excalidraw.com/libraries.json', { 
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to load libraries');
        const data = await res.json();
        const items: LibraryItem[] = Object.entries(data).map(([key, lib]: [string, any]) => ({
          name: lib.name || key,
          description: lib.description || '',
          authors: lib.authors || [{ name: 'Unknown' }],
          source: `https://libraries.excalidraw.com/${key}.excalidrawlib`,
          preview: lib.preview?.startsWith('http') ? lib.preview : `https://libraries.excalidraw.com/${key}.png`,
          tags: lib.tags || [],
          downloads: lib.downloads || 0,
        }));
        setLibraries(items);
        setFiltered(items);
      } catch (err) {
        console.error(err);
        setError('Could not load library marketplace. You can still browse libraries at libraries.excalidraw.com');
        // Fallback: show some popular libraries as placeholders
        setLibraries([
          { name: 'Software Architecture', description: 'Common architecture diagrams and icons', authors: [{ name: 'Excalidraw Community' }], source: '', preview: '', tags: ['Software', 'Architecture'], downloads: 0 },
          { name: 'AWS Icons', description: 'Amazon Web Services icons', authors: [{ name: 'AWS' }], source: '', preview: '', tags: ['Cloud', 'AWS'], downloads: 0 },
          { name: 'Kubernetes', description: 'K8s components and diagrams', authors: [{ name: 'K8s Community' }], source: '', preview: '', tags: ['Devops', 'Cloud'], downloads: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let result = libraries;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || l.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (activeCategory !== 'All') {
      result = result.filter(l => l.tags.some(t => t.toLowerCase() === activeCategory.toLowerCase()));
    }
    setFiltered(result);
  }, [search, activeCategory, libraries]);

  const handleImport = useCallback(async (lib: LibraryItem) => {
    if (!lib.source) {
      window.open('https://libraries.excalidraw.com', '_blank');
      return;
    }
    try {
      // Create a new drawing and navigate to it, the library will be loaded client-side
      const drawing = await api.drawings.create({
        title: lib.name,
        visibility: 'team',
      });
      // Store selected library in localStorage for the editor to pick up
      localStorage.setItem('pending_library', JSON.stringify({ drawingId: drawing.id, source: lib.source }));
      navigate(`/drawing/${drawing.id}`);
    } catch (err) {
      console.error('Failed to create drawing from library:', err);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
          <p>Loading library marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1><BookOpen size={24} /> Library Marketplace</h1>
          <p className={styles.subtitle}>Browse and import templates from the Excalidraw community library</p>
        </div>
        <Button variant="secondary" onClick={() => window.open('https://libraries.excalidraw.com', '_blank')}>
          <ExternalLink size={16} /> Open External
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <Input
            placeholder="Search libraries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.categories}>
          <Filter size={16} />
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.categoryChip} ${activeCategory === cat ? styles.active : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <BookOpen size={48} />
            <p>No libraries found</p>
            <p className={styles.emptySub}>Try a different search or category</p>
          </div>
        ) : filtered.map((lib, idx) => (
          <Card key={idx} className={styles.libraryCard} hover>
            <div className={styles.preview}>
              {lib.preview ? (
                <img src={lib.preview} alt={lib.name} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className={styles.placeholder}><BookOpen size={32} /></div>
              )}
            </div>
            <CardContent className={styles.info}>
              <h4 className={styles.name}>{lib.name}</h4>
              <p className={styles.description}>{lib.description || 'No description'}</p>
              <div className={styles.meta}>
                <span className={styles.authors}>{lib.authors.map(a => a.name).join(', ')}</span>
                {lib.downloads > 0 && <span className={styles.downloads}><Download size={12} /> {lib.downloads}</span>}
              </div>
              <div className={styles.tags}>
                {lib.tags.slice(0, 4).map(tag => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <Button size="sm" className={styles.importBtn} onClick={() => handleImport(lib)}>
                <Heart size={14} /> Import
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
