import React from 'react';
import styles from './Card.module.scss';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, hover = true, ...rest }) => {
  return (
    <div 
      className={`${styles.card} ${hover ? styles.hover : ''} ${className || ''}`}
      onClick={onClick}
      role={onClick ? 'button' : rest.role}
      {...rest}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`${styles.header} ${className || ''}`}>{children}</div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`${styles.content} ${className || ''}`}>{children}</div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`${styles.footer} ${className || ''}`}>{children}</div>
);
