import assert from "node:assert/strict";
import { test } from "node:test";
import { groupTasks, localDateKey } from "../src/my-tasks-data.js";
const task = (id, dueDate, completed = false, extra = {}) => ({ id, title: id, boardId: "board-a", boardTitle: "Launch", workspaceName: "Team", listTitle: "Doing", dueDate, completed, ...extra });
test("my tasks groups local date boundaries and completed overdue cards correctly", () => {
  const rows = [task("overdue", "2026-10-24"), task("today", "2026-10-25"), task("next", "2026-10-26"), task("no-date", null), task("done", "2026-10-01", true)];
  const groups = groupTasks(rows, { today: "2026-10-25" });
  assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([key, tasks]) => [key, tasks.map(task => task.id)])), { overdue: ["overdue"], today: ["today"], upcoming: ["next"], undated: ["no-date"], completed: ["done"] });
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 30)), "2026-01-02");
});
test("my tasks combines board and case-insensitive context search", () => {
  const rows = [task("a", null), task("b", null, false, { boardId: "board-b" }), task("c", null, false, { title: "Other", workspaceName: "Another", boardTitle: "Other", listTitle: "Todo" })];
  const groups = groupTasks(rows, { boardId: "board-a", query: " TEAM " });
  assert.deepEqual(groups.undated.map(task => task.id), ["a"]);
  assert.equal(rows.length, 3);
  assert.equal(groupTasks(rows, { query: "nothing matches" }).undated.length, 0);
});
test("my tasks sorts dates before titles and gives stable ties", () => {
  const rows = [task("z", "2026-11-02", false, { title: "Alpha" }), task("b", "2026-11-01", false, { title: "Beta" }), task("a", "2026-11-01", false, { title: "Alpha" }), task("c", "2026-11-01", false, { title: "Alpha" })];
  assert.deepEqual(groupTasks(rows, { today: "2026-10-25" }).upcoming.map(task => task.id), ["a", "c", "b", "z"]);
});
