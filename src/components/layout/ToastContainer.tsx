import React from 'react';
import { useToastContext } from './ToastContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const typeConfig = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', iconColor: 'text-emerald-500' },
  error: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', iconColor: 'text-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', iconColor: 'text-amber-500' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', iconColor: 'text-blue-500' },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const config = typeConfig[toast.type];
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px] max-w-[400px] animate-toast-in ${config.bg} ${config.border}`}
            style={{ animationDuration: '0.3s' }}
          >
            <Icon size={18} className={config.iconColor} />
            <span className={`flex-1 text-sm font-medium ${config.text}`}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
