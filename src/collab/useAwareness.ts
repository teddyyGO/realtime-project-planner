import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { UserIdentity } from '../utils/userIdentity';

export interface CursorState {
  x: number;
  y: number;
}

export interface PresenceState {
  user: UserIdentity;
  cursor?: CursorState;
  selectedNodeId?: string;
}

export interface RemotePresence extends PresenceState {
  clientId: number;
}

export function useAwareness(
  awareness: Awareness,
  identity: UserIdentity,
): RemotePresence[] {
  const [others, setOthers] = useState<RemotePresence[]>([]);

  // Publish our identity (idempotent).
  useEffect(() => {
    awareness.setLocalStateField('user', identity);
  }, [awareness, identity]);

  useEffect(() => {
    const update = () => {
      const localId = awareness.clientID;
      const next: RemotePresence[] = [];
      awareness.getStates().forEach((rawState, clientId) => {
        if (clientId === localId) return;
        const state = rawState as Partial<PresenceState> | undefined;
        if (!state?.user) return;
        next.push({
          clientId,
          user: state.user,
          cursor: state.cursor,
          selectedNodeId: state.selectedNodeId,
        });
      });
      setOthers(next);
    };
    update();
    awareness.on('change', update);
    return () => {
      awareness.off('change', update);
    };
  }, [awareness]);

  return others;
}

export function setLocalCursor(awareness: Awareness, cursor: CursorState | null): void {
  if (cursor) {
    awareness.setLocalStateField('cursor', cursor);
  } else {
    const state = awareness.getLocalState();
    if (state && 'cursor' in state) {
      const { cursor: _omit, ...rest } = state as Record<string, unknown>;
      void _omit;
      awareness.setLocalState(rest);
    }
  }
}

export function setLocalSelection(awareness: Awareness, nodeId: string | null): void {
  if (nodeId) {
    awareness.setLocalStateField('selectedNodeId', nodeId);
  } else {
    const state = awareness.getLocalState();
    if (state && 'selectedNodeId' in state) {
      const { selectedNodeId: _omit, ...rest } = state as Record<string, unknown>;
      void _omit;
      awareness.setLocalState(rest);
    }
  }
}
