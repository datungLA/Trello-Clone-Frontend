import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ClipboardList, RefreshCw, Search, SquareKanban } from "lucide-react";
import { api } from "./api";
import { Select } from "./select";
import { groupTasks, localDateKey, taskGroups } from "./my-tasks-data";
import "./my-tasks.css";

function dateLabel(value) {
  if (!value) return "No due date";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MyTasks({ onOpenCard }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [boardId, setBoardId] = useState("");
  const [busy, setBusy] = useState("");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [today, setToday] = useState(localDateKey);
  const live = useRef(false);
  const request = useRef(0);
  const writing = useRef(false);
  async function refresh() {
    const serial = ++request.current;
    setLoading(true); setError(""); setNotice("");
    try {
      const data = await api("/me/tasks");
      if (live.current && serial === request.current) setTasks(data);
    } catch (e) {
      if (live.current && serial === request.current) { setTasks([]); setError(`${e.message} Refresh to try again.`); }
    } finally { if (live.current && serial === request.current) setLoading(false); }
  }
  useEffect(() => {
    live.current = true;
    refresh();
    const timer = setInterval(() => setToday(localDateKey()), 60000);
    return () => { live.current = false; request.current++; clearInterval(timer); };
  }, []);
  async function toggle(task) {
    if (writing.current) return;
    writing.current = true; setBusy(task.id); setError(""); setNotice("");
    try {
      await api(`/cards/${task.id}`, { method: "PATCH", body: { completed: !task.completed } });
      const data = await api("/me/tasks");
      if (live.current) { setTasks(data); setNotice(task.completed ? "Task marked incomplete." : "Task completed."); }
    } catch (e) {
      if (live.current) { setError(`${e.message} Your task state could not be confirmed. Refresh before retrying.`); }
    } finally { writing.current = false; if (live.current) setBusy(""); }
  }
  async function open(task) {
    if (opening) return;
    setOpening(task.id); setError("");
    try { await onOpenCard(task); }
    catch (e) { if (live.current) setError(e.message); }
    finally { if (live.current) setOpening(""); }
  }
  const groups = groupTasks(tasks, { query, boardId, today });
  const boards = [...new Map(tasks.map(task => [task.boardId, { id: task.boardId, title: task.boardTitle, workspace: task.workspaceName }])).values()].sort((a, b) => a.title.localeCompare(b.title));
  const active = tasks.filter(task => !task.completed).length;
  const shown = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);
  return <div className="dashboard my-tasks">
    <header className="dashboard-heading">
      <div><span className="eyebrow">ACROSS ALL YOUR WORKSPACES</span><h1>My tasks.</h1><p>Your assigned cards, with a clear next step.</p></div>
      <button onClick={refresh} disabled={loading || !!busy || !!opening}><RefreshCw size={17} aria-hidden="true"/>Refresh</button>
    </header>
    <div className="my-tasks-summary"><span className="my-tasks-summary-icon"><ClipboardList size={25} aria-hidden="true"/></span><div><strong>{active} open {active === 1 ? "task" : "tasks"}</strong><p>Only active cards on boards you can access.</p></div></div>
    <div className="my-tasks-filters">
      <label className="search"><Search size={18} aria-hidden="true"/><input aria-label="Search my tasks" placeholder="Find a task, board, or workspace" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <label className="my-tasks-board-filter"><span>Board</span><Select value={boardId} onChange={e => setBoardId(e.target.value)}><option value="">All boards</option>{boards.map(board => <option key={board.id} value={board.id}>{board.title} · {board.workspace}</option>)}</Select></label>
      {(query || boardId) && <button onClick={() => { setQuery(""); setBoardId(""); }}>Clear filters</button>}
    </div>
    {error && <div className="my-tasks-error" role="alert">{error}</div>}
    <p className="my-tasks-status" role="status" aria-live="polite">{loading ? "Loading your assigned tasks..." : notice || `${shown} ${shown === 1 ? "task" : "tasks"} shown. Dates use your local calendar day.`}</p>
    {!loading && !shown && <section className="my-tasks-empty"><ClipboardList size={36} aria-hidden="true"/><h2>{tasks.length ? "No matching tasks." : "A little breathing room."}</h2><p>{tasks.length ? "Try another board or clear your search." : "Assign yourself to a card on any board. It will appear here, ready for your next step."}</p></section>}
    {!loading && taskGroups.map(group => groups[group.id].length > 0 && <section className={`my-tasks-group my-tasks-${group.id}`} key={group.id} aria-labelledby={`tasks-${group.id}`}>
      <div className="my-tasks-group-heading"><h2 id={`tasks-${group.id}`}>{group.label}<span>{groups[group.id].length}</span></h2><p>{group.detail}</p></div>
      <ul>{groups[group.id].map(task => <li key={task.id} className={task.completed ? "is-complete" : ""}>
        <button className="my-task-toggle" aria-label={`${task.completed ? "Mark incomplete" : "Complete"}: ${task.title}`} aria-pressed={task.completed} disabled={!!busy || !!opening} onClick={() => toggle(task)}><span>{task.completed && <Check size={16} aria-hidden="true"/>}</span></button>
        <button className="my-task-open" disabled={!!opening || !!busy} onClick={() => open(task)}><strong>{task.title}</strong><span><SquareKanban size={14} aria-hidden="true"/>{task.workspaceName} / {task.boardTitle} / {task.listTitle}</span></button>
        <span className="my-task-due"><CalendarDays size={15} aria-hidden="true"/>{dateLabel(task.dueDate)}</span>
      </li>)}</ul>
    </section>)}
  </div>;
}
