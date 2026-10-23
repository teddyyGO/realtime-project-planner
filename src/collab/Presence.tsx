import type { RemotePresence } from './useAwareness';
import type { UserIdentity } from '../utils/userIdentity';

interface PresenceProps {
  self: UserIdentity;
  others: RemotePresence[];
  onEditSelf?: () => void;
}

export function Presence({ self, others, onEditSelf }: PresenceProps) {
  const visibleOthers = others.slice(0, 4);
  const overflow = others.length - visibleOthers.length;

  return (
    <div
      className="flex items-center -space-x-1.5"
      aria-label={`${others.length + 1} editor${others.length === 0 ? '' : 's'} online`}
    >
      <Avatar user={self} isSelf onClick={onEditSelf} />
      {visibleOthers.map((p) => (
        <Avatar key={p.clientId} user={p.user} isSelf={false} />
      ))}
      {overflow > 0 && (
        <span className="ml-2 text-xs text-muted">+{overflow}</span>
      )}
    </div>
  );
}

function Avatar({
  user,
  isSelf,
  onClick,
}: {
  user: UserIdentity;
  isSelf: boolean;
  onClick?: () => void;
}) {
  const initial = user.name.slice(0, 1).toUpperCase();
  const className =
    'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-white border-2 border-white';

  if (isSelf && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${user.name} (you) — click to edit`}
        className={`${className} cursor-pointer hover:scale-110 transition-transform`}
        style={{ background: user.color }}
      >
        {initial}
      </button>
    );
  }
  return (
    <span
      title={`${user.name}${isSelf ? ' (you)' : ''}`}
      className={className}
      style={{ background: user.color }}
    >
      {initial}
    </span>
  );
}
