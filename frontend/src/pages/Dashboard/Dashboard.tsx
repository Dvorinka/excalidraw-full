import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Star, Users, FileText, Plus, Loader2, FolderPlus, UserPlus, BookOpen, Activity } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, TemplatePicker } from '@/components';
import { useDrawingStore, useAuthStore } from '@/stores';
import { api } from '@/services';
import { BUILTIN_TEMPLATES } from '@/components/TemplatePicker/TemplatePicker';
import type { PickedTemplate } from '@/components/TemplatePicker/TemplatePicker';
import styles from './Dashboard.module.scss';

const StatChart: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = '#6965db' }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={styles.chartBarWrap} aria-hidden="true">
      <div className={styles.chartBarBg} />
      <div className={styles.chartBar} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { recentDrawings, setRecentDrawings, activity, setActivity } = useDrawingStore();
  const { user } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [statsData, setStatsData] = useState({
    teams: 0,
    members: 0,
    projects: 0,
    folders: 0,
    drawings: 0,
    templates: 0,
    revisions: 0,
    assets: 0,
    storage_bytes: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [drawings, stats, activityData] = await Promise.all([
          api.drawings.list(),
          api.stats.get(),
          api.activity.list(),
        ]);
        setRecentDrawings(drawings);
        setStatsData(stats);
        setActivity(activityData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    };
    loadData();
  }, [setRecentDrawings, setActivity]);

  const handleCreateDrawing = async (template: PickedTemplate = 'blank') => {
    setIsCreating(true);
    try {
      const newDrawing = await api.drawings.create({
        title: template === 'blank' ? 'Untitled Drawing' : `${template.charAt(0).toUpperCase() + template.slice(1)}`,
        visibility: 'team',
      });
      setRecentDrawings([newDrawing, ...recentDrawings]);
      if (template !== 'blank' && BUILTIN_TEMPLATES[template]) {
        localStorage.setItem(`template_${newDrawing.id}`, JSON.stringify({
          elements: BUILTIN_TEMPLATES[template],
          appState: {},
          files: {},
        }));
      }
      navigate(`/drawing/${newDrawing.id}`);
    } catch (err) {
      console.error('Failed to create drawing:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const maxStat = Math.max(statsData.drawings, statsData.projects + statsData.folders, statsData.teams, statsData.revisions, 1);

  const stats = [
    { label: t('dashboard.stats.drawings'), value: statsData.drawings, icon: FileText, color: '#6965db' },
    { label: t('dashboard.stats.projects'), value: statsData.projects + statsData.folders, icon: FolderPlus, color: '#4dabf7' },
    { label: t('dashboard.stats.teams'), value: statsData.teams, icon: Users, color: '#51cf66' },
    { label: t('dashboard.stats.revisions'), value: statsData.revisions, icon: Clock, color: '#fcc419' },
    { label: t('dashboard.stats.storage'), value: formatBytes(Number(statsData.storage_bytes)), raw: statsData.storage_bytes, icon: Star, color: '#ff6b6b' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>{t('dashboard.welcome', { name: user?.name || t('common.user') })}</h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <div className={styles.quickActions}>
          <TemplatePicker
            isOpen={showTemplatePicker}
            onClose={() => setShowTemplatePicker(false)}
            onSelect={(t) => { setShowTemplatePicker(false); handleCreateDrawing(t); }}
          />
          <Button
            variant="secondary"
            onClick={() => navigate('/files')}
            className={styles.actionBtn}
          >
            <FolderPlus size={16} />
            New Project
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/team')}
            className={styles.actionBtn}
          >
            <UserPlus size={16} />
            Invite
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/library')}
            className={styles.actionBtn}
          >
            <BookOpen size={16} />
            Library
          </Button>
          <Button
            onClick={() => setShowTemplatePicker(true)}
            loading={isCreating}
            className={styles.createButton}
          >
            {isCreating ? (
              <Loader2 size={18} className={styles.spinner} />
            ) : (
              <Plus size={18} />
            )}
            {t('dashboard.newDrawing')}
          </Button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className={styles.statCard}>
              <div className={styles.statIcon}>
                <stat.icon size={24} />
              </div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
              <StatChart value={typeof stat.value === 'number' ? stat.value : 0} max={maxStat} color={stat.color} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={styles.twoColumn}>
        <div className={styles.column}>
          <Card>
            <CardHeader>
              <h3>{t('dashboard.recentDrawings')}</h3>
            </CardHeader>
            <CardContent>
              {recentDrawings.length === 0 ? (
                <div className={styles.empty}>
                  <p>{t('dashboard.noDrawings')}</p>
                  <p className={styles.emptySub}>{t('dashboard.noDrawingsSub')}</p>
                </div>
              ) : (
                <ul className={styles.drawingList} role="list" aria-label="Recent drawings">
                  {recentDrawings.slice(0, 5).map((drawing) => (
                    <li
                      key={drawing.id}
                      className={styles.drawingItem}
                      role="listitem"
                      tabIndex={0}
                      onClick={() => {
                        if (drawing.folder_id) {
                          navigate(`/folder/${drawing.folder_id}/drawing/${drawing.id}`);
                        } else {
                          navigate(`/drawing/${drawing.id}`);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (drawing.folder_id) {
                            navigate(`/folder/${drawing.folder_id}/drawing/${drawing.id}`);
                          } else {
                            navigate(`/drawing/${drawing.id}`);
                          }
                        }
                      }}
                      aria-label={`Open drawing ${drawing.title}`}
                    >
                      <div className={styles.drawingThumb}>
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
                      <div className={styles.drawingInfo}>
                        <p className={styles.drawingTitle}>{drawing.title}</p>
                        <p className={styles.drawingMeta}>
                          Edited {new Date(drawing.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={styles.column}>
          <Card className={styles.activityCard}>
            <CardHeader>
              <h3><Activity size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Recent Activity</h3>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptySub}>No recent activity</p>
                </div>
              ) : (
                <ul className={styles.activityList}>
                  {activity.slice(0, 8).map((event) => (
                    <li key={event.id} className={styles.activityItem}>
                      <div className={styles.activityAvatar}>
                        {event.actor?.name?.[0] || '?'}
                      </div>
                      <div className={styles.activityInfo}>
                        <p className={styles.activityText}>
                          <strong>{event.actor?.name || 'Unknown'}</strong>{' '}
                          {event.event_type.replace(/_/g, ' ')}{' '}
                          <span className={styles.activityResource}>{event.resource_type}</span>
                        </p>
                        <p className={styles.activityTime}>
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
