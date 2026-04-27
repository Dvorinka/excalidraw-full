import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Login } from './pages/Auth/Login';
import { Signup } from './pages/Auth/Signup';
import { FileBrowser } from './pages/FileBrowser/FileBrowser';
import { TeamSettings } from './pages/Team/TeamSettings';
import { UserSettings } from './pages/Settings/UserSettings';
import { Editor } from './pages/Editor/Editor';
import { useAuthStore } from './stores';
import { useAuth } from './hooks';
import { CommandPalette } from './components';
import { api } from './services';
import './App.scss';

export const App: React.FC = () => {
  useAuth(); // Initialize auth check
  const { isAuthenticated, isLoading } = useAuthStore();
  const [setupStatus, setSetupStatus] = useState<{ has_users: boolean } | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      api.auth.setupStatus()
        .then(setSetupStatus)
        .catch(() => setSetupStatus({ has_users: true }))
        .finally(() => setSetupLoading(false));
    } else {
      setSetupLoading(false);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || setupLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    const hasUsers = setupStatus?.has_users ?? true;
    return (
      <Routes>
        <Route path="/login" element={hasUsers ? <Login hasUsers={hasUsers} /> : <Navigate to="/signup" replace />} />
        <Route path="/signup" element={hasUsers ? <Navigate to="/login" replace /> : <Signup hasUsers={hasUsers} />} />
        <Route path="*" element={<Navigate to={hasUsers ? "/login" : "/signup"} replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/files/*" element={<FileBrowser />} />
        <Route path="/team" element={<TeamSettings />} />
        <Route path="/settings" element={<UserSettings />} />
        <Route path="/drawing/:id" element={<Editor />} />
        <Route path="/folder/:folderId/drawing/:id" element={<Editor />} />
      </Routes>
    </AppLayout>
  );
};
