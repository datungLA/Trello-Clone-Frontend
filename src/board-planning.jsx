import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, GanttChart, RefreshCw, Search, Table2 } from "lucide-react";
import { Select } from "./select";
import { localDateKey } from "./my-tasks-data";
import { shiftMonth } from "./board-calendar-data";
import { planningCards, timelineRange } from "./board-planning-data";

const columns = [{ key: "title", label: "Card" }, { key: "listTitle", label: "List" }, { key: "assignees", label: "Assignees" }, { key: "startDay", label: "Start date" }, { key: "dueDay", label: "Due date" }, { key: "completed", label: "Status" }];
function shortDate(day) { return day ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date"; }

export default function BoardPlanning({ board, members, mode, onOpenCard, onRefresh }) {
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [sort, setSort] = useState("title");
  const [direction, setDirection] = useState("asc");
  const [month, setMonth] = useState(() => localDateKey().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const live = useRef(false);
  const refreshing = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const cards = planningCards(board, members, { query, memberId, sort, direction });
  const undated = cards.filter(card => !card.startDay && !card.dueDay).length;
  const dated = cards.map(card => ({ ...card, range: timelineRange(card, month) })).filter(card => card.range);
  const days = new Date(`${month}-15T12:00:00`);
  const dayCount = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const monthLabel = days.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true; setBusy(true); setError(""); setNotice("");
    try { await onRefresh(); if (live.current) setNotice("Board view refreshed."); }
    catch (e) { if (live.current) setError(e.message); }
    finally { refreshing.current = false; if (live.current) setBusy(false); }
  }
  function changeSort(key) { if (sort === key) setDirection(direction === "asc" ? "desc" : "asc"); else { setSort(key); setDirection("asc"); } }
  const Icon = mode === "table" ? Table2 : GanttChart;
  return <section className="board-planning" aria-label={`Board ${mode}`} aria-busy={busy}>
    <header className="board-planning-heading"><div><span className="eyebrow">ONE BOARD, ANOTHER PERSPECTIVE</span><h2><Icon size={24} aria-hidden="true"/>{mode === "table" ? "Card table" : "Board timeline"}</h2><p>The same active cards and dates as your board. Open a card to edit its details{mode === "timeline" ? " or dates" : ""}.</p></div><button onClick={refresh} disabled={busy}><RefreshCw size={16} aria-hidden="true"/>Refresh</button></header>
    <div className="board-planning-filters"><label className="search"><Search size={17} aria-hidden="true"/><input aria-label={`Search ${mode} cards`} placeholder="Find a card, list, or assignee" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="planning-member"><span>Member</span><Select value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">All members</option>{members.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</Select></label>{(query || memberId) && <button onClick={() => { setQuery(""); setMemberId(""); }}>Clear filters</button>}</div>
    <p className="board-planning-scope">{cards.length} {cards.length === 1 ? "card" : "cards"} match. Archived cards and lists are excluded. {board.closed ? "This board is closed and read-only." : "Changes in card details update the original card."}</p>
    {error && <div className="board-planning-error" role="alert">{error}</div>}<p className="board-planning-status" role="status">{busy ? "Refreshing board view..." : notice}</p>
    {mode === "table" ? <div className="planning-scroll" role="region" aria-label="Sortable card table" tabIndex={0}><table className="planning-table"><caption>Active cards. Select a column heading to sort; open a card to edit.</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => changeSort(column.key)}>{column.label}{sort === column.key && (direction === "asc" ? <ArrowUp size={14} aria-hidden="true"/> : <ArrowDown size={14} aria-hidden="true"/>)}</button></th>)}</tr></thead><tbody>{cards.map(card => <tr key={card.id}><th scope="row"><button className="planning-card-link" disabled={busy} onClick={() => onOpenCard(card)}>{card.title}</button></th><td>{card.listTitle}</td><td>{card.assignees || "Unassigned"}</td><td>{shortDate(card.startDay)}</td><td>{shortDate(card.dueDay)}</td><td><span className="planning-status-label">{card.completed && <Check size={14} aria-hidden="true"/>}{card.completed ? "Complete" : "Incomplete"}</span></td></tr>)}</tbody></table>{!cards.length && <p className="board-planning-empty">No matching cards. Clear your filters or add cards in the Board view.</p>}</div> : <>
      <div className="planning-timeline-month"><button aria-label="Previous month" disabled={busy} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} aria-hidden="true"/></button><h3 aria-live="polite">{monthLabel}</h3><button aria-label="Next month" disabled={busy} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} aria-hidden="true"/></button><button disabled={busy} onClick={() => setMonth(localDateKey().slice(0, 7))}>Today</button></div>
      <p className="board-planning-scope">{dated.length} cards intersect this month. Bars show start through due date, inclusive; a start-only or due-only card appears as a single-day marker. Dates use the stored UTC calendar day. Open any card to reschedule with its date fields.</p>
      <div className="planning-scroll" role="region" aria-label={`${monthLabel} card timeline; scroll horizontally for dates`} tabIndex={0}><div className="planning-timeline" style={{ "--timeline-days": dayCount }}><div className="planning-timeline-header"><strong>Card / list</strong><div className="planning-timeline-days" aria-hidden="true">{Array.from({ length: dayCount }, (_, i) => <span key={i}>{i + 1}</span>)}</div></div>{dated.map(card => <div className="planning-timeline-row" key={card.id}><button className="planning-timeline-label" disabled={busy} onClick={() => onOpenCard(card)}><strong>{card.completed && <Check size={13} aria-label="Completed"/>}{card.title}</strong><small>{card.listTitle}</small></button><div className="planning-timeline-track"><button className={`planning-timeline-bar ${card.completed ? "complete" : ""} ${card.range.marker ? "marker" : ""}`} style={{ left: `${card.range.left}%`, width: `${card.range.width}%` }} disabled={busy} onClick={() => onOpenCard(card)} aria-label={`${card.title}: ${shortDate(card.range.start)} through ${shortDate(card.range.end)}. Open card to edit dates.`} title={`${card.title}: ${shortDate(card.range.start)} - ${shortDate(card.range.end)}`}><span>{card.range.clippedStart ? "← " : ""}{card.title}{card.range.clippedEnd ? " →" : ""}</span></button></div></div>)}</div>{!dated.length && <p className="board-planning-empty">No dated cards match this month. Try another month, clear filters, or add dates in card details.</p>}</div>
      <footer className="planning-undated"><strong>{undated} matching {undated === 1 ? "card has" : "cards have"} no dates</strong><p>Undated cards remain available in Table or Board view. Open their details to add a start or due date.</p></footer>
    </>}
  </section>;
}
