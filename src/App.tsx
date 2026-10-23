import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardCanvas } from './components/board/BoardCanvas';
import { BoardDashboard } from './components/BoardDashboard';
import { LandingChooser } from './components/LandingChooser';
import { NicknameDialog } from './components/NicknameDialog';
import { ShortcutsOverlayMount } from './components/ShortcutsOverlay';
import { ThemeRoot } from './components/ThemeToggle';
import { ToastProvider, useToastBusBridge } from './components/Toasts';
import { TreeCanvas } from './components/tree/TreeCanvas';
import { TreeDashboard } from './components/TreeDashboard';
import { createBoardRoom, type BoardRoom } from './collab/yRoom';
import { generateRoomSlug, parseRoute, type Route } from './utils/slug';
import { rememberPendingTemplate } from './utils/templates';
import { loadIdentity, saveIdentity, type UserIdentity } from './utils/userIdentity';

export default function App() {
  return (
    <ThemeRoot>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ThemeRoot>
  );
}

function AppShell() {
  useToastBusBridge();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [identity, setIdentity] = useState<UserIdentity | null>(() => loadIdentity());
  const [editingIdentity, setEditingIdentity] = useState(false);

  useEffect(() => {
    const handler = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  }, []);

  const handleSaveIdentity = useCallback((next: UserIdentity) => {
    saveIdentity(next);
    setIdentity(next);
    setEditingIdentity(false);
  }, []);

  const handleEditIdentity = useCallback(() => setEditingIdentity(true), []);

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const goTrees = useCallback(() => navigate('/trees'), [navigate]);
  const goBoards = useCallback(() => navigate('/boards'), [navigate]);

  const openTree = useCallback((slug: string) => navigate(`/r/${slug}`), [navigate]);
  const openBoard = useCallback((slug: string) => navigate(`/b/${slug}`), [navigate]);

  const createTree = useCallback(
    (templateId?: string) => {
      const slug = generateRoomSlug();
      if (templateId) rememberPendingTemplate(slug, templateId);
      navigate(`/r/${slug}`);
    },
    [navigate],
  );
  const createBoard = useCallback(
    (templateId?: string) => {
      const slug = generateRoomSlug();
      if (templateId) rememberPendingTemplate(slug, templateId);
      navigate(`/b/${slug}`);
    },
    [navigate],
  );

  const needsOnboarding = !identity?.chosen;
  // Don't mount any room canvas (and therefore don't open a WebSocket) until
  // the user has confirmed their nickname. Otherwise a legacy identity record
  // without a `chosen` field would start syncing before the dialog dismisses.
  const ready = !!identity && !needsOnboarding;

  return (
    <>
      {ready && route.type === 'landing' && (
        <LandingChooser
          identity={identity}
          onEditIdentity={handleEditIdentity}
          onChooseTrees={goTrees}
          onChooseBoards={goBoards}
        />
      )}
      {ready && route.type === 'trees' && (
        <TreeDashboard
          identity={identity}
          onEditIdentity={handleEditIdentity}
          onOpenProject={openTree}
          onCreateProject={createTree}
          onHome={goHome}
          onSwitchToBoards={goBoards}
        />
      )}
      {ready && route.type === 'boards' && (
        <BoardDashboard
          identity={identity}
          onEditIdentity={handleEditIdentity}
          onOpenBoard={openBoard}
          onCreateBoard={createBoard}
          onHome={goHome}
          onSwitchToTrees={goTrees}
        />
      )}
      {ready && route.type === 'tree-room' && (
        <TreeCanvas
          key={route.slug}
          roomSlug={route.slug}
          identity={identity}
          onBackToDashboard={goTrees}
          onNewRoom={createTree}
          onEditIdentity={handleEditIdentity}
        />
      )}
      {ready && route.type === 'board-room' && (
        <BoardRoomMount
          key={route.slug}
          roomSlug={route.slug}
          identity={identity}
          onBackToDashboard={goBoards}
          onNewBoard={createBoard}
          onEditIdentity={handleEditIdentity}
        />
      )}
      {!ready && <PlaceholderBackground />}

      {(needsOnboarding || editingIdentity) && (
        <NicknameDialog
          initial={identity}
          onSave={handleSaveIdentity}
          onCancel={needsOnboarding ? undefined : () => setEditingIdentity(false)}
        />
      )}

      <ShortcutsOverlayMount />
    </>
  );
}

function PlaceholderBackground() {
  return <div className="w-screen h-screen bg-gray-50" />;
}

interface BoardRoomMountProps {
  roomSlug: string;
  identity: UserIdentity;
  onBackToDashboard: () => void;
  onNewBoard: () => void;
  onEditIdentity: () => void;
}

function BoardRoomMount({
  roomSlug,
  identity,
  onBackToDashboard,
  onNewBoard,
  onEditIdentity,
}: BoardRoomMountProps) {
  const roomRef = useRef<BoardRoom | null>(null);
  if (roomRef.current === null) {
    roomRef.current = createBoardRoom(roomSlug);
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
    <BoardCanvas
      room={room}
      roomSlug={roomSlug}
      identity={identity}
      onBackToDashboard={onBackToDashboard}
      onNewBoard={onNewBoard}
      onEditIdentity={onEditIdentity}
    />
  );
}
