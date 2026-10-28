import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GripVertical, LockKeyhole, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "./api";
import { plannerBlocksForDay, plannerCapture, plannerDayKey, plannerDraft, plannerOverlap, plannerPayload, plannerPayloadMatches, plannerRange, reschedulePlannerBlock, shiftPlannerDay } from "./planner-data";
import "./planner.css";

const dayLabel = (day, options = { weekday: "long", month: "short", day: "numeric" }) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, options);
const timeLabel = value => new Date(value).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Device local time";
const uncertain = error => !error.status || error.status >= 500;
const query = range => `/planner?${new URLSearchParams({ from: range.from, to: range.to })}`;

export default function Planner() {
  const [day, setDay] = useState(() => plannerDayKey(new Date()));
  const [mode, setMode] = useState(() => matchMedia("(max-width: 599px)").matches ? "day" : "week");
  const [blocks, setBlocks] = useState([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null), [dragging, setDragging] = useState(""), [target, setTarget] = useState("");
  const [pendingMove, setPendingMove] = useState(null), [revision, setRevision] = useState(0);
  const live = useRef(false), request = useRef(0), writing = useRef(false);
  const range = plannerRange(day), rangeKey = range.first;

  useEffect(() => { live.current = true; return () => { live.current = false; request.current++; }; }, []);
  useEffect(() => {
    const current = ++request.current; setLoading(true); setLoadError("");
    api(query(range)).then(data => { if (live.current && request.current === current) setBlocks(data); }).catch(e => { if (live.current && request.current === current) setLoadError(e.message); }).finally(() => { if (live.current && request.current === current) setLoading(false); });
  }, [rangeKey, revision]);
  async function loadCurrent() {
    const data = await api(query(range));
    if (live.current) setBlocks(data);
    return data;
  }
  function navigate(next) { if (!busy && !pendingMove) { setDay(next); setError(""); setNotice(""); setPendingMove(null); } }
  function show(item = null, type = "edit") { setError(""); setDialog({ item, type: item ? type : "create" }); }
  function saved(block) { setDialog(null); setDay(plannerDayKey(block.startsAt)); setRevision(value => value + 1); setNotice("Focus block saved. Card due dates are unchanged."); }
  async function move(item, destination, retry = false) {
    if (writing.current || loading) return;
    let payload;
    try { payload = retry ? pendingMove.payload : reschedulePlannerBlock(item, destination); }
    catch (e) { setError(e.message); return; }
    if (!payload) return;
    writing.current = true; setBusy(true); setError(""); setNotice("");
    try {
      let result;
      if (retry) {
        const latest = (await loadCurrent()).find(block => block.id === item.id);
        if (plannerPayloadMatches(latest, payload)) result = latest;
        else if (!latest || latest.revision !== payload.revision) throw Object.assign(new Error("This block changed elsewhere or was removed. Your proposed move remains below; open Edit to review the current block."), { status: 409 });
      }
      result ||= await api(`/planner/${item.id}`, { method: "PATCH", body: payload });
      if (live.current) { setBlocks(current => current.map(block => block.id === result.id ? result : block)); setPendingMove(null); setNotice(`Focus block moved to ${dayLabel(destination)}. Its duration is unchanged.`); }
    } catch (e) {
      if (live.current) { setPendingMove({ item, payload, destination }); setError(`${e.message} The move is not confirmed. Refresh is required before another attempt.`); if (e.status === 409) await loadCurrent().catch(() => {}); }
    } finally { writing.current = false; if (live.current) setBusy(false); }
  }
  const displayed = mode === "day" ? [day] : range.days;
  return <section className="planner-page" aria-labelledby="planner-title">
    <header className="planner-heading"><div><span className="eyebrow">MAKE SPACE FOR FOCUS</span><h1 id="planner-title">Planner</h1><p>Your own time to think, build and follow through.</p></div><button className="primary" disabled={busy} onClick={() => show()}><Plus size={18}/>New focus block</button></header>
    <div className="planner-private"><LockKeyhole size={18}/><p>Only you can see these focus blocks. Overlaps are allowed. They do not change card due dates or reserve time on a shared calendar.</p></div>
    <div className="planner-toolbar"><div className="planner-date-controls"><button className="planner-icon" aria-label={mode === "week" ? "Previous week" : "Previous day"} disabled={busy || !!pendingMove} onClick={() => navigate(shiftPlannerDay(day, mode === "week" ? -7 : -1))}><ChevronLeft size={20}/></button><button disabled={busy || !!pendingMove} onClick={() => navigate(plannerDayKey(new Date()))}>Today</button><button className="planner-icon" aria-label={mode === "week" ? "Next week" : "Next day"} disabled={busy || !!pendingMove} onClick={() => navigate(shiftPlannerDay(day, mode === "week" ? 7 : 1))}><ChevronRight size={20}/></button></div><strong className="planner-date-label">{mode === "day" ? dayLabel(day) : `${dayLabel(range.days[0], { month: "short", day: "numeric" })} - ${dayLabel(range.days[6], { month: "short", day: "numeric", year: "numeric" })}`}</strong><div className="planner-view-controls" role="group" aria-label="Planner layout"><button aria-pressed={mode === "day"} onClick={() => setMode("day")}>Day</button><button aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button></div><button disabled={busy || loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16}/>Refresh</button></div>
    <p className="planner-timezone"><Clock3 size={15}/>{zone()}<span>Device local time</span></p>
    <div className="planner-week-strip" role="group" aria-label="Choose a day or drop a focus block here">{range.days.map(date => <button key={date} data-planner-day={date} aria-pressed={day === date} disabled={busy || !!pendingMove} className={target === date ? "is-drop-target" : ""} onClick={() => navigate(date)} onDragOver={event => { if (dragging && !busy && !pendingMove) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(date); } }} onDragLeave={() => setTarget("")} onDrop={event => { event.preventDefault(); const item = blocks.find(block => block.id === dragging); setDragging(""); setTarget(""); if (item) move(item, date); }}><span>{dayLabel(date, { weekday: "short" })}</span><strong>{dayLabel(date, { day: "numeric" })}</strong><small>{plannerBlocksForDay(blocks, date).length} blocks</small></button>)}</div>
    {error && <p className="planner-message error" role="alert">{error}</p>}{notice && <p className="planner-message success" role="status"><CheckCircle2 size={18}/>{notice}</p>}
    {pendingMove && <div className="planner-pending-move"><p><strong>Proposed reschedule</strong>{timeLabel(pendingMove.payload.startsAt)} - {timeLabel(pendingMove.payload.endsAt)}. The original block will never be duplicated.</p><button disabled={busy} onClick={() => move(pendingMove.item, pendingMove.destination, true)}>Check and retry move</button><button disabled={busy} onClick={() => {setPendingMove(null);setError("");}}>Dismiss proposed move</button></div>}
    {loading && <p role="status">Loading your focus blocks...</p>}{loadError && <div className="planner-message error" role="alert"><span>{loadError}</span><button onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
    {!loading && !loadError && <><p className="planner-drag-help">Drag a block's handle to another day, or choose Edit to reschedule with a keyboard or touch.</p><div className={`planner-agenda planner-agenda-${mode}`}>{displayed.map(date => {
      const items = plannerBlocksForDay(blocks, date);
      return <section key={date} className={`planner-day ${target === date ? "is-drop-target" : ""}`} data-planner-day-region={date} aria-label={dayLabel(date)} onDragOver={event => { if (dragging && !busy && !pendingMove) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(date); } }} onDrop={event => { event.preventDefault(); const item = blocks.find(block => block.id === dragging); setDragging(""); setTarget(""); if (item) move(item, date); }}><header><h2>{dayLabel(date)}</h2><button className="planner-icon" aria-label={`Add focus block on ${dayLabel(date)}`} disabled={busy} onClick={() => { setDay(date); show(); }}><Plus size={19}/></button></header>{!items.length && <div className="planner-empty"><CalendarDays size={24}/><p>A little room to focus.</p><button disabled={busy} onClick={() => { setDay(date); show(); }}>Plan a block</button></div>}<ol className="planner-blocks">{items.map(block => <li key={block.id} className={`planner-block ${dragging === block.id ? "is-dragging" : ""}`} data-planner-block-id={block.id}><div className="planner-block-top"><span><Clock3 size={14}/>Focus time</span><button className="planner-icon planner-drag" draggable={!busy && !pendingMove} disabled={busy || !!pendingMove} aria-label={`Drag to reschedule: ${block.title}`} title="Drag to a day; Edit also supports rescheduling" onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-trello-focus-block", block.id); setDragging(block.id); }} onDragEnd={() => {setDragging("");setTarget("");}}><GripVertical size={18}/></button></div><h3>{block.title}</h3><p className="planner-block-time">{timeLabel(block.startsAt)} - {timeLabel(block.endsAt)} · {Math.round((Date.parse(block.endsAt) - Date.parse(block.startsAt)) / 60000)} min</p>{plannerOverlap(block, blocks) && <span className="planner-overlap">Overlaps another block</span>}{block.notes && <p className="planner-block-notes">{block.notes}</p>}<div className="planner-block-actions"><button disabled={busy} onClick={() => show(block)}><Pencil size={16}/>Edit / reschedule</button><button className="planner-icon" aria-label={`Delete focus block: ${block.title}`} disabled={busy} onClick={() => show(block, "delete")}><Trash2 size={17}/></button></div></li>)}</ol></section>;
    })}</div></>}
    {dialog && <PlannerDialog value={dialog} day={day} onClose={() => {setDialog(null);setRevision(value => value + 1);}} onSaved={saved} onDeleted={() => {setDialog(null);setRevision(value => value + 1);setNotice("Focus block deleted.");}} onReload={async block => (await loadCurrent()).find(item => item.id === block.id)}/>}
  </section>;
}

function PlannerDialog({ value: { item, type }, day, onClose, onSaved, onDeleted, onReload }) {
  const ref = useRef(null), writing = useRef(false), pending = useRef(null);
  const [current, setCurrent] = useState(item), [draft, setDraft] = useState(() => plannerDraft(item, day));
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(false), [conflict, setConflict] = useState(false);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => { if (previous?.isConnected) previous.focus(); }; }, []);
  async function submit(event) {
    event.preventDefault(); if (writing.current || conflict) return;
    setError("");
    let body;
    try { body = type === "create" ? (pending.current = plannerCapture(pending.current, draft, () => crypto.randomUUID())) : type === "delete" ? { confirm: true, revision: current.revision } : { ...plannerPayload(draft, current), revision: current.revision }; }
    catch (e) { setError(e.message); return; }
    writing.current = true; setBusy(true);
    try { if (type === "delete") { await api(`/planner/${current.id}`, { method: "DELETE", body }); onDeleted(); } else onSaved(await api(type === "create" ? "/planner" : `/planner/${current.id}`, { method: type === "create" ? "POST" : "PATCH", body })); }
    catch (e) { setError(`${e.message}${uncertain(e) ? " The save is not confirmed; your draft is preserved." : ""}`); if (type === "create") { setRetry(uncertain(e)); if (!uncertain(e)) pending.current = null; } else if (e.status === 409) setConflict(true); }
    finally { writing.current = false; setBusy(false); }
  }
  async function reloadLatest() {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError("");
    try {
      const latest = await onReload(current);
      if (!latest) throw new Error("This block moved outside the current week or was removed. Your draft is still here to copy. Close and refresh the planner.");
      setCurrent(latest); setDraft(plannerDraft(latest)); setConflict(false); setRetry(false);
    } catch (e) { setError(e.message); } finally { writing.current = false; setBusy(false); }
  }
  const label = type === "create" ? "Plan a focus block" : type === "delete" ? "Delete this focus block?" : "Edit focus block";
  return <dialog ref={ref} className="planner-dialog" aria-labelledby="planner-dialog-title" onCancel={event => {event.preventDefault();if(!busy)onClose();}}><form onSubmit={submit}><header><h2 id="planner-dialog-title">{label}</h2><button className="planner-icon" type="button" aria-label="Close focus block dialog" disabled={busy} onClick={onClose}><X size={20}/></button></header>{type === "delete" ? <p>Delete <strong>{current.title}</strong> scheduled for {timeLabel(current.startsAt)}? This affects only your personal planner and cannot be undone.</p> : <><p className="planner-dialog-zone"><Clock3 size={16}/>{zone()}. Times use your device's timezone.</p><label className="field"><span>Title</span><input name="title" autoFocus required maxLength={200} disabled={busy} readOnly={retry || conflict} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label><div className="planner-time-fields"><label className="field"><span>Starts</span><input type="datetime-local" name="startsAt" required disabled={busy} readOnly={retry || conflict} value={draft.startsLocal} onChange={event => setDraft({ ...draft, startsLocal: event.target.value })}/></label><label className="field"><span>Ends</span><input type="datetime-local" name="endsAt" required disabled={busy} readOnly={retry || conflict} value={draft.endsLocal} onChange={event => setDraft({ ...draft, endsLocal: event.target.value })}/></label></div><label className="field"><span>Notes <small>Optional</small></span><textarea name="notes" rows={4} maxLength={10000} disabled={busy} readOnly={retry || conflict} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })}/></label><p className="planner-muted">Blocks can overlap and last from 1 minute to 24 hours. Nonexistent daylight-saving times are rejected; newly chosen repeated clock times use the first occurrence.</p></>}{error && <p className="planner-message error" role="alert">{error}</p>}{conflict && <div className="planner-conflict"><p>Your draft is preserved. Reloading replaces it with the latest block, so copy anything you want to keep first.</p><button type="button" disabled={busy} onClick={reloadLatest}>Reload latest version</button></div>}{retry && <p className="planner-muted">Retry uses the same capture ID and exact details to avoid duplicates.</p>}<footer><button type="button" autoFocus={type === "delete"} disabled={busy} onClick={onClose}>Cancel</button><button className={type === "delete" ? "danger" : "primary"} disabled={busy || conflict}>{busy ? "Saving..." : type === "delete" ? "Delete block" : retry ? "Retry save" : "Save focus block"}</button></footer></form></dialog>;
}
