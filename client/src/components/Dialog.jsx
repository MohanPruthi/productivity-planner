import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Shared modal: rendered into <body> so page animations and stacking never trap it.
const Dialog = ({ open, onClose, title, subtitle, children, footer, width = 460 }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="ui-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="ui-dialog"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ui-dialog-head">
          <div>
            <h2 className="ui-dialog-title">{title}</h2>
            {subtitle && <p className="ui-dialog-subtitle">{subtitle}</p>}
          </div>
          <button className="ui-icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="ui-dialog-body">{children}</div>
        {footer && <div className="ui-dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
