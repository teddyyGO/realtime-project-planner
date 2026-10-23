import { useEffect, useRef, useState } from 'react';
import type { ChecklistGroup } from '../../collab/yRoom';
import { ChecklistEditor } from './ChecklistEditor';

interface ChecklistGroupsProps {
  groups: ChecklistGroup[];
  onAddGroup: (title: string) => void;
  onRenameGroup: (groupId: string, title: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onAddItem: (groupId: string, text: string) => void;
  onToggleItem: (groupId: string, itemId: string, done: boolean) => void;
  onUpdateItem: (groupId: string, itemId: string, text: string) => void;
  onRemoveItem: (groupId: string, itemId: string) => void;
}

export function ChecklistGroups({
  groups,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onRemoveItem,
}: ChecklistGroupsProps) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (addingGroup) inputRef.current?.focus();
  }, [addingGroup]);

  const submitGroup = () => {
    const trimmed = groupDraft.trim();
    setAddingGroup(false);
    setGroupDraft('');
    if (trimmed) onAddGroup(trimmed);
  };

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <GroupBlock
          key={g.id}
          group={g}
          onRename={(t) => onRenameGroup(g.id, t)}
          onRemove={() => onRemoveGroup(g.id)}
          onAddItem={(t) => onAddItem(g.id, t)}
          onToggleItem={(id, done) => onToggleItem(g.id, id, done)}
          onUpdateItem={(id, text) => onUpdateItem(g.id, id, text)}
          onRemoveItem={(id) => onRemoveItem(g.id, id)}
        />
      ))}

      {addingGroup ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={groupDraft}
            onChange={(e) => setGroupDraft(e.target.value.slice(0, 64))}
            onBlur={submitGroup}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitGroup();
              } else if (e.key === 'Escape') {
                setAddingGroup(false);
                setGroupDraft('');
              }
            }}
            placeholder="Checklist title"
            className="flex-1 text-sm border border-stroke rounded px-2 py-1.5"
          />
          <button
            type="button"
            onClick={submitGroup}
            className="text-sm px-2.5 py-1 rounded bg-ink text-white"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingGroup(true)}
          className="text-sm text-muted hover:text-ink"
        >
          + Add another checklist
        </button>
      )}
    </div>
  );
}

function GroupBlock({
  group,
  onRename,
  onRemove,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onRemoveItem,
}: {
  group: ChecklistGroup;
  onRename: (title: string) => void;
  onRemove: () => void;
  onAddItem: (text: string) => void;
  onToggleItem: (itemId: string, done: boolean) => void;
  onUpdateItem: (itemId: string, text: string) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.title);

  useEffect(() => {
    if (!editing) setDraft(group.title);
  }, [group.title, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === group.title) return;
    onRename(next);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 64))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setDraft(group.title);
                setEditing(false);
              }
            }}
            className="flex-1 text-sm font-medium border border-stroke rounded px-1.5 py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm font-medium text-ink hover:bg-gray-50 rounded px-1 py-0.5"
            title="Rename checklist"
          >
            {group.title}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(`Delete the "${group.title}" checklist?`);
            if (ok) onRemove();
          }}
          className="text-xs text-muted hover:text-red-600 px-1"
          aria-label={`Remove ${group.title} checklist`}
        >
          ✕
        </button>
      </div>
      <ChecklistEditor
        items={group.items}
        onAdd={onAddItem}
        onToggle={onToggleItem}
        onUpdate={onUpdateItem}
        onRemove={onRemoveItem}
      />
    </div>
  );
}
