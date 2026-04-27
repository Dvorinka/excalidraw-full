import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';
import { Button, Input, Card } from '@/components';
import { useAuth } from '@/hooks';
import styles from './Auth.module.scss';

export const Signup: React.FC<{ hasUsers: boolean }> = ({ hasUsers }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await signup(name, email, password);
      navigate('/');
    } catch {
      setError('Could not create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <h1>{t('auth.signup.title')}</h1>
          <p>{t('auth.signup.subtitle')}</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label={t('auth.signup.nameLabel')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.signup.namePlaceholder')}
            required
          />
          <Input
            label={t('auth.signup.emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.signup.emailPlaceholder')}
            required
          />
          <Input
            label={t('auth.signup.passwordLabel')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.signup.passwordPlaceholder')}
            required
          />
          <Button type="submit" fullWidth loading={isLoading}>
            {t('auth.signup.createAccount')}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>{t('common.continueWith')}</span>
        </div>

        <Button variant="secondary" fullWidth>
          <Github size={18} />
          GitHub
        </Button>

        {hasUsers && (
          <p className={styles.footer}>
            {t('auth.signup.hasAccount')} <Link to="/login">{t('auth.signup.signInLink')}</Link>
          </p>
        )}
      </Card>
    </div>
  );
};
