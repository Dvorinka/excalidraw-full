import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';
import { Button, Input, Card } from '@/components';
import { useAuth } from '@/hooks';
import styles from './Auth.module.scss';

const loginStrings = {
  title: 'auth.login.title',
  subtitle: 'auth.login.subtitle',
  emailLabel: 'auth.login.emailLabel',
  emailPlaceholder: 'auth.login.emailPlaceholder',
  passwordLabel: 'auth.login.passwordLabel',
  passwordPlaceholder: 'auth.login.passwordPlaceholder',
  signIn: 'auth.login.signIn',
  noAccount: 'auth.login.noAccount',
  signUpLink: 'auth.login.signUpLink',
};

const commonStrings = {
  continueWith: 'common.continueWith',
};

export const Login: React.FC<{ hasUsers: boolean }> = ({ hasUsers }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <h1>{t(loginStrings.title)}</h1>
          <p>{t(loginStrings.subtitle)}</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label={t(loginStrings.emailLabel)}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(loginStrings.emailPlaceholder)}
            required
          />
          <Input
            label={t(loginStrings.passwordLabel)}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t(loginStrings.passwordPlaceholder)}
            required
          />
          <Button type="submit" fullWidth loading={isLoading}>
            {t(loginStrings.signIn)}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>{t(commonStrings.continueWith)}</span>
        </div>

        <Button variant="secondary" fullWidth>
          <Github size={18} />
          GitHub
        </Button>

        {!hasUsers && (
          <p className={styles.footer}>
            {t(loginStrings.noAccount)} <Link to="/signup">{t(loginStrings.signUpLink)}</Link>
          </p>
        )}
      </Card>
    </div>
  );
};
