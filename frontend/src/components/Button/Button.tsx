import React from 'react';
import { clsx } from 'clsx';
import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    fullWidth = false,
    children, 
    className,
    disabled,
    ...props 
  }, ref) => {
    const isIconOnly = React.Children.count(children) === 1 && 
      React.isValidElement(children) && 
      (children.type === 'svg' || String(children.type).includes('Icon'));

    return (
      <button
        ref={ref}
        className={clsx(
          styles.button,
          styles[`variant-${variant}`],
          styles[`size-${size}`],
          {
            [styles.loading]: loading,
            [styles.fullWidth]: fullWidth,
            [styles.iconOnly]: isIconOnly,
          },
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
