import { businessDay } from "./board-calendar-data.js";

export function planningCards(board, members, { query = "", memberId = "", sort = "title", direction = "asc" } = {}) {
  const names = new Map(members.map(member => [member.id, member.displayName]));
  const needle = query.trim().toLocaleLowerCase();
  const cards = board.lists.filter(list => !list.archived).flatMap(list => list.cards.filter(card => !card.archived).map(card => ({ ...card, listTitle: list.title, assignees: (card.assigneeIds || []).filter(id => names.has(id)).map(id => names.get(id)).sort().join(", "), startDay: businessDay(card.startDate), dueDay: businessDay(card.dueDate) })));
  const filtered = cards.filter(card => (!memberId || card.assigneeIds?.includes(memberId)) && (!needle || [card.title, card.listTitle, card.assignees].join(" ").toLocaleLowerCase().includes(needle)));
  return filtered.sort((a, b) => {
    const left = sort === "completed" ? Number(a.completed) : a[sort] || "";
    const right = sort === "completed" ? Number(b.completed) : b[sort] || "";
    if (["dueDay", "startDay"].includes(sort) && (!left || !right)) return !left && !right ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id) : !left ? 1 : -1;
    const order = typeof left === "number" ? left - right : left.localeCompare(right);
    return order * (direction === "desc" ? -1 : 1) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

export function timelineRange(card, month) {
  const start = businessDay(card.startDate || card.dueDate);
  const end = businessDay(card.dueDate || card.startDate);
  if (!start || !end || end < start) return null;
  const [year, number] = month.split("-").map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const last = `${month}-${String(days).padStart(2, "0")}`;
  if (end < first || start > last) return null;
  const from = start < first ? 1 : Number(start.slice(8, 10));
  const to = end > last ? days : Number(end.slice(8, 10));
  return { left: (from - 1) / days * 100, width: (to - from + 1) / days * 100, days, start, end, clippedStart: start < first, clippedEnd: end > last, marker: start === end };
}
