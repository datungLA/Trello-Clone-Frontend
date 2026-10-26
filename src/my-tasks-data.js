export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const taskGroups = [
  { id: "overdue", label: "Overdue", detail: "A little attention goes a long way." },
  { id: "today", label: "Due today", detail: "Your focus for today." },
  { id: "upcoming", label: "Upcoming", detail: "A clear view of what's next." },
  { id: "undated", label: "No due date", detail: "Ready when you are." },
  { id: "completed", label: "Completed", detail: "Progress worth keeping in view." },
];

export function groupTasks(tasks, { query = "", boardId = "", today = localDateKey() } = {}) {
  const groups = Object.fromEntries(taskGroups.map(group => [group.id, []]));
  const needle = query.trim().toLocaleLowerCase();
  for (const task of tasks) {
    if (boardId && task.boardId !== boardId) continue;
    if (needle && ![task.title, task.boardTitle, task.workspaceName, task.listTitle].join(" ").toLocaleLowerCase().includes(needle)) continue;
    const due = task.dueDate?.slice(0, 10);
    const key = task.completed ? "completed" : !due ? "undated" : due < today ? "overdue" : due === today ? "today" : "upcoming";
    groups[key].push(task);
  }
  for (const tasks of Object.values(groups)) tasks.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return groups;
}
