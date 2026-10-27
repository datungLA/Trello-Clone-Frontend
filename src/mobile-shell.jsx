import React, { useEffect, useRef, useState } from "react";
import { LockKeyhole, Search, X } from "lucide-react";
import { api } from "./api";
import { Select } from "./select";

export function useCompactShell() {
  const [mode, setMode] = useState(() => ({ compact: matchMedia("(max-width: 899px), (max-height: 500px)").matches, short: matchMedia("(max-height: 500px)").matches }));
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const query = matchMedia("(max-width: 899px), (max-height: 500px)");
    const heightQuery = matchMedia("(max-height: 500px)");
    const change = () => setMode({ compact: query.matches, short: heightQuery.matches });
    const connection = () => setOnline(navigator.onLine);
    function resize() {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--app-visible-height", `${viewport?.height || innerHeight}px`);
      document.documentElement.classList.toggle("keyboard-open", !!viewport && viewport.height < innerHeight - 120);
      if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: "nearest", inline: "nearest" }));
    }
    query.addEventListener("change", change); heightQuery.addEventListener("change", change); window.addEventListener("online", connection); window.addEventListener("offline", connection);
    window.visualViewport?.addEventListener("resize", resize); window.addEventListener("resize", resize); resize();
    return () => { query.removeEventListener("change", change); heightQuery.removeEventListener("change", change); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); window.visualViewport?.removeEventListener("resize", resize); window.removeEventListener("resize", resize); document.documentElement.classList.remove("keyboard-open"); };
  }, []);
  return { ...mode, online };
}

export function MobileOverlay({ title, kind = "sheet", children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { const previous = document.activeElement; dialog.current.showModal(); return () => { if (previous?.isConnected) previous.focus(); }; }, []);
  return <dialog ref={dialog} className={`mobile-overlay mobile-overlay-${kind}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}><header><h2>{title}</h2><button className="icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20}/></button></header><div className="mobile-overlay-content">{children}</div></dialog>;
}

export function MobileBoardPicker({ workspaces, workspaceId, boardId, onWorkspace, onBoard, onCreate, onClose }) {
  const [selected, setSelected] = useState(workspaceId || workspaces[0]?.id || "");
  const [boards, setBoards] = useState([]), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!selected) return;
    let active = true; setLoading(true); setBoards([]); setError("");
    api(`/workspaces/${selected}/boards`).then(data => { if (active) setBoards(data.filter(board => !board.closed && !board.workspaceArchived)); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected, revision]);
  const shown = boards.filter(board => board.title.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  return <MobileOverlay title="Your workspaces and boards" kind="picker" onClose={onClose}>
    <label className="field"><span>Workspace</span><Select value={selected} onChange={e => setSelected(e.target.value)}><option value="" disabled>Choose a workspace</option>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</Select></label>
    <label className="mobile-picker-search"><Search size={18}/><input aria-label="Find a board in this workspace" placeholder="Find a board" value={search} onChange={e => setSearch(e.target.value)}/></label>
    {loading && <p role="status">Loading boards...</p>}{error && <p role="alert" className="error">{error}<button onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    {!loading && !error && !shown.length && <p className="muted">{boards.length ? "No boards match your search." : "No open boards in this workspace yet."}</p>}
    <ul className="mobile-picker-boards">{shown.map(board => <li key={board.id}><button aria-current={board.id === boardId ? "page" : undefined} onClick={() => { onClose(); onBoard(board.id); }}><i style={{ background: board.color }}/><span><strong>{board.title}</strong><small><LockKeyhole size={12}/>Workspace board</small></span></button></li>)}</ul>
    <div className="mobile-picker-footer">{selected && <button onClick={() => { onClose(); onWorkspace(selected); }}>All workspace boards</button>}<button className="primary" onClick={() => { onClose(); onCreate(); }}>Create workspace</button></div>
  </MobileOverlay>;
}

export function ResponsiveFilters({ compact, open, onClose, search, onSearch, children }) {
  const dialog = useRef(null), previous = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (element.open) element.close();
    if (compact) {
      if (open) { previous.current = document.activeElement; element.showModal(); const details = element.querySelector("details"); if (details) details.open = true; }
      else if (previous.current?.isConnected) { previous.current.focus(); previous.current = null; }
    } else element.setAttribute("open", "");
    return () => { if (element.open) element.close(); };
  }, [compact, open]);
  return <dialog ref={dialog} className={`responsive-filter-dialog ${compact ? "is-compact" : "is-wide"}`} aria-label="Board filters and saved views" onCancel={event => { event.preventDefault(); onClose(); }}><header className="mobile-filter-heading"><h2>Filter your board</h2><button className="icon-button" aria-label="Close board filters" onClick={onClose}><X size={20}/></button></header><div className="responsive-filter-content"><label className="mobile-filter-search field"><span>Find a card</span><input aria-label="Search board cards" placeholder="Search titles and descriptions" value={search} onChange={e => onSearch(e.target.value)}/></label>{children}</div></dialog>;
}
