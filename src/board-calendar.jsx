import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, GripVertical, RefreshCw, X } from "lucide-react";
import { api } from "./api";
import { Select } from "./select";
import { localDateKey } from "./my-tasks-data";
import { businessDay, calendarCards, monthCells, shiftMonth } from "./board-calendar-data";
import "./board-calendar.css";

function longDay(value) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }

export default function BoardCalendar({ board, members, onOpenCard, onRefresh }) {
  const [today, setToday] = useState(localDateKey);
  const [month, setMonth] = useState(() => localDateKey().slice(0, 7));
  const [memberId, setMemberId] = useState("");
  const [editing, setEditing] = useState(null);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragged, setDragged] = useState("");
  const [target, setTarget] = useState("");
  const live = useRef(false);
  const writing = useRef(false);
  const dateInput = useRef(null);
  useEffect(() => { live.current = true; const timer = setInterval(() => setToday(localDateKey()), 60000); return () => { live.current = false; clearInterval(timer); }; }, []);
  useEffect(() => { if (editing) dateInput.current?.focus(); }, [editing?.id]);
  const cards = calendarCards(board, memberId);
  const undated = cards.filter(card => !card.calendarDate).length;
  const cells = monthCells(month);
  const visibleCount = cards.filter(card => card.calendarDate.startsWith(month)).length;
  const disabled = busy || board.closed;
  function choose(card, date = businessDay(card.dueDate)) {
    setEditing(card); setDue(date); setError(""); setNotice("");
  }
  async function reschedule(card, date) {
    if (writing.current || board.closed) return;
    writing.current = true; setBusy(true); setError(""); setNotice(""); setEditing(card); setDue(date);
    try {
      await api(`/cards/${card.id}`, { method: "PATCH", body: { dueDate: date } });
      await onRefresh();
      if (live.current) { setEditing(null); setNotice(`Due date saved for ${card.title}: ${longDay(date)}.`); }
    } catch (e) { if (live.current) setError(`${e.message} Your chosen date is preserved. Choose a valid date or refresh before retrying.`); }
    finally { writing.current = false; if (live.current) { setBusy(false); setDragged(""); setTarget(""); } }
  }
  async function refresh() {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError("");
    try { await onRefresh(); if (live.current) setNotice("Calendar refreshed."); }
    catch (e) { if (live.current) setError(e.message); }
    finally { writing.current = false; if (live.current) setBusy(false); }
  }
  function endDrag() { setDragged(""); setTarget(""); }
  function drop(event, date) {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-trello-calendar-card");
    const card = cards.find(card => card.id === id);
    endDrag();
    if (card && !disabled) reschedule(card, date);
  }
  const monthLabel = new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return <section className="board-calendar" aria-label="Board calendar" aria-busy={busy}>
    <header className="board-calendar-heading"><div><span className="eyebrow">MAKE ROOM FOR WHAT'S NEXT</span><h2><CalendarDays size={24} aria-hidden="true"/>Board calendar</h2><p>Cards appear on their due date, or start date when no due date is set. Dates use the stored UTC calendar day.</p></div><button onClick={refresh} disabled={busy}><RefreshCw size={16} aria-hidden="true"/>Refresh</button></header>
    <div className="board-calendar-controls"><div className="board-calendar-month"><button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} disabled={busy}><ChevronLeft size={18} aria-hidden="true"/></button><h3 aria-live="polite">{monthLabel}</h3><button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} disabled={busy}><ChevronRight size={18} aria-hidden="true"/></button><button onClick={() => setMonth(today.slice(0, 7))} disabled={busy}>Today</button></div><label className="board-calendar-member"><span>Member</span><Select value={memberId} onChange={e => setMemberId(e.target.value)} disabled={busy}><option value="">All members</option>{members.map(member => <option key={member.userId || member.id} value={member.userId || member.id}>{member.displayName}</option>)}</Select></label></div>
    <p className="board-calendar-hint">{visibleCount} {visibleCount === 1 ? "card" : "cards"} this month. {board.closed ? "This closed board is read-only." : "Drag a card's handle onto a day to change its due date, or use Reschedule for keyboard and touch."} Archived cards and lists are excluded.</p>
    {error && <div className="board-calendar-error" role="alert">{error}</div>}
    <p className="board-calendar-status" role="status">{busy ? "Saving or refreshing calendar..." : notice}</p>
    {editing && <form className="board-calendar-editor" onSubmit={event => { event.preventDefault(); reschedule(editing, due); }}><div><strong>Reschedule: {editing.title}</strong><p>Changes this card's due date. Its start date stays unchanged.</p></div><label>Due date<input ref={dateInput} type="date" value={due} required min={businessDay(editing.startDate) || undefined} onChange={e => setDue(e.target.value)} disabled={disabled}/></label><button className="primary" disabled={disabled || !due}>Save date</button><button type="button" aria-label="Cancel rescheduling" onClick={() => { setEditing(null); setError(""); }} disabled={busy}><X size={18} aria-hidden="true"/></button></form>}
    <div className="board-calendar-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div>
    <div className="board-calendar-grid">{cells.map(cell => {
      const dayCards = cards.filter(card => card.calendarDate === cell.key);
      return <section key={cell.key} aria-label={longDay(cell.key)} className={`board-calendar-day ${cell.current ? "" : "outside-month"} ${cell.key === today ? "is-today" : ""} ${target === cell.key ? "is-drop-target" : ""} ${dayCards.length ? "has-cards" : ""}`} onDragOver={event => { if (dragged && !disabled) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(cell.key); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTarget(""); }} onDrop={event => drop(event, cell.key)}><h4><time dateTime={cell.key}><span className="calendar-mobile-date">{longDay(cell.key)}</span><span className="calendar-grid-date">{cell.day}</span></time></h4><ul>{dayCards.map(card => <li key={card.id} className={`${dragged === card.id ? "calendar-drag-source" : ""} ${card.completed ? "is-complete" : ""}`}>
        <div className="board-calendar-card-top"><button className="calendar-drag-handle" draggable={!disabled} onDragStart={event => { if (disabled) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-trello-calendar-card", card.id); event.dataTransfer.effectAllowed = "move"; setDragged(card.id); setError(""); }} onDragEnd={endDrag} onClick={() => choose(card)} aria-label={`Reschedule or drag: ${card.title}`} disabled={disabled}><GripVertical size={17} aria-hidden="true"/></button><button className="calendar-card-title" onClick={() => onOpenCard(card)} disabled={busy}>{card.completed && <Check size={14} aria-label="Completed"/>}{card.title}</button></div><span className="calendar-card-list">{card.listTitle} · {card.startOnly ? "Start date" : "Due date"}</span><button className="calendar-reschedule" disabled={disabled} onClick={() => choose(card)}>Reschedule</button>
      </li>)}</ul></section>;
    })}</div>
    {!visibleCount && <p className="board-calendar-empty">No dated cards this month. Navigate to another month or add dates in card details.</p>}
    <footer className="board-calendar-undated"><strong>{undated} {undated === 1 ? "card without dates" : "cards without dates"}</strong><p>Open a card from the Board view to add a start or due date. A card with only a start date will receive a due date when rescheduled here.</p></footer>
  </section>;
}
