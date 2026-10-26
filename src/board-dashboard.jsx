import React, { useEffect, useRef, useState } from "react";
import { CalendarClock, ChartNoAxesCombined, CheckCircle2, Circle, ClipboardList, RefreshCw } from "lucide-react";
import { api } from "./api";
import { localDateKey } from "./my-tasks-data";
import "./board-dashboard.css";

function Breakdown({ title, subtitle, rows, empty }) {
  const largest = Math.max(1, ...rows.map(row => row.total));
  return <section className="board-metrics-panel">
    <h2>{title}</h2><p>{subtitle}</p>
    {!rows.length ? <p className="board-metrics-empty">{empty}</p> : <ul>{rows.map(row => <li key={row.id}>
      <div className="board-metrics-row"><strong>{row.name}</strong><span>{row.total} {row.total === 1 ? "card" : "cards"}</span></div>
      <div className="board-metrics-bar" aria-hidden="true"><span style={{ width: `${row.total / largest * 100}%` }}/></div>
      <p className="board-metrics-row-detail">{row.completed} completed · {row.overdue} overdue</p>
    </li>)}</ul>}
  </section>;
}

export default function BoardDashboard({ boardId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState(localDateKey);
  const serial = useRef(0);
  const live = useRef(false);
  async function refresh() {
    const request = ++serial.current;
    setLoading(true); setError(""); setData(null);
    try {
      const result = await api(`/boards/${boardId}/dashboard?today=${day}`);
      if (live.current && request === serial.current) setData(result);
    } catch (e) { if (live.current && request === serial.current) setError(e.message); }
    finally { if (live.current && request === serial.current) setLoading(false); }
  }
  useEffect(() => {
    live.current = true;
    refresh();
    return () => { live.current = false; serial.current++; };
  }, [boardId, day]);
  useEffect(() => { const timer = setInterval(() => setDay(localDateKey()), 60000); return () => clearInterval(timer); }, []);
  const metrics = data && [
    { label: "Active cards", value: data.total, Icon: ClipboardList },
    { label: "Incomplete", value: data.incomplete, Icon: Circle },
    { label: "Completed", value: data.completed, Icon: CheckCircle2 },
    { label: "Overdue", value: data.overdue, Icon: CalendarClock },
    { label: "No due date", value: data.undated, Icon: CalendarClock },
  ];
  return <section className="board-metrics" aria-labelledby="board-metrics-title" aria-busy={loading}>
    <header className="board-metrics-heading"><div><span className="eyebrow">A CLEARER PICTURE</span><h2 id="board-metrics-title"><ChartNoAxesCombined size={24} aria-hidden="true"/>Board dashboard</h2><p>Active cards across this board. Archived cards and lists are excluded.</p></div><button onClick={refresh} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>Refresh</button></header>
    {loading && <p className="board-metrics-loading" role="status">Loading board counts...</p>}
    {error && <div className="board-metrics-error" role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <>
      <div className="board-metrics-tiles">{metrics.map(({ label, value, Icon }) => <div className="board-metric" key={label}><Icon size={20} aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="board-metrics-completion"><div><strong>Completion</strong><span>{data.completed} of {data.total} cards complete</span></div><progress value={data.completed} max={Math.max(1, data.total)} aria-label={`${data.completed} of ${data.total} cards complete`}/></div>
      {!data.total && <p className="board-metrics-empty">No active cards yet. Add cards to your board to start seeing progress here.</p>}
      <div className="board-metrics-columns">
        <Breakdown title="Cards by list" subtitle="Current active lists, including empty lists." rows={data.byList.map(row => ({ ...row, name: row.title }))} empty="No active lists yet."/>
        <Breakdown title="Cards by assignee" subtitle="A card with multiple assignees counts once for each person." rows={[...data.byAssignee.map(row => ({ ...row, name: row.displayName })), { ...data.unassigned, id: "unassigned", name: "Unassigned" }]} empty="No assigned cards yet."/>
      </div>
      <footer className="board-metrics-scope"><strong>What these numbers include</strong><p>All active cards on this board, independent of the board's search or saved filters. "Overdue" means incomplete with a due calendar date before {data.asOf}, your local day at refresh. Completed cards never count as overdue. "No due date" includes both completed and incomplete cards.</p><p>Assignee counts show current workspace members. "Unassigned" means no current member is assigned; person totals can overlap. Refresh for the latest changes.</p></footer>
    </>}
  </section>;
}
