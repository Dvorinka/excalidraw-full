import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Database, Users, FileText, Plus, Loader2, FolderPlus, UserPlus, Activity } from 'lucide-react';
import { Button, Card, CardHeader, CardContent } from '@/components';
import { useDrawingStore, useAuthStore } from '@/stores';
import { api } from '@/services';
import styles from './Dashboard.module.scss';

const ACTIVITY_LIMIT = 5;

const HandDrawnChart: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = '#6965db' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const w = 120;
  const h = 60;
  const pad = 6;
  const barW = ((w - pad * 2) * pct) / 100;
  const roughness = 1.2;

  const r = () => (Math.random() - 0.5) * roughness;

  return (
    <svg className={styles.handChart} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path
        d={`M${pad + r()},${pad + r()} L${w - pad + r()},${pad + r()} L${w - pad + r()},${h - pad + r()} L${pad + r()},${h - pad + r()} Z`}
        fill="none"
        stroke="var(--color-gray-40)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M${pad + r()},${h - pad + r()} L${pad + r()},${pad + r()} L${pad + barW + r()},${pad + r()} L${pad + barW + r()},${h - pad + r()} Z`}
          fill={color}
          stroke={color}
          strokeWidth="1"
          opacity="0.35"
          strokeLinecap="round"
        />
      )}
      <path
        d={`M${pad + r()},${h - pad + r()} L${pad + barW + r()},${h - pad + r()}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M${pad + r()},${pad + r()} L${pad + barW + r()},${pad + r()}`}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
};

const MiniSparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#6965db' }) => {
  if (!data.length) return null;
  const w = 140;
  const h = 40;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = w / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x + (Math.random() - 0.5) * 0.8},${y + (Math.random() - 0.5) * 0.8}`;
  }).join(' ');

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.7"
      />
      {data.map((v, i) => {
        const x = i * stepX;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.5" />;
      })}
    </svg>
  );
};

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { recentDrawings, setRecentDrawings, activity, setActivity } = useDrawingStore();
  const { user } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
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
      });
      setRecentDrawings([newDrawing, ...recentDrawings]);
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
  const storageMax = Math.max(Number(statsData.storage_bytes), 1024 * 1024);

  const statColors = ['#6965db', '#339af0', '#40c057', '#fcc419', '#ff6b6b'];
  const sparkData = [
    [2, 4, 3, 8, 5, 9, statsData.drawings],
    [1, 2, 3, 3, 4, 5, statsData.projects + statsData.folders],
    [1, 1, 1, 1, 2, 2, statsData.teams],
    [5, 8, 12, 15, 20, 25, statsData.revisions],
    [1024, 2048, 4096, 8192, 16384, 32768, Number(statsData.storage_bytes)],
  ];

  const stats = [
    { label: t('dashboard.stats.drawings'), value: statsData.drawings, chartValue: statsData.drawings, max: maxStat, icon: FileText, color: statColors[0] },
    { label: t('dashboard.stats.projects'), value: statsData.projects + statsData.folders, chartValue: statsData.projects + statsData.folders, max: maxStat, icon: FolderPlus, color: statColors[1] },
    { label: t('dashboard.stats.teams'), value: statsData.teams, chartValue: statsData.teams, max: maxStat, icon: Users, color: statColors[2] },
    { label: t('dashboard.stats.revisions'), value: statsData.revisions, chartValue: statsData.revisions, max: maxStat, icon: Clock, color: statColors[3] },
    { label: t('dashboard.stats.storage'), value: formatBytes(Number(statsData.storage_bytes)), chartValue: Number(statsData.storage_bytes), max: storageMax, icon: Database, color: statColors[4] },
  ];
  const visibleActivity = activity
    .filter((event) => event.event_type !== 'revision_created')
    .slice(0, ACTIVITY_LIMIT);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>{t('dashboard.welcome', { name: user?.name || t('common.user') })}</h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <div className={styles.quickActions}>
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
            onClick={handleCreateDrawing}
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
        {stats.map((stat, idx) => (
          <Card key={stat.label} className={styles.statCardWrapper}>
            <CardContent className={styles.statCard}>
              <div className={styles.statTop}>
                <div className={styles.statIcon} style={{ color: stat.color, borderColor: stat.color }}>
                  <stat.icon size={22} />
                </div>
                <HandDrawnChart value={stat.chartValue} max={stat.max} color={stat.color} />
              </div>
              <div className={styles.statValue} style={{ color: stat.color }}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
              <MiniSparkline data={sparkData[idx]} color={stat.color} />
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
              {visibleActivity.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptySub}>No recent activity</p>
                </div>
              ) : (
                <ul className={styles.activityList}>
                  {visibleActivity.map((event) => (
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
  );
};
