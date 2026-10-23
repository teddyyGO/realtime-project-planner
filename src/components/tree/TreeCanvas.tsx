import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type OnConnect,
  type ReactFlowInstance,
} from 'reactflow';
import { CardNode } from '../CardNode';
import { ContextMenu, type ContextMenuState } from '../ContextMenu';
import { RoomTitle } from '../RoomTitle';
import { StylePanel } from '../StylePanel';
import { Toolbar } from '../Toolbar';
import { OthersSelectionContext, type OthersSelectionMap } from '../../collab/OthersContext';
import { Cursors } from '../../collab/Cursors';
import { Presence } from '../../collab/Presence';
import { SyncStatus } from '../../collab/SyncStatus';
import { setLocalCursor, setLocalSelection, useAwareness } from '../../collab/useAwareness';
import { useYGraph } from '../../collab/useYGraph';
import { createRoom, type Room } from '../../collab/yRoom';
import type { BorderStyle, CardData, CardNode as TCardNode } from '../../types';
import { CARD_HEIGHT, CARD_WIDTH, DEFAULT_CARD_DATA, GRID_SIZE } from '../../types';
import { exportJson, exportPng, exportSvg, importJsonFile } from '../../utils/export';
import { autoLayout } from '../../utils/layout';
import { recordVisit, updateRecentTitle } from '../../utils/recents';
import { TREE_TEMPLATES, takePendingTemplate } from '../../utils/templates';
import type { UserIdentity } from '../../utils/userIdentity';

const NODE_TYPES = { card: CardNode };

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af', width: 16, height: 16 },
};

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function newId(prefix: string, clientId?: number): string {
  const c = clientId ? clientId.toString(36) : 'l';
  return `${prefix}-${c}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TreeCanvasProps {
  roomSlug: string;
  identity: UserIdentity;
  onBackToDashboard: () => void;
  onNewRoom: () => void;
  onEditIdentity: () => void;
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider key={props.roomSlug}>
      <RoomCanvas {...props} />
    </ReactFlowProvider>
  );
}

function RoomCanvas({
  roomSlug,
  identity,
  onBackToDashboard,
  onNewRoom,
  onEditIdentity,
}: TreeCanvasProps) {
  const roomRef = useRef<Room | null>(null);
  if (roomRef.current === null) {
    roomRef.current = createRoom(roomSlug);
  }
  const room = roomRef.current;

  useEffect(() => {
    return () => {
      room.destroy();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Inner
      room={room}
      roomSlug={roomSlug}
      identity={identity}
      onBackToDashboard={onBackToDashboard}
      onNewRoom={onNewRoom}
      onEditIdentity={onEditIdentity}
    />
  );
}

interface InnerProps {
  room: Room;
  roomSlug: string;
  identity: UserIdentity;
  onBackToDashboard: () => void;
  onNewRoom: () => void;
  onEditIdentity: () => void;
}

function Inner({
  room,
  roomSlug,
  identity,
  onBackToDashboard,
  onNewRoom,
  onEditIdentity,
}: InnerProps) {
  const flow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const {
    nodes,
    edges,
    applyNodeChangesY,
    applyEdgeChangesY,
    addNode,
    addEdgeY,
    updateEdgeLabel,
    updateNodeData,
    deleteNode,
    replaceAll,
    updateNodePositions,
  } = useYGraph(room);

  const others = useAwareness(room.awareness, identity);

  const readTitle = useCallback((): string => {
    const v = room.meta.get('name');
    return typeof v === 'string' ? v : 'Untitled project';
  }, [room.meta]);
  const [title, setTitle] = useState<string>(readTitle);

  useEffect(() => {
    setTitle(readTitle());
    const sync = () => setTitle(readTitle());
    room.meta.observe(sync);
    return () => room.meta.unobserve(sync);
  }, [room.meta, readTitle]);

  useEffect(() => {
    recordVisit('tree', roomSlug, title);
  }, [roomSlug, title]);

  // Apply pending template (set by the dashboard when creating with a template)
  // once the provider has synced with the server's default seed.
  useEffect(() => {
    const tplId = takePendingTemplate(roomSlug);
    if (!tplId) return;
    const tpl = TREE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const apply = () => {
      const built = tpl.build();
      room.doc.transact(() => {
        room.meta.set('name', built.meta.name);
      }, room.localOrigin);
      replaceAll(built.nodes, built.edges);
    };
    if (room.provider.isSynced) apply();
    else {
      const handler = (e: { state?: boolean } | boolean) => {
        const synced = typeof e === 'boolean' ? e : e?.state ?? true;
        if (synced) {
          room.provider.off('synced', handler);
          apply();
        }
      };
      room.provider.on('synced', handler);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) return;
      room.doc.transact(() => {
        room.meta.set('name', trimmed);
      }, room.localOrigin);
      updateRecentTitle('tree', roomSlug, trimmed);
    },
    [room.doc, room.meta, room.localOrigin, roomSlug],
  );

  const [, setHistoryVersion] = useState(0);
  useEffect(() => {
    const bump = () => setHistoryVersion((v) => v + 1);
    room.undoManager.on('stack-item-added', bump);
    room.undoManager.on('stack-item-popped', bump);
    room.undoManager.on('stack-cleared', bump);
    return () => {
      room.undoManager.off('stack-item-added', bump);
      room.undoManager.off('stack-item-popped', bump);
      room.undoManager.off('stack-cleared', bump);
    };
  }, [room.undoManager]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    setLocalSelection(room.awareness, selectedNodeId);
  }, [selectedNodeId, room.awareness]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const othersSelection: OthersSelectionMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of others) {
      if (!o.selectedNodeId) continue;
      const arr = map.get(o.selectedNodeId) ?? [];
      arr.push(o.user.color);
      map.set(o.selectedNodeId, arr);
    }
    return map;
  }, [others]);

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: TCardNode[] }) => {
    setSelectedNodeId(sel.length === 1 ? sel[0].id : null);
  }, []);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      const id = newId('e', room.awareness.clientID);
      addEdgeY(id, {
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
      });
    },
    [addEdgeY, room.awareness.clientID],
  );

  const addCardAtViewportCenter = useCallback(() => {
    const instance = rfInstanceRef.current;
    const wrapper = wrapperRef.current;
    let pos = { x: 0, y: 0 };
    if (instance && wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const projected = instance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      pos = { x: snap(projected.x - CARD_WIDTH / 2), y: snap(projected.y - CARD_HEIGHT / 2) };
    }
    const id = newId('n', room.awareness.clientID);
    addNode(id, { position: pos, data: { ...DEFAULT_CARD_DATA, label: 'New card' } });
    setSelectedNodeId(id);
  }, [addNode, room.awareness.clientID]);

  const addChild = useCallback(
    (parentId: string) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const childCount = edges.filter((e) => e.source === parentId).length;
      const position = {
        x: snap(parent.position.x + CARD_WIDTH + 80),
        y: snap(parent.position.y + childCount * (CARD_HEIGHT + 24)),
      };
      const id = newId('n', room.awareness.clientID);
      addNode(id, { position, data: { ...DEFAULT_CARD_DATA, label: 'New card' } });
      addEdgeY(newId('e', room.awareness.clientID), {
        source: parentId,
        target: id,
        sourceHandle: 'right',
        targetHandle: 'left',
      });
      setSelectedNodeId(id);
    },
    [nodes, edges, addNode, addEdgeY, room.awareness.clientID],
  );

  const handleUpdateData = useCallback(
    (id: string, patch: Partial<CardData>) => updateNodeData(id, patch),
    [updateNodeData],
  );

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges);
    const positions = laid.map((n) => ({ id: n.id, position: n.position }));
    updateNodePositions(positions);
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 300 }));
  }, [nodes, edges, updateNodePositions, flow]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const { nodes: importedNodes, edges: importedEdges } = await importJsonFile(file);
        replaceAll(
          importedNodes.map((n) => ({
            id: n.id,
            record: {
              position: n.position,
              data: { ...DEFAULT_CARD_DATA, ...(n.data as Partial<CardData>) },
            },
          })),
          importedEdges.map((e) => ({
            id: e.id,
            record: {
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined,
            },
          })),
        );
        setSelectedNodeId(null);
        requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 300 }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not import file';
        window.alert(`Import failed: ${msg}`);
      }
    },
    [replaceAll, flow],
  );

  const handleExportJson = useCallback(() => {
    exportJson(nodes, edges);
  }, [nodes, edges]);

  const handleExportSvg = useCallback(async () => {
    try {
      await exportSvg();
    } catch (err) {
      window.alert(`SVG export failed: ${err instanceof Error ? err.message : err}`);
    }
  }, []);

  const handleExportPng = useCallback(async () => {
    try {
      await exportPng();
    } catch (err) {
      window.alert(`PNG export failed: ${err instanceof Error ? err.message : err}`);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string; label: string }>;
      updateNodeData(ce.detail.id, { label: ce.detail.label });
    };
    window.addEventListener('card:label-change', handler);
    return () => window.removeEventListener('card:label-change', handler);
  }, [updateNodeData]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string; x: number; y: number }>;
      setContextMenu({ nodeId: ce.detail.id, x: ce.detail.x, y: ce.detail.y });
    };
    window.addEventListener('card:context', handler);
    return () => window.removeEventListener('card:context', handler);
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || target.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) room.undoManager.redo();
        else room.undoManager.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        room.undoManager.redo();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [room.undoManager]);

  const cursorRafPending = useRef(false);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (cursorRafPending.current) return;
      cursorRafPending.current = true;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const instance = rfInstanceRef.current;
      if (!instance) {
        cursorRafPending.current = false;
        return;
      }
      requestAnimationFrame(() => {
        cursorRafPending.current = false;
        const pos = instance.screenToFlowPosition({ x: clientX, y: clientY });
        setLocalCursor(room.awareness, { x: pos.x, y: pos.y });
      });
    },
    [room.awareness],
  );

  const handleMouseLeave = useCallback(() => {
    setLocalCursor(room.awareness, null);
  }, [room.awareness]);

  const handleCopyShareLink = useCallback(() => {
    const url = window.location.href;
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // ignore
      }
      ta.remove();
    };
    const done = () => {
      setShareLinkCopied(true);
      window.setTimeout(() => setShareLinkCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(done)
        .catch(() => {
          fallback();
          done();
        });
    } else {
      fallback();
      done();
    }
  }, []);

  return (
    <OthersSelectionContext.Provider value={othersSelection}>
      <div
        ref={wrapperRef}
        className="relative w-screen h-screen overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          connectionMode={ConnectionMode.Loose}
          onNodesChange={applyNodeChangesY}
          onEdgesChange={applyEdgeChangesY}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
          }}
          onPaneClick={() => setContextMenu(null)}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
          onEdgeDoubleClick={(_, edge) => {
            const current = (edge.label as string | undefined) ?? '';
            const next = window.prompt('Edge label (leave blank to remove):', current);
            if (next === null) return;
            updateEdgeLabel(edge.id, next || undefined);
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const data = n.data as { bgColor?: string } | undefined;
              return data?.bgColor ?? '#e5e7eb';
            }}
            maskColor="rgba(15, 23, 42, 0.06)"
            style={{
              background: 'var(--surface)',
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          />
        </ReactFlow>

        <Cursors others={others} />

        <RoomTitle
          title={title}
          onChange={handleTitleChange}
          onBack={onBackToDashboard}
          backLabel="Trees"
        />

        <Toolbar
          onAddCard={addCardAtViewportCenter}
          onAutoLayout={handleAutoLayout}
          onUndo={() => room.undoManager.undo()}
          onRedo={() => room.undoManager.redo()}
          canUndo={room.undoManager.canUndo()}
          canRedo={room.undoManager.canRedo()}
          onImportFile={handleImport}
          onExportJson={handleExportJson}
          onExportSvg={handleExportSvg}
          onExportPng={handleExportPng}
          onNewRoom={onNewRoom}
          onCopyShareLink={handleCopyShareLink}
          shareLinkCopied={shareLinkCopied}
          presence={<Presence self={identity} others={others} onEditSelf={onEditIdentity} />}
          syncStatus={<SyncStatus provider={room.provider} />}
        />

        <StylePanel
          node={selectedNode}
          onChangeBg={(id, hex) => handleUpdateData(id, { bgColor: hex })}
          onChangeTextColor={(id, hex, auto) =>
            handleUpdateData(id, { textColor: hex, textColorAuto: auto })
          }
          onChangeBorder={(id, style: BorderStyle) => handleUpdateData(id, { borderStyle: style })}
          onDelete={deleteNode}
        />

        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddChild={addChild}
          onDelete={deleteNode}
        />
      </div>
    </OthersSelectionContext.Provider>
  );
}
