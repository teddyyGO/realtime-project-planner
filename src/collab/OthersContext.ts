import { createContext, useContext } from 'react';

export type OthersSelectionMap = Map<string, string[]>;

export const OthersSelectionContext = createContext<OthersSelectionMap>(new Map());

export function useOtherSelectorsFor(nodeId: string): string[] {
  const map = useContext(OthersSelectionContext);
  return map.get(nodeId) ?? [];
}
