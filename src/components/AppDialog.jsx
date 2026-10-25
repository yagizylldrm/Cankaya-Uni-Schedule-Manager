import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl',
};

/**
 * AppDialog - Standard accessible modal dialog component
 *
 * Implements WAI-ARIA Modal Dialog pattern using HTML5 native <dialog>:
 * - Automatic focus capture and trap via showModal()
 * - Traps and handles Escape key cleanly
 * - Restores focus to the triggering element when closed
 * - Closes on backdrop click
 * - Consistent editorial studio styling (border rulers, clean typography, neutral surface)
 */
export default function AppDialog({
  isOpen = true,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  titleId,
  initialFocusRef,
  restoreFocusRef,
  children,
  className = '',
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const generatedId = useId();
  const headingId = titleId || `dialog-title-${generatedId}`;
  const descId = description ? `dialog-desc-${generatedId}` : undefined;

  // Restore focus helper
  const restoreFocus = () => {
    const target = restoreFocusRef?.current || triggerRef.current;
    if (target && document.contains(target) && typeof target.focus === 'function') {
      target.focus();
    }
  };

  // Track the element that triggered the dialog and manage showModal / close lifecycle
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      triggerRef.current = document.activeElement;
      if (!dialog.open) {
        dialog.showModal();
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      restoreFocus();
    }
  }, [isOpen, initialFocusRef]);

  // Clean focus restoration on component unmount
  useEffect(() => {
    return () => {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      }
      restoreFocus();
    };
  }, []);

  const handleCancel = (e) => {
    e.preventDefault();
    onClose?.();
  };

  const handleBackdropClick = (e) => {
    // Check if the click target is the dialog backdrop itself
    if (e.target === dialogRef.current) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby={headingId}
      aria-describedby={descId}
      className={`w-[calc(100%-2rem)] ${SIZE_CLASSES[size] || SIZE_CLASSES.md} p-0 rounded-2xl bg-surface text-ink border border-border-subtle shadow-2xl overflow-hidden backdrop:bg-[#121212]/60 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-subtle flex items-start justify-between gap-4 bg-surface">
          <div>
            <h2 id={headingId} className="text-lg sm:text-xl font-semibold tracking-tight text-ink leading-snug">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs sm:text-sm text-ink-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-1.5 -mr-1.5 -mt-1 text-ink-muted hover:text-ink hover:bg-surface-muted rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer (if provided) */}
        {footer && (
          <div className="px-5 py-3 border-t border-border-subtle bg-surface-muted/50 flex flex-wrap items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
