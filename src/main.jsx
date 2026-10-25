import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, renew, logout, setAccessToken, setExpiredHandler } from "./api";
import { BoardFilters, CardEditor, CardBadges, matchesFilters, OwnershipTransfer } from "./roadmap";
import { ConfirmDialog } from "./confirm";
import { Select } from "./select";
import Notifications from "./notifications";
import { Archive, ArrowRight, Check, ChevronDown, GripVertical, LayoutGrid, LockKeyhole, MoreHorizontal, Plus, Search, SquareKanban, Star, UsersRound, X } from "lucide-react";
import "./styles.css";
const AdminPanel = lazy(() => import("./admin"));
const SessionsPanel = lazy(() => import("./sessions"));
class ScreenBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="screen-error" role="alert"><h2>This screen could not load.</h2><p>Check your connection, then reload to try again.</p><button onClick={() => location.reload()}>Reload page</button>{this.props.onBack && <button onClick={this.props.onBack}>Back to boards</button>}</div>;
    return this.props.children;
  }
}


const colors = [
  "#0065ff",
  "#0c7776",
  "#6b4d9f",
  "#b34c6a",
  "#af6435",
  "#485970",
];
const uid = () => crypto.randomUUID();
function Icon({ name, size = 20 }) {
  const icons = { grid: LayoutGrid, plus: Plus, arrow: ChevronDown, people: UsersRound, star: Star, archive: Archive, close: X, search: Search, lock: LockKeyhole, card: SquareKanban, check: Check, chevron: ChevronDown };
  const LucideIcon = icons[name] || LayoutGrid;
  return <LucideIcon size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <i />
        <i />
      </span>
      Trello<span className="clone-label">CLONE</span>
    </span>
  );
}
function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={onClose}
      className={wide ? "modal wide" : "modal"}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Auth({ onLogin, initialMode }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "forgot-password") {
        const result = await api("/auth/forgot-password", {
          method: "POST",
          body: values,
        });
        setMessage(
          result.message ||
            "If the account exists, a reset link has been sent.",
        );
      } else if (mode === "reset-password") {
        await api("/auth/reset-password", {
          method: "POST",
          body: {
            token: new URLSearchParams(location.search).get("token"),
            newPassword: values.password,
          },
        });
        setMode("login");
        setMessage("Password updated. Sign in with your new password.");
        history.replaceState({}, "", "/");
      } else {
        const data = await api(`/auth/${mode}`, {
          method: "POST",
          body: values,
        });
        setAccessToken(data.accessToken);
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Welcome back.",
    register: "Make room for great work.",
    "forgot-password": "Forgot your password?",
    "reset-password": "A fresh start.",
  }[mode];
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo />
        <div className="auth-pitch">
          <span className="eyebrow">A LITTLE MORE ORGANIZED</span>
          <h1>
            Big ideas.
            <br />
            Clear next steps.
          </h1>
          <p>
            Bring your tasks, teammates, and plans together. One board at a
            time.
          </p>
          <div className="board-illustration" aria-hidden="true">
            {["To do", "Doing", "Done"].map((name, i) => (
              <div key={name}>
                <strong>{name}</strong>
                {Array.from({ length: 3 - i }, (_, j) => (
                  <span key={j}>
                    <i
                      style={{
                        background: ["#b3d4ff", "#c0b6f2", "#b3dfd0"][i],
                      }}
                    />
                    <b />
                    <b />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <small>Less busywork. More possibility.</small>
      </div>
      <main className="auth-panel">
        <div className="auth-form">
          <span className="eyebrow">YOUR WORK, IN ONE PLACE</span>
          <h2>{title}</h2>
          <p>
            {mode === "login"
              ? "Log in to pick up where you left off."
              : mode === "register"
                ? "Create your account and start organizing."
                : "Get back to the work that matters."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label="Full name">
                <input
                  name="displayName"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Alex Morgan"
                />
              </Field>
            )}
            {mode !== "reset-password" && (
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </Field>
            )}
            {!["forgot-password"].includes(mode) && (
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  placeholder={
                    mode === "register"
                      ? "At least 12 characters"
                      : "Enter your password"
                  }
                />
              </Field>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait..."
                : {
                    login: "Log in",
                    register: "Create account",
                    "forgot-password": "Send reset link",
                    "reset-password": "Set new password",
                  }[mode]}
              <ArrowRight size={16} aria-hidden="true"/>
            </button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button
                  className="text-button"
                  onClick={() => {
                    setMode("forgot-password");
                    setError("");
                  }}
                >
                  Forgot password?
                </button>
                <span>
                  New here?{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                  >
                    Create an account
                  </button>
                </span>
              </>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Back to log in
              </button>
            )}
          </div>
          <p className="privacy-note">
            <Icon name="lock" size={14} /> Your boards are private to your
            workspace.
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState("");
  const [theme, setTheme] = useState("system");
  const [confirmAction, setConfirmAction] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState("");
  const [adminOpen, setAdminOpen] = useState(() => location.pathname.split("/")[1] === "admin");
  const [booting, setBooting] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [boards, setBoards] = useState([]);
  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cardFilters, setCardFilters] = useState({labelIds: [], assigneeIds: [], due: ""});
  const [view, setView] = useState("boards");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [cardId, setCardId] = useState(null);
  const [cardDraft, setCardDraft] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const navigation = useRef(0);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(""), 3200);
    return () => clearTimeout(timer);
  }, [notification]);
  useEffect(() => { if (user) setTheme(user.theme || "system"); }, [user?.id, user?.theme]);
  useEffect(() => {
    setExpiredHandler(() => {
      setUser(null);
      setBoard(null);
      setWorkspaces([]);
      setBoards([]);
      setMembers([]);
      setWorkspaceId("");
      setModal(null);
      setCardId(null);
      setError("Your session expired. Please log in again.");
    });
    renew()
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);
  useEffect(() => {
    if (user) loadWorkspaces();
  }, [user?.id]);
  useEffect(() => {
    if (workspaceId) {
      setLoading(true);
      Promise.all([
        api(`/workspaces/${workspaceId}/boards`),
        api(`/workspaces/${workspaceId}/members`),
      ])
        .then(([b, m]) => {
          setBoards(b);
          setMembers(m);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [workspaceId]);
  useEffect(() => {
    const handler = () => {
      if (user) routeFromUrl();
    };
    addEventListener("popstate", handler);
    return () => removeEventListener("popstate", handler);
  }, [user]);
  async function loadWorkspaces() {
    try {
      const data = await api("/workspaces");
      setWorkspaces(data);
      setWorkspaceId((id) =>
        data.some((w) => w.id === id) ? id : data[0]?.id || "",
      );
      await routeFromUrl();
    } catch (err) {
      setError(err.message);
    }
  }
  async function routeFromUrl() {
    const path = location.pathname.split("/").filter(Boolean);
    setAdminOpen(path[0] === "admin");
    if (path[0] === "cards" && path[1]) {
      try {
        const c = await api(`/cards/${path[1]}`);
        await openBoard(c.boardId, false);
        setCardId(c.id);
        setCardDraft(c);
      } catch (err) {
        setError(err.message);
      }
    } else if (path[0] === "boards" && path[1]) await openBoard(path[1], false);
    else if (
      path[0] === "invite" ||
      new URLSearchParams(location.search).has("invite")
    )
      setModal("accept");
    else {
      setBoard(null);
      setCardId(null);
    }
  }
  async function openBoard(id, navigate = true) {
    setAdminOpen(false);
    const serial = ++navigation.current;
    setLoading(true);
    setCardId(null);
    try {
      const b = await api(`/boards/${id}`);
      if (serial !== navigation.current) return;
      setBoard(b);
      setWorkspaceId(b.workspaceId);
      setArchiveOpen(false);
      setSearch("");
      setCardFilters({labelIds: [], assigneeIds: [], due: ""});
      if (navigate) history.pushState({}, "", `/boards/${id}`);
      api(`/boards/${id}/preferences`, {
        method: "PATCH",
        body: { lastOpenedAt: true },
      }).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      if (serial === navigation.current) setLoading(false);
    }
  }
  async function refreshBoard() {
    if (board) setBoard(await api(`/boards/${board.id}`));
  }
  async function refreshBoards() {
    if (workspaceId) setBoards(await api(`/workspaces/${workspaceId}/boards`));
  }
  function goHome(id = workspaceId, nextView = "boards") {
    setAdminOpen(false);
    navigation.current++;
    setWorkspaceId(id);
    setBoard(null);
    setCardId(null);
    setView(nextView);
    setSearch("");
    history.pushState({}, "", "/");
  }
  function signOutLocally() {
    setAccessToken(null);
    setUser(null); setBoard(null); setWorkspaces([]); setBoards([]);
    setMembers([]); setWorkspaceId(""); setModal(null); setCardId(null);
    setCardDraft(null); setAdminOpen(false);
    history.replaceState({}, "", "/");
  }
  async function mutate(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotification("Changes saved.");
      return true;
    } catch (err) {
      setError(
        `${err.message} Your changes were not confirmed. Refresh before retrying.`,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function showCard(c) {
    setCardId(c.id);
    setCardDraft({ ...c });
    history.pushState({}, "", `/cards/${c.id}`);
  }
  function closeCard() {
    setCardId(null);
    setCardDraft(null);
    history.pushState({}, "", `/boards/${board.id}`);
  }
  async function patchBoard(body) {
    await api(`/boards/${board.id}`, { method: "PATCH", body });
    await refreshBoard();
    await refreshBoards();
  }
  async function moveCard(id, listId, position) {
    return mutate(async () => {
      await api(`/cards/${id}/move`, {
        method: "POST",
        body: { listId, position },
      });
      await refreshBoard();
      const target = board.lists.find(l => l.id === listId);
      const active = target?.cards.filter(c => !c.archived && c.id !== id).length || 0;
      if (target?.wipLimit && active + 1 > target.wipLimit) setError(`Move saved. ${target.title} is above its work-in-progress limit of ${target.wipLimit}.`);
    });
  }
  async function drop(e, list, position) {
    e.preventDefault();
    if (busy || board.closed) return;
    try {
      const item = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (item.type === "card") await moveCard(item.id, list.id, position);
      else if (item.type === "list")
        await mutate(async () => {
          await api(`/lists/${item.id}/move`, {
            method: "POST",
            body: { position: visibleLists.findIndex((l) => l.id === list.id) },
          });
          await refreshBoard();
        });
    } catch (err) {
      if (!(err instanceof SyntaxError)) setError(err.message);
    } finally {
      setDraggedItem(null);
      setDropTarget("");
    }
  }
  if (booting)
    return (
      <div className="boot">
        <Logo />
        <p>Getting your workspace ready...</p>
      </div>
    );
  if (!user)
    return (
      <Auth
        onLogin={setUser}
        initialMode={
          location.pathname === "/reset-password" ? "reset-password" : location.pathname === "/signup" ? "register" : undefined
        }
      />
    );
  if (adminOpen) return <ScreenBoundary onBack={() => goHome()}><Suspense fallback={<div className="boot" role="status"><Logo/><p>Opening administration...</p></div>}><AdminPanel user={user} onBack={() => goHome()} onSignedOut={signOutLocally}/></Suspense></ScreenBoundary>;
  const visibleLists = (board?.lists || [])
    .filter((l) => !l.archived)
    .sort((a, b) => a.position - b.position);
  const visibleBoards = boards.filter(
    (b) =>
      (view === "closed" ? b.closed : !b.closed) &&
      (view !== "starred" || b.favorite) &&
      b.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <button
          className="brand-button"
          onClick={() => goHome()}
          aria-label="Go to boards"
        >
          <Logo />
        </button>
        <div className="topbar-links">
          <button className="nav-link" onClick={() => goHome()}>
            Workspaces <Icon name="chevron" size={14} />
          </button>
          <button
            className="nav-link"
            onClick={() => goHome(workspaceId, "starred")}
          >
            Starred
          </button>
        </div>
        <button
          className="primary compact"
          onClick={() => setModal(workspaceId ? "board" : "workspace")}
        >
          Create <Icon name="plus" size={16} />
        </button>
        <div className="topbar-spacer" />
        {user.isAdmin && <button className="nav-link admin-entry" onClick={() => {setModal(null);setAdminOpen(true);history.pushState({}, "", "/admin");}}>Administration</button>}
        <span className="dev-badge">DEV WORKSPACE</span>
        <Notifications userId={user.id} onOpenCard={async id => { const card = await api(`/cards/${id}`); await openBoard(card.boardId, false); setCardId(card.id); setCardDraft(card); history.pushState({}, "", `/cards/${id}`); }}/>
        <button
          className="avatar"
          aria-label="Open profile"
          onClick={() => setModal("profile")}
        >
          {user.displayName?.slice(0, 2).toUpperCase()}
        </button>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <div className="workspace-switch">
            <span className="workspace-avatar">
              {workspace?.name?.[0]?.toUpperCase() || "T"}
            </span>
            <div>
              <strong>{workspace?.name || "Your workspace"}</strong>
              <span>Free workspace</span>
            </div>
          </div>
          <div className="workspace-picker">
            <label htmlFor="workspace-select" className="sr-only">
              Select workspace
            </label>
            <Select
              id="workspace-select"
              value={workspaceId}
              onChange={(e) => goHome(e.target.value)}
            >
              <option value="" disabled>
                Select workspace
              </option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <button
              className="icon-button"
              aria-label="Create workspace"
              onClick={() => setModal("workspace")}
            >
              <Icon name="plus" size={17} />
            </button>
          </div>
          <nav>
            <button
              className={
                !board && view === "boards"
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => goHome()}
            >
              <Icon name="grid" />
              Boards
            </button>
            <button
              className={
                view === "members" && !board
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => goHome(workspaceId, "members")}
            >
              <Icon name="people" />
              Members<span className="count">{members.length}</span>
            </button>
            <button
              className={
                view === "starred" && !board
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => goHome(workspaceId, "starred")}
            >
              <Icon name="star" />
              Starred boards
            </button>
            <button
              className={
                view === "closed" && !board
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => goHome(workspaceId, "closed")}
            >
              <Icon name="archive" />
              Closed boards
            </button>
          </nav>
          <div className="sidebar-section">
            <span>YOUR BOARDS</span>
            {boards
              .filter((b) => !b.closed)
              .map((b) => (
                <button
                  key={b.id}
                  className={`board-link ${board?.id === b.id ? "selected" : ""}`}
                  onClick={() => openBoard(b.id)}
                >
                  <i style={{ background: b.color }} />
                  <span>{b.title}</span>
                  {b.favorite && <Icon name="star" size={13} />}
                </button>
              ))}
          </div>
          <div className="sidebar-footer">
            <Icon name="lock" size={17} />
            <p>
              One workspace.
              <br />
              <strong>Endless possibilities.</strong>
            </p>
          </div>
        </aside>
        <main
          className={`main ${board ? "board-main" : ""}`}
          style={board ? { "--board-color": board.color } : {}}
        >
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                onClick={() =>
                  mutate(async () => {
                    if (board) await refreshBoard();
                    else await refreshBoards();
                  })
                }
              >
                Refresh
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-line" role="status" aria-label="Loading" />
          )}
          {board ? (
            <>
              <div className="board-toolbar">
                <div className="board-title">
                  <h1>{board.title}</h1>
                  <button
                    className={`icon-button ${board.favorite ? "is-starred" : ""}`}
                    aria-label={board.favorite ? "Unstar board" : "Star board"}
                    disabled={busy}
                    onClick={() =>
                      mutate(async () => {
                        await api(`/boards/${board.id}/preferences`, {
                          method: "PATCH",
                          body: { favorite: !board.favorite },
                        });
                        await refreshBoard();
                        await refreshBoards();
                      })
                    }
                  >
                    <Icon name="star" />
                  </button>
                  <span className="toolbar-divider" />
                  <span className="private-label">
                    <Icon name="lock" size={14} /> Workspace
                  </span>
                </div>
                <div className="board-tools">
                  <button
                    className="glass-button"
                    onClick={() => setModal("members")}
                  >
                    <Icon name="people" size={16} />
                    Share
                  </button>
                  <button
                    className="glass-button"
                    onClick={() => setArchiveOpen(!archiveOpen)}
                  >
                    <Icon name="archive" size={16} />
                    Archive
                  </button>
                  <button
                    className="glass-button"
                    onClick={() => setModal("board-settings")}
                  >
                    Settings
                  </button>
                </div>
              </div>
              {board.closed && (
                <div className="closed-banner">
                  This board is closed. Reopen it to make changes.
                  <button
                    disabled={busy}
                    onClick={() => mutate(() => patchBoard({ closed: false }))}
                  >
                    Reopen board
                  </button>
                </div>
              )}
              <div className="board-subbar">
                <span>
                  <Icon name="grid" size={16} /> Board
                </span>
                <label className="board-search">
                  <Icon name="search" size={16} />
                  <input
                    name="cardSearch"
                    aria-label="Filter cards"
                    placeholder="Filter cards"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <BoardFilters key={board.id} board={board} members={members} filters={{...cardFilters, query: search}} onChange={value => {setSearch(value.query || "");setCardFilters(value);}} onError={setError}/>
              <p className="drag-hint">Drag cards between lists or list headers to reorder. Position controls are available in card and list settings.</p>
              <div className="lists">
                {visibleLists.map((list, index) => (
                  <section
                    className={`list ${list.wipLimit && list.cards.filter(c=>!c.archived).length > list.wipLimit ? "over-limit" : ""} ${dropTarget === `list-${list.id}` ? "drop-target" : ""}`}
                    key={list.id}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget(`list-${list.id}`); }}
                    onDrop={(e) =>
                      drop(
                        e,
                        list,
                        list.cards.filter((c) => !c.archived).length,
                      )
                    }
                  >
                    <header
                      draggable={!board.closed && !busy}
                      onDragEnd={() => { setDraggedItem(null); setDropTarget(""); }}
                      onDragStart={(e) =>
                        { setDraggedItem(`list-${list.id}`); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify({ type: "list", id: list.id })); }
                      }
                    >
                      <GripVertical className="drag-grip" size={16} aria-hidden="true"/>
                      <h2>{list.title}</h2>
                      <span className="list-count">
                        {list.cards.filter((c) => !c.archived).length}{list.wipLimit ? ` / ${list.wipLimit}` : ""}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`Edit list ${list.title}`}
                        disabled={board.closed || busy}
                        onClick={() =>
                          setModal({ type: "list-settings", list, index })
                        }
                      >
                        <MoreHorizontal size={16} aria-hidden="true"/>
                      </button>
                    </header>
                    {list.wipLimit && list.cards.filter(c=>!c.archived).length > list.wipLimit && <p className="wip-warning" role="status">Above work-in-progress limit</p>}
                    <div className="cards">
                      {list.cards
                        .filter(
                          (c) =>
                            !c.archived &&
                            matchesFilters(c, {...cardFilters, query: search}),
                        )
                        .sort((a, b) => a.position - b.position)
                        .map((c) => (
                          <button
                            className={`task-card ${dropTarget === `card-${c.id}` ? "drop-target" : ""} ${draggedItem === `card-${c.id}` ? "dragging" : ""}`}
                            key={c.id}
                            draggable={!board.closed && !busy}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDraggedItem(`card-${c.id}`);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData(
                                "text/plain",
                                JSON.stringify({ type: "card", id: c.id }),
                              );
                            }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(`card-${c.id}`); }}
                            onDragEnd={() => { setDraggedItem(null); setDropTarget(""); }}
                            onDrop={(e) => {
                              e.stopPropagation();
                              drop(
                                e,
                                list,
                                list.cards
                                  .filter((item) => !item.archived)
                                  .sort((a, b) => a.position - b.position)
                                  .findIndex((item) => item.id === c.id),
                              );
                            }}
                            onClick={() => showCard(c)}
                          >
                            <GripVertical className="drag-grip card-drag-grip" size={15} aria-hidden="true"/>
                            <CardBadges card={c} labels={board.labels || []} members={members}/>
                            {c.description && (
                              <span className="card-meta">
                                <Icon name="card" size={14} /> Description
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                    {!board.closed && (
                      <AddItem
                        key={`card-${list.id}`}
                        label="Add a card"
                        placeholder="What needs to be done?"
                        busy={busy}
                        onAdd={(title, id) =>
                          mutate(async () => {
                            await api(`/lists/${list.id}/cards`, {
                              method: "POST",
                              body: { title, id },
                            });
                            await refreshBoard();
                            return true;
                          })
                        }
                      />
                    )}
                  </section>
                ))}
                {!board.closed && (
                  <div className="add-list">
                    <AddItem
                      label="Add another list"
                      placeholder="Enter list title"
                      busy={busy}
                      onAdd={(title, id) =>
                        mutate(async () => {
                          await api(`/boards/${board.id}/lists`, {
                            method: "POST",
                            body: { title, id },
                          });
                          await refreshBoard();
                        })
                      }
                    />
                  </div>
                )}
              </div>
              {archiveOpen && (
                <aside className="archive-panel">
                  <header>
                    <h2>Archived items</h2>
                    <button
                      className="icon-button"
                      aria-label="Close archive"
                      onClick={() => setArchiveOpen(false)}
                    >
                      <Icon name="close" />
                    </button>
                  </header>
                  <p>Bring a list or card back to your board.</p>
                  {board.lists
                    .flatMap((l) => [
                      ...(l.archived ? [{ ...l, type: "list" }] : []),
                      ...l.cards
                        .filter((c) => c.archived)
                        .map((c) => ({ ...c, type: "card" })),
                    ])
                    .map((item) => (
                      <div className="archive-item" key={item.id}>
                        <span>
                          <small>{item.type}</small>
                          {item.title}
                        </span>
                        {item.type === "card" && <button onClick={() => showCard(item)}>Open</button>}
                        <button
                          disabled={busy || board.closed}
                          onClick={() =>
                            mutate(async () => {
                              await api(
                                `/${item.type === "list" ? "lists" : "cards"}/${item.id}`,
                                { method: "PATCH", body: { archived: false } },
                              );
                              await refreshBoard();
                            })
                          }
                        >
                          Restore
                        </button>
                        {item.type === "list" && <button className="danger" disabled={busy || board.closed} onClick={()=>setConfirmAction({title:"Delete archived list permanently?",message:"Archive every card inside first. The list cannot be restored after deletion.",confirmLabel:"Delete list",action:async()=>{await api(`/lists/${item.id}`,{method:"DELETE",body:{confirm:true}});await refreshBoard();}})}>Delete</button>}
                      </div>
                    ))}
                  <p className="muted">Cards inside an archived list require restoring that list first. Permanent list deletion requires all its cards to be archived.</p>
                </aside>
              )}
            </>
          ) : (
            <div className="dashboard">
              <div className="dashboard-heading">
                <div>
                  <span className="eyebrow">
                    YOUR SPACE TO MAKE THINGS HAPPEN
                  </span>
                  <h1>
                    {view === "members"
                      ? "Better, together."
                      : view === "starred"
                        ? "Your favorites."
                        : view === "closed"
                          ? "Closed boards."
                          : `Let's get organized.`}
                  </h1>
                  <p>
                    {view === "members"
                      ? "Good work starts with the right people."
                      : "A clear view of everything you are working on."}
                  </p>
                </div>
                {view !== "members" && workspaceId && (
                  <button className="primary" onClick={() => setModal("board")}>
                    <Icon name="plus" size={18} />
                    Create board
                  </button>
                )}
              </div>
              {!workspaces.length ? (
                <div className="welcome-empty">
                  <span className="empty-icon">
                    <Icon name="grid" size={32} />
                  </span>
                  <h2>A fresh workspace. A world of possibilities.</h2>
                  <p>
                    Create your first workspace to bring your ideas together.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setModal("workspace")}
                  >
                    Create workspace
                  </button>
                </div>
              ) : view === "members" ? (
                <>
                <Members
                  members={members}
                  workspace={workspace}
                  busy={busy}
                  onInvite={() => setModal("members")}
                  onRemove={(id) => setConfirmAction({title:"Remove workspace member?",message:"They will lose access to this workspace and its boards.",confirmLabel:"Remove member",action:async()=>{await api(`/workspaces/${workspaceId}/members/${id}`,{method:"DELETE"});setMembers(await api(`/workspaces/${workspaceId}/members`));}})}
                />
                <OwnershipTransfer workspace={workspace} members={members} busy={busy} onTransfer={mutate} onTransferred={async()=>{await loadWorkspaces();setMembers(await api(`/workspaces/${workspaceId}/members`));}}/>
                </>
              ) : (
                <>
                  <div className="section-heading">
                    <h2>
                      <Icon name={view === "starred" ? "star" : "grid"} />
                      {view === "closed"
                        ? "Closed boards"
                        : view === "starred"
                          ? "Starred boards"
                          : "Your boards"}
                      <span>{visibleBoards.length}</span>
                    </h2>
                    <label className="search">
                      <Icon name="search" size={17} />
                      <input
                        name="boardSearch"
                        placeholder="Find a board"
                        aria-label="Find a board"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="board-grid">
                    {visibleBoards.map((b) => (
                      <button
                        className="board-tile"
                        key={b.id}
                        onClick={() => openBoard(b.id)}
                      >
                        <div
                          className="board-tile-cover"
                          style={{ background: b.color }}
                        >
                          <div className="mini-board" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </div>
                          {b.favorite && (
                            <span className="tile-star">
                              <Icon name="star" size={17} />
                            </span>
                          )}
                        </div>
                        <div className="board-tile-info">
                          <strong>{b.title}</strong>
                          <span>
                            <Icon name="lock" size={12} />
                            Workspace board
                          </span>
                        </div>
                      </button>
                    ))}
                    {view === "boards" && (
                      <button
                        className="new-board-tile"
                        onClick={() => setModal("board")}
                      >
                        <span>
                          <Icon name="plus" size={25} />
                        </span>
                        <strong>Create a new board</strong>
                        <small>Start something great</small>
                      </button>
                    )}
                  </div>
                  {visibleBoards.length === 0 && view !== "boards" && (
                    <div className="simple-empty">
                      {search
                        ? "No boards match your search."
                        : view === "closed"
                          ? "No closed boards. Everything is in play."
                          : "Star a board to keep it close at hand."}
                    </div>
                  )}
                  <div className="dashboard-tip">
                    <span>
                      <Icon name="check" size={20} />
                    </span>
                    <div>
                      <strong>A little structure goes a long way.</strong>
                      <p>
                        Create lists for each stage, then move cards as work
                        progresses.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
      {cardId && cardDraft && board && (
        <Modal title="Card details" onClose={closeCard} wide>
          <CardEditor key={cardId} card={cardDraft} board={board} boards={boards.some(b=>b.id===board.id)?boards:[board,...boards]} members={members} user={user} onClose={closeCard} onRefresh={refreshBoard}/>
        </Modal>
      )}
      {modal && (
        <Modal
          title={
            typeof modal === "object"
              ? "List settings"
              : {
                  workspace: "Create a workspace",
                  board: "Create a board",
                  "board-settings": "Board settings",
                  profile: "Your profile",
                  sessions: "Your active sessions",
                  members: "Invite a teammate",
                  accept: "Join a workspace",
                }[modal]
          }
          onClose={() => {
            setModal(null);
            setInvitation(null);
          }}
        >
          {modal === "workspace" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name");
                mutate(async () => {
                  const w = await api("/workspaces", {
                    method: "POST",
                    body: { name },
                  });
                  setModal(null);
                  await loadWorkspaces();
                  goHome(w.id);
                });
              }}
            >
              <p className="muted">
                A shared home for your boards and teammates.
              </p>
              <Field label="Workspace name">
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g. Design studio"
                />
              </Field>
              <button className="primary" disabled={busy}>
                Create workspace
              </button>
            </form>
          )}
          {modal === "board" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const body = Object.fromEntries(new FormData(e.currentTarget));
                mutate(async () => {
                  const b = await api(`/workspaces/${workspaceId}/boards`, {
                    method: "POST",
                    body,
                  });
                  setModal(null);
                  await refreshBoards();
                  await openBoard(b.id);
                });
              }}
            >
              <Field label="Board title">
                <input
                  autoFocus
                  name="title"
                  required
                  maxLength={100}
                  placeholder="e.g. Product roadmap"
                />
              </Field>
              <ColorPicker />
              <p className="privacy-note">
                <Icon name="lock" size={15} />
                Visible to members of {workspace?.name}.
              </p>
              <button className="primary" disabled={busy}>
                Create board
              </button>
            </form>
          )}
          {modal === "board-settings" && board && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  mutate(async () => {
                    await patchBoard(body);
                    setModal(null);
                  });
                }}
              >
                <Field label="Board title">
                  <input
                    name="title"
                    defaultValue={board.title}
                    required
                    maxLength={100}
                  />
                </Field>
                <ColorPicker initial={board.color} />
                <button className="primary" disabled={busy || board.closed}>
                  Save changes
                </button>
              </form>
              <hr />
              <button
                disabled={busy}
                onClick={() =>
                  mutate(async () => {
                    await patchBoard({ closed: !board.closed });
                    setModal(null);
                  })
                }
              >
                {board.closed ? "Reopen board" : "Close board"}
              </button>
              <p className="muted">
                Closed boards keep their content and can be reopened.
              </p>
              <button disabled={busy || board.closed} onClick={()=>mutate(async()=>{const copy=await api(`/boards/${board.id}/copy`,{method:"POST",body:{}});await refreshBoards();setModal(null);await openBoard(copy.id);})}>Copy board</button>
            </>
          )}
          {typeof modal === "object" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  mutate(async () => {
                    await api(`/lists/${modal.list.id}`, {
                      method: "PATCH",
                      body: { title: f.get("title"), wipLimit: f.get("wipLimit") ? Number(f.get("wipLimit")) : null },
                    });
                    await api(`/lists/${modal.list.id}/move`, {
                      method: "POST",
                      body: { position: Number(f.get("position")) - 1 },
                    });
                    await refreshBoard();
                    setModal(null);
                  });
                }}
              >
                <Field label="List title">
                  <input
                    name="title"
                    defaultValue={modal.list.title}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="Work-in-progress limit (optional)">
                  <input name="wipLimit" type="number" min="1" max="10000" defaultValue={modal.list.wipLimit || ""} placeholder="No limit"/>
                </Field>
                <p className="muted">Soft limit: moving over capacity shows a warning.</p>
                <Field label="Position">
                  <input
                    name="position"
                    type="number"
                    min="1"
                    max={visibleLists.length}
                    defaultValue={modal.index + 1}
                    required
                  />
                </Field>
                <button className="primary" disabled={busy}>
                  Save changes
                </button>
              </form>
              <hr />
              <button
                disabled={busy}
                onClick={() =>
                  mutate(async () => {
                    await api(`/lists/${modal.list.id}`, {
                      method: "PATCH",
                      body: { archived: true },
                    });
                    await refreshBoard();
                    setModal(null);
                  })
                }
              >
                Archive list
              </button>
              <button disabled={busy} onClick={() => mutate(async()=>{await api(`/lists/${modal.list.id}/copy`,{method:"POST",body:{}});await refreshBoard();setModal(null);})}>Copy list</button>
            </>
          )}
          {modal === "profile" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  mutate(async () => {
                    const updated = await api("/me", { method: "PATCH", body: { displayName: values.get("displayName"), theme: values.get("theme") } });
                    setUser(updated);
                    setTheme(updated.theme);
                    setModal(null);
                  });
                }}
              >
                <Field label="Display name">
                  <input
                    name="displayName"
                    required
                    maxLength={100}
                    defaultValue={user.displayName}
                  />
                </Field>
                <Field label="Email">
                  <input name="email" value={user.email} readOnly />
                </Field>
                <Field label="Appearance">
                  <Select name="theme" defaultValue={user.theme || "system"}>
                    <option value="system">Use device setting</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </Select>
                </Field>
                <button className="primary" disabled={busy}>
                  Save profile
                </button>
              </form>
              <hr />
              <button onClick={() => setModal("sessions")}>Manage active sessions</button>
              <hr />
              <section className="danger-zone"><h3>Delete account</h3><p>Your work stays available to workspace members. Transfer workspace ownership first.</p><button className="danger" disabled={busy} onClick={() => setConfirmAction({title:"Delete your account?",message:"This permanently removes your sign-in, profile, memberships, and saved views. Your comments remain marked as Deleted user. Transfer workspace ownership first.",confirmLabel:"Delete account",requiredText:"DELETE",requirePassword:true,action:async({password})=>{await api("/me",{method:"DELETE",body:{confirm:"DELETE",password}});signOutLocally();}})}>Delete account</button></section>
              <hr />
              <button
                disabled={busy}
                onClick={() =>
                  mutate(async () => {
                    await logout();
                    setUser(null);
                    setBoard(null);
                    setWorkspaces([]);
                    setBoards([]);
                    setMembers([]);
                    setWorkspaceId("");
                    setModal(null);
                    setCardId(null);
                  })
                }
              >
                Log out
              </button>
            </>
          )}
          {modal === "sessions" && <ScreenBoundary><Suspense fallback={<p role="status">Loading session management...</p>}><SessionsPanel onSignedOut={signOutLocally}/></Suspense></ScreenBoundary>}
          {modal === "members" && (
            <>
              {workspace?.role === "owner" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = new FormData(e.currentTarget).get("email");
                    mutate(async () => {
                      setInvitation(
                        await api(`/workspaces/${workspaceId}/invitations`, {
                          method: "POST",
                          body: { email },
                        }),
                      );
                    });
                  }}
                >
                  <p className="muted">
                    Invite someone to collaborate on all workspace boards.
                  </p>
                  <Field label="Email address">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="teammate@example.com"
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    Create invitation
                  </button>
                  {invitation && (
                    <div className="notice">
                      <strong>Invitation ready</strong>
                      <p>Share this link with {invitation.email}:</p>
                      <input
                        readOnly
                        aria-label="Invitation link"
                        value={`${location.origin}/invite?invite=${invitation.token}`}
                      />
                      <small>Only that signed-in email can accept.</small>
                    </div>
                  )}
                </form>
              ) : (
                <p>Only workspace owners can invite people.</p>
              )}
              <Members members={members} workspace={workspace} />
            </>
          )}
          {modal === "accept" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const token = new FormData(e.currentTarget).get("token");
                mutate(async () => {
                  const w = await api("/invitations/accept", {
                    method: "POST",
                    body: { token },
                  });
                  history.replaceState({}, "", "/");
                  setModal(null);
                  await loadWorkspaces();
                  goHome(w.id);
                });
              }}
            >
              <p className="muted">
                Signed in as {user.email}. Your email must match the invitation.
              </p>
              <Field label="Invitation token">
                <input
                  name="token"
                  required
                  defaultValue={
                    new URLSearchParams(location.search).get("invite") || ""
                  }
                />
              </Field>
              <button className="primary" disabled={busy}>
                Join workspace
              </button>
            </form>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <p className="muted" role="status">
              Saving...
            </p>
          )}
        </Modal>
      )}
      {notification && <div className="toast" role="status"><Icon name="check" size={18}/><span>{notification}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotification("")}><Icon name="close" size={16}/></button></div>}
      {confirmAction && <ConfirmDialog title={confirmAction.title} message={confirmAction.message} confirmLabel={confirmAction.confirmLabel} requiredText={confirmAction.requiredText} requirePassword={confirmAction.requirePassword} busy={busy} error={error} onClose={() => setConfirmAction(null)} onConfirm={async({password})=>{if(await mutate(()=>confirmAction.action({password}))){setConfirmAction(null);confirmAction.onComplete?.();}}}/>}
    </div>
  );
}
function ColorPicker({ initial = colors[0] }) {
  return (
    <fieldset className="color-picker">
      <legend>Board color</legend>
      {colors.map((color) => (
        <label key={color} style={{ background: color }}>
          <input
            type="radio"
            name="color"
            value={color}
            defaultChecked={initial === color}
            aria-label={`Color ${color}`}
          />
          <span>
            <Icon name="check" size={19} />
          </span>
        </label>
      ))}
    </fieldset>
  );
}
function Members({ members, workspace, busy, onInvite, onRemove }) {
  return (
    <div className="members">
      <div className="section-heading">
        <h2>Workspace members</h2>
        {workspace?.role === "owner" && onInvite && (
          <button className="primary" onClick={onInvite}>
            Invite people
          </button>
        )}
      </div>
      {members.map((m) => (
        <div className="member" key={m.id}>
          <span className="avatar">
            {m.displayName?.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{m.displayName}</strong>
            <small>{m.email}</small>
          </div>
          <span className="role-badge">{m.role}</span>
          {onRemove && workspace?.role === "owner" && m.role !== "owner" && (
            <button disabled={busy} onClick={() => onRemove(m.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
function AddItem({ label, placeholder, onAdd, busy }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [id, setId] = useState(uid);
  if (!open)
    return (
      <button
        className="add-item"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={18} />
        {label}
      </button>
    );
  return (
    <form
      className="add-item-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const saved = await onAdd(title.trim(), id);
        if (saved !== false) {
          setTitle("");
          setId(uid());
        }
      }}
    >
      <input
        name="title"
        autoFocus
        aria-label={placeholder}
        required
        maxLength={200}
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div>
        <button className="primary compact" disabled={busy}>
          Add
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Cancel adding"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")).render(<App />);
