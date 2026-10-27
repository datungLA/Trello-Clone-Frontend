import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, GripVertical, Inbox as InboxIcon, LockKeyhole, Pencil, Plus, RefreshCw, StickyNote, Trash2, X } from "lucide-react";
import { api } from "./api";
import { Select } from "./select";
import { inboxCapture, inboxPayload, openInboxBoards, reorderedInbox, uncertainInboxWrite } from "./inbox-data";
import "./inbox.css";

export default function Inbox({ onOpenCard }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [captureRetry, setCaptureRetry] = useState(false);
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);
  const [moved, setMoved] = useState(null);
  const [dragging, setDragging] = useState("");
  const [target, setTarget] = useState("");
  const capture = useRef(null), titleInput = useRef(null), live = useRef(false), serial = useRef(0), writing = useRef(false);

  async function refresh() {
    const request = ++serial.current;
    setLoading(true); setLoadError("");
    try { const data = await api("/inbox"); if (live.current && request === serial.current) setItems(data); }
    catch (e) { if (live.current && request === serial.current) setLoadError(e.message); }
    finally { if (live.current && request === serial.current) setLoading(false); }
  }
  useEffect(() => { live.current = true; refresh(); return () => { live.current = false; serial.current++; }; }, []);
  async function add(event) {
    event.preventDefault();
    if (writing.current) return;
    setError(""); setNotice("");
    try { capture.current = inboxCapture(capture.current, draft, () => crypto.randomUUID()); }
    catch (e) { setError(e.message); return; }
    writing.current = true; setBusy("capture");
    try {
      const saved = await api("/inbox", { method: "POST", body: capture.current });
      if (!live.current) return;
      setItems(current => current.some(item => item.id === saved.id) ? current : [...current, saved]);
      capture.current = null; setCaptureRetry(false); setDraft({ title: "", description: "" }); setNotice("Saved to your private Inbox."); requestAnimationFrame(() => titleInput.current?.focus());
    } catch (e) { if (live.current) { const uncertain = uncertainInboxWrite(e); setCaptureRetry(uncertain); if (!uncertain) capture.current = null; setError(`${e.message} Your draft is preserved.${uncertain ? " Retry the same capture to avoid duplicates." : ""}`); } }
    finally { writing.current = false; if (live.current) setBusy(""); }
  }
  async function reorder(moving, destination) {
    const ids = reorderedInbox(items, moving, destination);
    const focused = document.activeElement;
    if (!ids || writing.current || loading) return;
    writing.current = true; setBusy("reorder"); setError(""); setNotice("");
    try { const data = await api("/inbox/reorder", { method: "POST", body: { ids } }); if (live.current) { setItems(data); setNotice("Inbox order saved."); } }
    catch (e) { if (live.current) { setError(`${e.message} Refresh before reordering again.`); await refresh(); } }
    finally { writing.current = false; if (live.current) { setBusy(""); requestAnimationFrame(() => { if (focused?.isConnected) { if (!focused.disabled) focused.focus(); else focused.closest("li")?.querySelector(".inbox-drag")?.focus(); } }); } }
  }
  async function openMoved() {
    if (writing.current) return;
    writing.current = true; setBusy("open"); setError("");
    try { await onOpenCard({ id: moved.cardId, boardId: moved.boardId }); }
    catch (e) { if (live.current) setError(e.message); }
    finally { writing.current = false; if (live.current) setBusy(""); }
  }
  return <section className="inbox-page" aria-labelledby="inbox-title">
    <header className="inbox-heading"><div><span className="eyebrow">A LITTLE SPACE TO THINK</span><h1 id="inbox-title">Your Inbox</h1><p>Capture an idea now. Give it a place when you're ready.</p></div><button type="button" disabled={!!busy || loading} onClick={refresh}><RefreshCw size={17}/>Refresh</button></header>
    <div className="inbox-private"><LockKeyhole size={17}/><span>Only you can see these notes. Moving one to a board shares it with that board's members.</span></div>
    <form className="inbox-composer" onSubmit={add} aria-label="Capture an Inbox item">
      <span className="inbox-compose-icon"><Plus size={22}/></span><div className="inbox-compose-fields"><label className="field"><span>What is on your mind?</span><input ref={titleInput} maxLength={200} required value={draft.title} readOnly={captureRetry} disabled={busy === "capture"} placeholder="An idea, a task, a small reminder..." onChange={e => setDraft({ ...draft, title: e.target.value })}/></label><label className="field"><span>Notes <span className="inbox-optional">Optional</span></span><textarea rows={3} maxLength={10000} value={draft.description} readOnly={captureRetry} disabled={busy === "capture"} placeholder="Keep the useful details here." onChange={e => setDraft({ ...draft, description: e.target.value })}/></label><div className="inbox-compose-actions"><span>{captureRetry ? "Retry keeps the original capture ID." : "Private until you move it to a board."}</span><button className="primary" disabled={!!busy} type="submit"><Plus size={17}/>{busy === "capture" ? "Saving..." : captureRetry ? "Retry capture" : "Capture idea"}</button></div></div>
    </form>
    {error && <p className="inbox-message error" role="alert">{error}</p>}
    {notice && <p className="inbox-message success" role="status"><CheckCircle2 size={18}/>{notice}</p>}
    {moved && <div className="inbox-moved"><CheckCircle2 size={20}/><span><strong>Moved to your board.</strong> The title and notes are now on the new card.</span><button disabled={!!busy} onClick={openMoved}>Open card<ArrowRight size={16}/></button></div>}
    <div className="inbox-items-heading"><h2>Ideas to organize <span>{items.length}</span></h2><p>Drag a handle to reorder, or use the up/down buttons.</p></div>
    {loading && <p role="status">Loading your Inbox...</p>}
    {loadError && <div className="inbox-message error" role="alert"><span>{loadError}</span><button onClick={refresh}>Try again</button></div>}
    {!loading && !loadError && !items.length && <div className="inbox-empty"><InboxIcon size={38}/><h2>A clear place for your next idea.</h2><p>Capture something above. It stays private until you decide where it belongs.</p></div>}
    <ol className="inbox-items" aria-label="Private captured ideas">{items.map((item, index) => <li key={item.id} data-inbox-item-id={item.id} className={`inbox-item ${dragging === item.id ? "is-dragging" : ""} ${target === item.id && dragging !== item.id ? "is-drop-target" : ""}`} onDragOver={event => { if (dragging && !busy) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(item.id); } }} onDrop={event => { event.preventDefault(); if (dragging) reorder(dragging, item.id); setDragging(""); setTarget(""); }}>
      <div className="inbox-item-top"><span className="inbox-item-type"><StickyNote size={15}/>Private idea</span><button className="inbox-drag" type="button" draggable={!busy && !loading} disabled={!!busy || loading} aria-label={`Drag to reorder: ${item.title}`} title="Drag to reorder; up/down buttons also available" onDragStart={event => { if (busy) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-trello-inbox", item.id); setDragging(item.id); }} onDragEnd={() => { setDragging(""); setTarget(""); }}><GripVertical size={19}/></button></div>
      <h3>{item.title}</h3>{item.description && <p className="inbox-item-notes">{item.description}</p>}
      <div className="inbox-item-actions"><button disabled={!!busy} onClick={() => setDialog({ type: "move", item })}><ArrowRight size={16}/>Move to board</button><button className="inbox-icon-button" aria-label={`Edit: ${item.title}`} title="Edit idea" disabled={!!busy} onClick={() => setDialog({ type: "edit", item })}><Pencil size={16}/></button><button className="inbox-icon-button" aria-label={`Delete: ${item.title}`} title="Delete idea" disabled={!!busy} onClick={() => setDialog({ type: "delete", item })}><Trash2 size={16}/></button><span className="inbox-reorder"><button className="inbox-icon-button" aria-label={`Move up: ${item.title}`} title="Move up" disabled={!!busy || loading || index === 0} onClick={() => reorder(item.id, items[index - 1].id)}><ArrowUp size={16}/></button><button className="inbox-icon-button" aria-label={`Move down: ${item.title}`} title="Move down" disabled={!!busy || loading || index === items.length - 1} onClick={() => reorder(item.id, items[index + 1].id)}><ArrowDown size={16}/></button></span></div>
    </li>)}</ol>
    {dialog && <InboxDialog value={dialog} onClose={() => setDialog(null)} onSaved={saved => { setItems(current => current.map(item => item.id === saved.id ? saved : item)); setNotice("Idea updated."); setDialog(null); }} onDeleted={id => { setItems(current => current.filter(item => item.id !== id)); setNotice("Idea deleted."); setDialog(null); requestAnimationFrame(() => titleInput.current?.focus()); }} onMoved={result => { setItems(current => current.filter(item => item.id !== result.itemId)); setMoved(result); setNotice("Idea moved without losing its notes."); setDialog(null); requestAnimationFrame(() => titleInput.current?.focus()); }}/>} 
  </section>;
}

function InboxDialog({ value: { type, item }, onClose, onSaved, onDeleted, onMoved }) {
  const dialog = useRef(null), submitting = useRef(false), moveAttempt = useRef(null);
  const [draft, setDraft] = useState({ title: item.title, description: item.description });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState([]), [boards, setBoards] = useState([]), [lists, setLists] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(""), [boardId, setBoardId] = useState(""), [listId, setListId] = useState("");
  const [loading, setLoading] = useState(type === "move"), [revision, setRevision] = useState(0), [moveRetry, setMoveRetry] = useState(false);
  useEffect(() => { const previous = document.activeElement; dialog.current.showModal(); return () => { if (previous?.isConnected) previous.focus(); }; }, []);
  useEffect(() => {
    if (type !== "move") return;
    let active = true; setLoading(true); setError("");
    api("/workspaces").then(data => { if (active) { setWorkspaces(data.filter(workspace => !workspace.archived)); setWorkspaceId(current => data.some(w => w.id === current) ? current : data[0]?.id || ""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, revision]);
  useEffect(() => {
    if (!workspaceId) return;
    let active = true; setLoading(true); setBoards([]); setBoardId(""); setLists([]); setListId(""); setError("");
    api(`/workspaces/${workspaceId}/boards`).then(data => { if (active) { const open = openInboxBoards(data); setBoards(open); setBoardId(open[0]?.id || ""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, revision]);
  useEffect(() => {
    if (!boardId) return;
    let active = true; setLoading(true); setLists([]); setListId(""); setError("");
    api(`/boards/${boardId}`).then(board => { if (active) { const open = board.closed ? [] : board.lists.filter(list => !list.archived); setLists(open); setListId(open[0]?.id || ""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [boardId, revision]);
  async function submit(event) {
    event.preventDefault(); if (submitting.current) return;
    setError("");
    let body;
    try { if (type === "edit") body = inboxPayload(draft); }
    catch (e) { setError(e.message); return; }
    submitting.current = true; setBusy(true);
    try {
      if (type === "edit") onSaved(await api(`/inbox/${item.id}`, { method: "PATCH", body }));
      else if (type === "delete") { await api(`/inbox/${item.id}`, { method: "DELETE", body: { confirm: true } }); onDeleted(item.id); }
      else {
        moveAttempt.current ||= { listId };
        const result = await api(`/inbox/${item.id}/move`, { method: "POST", body: moveAttempt.current });
        onMoved(result);
      }
    } catch (e) { setError(e.message); if (type === "move") { const uncertain = uncertainInboxWrite(e); setMoveRetry(uncertain); if (!uncertain) moveAttempt.current = null; } }
    finally { submitting.current = false; setBusy(false); }
  }
  const title = type === "edit" ? "Edit your idea" : type === "delete" ? "Delete this idea?" : "Give your idea a home";
  return <dialog ref={dialog} className="inbox-dialog" aria-labelledby="inbox-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><form onSubmit={submit}><header><h2 id="inbox-dialog-title">{title}</h2><button type="button" className="inbox-icon-button" aria-label="Close" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    {type === "edit" ? <><label className="field"><span>Title</span><input autoFocus required maxLength={200} disabled={busy} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label><label className="field"><span>Notes</span><textarea rows={6} maxLength={10000} disabled={busy} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label></> : type === "delete" ? <p>Delete <strong>{item.title}</strong> from your private Inbox? This cannot be undone.</p> : <><p>Your title and notes become one new card. Members of the destination board will be able to see it.</p><div className="inbox-move-fields"><label className="field"><span>Workspace</span><Select value={workspaceId} disabled={busy || moveRetry || loading || !workspaces.length} onChange={e => { setWorkspaceId(e.target.value); setBoardId(""); setLists([]); setListId(""); }}><option value="" disabled>Select a workspace</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></label><label className="field"><span>Board</span><Select value={boardId} disabled={busy || moveRetry || loading || !boards.length} onChange={e => { setBoardId(e.target.value); setLists([]); setListId(""); }}><option value="" disabled>Select an open board</option>{boards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</Select></label><label className="field"><span>List</span><Select value={listId} disabled={busy || moveRetry || loading || !lists.length} onChange={e => setListId(e.target.value)}><option value="" disabled>Select an active list</option>{lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}</Select></label></div>{loading ? <p role="status">Loading destinations...</p> : !listId && !error ? <p className="inbox-muted">No available list here. Create an open board and list, or choose another workspace.</p> : null}{moveRetry && <p className="inbox-muted">Retry checks the same move before creating anything else.</p>}</>}
    {error && <div className="inbox-message error" role="alert"><span>{error}</span>{type === "move" && !moveRetry && <button type="button" onClick={() => setRevision(value => value + 1)}>Reload destinations</button>}</div>}
    <footer><button type="button" autoFocus={type === "delete"} disabled={busy} onClick={onClose}>Cancel</button><button className={type === "delete" ? "danger" : "primary"} disabled={busy || (type === "move" && (loading || (!listId && !moveRetry)))}>{busy ? "Saving..." : type === "edit" ? "Save idea" : type === "delete" ? "Delete idea" : moveRetry ? "Retry move" : "Move to board"}</button></footer>
  </form></dialog>;
}
