import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkerType, applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from 'reactflow';
import type { CardData, CardEdge, CardNode } from '../types';
import { DEFAULT_CARD_DATA, GRID_SIZE } from '../types';
import type { EdgeRecord, NodeRecord, Room } from './yRoom';

const MARKER_END = { type: MarkerType.ArrowClosed, color: '#9ca3af', width: 16, height: 16 } as const;

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function recordToNode(id: string, record: NodeRecord, selected: boolean): CardNode {
  return {
    id,
    type: 'card',
    position: { x: record.position.x, y: record.position.y },
    data: { ...DEFAULT_CARD_DATA, ...record.data } as CardData,
    selected,
  };
}

function recordToEdge(id: string, record: EdgeRecord, selected: boolean): CardEdge {
  return {
    id,
    source: record.source,
    target: record.target,
    // Legacy edges (pre top/bottom handles) default to left→right routing.
    sourceHandle: record.sourceHandle ?? 'right',
    targetHandle: record.targetHandle ?? 'left',
    type: 'smoothstep',
    markerEnd: MARKER_END,
    selected,
    ...(record.label
      ? {
          label: record.label,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: '#ffffff', stroke: '#d1d5db' },
          labelStyle: { fontSize: 11, fill: '#1f2937' },
        }
      : {}),
  };
}

export interface UseYGraph {
  nodes: CardNode[];
  edges: CardEdge[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  applyNodeChangesY: (changes: NodeChange[]) => void;
  applyEdgeChangesY: (changes: EdgeChange[]) => void;
  addNode: (id: string, record: NodeRecord) => void;
  addEdgeY: (id: string, record: EdgeRecord) => void;
  updateEdgeLabel: (id: string, label: string | undefined) => void;
  updateNodeData: (id: string, patch: Partial<CardData>) => void;
  deleteNode: (id: string) => void;
  replaceAll: (
    nextNodes: Array<{ id: string; record: NodeRecord }>,
    nextEdges: Array<{ id: string; record: EdgeRecord }>,
  ) => void;
  updateNodePositions: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void;
}

export function useYGraph(room: Room): UseYGraph {
  const { doc, nodes: yNodes, edges: yEdges, localOrigin } = room;

  const [nodes, setNodes] = useState<CardNode[]>([]);
  const [edges, setEdges] = useState<CardEdge[]>([]);

  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set());

  // Force-rerender hook for selection changes (selection isn't in Y).
  const [, setSelectionTick] = useState(0);
  const bumpSelection = useCallback(() => setSelectionTick((t) => t + 1), []);

  // Sync Y → React state -----------------------------------------------
  useEffect(() => {
    const sync = () => {
      const nextNodes: CardNode[] = [];
      yNodes.forEach((record, id) => {
        nextNodes.push(recordToNode(id, record, selectedNodeIdsRef.current.has(id)));
      });
      const nextEdges: CardEdge[] = [];
      yEdges.forEach((record, id) => {
        nextEdges.push(recordToEdge(id, record, selectedEdgeIdsRef.current.has(id)));
      });
      setNodes(nextNodes);
      setEdges(nextEdges);
    };

    sync();
    yNodes.observeDeep(sync);
    yEdges.observeDeep(sync);
    return () => {
      yNodes.unobserveDeep(sync);
      yEdges.unobserveDeep(sync);
    };
  }, [yNodes, yEdges]);

  // Local edit helpers -------------------------------------------------
  const transact = useCallback(
    (fn: () => void) => {
      doc.transact(fn, localOrigin);
    },
    [doc, localOrigin],
  );

  // Apply React Flow NodeChange[] to Y, with snapping ------------------
  const applyNodeChangesY = useCallback(
    (changes: NodeChange[]) => {
      const positionChanges = changes.filter((c) => c.type === 'position');
      const removeChanges = changes.filter((c) => c.type === 'remove');
      const selectChanges = changes.filter((c) => c.type === 'select');

      // Selection — local only, not in Y.
      if (selectChanges.length > 0) {
        const sel = selectedNodeIdsRef.current;
        for (const c of selectChanges) {
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        }
        bumpSelection();
        // Mirror selection onto the visible nodes so React Flow sees it.
        setNodes((cur) =>
          cur.map((n) => (n.selected === sel.has(n.id) ? n : { ...n, selected: sel.has(n.id) })),
        );
      }

      // Position changes — write to Y. Snap on drag-end only.
      if (positionChanges.length > 0) {
        transact(() => {
          for (const c of positionChanges) {
            if (!('position' in c) || !c.position) continue;
            const record = yNodes.get(c.id);
            if (!record) continue;
            const isDrop = c.dragging === false;
            const x = isDrop ? snap(c.position.x) : c.position.x;
            const y = isDrop ? snap(c.position.y) : c.position.y;
            yNodes.set(c.id, { ...record, position: { x, y } });
          }
        });
      }

      if (removeChanges.length > 0) {
        transact(() => {
          for (const c of removeChanges) {
            yNodes.delete(c.id);
            // Cascade-delete attached edges.
            const edgeIds: string[] = [];
            yEdges.forEach((rec, eid) => {
              if (rec.source === c.id || rec.target === c.id) edgeIds.push(eid);
            });
            for (const eid of edgeIds) yEdges.delete(eid);
          }
        });
        // Clear selection refs for removed nodes.
        const sel = selectedNodeIdsRef.current;
        let touched = false;
        for (const c of removeChanges) {
          if (sel.delete(c.id)) touched = true;
        }
        if (touched) bumpSelection();
      }

      // Dimension/reset changes — used internally by React Flow, ignore.
      const other = changes.filter(
        (c) => c.type !== 'position' && c.type !== 'remove' && c.type !== 'select',
      );
      if (other.length > 0) {
        // For things like 'dimensions', let React Flow compute against the current node list.
        setNodes((cur) => applyNodeChanges(other, cur) as CardNode[]);
      }
    },
    [transact, yNodes, yEdges, bumpSelection],
  );

  const applyEdgeChangesY = useCallback(
    (changes: EdgeChange[]) => {
      const removeChanges = changes.filter((c) => c.type === 'remove');
      const selectChanges = changes.filter((c) => c.type === 'select');

      if (selectChanges.length > 0) {
        const sel = selectedEdgeIdsRef.current;
        for (const c of selectChanges) {
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        }
        bumpSelection();
        setEdges((cur) =>
          cur.map((e) => (e.selected === sel.has(e.id) ? e : { ...e, selected: sel.has(e.id) })),
        );
      }

      if (removeChanges.length > 0) {
        transact(() => {
          for (const c of removeChanges) yEdges.delete(c.id);
        });
        const sel = selectedEdgeIdsRef.current;
        let touched = false;
        for (const c of removeChanges) {
          if (sel.delete(c.id)) touched = true;
        }
        if (touched) bumpSelection();
      }

      const other = changes.filter((c) => c.type !== 'remove' && c.type !== 'select');
      if (other.length > 0) {
        setEdges((cur) => applyEdgeChanges(other, cur));
      }
    },
    [transact, yEdges, bumpSelection],
  );

  const addNode = useCallback(
    (id: string, record: NodeRecord) => {
      transact(() => {
        yNodes.set(id, record);
      });
    },
    [transact, yNodes],
  );

  const addEdgeY = useCallback(
    (id: string, record: EdgeRecord) => {
      transact(() => {
        yEdges.set(id, record);
      });
    },
    [transact, yEdges],
  );

  const updateEdgeLabel = useCallback(
    (id: string, label: string | undefined) => {
      transact(() => {
        const cur = yEdges.get(id);
        if (!cur) return;
        const trimmed = label?.trim();
        if (!trimmed) {
          const { label: _drop, ...rest } = cur;
          void _drop;
          yEdges.set(id, rest as EdgeRecord);
        } else {
          yEdges.set(id, { ...cur, label: trimmed.slice(0, 80) });
        }
      });
    },
    [transact, yEdges],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<CardData>) => {
      transact(() => {
        const record = yNodes.get(id);
        if (!record) return;
        yNodes.set(id, { ...record, data: { ...record.data, ...patch } });
      });
    },
    [transact, yNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      transact(() => {
        yNodes.delete(id);
        const edgeIds: string[] = [];
        yEdges.forEach((rec, eid) => {
          if (rec.source === id || rec.target === id) edgeIds.push(eid);
        });
        for (const eid of edgeIds) yEdges.delete(eid);
      });
      if (selectedNodeIdsRef.current.delete(id)) bumpSelection();
    },
    [transact, yNodes, yEdges, bumpSelection],
  );

  const replaceAll = useCallback(
    (
      nextNodes: Array<{ id: string; record: NodeRecord }>,
      nextEdges: Array<{ id: string; record: EdgeRecord }>,
    ) => {
      transact(() => {
        yNodes.forEach((_v, k) => yNodes.delete(k));
        yEdges.forEach((_v, k) => yEdges.delete(k));
        for (const { id, record } of nextNodes) yNodes.set(id, record);
        for (const { id, record } of nextEdges) yEdges.set(id, record);
      });
      selectedNodeIdsRef.current.clear();
      selectedEdgeIdsRef.current.clear();
      bumpSelection();
    },
    [transact, yNodes, yEdges, bumpSelection],
  );

  const updateNodePositions = useCallback(
    (updates: Array<{ id: string; position: { x: number; y: number } }>) => {
      transact(() => {
        for (const { id, position } of updates) {
          const record = yNodes.get(id);
          if (!record) continue;
          yNodes.set(id, { ...record, position });
        }
      });
    },
    [transact, yNodes],
  );

  return {
    nodes,
    edges,
    selectedNodeIds: selectedNodeIdsRef.current,
    selectedEdgeIds: selectedEdgeIdsRef.current,
    applyNodeChangesY,
    applyEdgeChangesY,
    addNode,
    addEdgeY,
    updateEdgeLabel,
    updateNodeData,
    deleteNode,
    replaceAll,
    updateNodePositions,
  };
}
