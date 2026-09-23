import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type || 'info'}`}>
          {toast.type === 'success' && <CheckCircle2 size={18} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />}
          {toast.type === 'error' && <AlertCircle size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />}
          {toast.type === 'info' && <Info size={18} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />}
          
          <div style={{ flex: 1 }}>
            {toast.title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{toast.title}</div>}
            <div style={{ color: 'var(--text-secondary)' }}>{toast.message}</div>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex'
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
