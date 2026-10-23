import { useEffect, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';

type Status = 'connecting' | 'connected' | 'disconnected';

interface SyncStatusProps {
  provider: HocuspocusProvider;
}

export function SyncStatus({ provider }: SyncStatusProps) {
  const [status, setStatus] = useState<Status>(
    () => (provider.status as Status) ?? 'connecting',
  );
  const [synced, setSynced] = useState<boolean>(() => provider.isSynced);

  useEffect(() => {
    const onStatus = (e: { status: string }) => {
      setStatus(e.status as Status);
    };
    const onSynced = (e: { state?: boolean } | boolean) => {
      const next = typeof e === 'boolean' ? e : (e?.state ?? true);
      setSynced(next);
    };
    provider.on('status', onStatus);
    provider.on('synced', onSynced);
    return () => {
      provider.off('status', onStatus);
      provider.off('synced', onSynced);
    };
  }, [provider]);

  const dotColor =
    status === 'connected' && synced
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const label =
    status === 'connected' && synced
      ? 'Synced'
      : status === 'connected'
        ? 'Syncing…'
        : status === 'connecting'
          ? 'Connecting…'
          : 'Offline';

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted px-2 py-1" aria-live="polite">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
