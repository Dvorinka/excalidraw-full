import React, { useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './Layout.module.scss';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className={styles.layout}>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={closeSidebar}
          role="presentation"
          aria-hidden="true"
        />
      )}
      <div className={styles.main}>
        <Header>
          <button
            className={styles.mobileMenuToggle}
            onClick={openSidebar}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            <Menu size={20} />
          </button>
        </Header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};
