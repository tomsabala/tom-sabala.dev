import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
  maxWidth?: string;
  dismissOnBackdrop?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  titleId,
  children,
  maxWidth = 'max-w-2xl',
  dismissOnBackdrop = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portalled to <body> on purpose: `position: fixed` resolves against the nearest ancestor
  // with a filter/backdrop-filter/transform, and SiteHeader has `backdrop-filter: blur(10px)`.
  // Rendered in place, the dialog centres itself inside the 59px header strip instead of the
  // viewport, and the header's z-index caps it. Both go away once it lives outside that tree.
  return createPortal(
    <div data-panel="1" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-lg"
        style={{ background: 'color-mix(in oklab, var(--bg) 70%, transparent)' }}
        aria-hidden="true"
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative bg-bg text-ink border border-ln2 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        style={{ boxShadow: '0 30px 60px -30px rgba(0,0,0,0.5)' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
