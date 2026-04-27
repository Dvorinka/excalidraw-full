import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores';
import styles from './Layout.module.scss';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { to: '/files', icon: FolderOpen, label: t('sidebar.projects') },
    { to: '/team', icon: Users, label: t('sidebar.team') },
    { to: '/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  return (
    <aside
      id="app-sidebar"
      className={`${styles.sidebar} ${open ? styles.open : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <img src="https://plus.excalidraw.com/images/logo.svg" alt="Excalidraw" className={styles.logoImg} />
        </div>
        {onClose && (
          <button
            className={styles.sidebarCloseBtn}
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            onClick={onClose}
            aria-label={item.label}
          >
            <item.icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.user}>
          <div className={styles.avatar}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} />
            ) : (
              user?.name?.[0] || '?'
            )}
          </div>
          <span className={styles.userName}>{user?.name}</span>
        </div>
        <button
          className={styles.logout}
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
