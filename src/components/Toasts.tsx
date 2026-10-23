import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function useToast(): (message: string, kind?: ToastKind) => void {
  return useContext(ToastContext).push;
}

const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `t-${++idRef.current}`;
    setToasts((cur) => [...cur, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto text-sm px-3.5 py-2 rounded-md shadow-lg max-w-md text-left ${
              t.kind === 'error'
                ? 'bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-ink text-white'
            }`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Convenience: schedule a toast outside of React tree (e.g. from a non-React
// callback). Looks up the latest provider via window-level event bus.
const BUS_EVENT = 'app:toast';

export function emitToast(message: string, kind: ToastKind = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BUS_EVENT, { detail: { message, kind } }));
}

export function useToastBusBridge(): void {
  const push = useToast();
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ message: string; kind: ToastKind }>;
      push(ce.detail.message, ce.detail.kind);
    };
    window.addEventListener(BUS_EVENT, handler);
    return () => window.removeEventListener(BUS_EVENT, handler);
  }, [push]);
}
