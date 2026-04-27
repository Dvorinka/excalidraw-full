import React, { useState } from 'react';
import { User, Key, Bell, Palette, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardContent, Button, Input } from '@/components';
import { useAuthStore, useThemeStore } from '@/stores';
import styles from './Settings.module.scss';

export const UserSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('userSettings.tabProfile'), icon: User },
    { id: 'account', label: t('userSettings.tabAccount'), icon: Key },
    { id: 'notifications', label: t('userSettings.tabNotifications'), icon: Bell },
    { id: 'appearance', label: t('userSettings.tabAppearance'), icon: Palette },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{t('userSettings.title')}</h1>
        <p className={styles.subtitle}>{t('userSettings.subtitle')}</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebar} role="tablist" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              aria-label={tab.label}
            >
              <tab.icon size={18} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'profile' && (
            <Card role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
              <CardHeader>
                <h3>{t('userSettings.profileInfo')}</h3>
              </CardHeader>
              <CardContent>
                <div className={styles.form}>
                  <div className={styles.avatarSection}>
                    <div className={styles.avatar}>
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} />
                      ) : (
                        user?.name?.[0] || '?'
                      )}
                    </div>
                    <Button variant="secondary" size="sm">{t('userSettings.changeAvatar')}</Button>
                  </div>
                  <Input label={t('auth.signup.nameLabel')} defaultValue={user?.name} />
                  <Input label={t('userSettings.username')} defaultValue={user?.username} />
                  <Input label={t('auth.login.emailLabel')} type="email" defaultValue={user?.email} />
                  <div className={styles.actions}>
                    <Button>{t('userSettings.saveChanges')}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'account' && (
            <Card role="tabpanel" id="panel-account" aria-labelledby="tab-account">
              <CardHeader>
                <h3>{t('userSettings.accountSecurity')}</h3>
              </CardHeader>
              <CardContent>
                <div className={styles.form}>
                  <Input label={t('userSettings.currentPassword')} type="password" />
                  <Input label={t('userSettings.newPassword')} type="password" />
                  <Input label={t('userSettings.confirmPassword')} type="password" />
                  <div className={styles.actions}>
                    <Button>{t('userSettings.updatePassword')}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications">
              <CardHeader>
                <h3>{t('userSettings.notificationPrefs')}</h3>
              </CardHeader>
              <CardContent>
                <div className={styles.toggleList}>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span>{t('userSettings.emailMentions')}</span>
                  </label>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span>{t('userSettings.emailInvites')}</span>
                  </label>
                  <label className={styles.toggle}>
                    <input type="checkbox" />
                    <span>{t('userSettings.weeklySummary')}</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'appearance' && (
            <Card role="tabpanel" id="panel-appearance" aria-labelledby="tab-appearance">
              <CardHeader>
                <h3>{t('userSettings.appearance')}</h3>
              </CardHeader>
              <CardContent>
                <div className={styles.themeSelect}>
                  <p className={styles.label}>{t('userSettings.theme')}</p>
                  <div className={styles.themeOptions}>
                    <button
                      className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <Sun size={16} />
                      {t('userSettings.light')}
                    </button>
                    <button
                      className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <Moon size={16} />
                      {t('userSettings.dark')}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
