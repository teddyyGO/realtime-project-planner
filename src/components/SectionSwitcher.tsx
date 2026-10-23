interface SectionSwitcherProps {
  active: 'trees' | 'boards';
  onTrees: () => void;
  onBoards: () => void;
  onHome: () => void;
}

export function SectionSwitcher({ active, onTrees, onBoards, onHome }: SectionSwitcherProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={onHome}
        className="px-2 py-1 rounded text-muted hover:text-ink hover:bg-gray-100"
        title="Home"
      >
        ⌂
      </button>
      <SwitchTab label="Trees" active={active === 'trees'} onClick={onTrees} />
      <SwitchTab label="Boards" active={active === 'boards'} onClick={onBoards} />
    </div>
  );
}

function SwitchTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded transition-colors ${
        active ? 'bg-gray-100 text-ink font-medium' : 'text-muted hover:text-ink hover:bg-gray-50'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </button>
  );
}
