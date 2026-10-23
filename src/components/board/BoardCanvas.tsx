import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Presence } from '../../collab/Presence';
import { SyncStatus } from '../../collab/SyncStatus';
import { setLocalSelection, useAwareness } from '../../collab/useAwareness';
import { useYBoard } from '../../collab/useYBoard';
import type { BoardRoom } from '../../collab/yRoom';
import { recordVisit, updateRecentTitle } from '../../utils/recents';
import type { UserIdentity } from '../../utils/userIdentity';
import { RoomTitle } from '../RoomTitle';
import { useToast } from '../Toasts';
import { exportBoardJson } from '../../utils/boardExport';
import { BoardImportError, parseBoardImportFile, toBoardCardRecord, type ImportedBoard } from '../../utils/boardImport';
import type { ImportMode } from './ImportCardsDialog';
import { BOARD_TEMPLATES, takePendingTemplate } from '../../utils/templates';
import { loadCollapsed, saveCollapsed } from '../../utils/collapsedLists';
import { AddListInline } from './AddListInline';
import { ArchiveDrawer } from './ArchiveDrawer';
import { BackgroundPicker, type BoardBackground } from './BackgroundPicker';
import { BoardCard } from './BoardCard';
import { BoardList } from './BoardList';
import { CardDetailModal } from './CardDetailModal';
import { ImportCardsDialog } from './ImportCardsDialog';
import { LABEL_PALETTE } from './LabelPicker';

interface BoardCanvasProps {
  room: BoardRoom;
  roomSlug: string;
  identity: UserIdentity;
  onBackToDashboard: () => void;
  onNewBoard: () => void;
  onEditIdentity: () => void;
}

export function BoardCanvas({
  room,
  roomSlug,
  identity,
  onBackToDashboard,
  onNewBoard,
  onEditIdentity,
}: BoardCanvasProps) {
  const {
    listsSorted,
    cardsById,
    addList,
    renameList,
    deleteList,
    moveList,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    toggleLabel,
    labelNames,
    setLabelName,
    quickFlagColor,
    setQuickFlagColor,
    flagKeybind,
    setFlagKeybind,
    doneColor,
    setDoneColor,
    doneKeybind,
    setDoneKeybind,
    toggleCardDone,
    setCardArchived,
    purgeArchivedCards,
    archivedCards,
    importCardsIntoList,
    importCardsMultiList,
    applyTemplate,
    addChecklistGroup,
    renameChecklistGroup,
    removeChecklistGroup,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
  } = useYBoard(room);

  // Apply a pending template (if the user picked one from the dashboard) once
  // the provider has finished syncing with the server's default seed.
  useEffect(() => {
    const tplId = takePendingTemplate(roomSlug);
    if (!tplId) return;
    const tpl = BOARD_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const apply = () => {
      const built = tpl.build();
      applyTemplate(built);
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

  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedBoard | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  /**
   * "Mark done" action — toggles card.done AND syncs the doneColor label so
   * a done card also shows up in the labels list. Converges to a consistent
   * state even if done + label are currently out of sync (e.g. label was
   * added manually via LabelPicker).
   */
  const doDoneAction = useCallback(
    (cardId: string) => {
      const card = cardsById.get(cardId);
      if (!card) {
        toggleCardDone(cardId);
        return;
      }
      const targetDone = !card.done;
      const hasLabel = (card.labels ?? []).includes(doneColor);
      toggleCardDone(cardId);
      if (targetDone !== hasLabel) {
        toggleLabel(cardId, doneColor);
      }
    },
    [cardsById, doneColor, toggleCardDone, toggleLabel],
  );

  // Effective keybinds: custom key if set, otherwise the palette-position
  // number of the matching color (default = "press N" where N is the color's
  // position in the palette). Same fallback for both flag and done.
  const flagPaletteIdx = LABEL_PALETTE.findIndex(
    (c) => c.toLowerCase() === quickFlagColor.toLowerCase(),
  );
  const donePaletteIdx = LABEL_PALETTE.findIndex(
    (c) => c.toLowerCase() === doneColor.toLowerCase(),
  );
  const effectiveFlagKeybind =
    flagKeybind ?? (flagPaletteIdx >= 0 ? String(flagPaletteIdx + 1) : null);
  const effectiveDoneKeybind =
    doneKeybind ?? (donePaletteIdx >= 0 ? String(donePaletteIdx + 1) : null);
  const effectiveFlagKeybindHint = effectiveFlagKeybind ?? undefined;
  const effectiveDoneKeybindHint = effectiveDoneKeybind ?? undefined;
  const [collapsedListIds, setCollapsedListIds] = useState<Set<string>>(() =>
    loadCollapsed(roomSlug),
  );
  const toggleListCollapsed = useCallback(
    (listId: string) => {
      setCollapsedListIds((cur) => {
        const next = new Set(cur);
        if (next.has(listId)) next.delete(listId);
        else next.add(listId);
        saveCollapsed(roomSlug, next);
        return next;
      });
    },
    [roomSlug],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseBoardImportFile(file);
        if (parsed.cards.length === 0) {
          toast('JSON had no cards to import.', 'info');
          return;
        }
        setPendingImport(parsed);
      } catch (err) {
        const msg = err instanceof BoardImportError ? err.message : 'Could not read file';
        toast(`Import failed: ${msg}`, 'error');
      }
    },
    [toast],
  );

  const handleConfirmImport = useCallback(
    (mode: ImportMode) => {
      const parsed = pendingImport;
      setPendingImport(null);
      if (!parsed) return;
      // Merge in any board-level label names declared in the JSON.
      if (parsed.labelNames) {
        for (const [color, name] of Object.entries(parsed.labelNames)) {
          if (!labelNames[color]) setLabelName(color, name);
        }
      }
      if (mode.kind === 'preserve') {
        const groups = new Map<string, ReturnType<typeof toBoardCardRecord>[]>();
        const order: string[] = [];
        for (const c of parsed.cards) {
          const key = (c.list ?? 'Imported').trim() || 'Imported';
          if (!groups.has(key)) {
            groups.set(key, []);
            order.push(key);
          }
          groups.get(key)!.push(toBoardCardRecord(c));
        }
        const inserted = importCardsMultiList(
          order.map((listName) => ({ listName, cards: groups.get(listName)! })),
        );
        toast(
          `Imported ${inserted} card${inserted === 1 ? '' : 's'} across ${order.length} list${order.length === 1 ? '' : 's'}.`,
          'success',
        );
        return;
      }
      const listId = mode.kind === 'new' ? addList(mode.listName) : mode.listId;
      const inserted = importCardsIntoList(
        listId,
        parsed.cards.map((c) => toBoardCardRecord(c)),
      );
      const listName =
        listsSorted.find((l) => l.id === listId)?.title ??
        (mode.kind === 'new' ? mode.listName : 'list');
      toast(`Imported ${inserted} card${inserted === 1 ? '' : 's'} into "${listName}"`, 'success');
    },
    [
      pendingImport,
      addList,
      importCardsIntoList,
      importCardsMultiList,
      listsSorted,
      labelNames,
      setLabelName,
      toast,
    ],
  );

  const others = useAwareness(room.awareness, identity);

  // Title bound to Y meta.
  const readTitle = useCallback((): string => {
    const v = room.meta.get('name');
    return typeof v === 'string' ? v : 'Untitled board';
  }, [room.meta]);
  const [title, setTitle] = useState<string>(readTitle);

  // Background bound to Y meta.
  const readBackground = useCallback((): BoardBackground | null => {
    const v = room.meta.get('background');
    if (!v || typeof v !== 'object') return null;
    const obj = v as { type?: unknown; value?: unknown };
    if (obj.type === 'color' && typeof obj.value === 'string') {
      return { type: 'color', value: obj.value };
    }
    if (obj.type === 'image' && typeof obj.value === 'string') {
      return { type: 'image', value: obj.value };
    }
    return null;
  }, [room.meta]);
  const [background, setBackground] = useState<BoardBackground | null>(readBackground);

  useEffect(() => {
    setTitle(readTitle());
    setBackground(readBackground());
    const sync = () => {
      setTitle(readTitle());
      setBackground(readBackground());
    };
    room.meta.observe(sync);
    return () => room.meta.unobserve(sync);
  }, [room.meta, readTitle, readBackground]);

  const handleBackgroundChange = useCallback(
    (next: BoardBackground | null) => {
      room.doc.transact(() => {
        if (next) room.meta.set('background', next);
        else room.meta.delete('background');
      }, room.localOrigin);
    },
    [room.doc, room.meta, room.localOrigin],
  );

  useEffect(() => {
    recordVisit('board', roomSlug, title);
  }, [roomSlug, title]);

  const handleTitleChange = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) return;
      room.doc.transact(() => {
        room.meta.set('name', trimmed);
      }, room.localOrigin);
      updateRecentTitle('board', roomSlug, trimmed);
    },
    [room.doc, room.meta, room.localOrigin, roomSlug],
  );

  // Selected card (for the detail modal) ------------------------------
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  useEffect(() => {
    setLocalSelection(room.awareness, selectedCardId);
  }, [selectedCardId, room.awareness]);

  // Awareness map: card id → first remote color viewing it.
  const remoteColorByCardId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of others) {
      if (o.selectedNodeId && !m.has(o.selectedNodeId)) {
        m.set(o.selectedNodeId, o.user.color);
      }
    }
    return m;
  }, [others]);

  const selectedCard = selectedCardId ? cardsById.get(selectedCardId) ?? null : null;
  const selectedListTitle = selectedCard
    ? listsSorted.find((l) => l.id === selectedCard.listId)?.title ?? ''
    : '';

  // Auto-close the modal if the selected card disappears (remote delete).
  useEffect(() => {
    if (selectedCardId && !cardsById.has(selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [cardsById, selectedCardId]);

  // Undo / redo subscription ------------------------------------------
  const [, setHistoryTick] = useState(0);
  useEffect(() => {
    const bump = () => setHistoryTick((v) => v + 1);
    room.undoManager.on('stack-item-added', bump);
    room.undoManager.on('stack-item-popped', bump);
    room.undoManager.on('stack-cleared', bump);
    return () => {
      room.undoManager.off('stack-item-added', bump);
      room.undoManager.off('stack-item-popped', bump);
      room.undoManager.off('stack-cleared', bump);
    };
  }, [room.undoManager]);

  // Keyboard shortcuts -----------------------------------------------
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

      // Dedicated done keybind — falls back to the palette position of the
      // done color if the user hasn't set an explicit key. Toggles card.done
      // AND the doneColor label together.
      if (
        effectiveDoneKeybind &&
        !mod &&
        !e.altKey &&
        !e.shiftKey &&
        !isEditableTarget(e.target) &&
        hoveredCardId &&
        e.key.toLowerCase() === effectiveDoneKeybind
      ) {
        e.preventDefault();
        doDoneAction(hoveredCardId);
        return;
      }

      // Dedicated flag keybind — falls back to the palette position of the
      // flag color (default: e.g. yellow → "2"). Toggles the quick-flag label
      // on the hovered card.
      if (
        effectiveFlagKeybind &&
        !mod &&
        !e.altKey &&
        !e.shiftKey &&
        !isEditableTarget(e.target) &&
        hoveredCardId &&
        e.key.toLowerCase() === effectiveFlagKeybind
      ) {
        e.preventDefault();
        toggleLabel(hoveredCardId, quickFlagColor);
        return;
      }

      // 1-9 toggles palette label N on the currently-hovered card.
      // Skip when typing or when a modifier is held (don't fight Cmd+1 etc.).
      if (
        !mod &&
        !e.altKey &&
        !e.shiftKey &&
        !isEditableTarget(e.target) &&
        hoveredCardId &&
        e.key >= '1' &&
        e.key <= '9'
      ) {
        const idx = Number(e.key) - 1;
        const color = LABEL_PALETTE[idx];
        if (color) {
          e.preventDefault();
          toggleLabel(hoveredCardId, color);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    room.undoManager,
    hoveredCardId,
    toggleLabel,
    effectiveFlagKeybind,
    quickFlagColor,
    effectiveDoneKeybind,
    doDoneAction,
  ]);

  // Share-link copy ---------------------------------------------------
  const [shareCopied, setShareCopied] = useState(false);
  const handleCopyShareLink = useCallback(() => {
    const url = window.location.href;
    const done = () => {
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
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
      done();
    }
  }, []);

  // DnD ---------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDrag, setActiveDrag] = useState<{ id: string; kind: 'card' | 'list' } | null>(
    null,
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const kind = (e.active.data.current as { kind?: string } | undefined)?.kind;
    if (kind === 'card' || kind === 'list') {
      setActiveDrag({ id: String(e.active.id), kind });
    }
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = e;
      if (!over) return;
      const activeKind = (active.data.current as { kind?: string } | undefined)?.kind;
      const overKind = (over.data.current as { kind?: string } | undefined)?.kind;

      if (activeKind === 'list') {
        if (active.id === over.id) return;
        // While dragging a list across the board the cursor passes over cards
        // too — resolve the "over list" by mapping cards back to their parent.
        let overListId = String(over.id);
        if (overKind === 'card') {
          const parentList = (over.data.current as { listId?: string } | undefined)?.listId;
          if (parentList) overListId = parentList;
        }
        if (overListId === String(active.id)) return;
        const ids = listsSorted.map((l) => l.id);
        const activeIdx = ids.indexOf(String(active.id));
        const overIdx = ids.indexOf(overListId);
        if (activeIdx < 0 || overIdx < 0) return;
        const afterId =
          activeIdx < overIdx
            ? overListId
            : overIdx === 0
              ? null
              : ids[overIdx - 1];
        moveList(String(active.id), afterId);
        return;
      }

      if (activeKind === 'card') {
        // Released on self (drag-and-cancel) — would otherwise jump card to end of list.
        if (active.id === over.id) return;
        const cardId = String(active.id);
        // The drop target can be another card OR a list (when dropped on empty space).
        let targetListId: string | null = null;
        let beforeCardId: string | null = null;
        if (overKind === 'card') {
          const overListId = (over.data.current as { listId?: string } | undefined)?.listId;
          targetListId = overListId ?? null;
          if (targetListId) {
            const list = listsSorted.find((l) => l.id === targetListId);
            if (list) {
              const overIdx = list.cards.findIndex((c) => c.id === String(over.id));
              const activeIdx = list.cards.findIndex((c) => c.id === cardId);
              // If we're moving down within the same list, drop AFTER over; otherwise BEFORE.
              if (activeIdx >= 0 && activeIdx < overIdx) {
                beforeCardId = overIdx + 1 < list.cards.length ? list.cards[overIdx + 1].id : null;
              } else {
                beforeCardId = String(over.id);
              }
            }
          }
        } else if (overKind === 'list') {
          targetListId = String(over.id);
          beforeCardId = null; // drop at end
        }
        if (!targetListId) return;
        moveCard(cardId, targetListId, beforeCardId);
      }
    },
    [listsSorted, moveList, moveCard],
  );

  // Compose background CSS — color or hotlinked image. Empty default falls
  // back to the Tailwind gray-50 the wrapper would otherwise carry.
  const backgroundStyle: React.CSSProperties = {};
  if (background?.type === 'color') {
    backgroundStyle.background = background.value;
  } else if (background?.type === 'image') {
    backgroundStyle.backgroundImage = `url(${background.value})`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
    backgroundStyle.backgroundRepeat = 'no-repeat';
  }

  // Render -----------------------------------------------------------
  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-col ${
        background ? '' : 'bg-gray-50'
      }`}
      style={backgroundStyle}
    >
      <RoomTitle
        title={title}
        onChange={handleTitleChange}
        onBack={onBackToDashboard}
        backLabel="Boards"
      />

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur border border-stroke rounded-lg shadow-card px-1.5 py-1.5">
        <ToolbarButton onClick={onNewBoard} label="+ New board" />
        <Divider />
        <ToolbarButton
          onClick={() => room.undoManager.undo()}
          label="Undo"
          disabled={!room.undoManager.canUndo()}
          title="Cmd/Ctrl+Z"
        />
        <ToolbarButton
          onClick={() => room.undoManager.redo()}
          label="Redo"
          disabled={!room.undoManager.canRedo()}
          title="Cmd/Ctrl+Shift+Z"
        />
        <Divider />
        <ToolbarButton
          onClick={() => setArchiveOpen(true)}
          label={`Archive${archivedCards.length > 0 ? ` (${archivedCards.length})` : ''}`}
        />
        <Divider />
        <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Import" />
        <ToolbarButton
          onClick={() => exportBoardJson(title, listsSorted, labelNames)}
          label="Export"
        />
        <BackgroundPicker current={background} onChange={handleBackgroundChange} />
        <Divider />
        <ToolbarButton onClick={handleCopyShareLink} label={shareCopied ? 'Copied ✓' : 'Share'} />
        <Divider />
        <div className="px-1">
          <Presence self={identity} others={others} onEditSelf={onEditIdentity} />
        </div>
        <SyncStatus provider={room.provider} />
      </div>

      <div className="pt-16 pb-3 px-3 h-full overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={listsSorted.map((l) => l.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="h-full flex items-start gap-3 overflow-x-auto overflow-y-hidden pb-3">
              {listsSorted.map((list) => (
                <BoardList
                  key={list.id}
                  list={list}
                  collapsed={collapsedListIds.has(list.id)}
                  onToggleCollapsed={() => toggleListCollapsed(list.id)}
                  onRenameList={renameList}
                  onDeleteList={deleteList}
                  onAddCard={addCard}
                  onOpenCard={(c) => setSelectedCardId(c.id)}
                  onToggleCardDone={doDoneAction}
                  onToggleCardFlag={(id) => toggleLabel(id, quickFlagColor)}
                  onCardHover={setHoveredCardId}
                  remoteColorByCardId={remoteColorByCardId}
                  labelNames={labelNames}
                  quickFlagColor={quickFlagColor}
                  flagKeybindHint={effectiveFlagKeybindHint}
                  doneColor={doneColor}
                  doneKeybindHint={effectiveDoneKeybindHint}
                />
              ))}
              <AddListInline onAdd={addList} />
            </div>
          </SortableContext>

          {/* Overlay renders a clone of the dragged item that follows the
              cursor across the canvas — without this, the dragged card would
              be invisible the moment it leaves its source column. */}
          <DragOverlay dropAnimation={null}>
            {activeDrag?.kind === 'card' && cardsById.has(activeDrag.id) ? (
              <div className="rotate-1 cursor-grabbing">
                <BoardCard
                  card={cardsById.get(activeDrag.id)!}
                  onOpen={() => {}}
                  labelNames={labelNames}
                  flagColor={quickFlagColor}
                  flagKeybindHint={effectiveFlagKeybindHint}
                  doneColor={doneColor}
                  doneKeybindHint={effectiveDoneKeybindHint}
                />
              </div>
            ) : null}
            {activeDrag?.kind === 'list' ? (
              <DraggedListClone list={listsSorted.find((l) => l.id === activeDrag.id) ?? null} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          e.target.value = '';
        }}
      />

      {archiveOpen && (
        <ArchiveDrawer
          cards={archivedCards}
          lists={listsSorted}
          onClose={() => setArchiveOpen(false)}
          onRestore={(id) => {
            setCardArchived(id, false);
            toast('Card restored', 'success');
          }}
          onDelete={(id) => deleteCard(id)}
          onPurgeAll={() => {
            const n = purgeArchivedCards();
            toast(`Deleted ${n} archived card${n === 1 ? '' : 's'}`, 'info');
          }}
        />
      )}

      {pendingImport && (
        <ImportCardsDialog
          cards={pendingImport.cards}
          hasListAssignments={pendingImport.hasListAssignments}
          listNames={pendingImport.listNames}
          lists={listsSorted}
          onCancel={() => setPendingImport(null)}
          onConfirm={handleConfirmImport}
        />
      )}

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          listTitle={selectedListTitle}
          onClose={() => setSelectedCardId(null)}
          onUpdateTitle={(t) => updateCard(selectedCard.id, { title: t })}
          onUpdateDescription={(d) => updateCard(selectedCard.id, { description: d })}
          onToggleLabel={(c) => toggleLabel(selectedCard.id, c)}
          labelNames={labelNames}
          onRenameLabel={setLabelName}
          quickFlagColor={quickFlagColor}
          onSetQuickFlagColor={setQuickFlagColor}
          flagKeybind={flagKeybind}
          onSetFlagKeybind={setFlagKeybind}
          doneColor={doneColor}
          onSetDoneColor={setDoneColor}
          doneKeybind={doneKeybind}
          onSetDoneKeybind={setDoneKeybind}
          onSetDueDate={(iso) => updateCard(selectedCard.id, { dueDate: iso })}
          onAddChecklistGroup={(title) => {
            addChecklistGroup(selectedCard.id, title);
          }}
          onRenameChecklistGroup={(gid, title) =>
            renameChecklistGroup(selectedCard.id, gid, title)
          }
          onRemoveChecklistGroup={(gid) => removeChecklistGroup(selectedCard.id, gid)}
          onAddChecklistItem={(gid, text) => addChecklistItem(selectedCard.id, gid, text)}
          onToggleChecklistItem={(gid, id, done) =>
            updateChecklistItem(selectedCard.id, gid, id, { done })
          }
          onUpdateChecklistItem={(gid, id, text) =>
            updateChecklistItem(selectedCard.id, gid, id, { text })
          }
          onRemoveChecklistItem={(gid, id) =>
            removeChecklistItem(selectedCard.id, gid, id)
          }
          onToggleDone={() => doDoneAction(selectedCard.id)}
          onArchive={() => {
            setCardArchived(selectedCard.id, true);
            setSelectedCardId(null);
            toast(`Archived "${selectedCard.title || 'card'}"`, 'info');
          }}
          onDelete={() => {
            deleteCard(selectedCard.id);
            setSelectedCardId(null);
          }}
        />
      )}
    </div>
  );
}

function DraggedListClone({ list }: { list: { id: string; title: string; cards: unknown[] } | null }) {
  if (!list) return null;
  return (
    <div className="shrink-0 w-72 bg-gray-100 rounded-lg shadow-lg opacity-95 rotate-1 cursor-grabbing">
      <div className="px-2.5 py-2 flex items-center gap-1.5">
        <span className="flex-1 text-sm font-medium text-ink truncate">{list.title}</span>
        <span className="text-[11px] text-muted tabular-nums">{list.cards.length}</span>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  disabled,
  title,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-sm px-2.5 py-1.5 rounded transition-colors ${
        disabled ? 'text-muted cursor-not-allowed' : 'text-ink hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-stroke mx-0.5" aria-hidden />;
}
