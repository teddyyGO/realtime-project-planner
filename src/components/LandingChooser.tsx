import type { UserIdentity } from '../utils/userIdentity';
import { ThemeToggle } from './ThemeToggle';

interface LandingChooserProps {
  identity: UserIdentity;
  onEditIdentity: () => void;
  onChooseTrees: () => void;
  onChooseBoards: () => void;
}

export function LandingChooser({
  identity,
  onEditIdentity,
  onChooseTrees,
  onChooseBoards,
}: LandingChooserProps) {
  return (
    <div className="min-h-screen w-screen flex flex-col bg-gray-50">
      <header className="border-b border-stroke bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div>
              <h1 className="text-base font-semibold text-ink leading-tight">
                Project Planning
              </h1>
              <p className="text-xs text-muted">Pick how you want to plan today</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={onEditIdentity}
              className="flex items-center gap-2 text-sm px-2 py-1 rounded-md hover:bg-gray-100"
              aria-label="Edit your nickname"
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-white"
                style={{ background: identity.color }}
              >
                {identity.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-ink">{identity.name}</span>
              <span className="text-xs text-muted">Edit</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-4xl w-full mx-auto px-6 py-16">
          <h2 className="text-xl font-semibold text-ink text-center">
            What are you planning?
          </h2>
          <p className="text-sm text-muted text-center mt-1">
            Two ways to think about a project. Pick one — you can switch any time.
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChoiceCard
              title="Tree Maker"
              description="Sketch how the pieces of a plan connect. Cards, lines, hierarchy — like an org chart or a mind map. Best for designing structure."
              cta="Open trees"
              onClick={onChooseTrees}
              preview={<TreePreview />}
            />
            <ChoiceCard
              title="Boards"
              description="Move work through columns. Kanban-style cards with labels, checklists, and due dates. Best for tracking progress."
              cta="Open boards"
              onClick={onChooseBoards}
              preview={<BoardPreview />}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  cta,
  onClick,
  preview,
}: {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white border border-stroke rounded-xl p-5 hover:border-gray-400 hover:shadow-md transition-all"
    >
      <div className="h-32 bg-gray-50 border border-stroke rounded-lg overflow-hidden flex items-center justify-center mb-4 group-hover:bg-white transition-colors">
        {preview}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-muted mt-1 leading-relaxed">{description}</p>
      <div className="mt-3 text-sm font-medium text-ink flex items-center gap-1">
        {cta}
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  );
}

function TreePreview() {
  return (
    <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden>
      <g fill="#ffffff" stroke="#9ca3af" strokeWidth="1">
        <rect x="8" y="40" width="48" height="20" rx="4" />
        <rect x="118" y="10" width="52" height="20" rx="4" />
        <rect x="118" y="40" width="52" height="20" rx="4" />
        <rect x="118" y="70" width="52" height="20" rx="4" />
      </g>
      <g fill="none" stroke="#9ca3af" strokeWidth="1">
        <path d="M56 50 H87 V20 H118" />
        <path d="M56 50 H118" />
        <path d="M56 50 H87 V80 H118" />
      </g>
    </svg>
  );
}

function BoardPreview() {
  return (
    <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden>
      <g fill="#ffffff" stroke="#9ca3af" strokeWidth="1">
        <rect x="6" y="8" width="50" height="84" rx="4" />
        <rect x="65" y="8" width="50" height="84" rx="4" />
        <rect x="124" y="8" width="50" height="84" rx="4" />
      </g>
      <g fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5">
        <rect x="11" y="22" width="40" height="12" rx="2" />
        <rect x="11" y="38" width="40" height="12" rx="2" />
        <rect x="70" y="22" width="40" height="12" rx="2" />
        <rect x="129" y="22" width="40" height="12" rx="2" />
        <rect x="129" y="38" width="40" height="12" rx="2" />
        <rect x="129" y="54" width="40" height="12" rx="2" />
      </g>
    </svg>
  );
}

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#1f2937" />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="16" cy="8" r="3" />
        <circle cx="8" cy="22" r="3" />
        <circle cx="24" cy="22" r="3" />
        <path d="M16 11v4M16 15h-8v4M16 15h8v4" />
      </g>
    </svg>
  );
}
