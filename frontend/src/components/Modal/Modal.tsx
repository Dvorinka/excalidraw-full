import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import styles from './Modal.module.scss';

export type ModalType = 'confirm' | 'alert' | 'info';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) {
          onCancel();
        } else {
          onClose?.();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel, onClose]);

  if (!isOpen) return null;
  const close = () => onCancel?.() ?? onClose?.();

  const iconMap = {
    confirm: <AlertTriangle size={24} className={styles.iconWarning} />,
    alert: <AlertTriangle size={24} className={styles.iconDanger} />,
    info: <Info size={24} className={styles.iconInfo} />,
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          close();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.icon}>{iconMap[type]}</div>
          <h3 id="modal-title" className={styles.title}>{title}</h3>
          <button
            className={styles.closeBtn}
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {type === 'confirm' && (
            <button
              className={styles.btnSecondary}
              onClick={close}
            >
              {cancelText}
            </button>
          )}
          <button
            className={type === 'alert' ? styles.btnDanger : styles.btnPrimary}
            onClick={() => onConfirm?.() ?? close()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
