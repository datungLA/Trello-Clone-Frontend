import assert from "node:assert/strict";
import { test } from "node:test";
import { planningCards, timelineRange } from "../src/board-planning-data.js";
const card = (id, extra = {}) => ({ id, title: id, archived: false, assigneeIds: [], ...extra });
const members = [{ id: "one", displayName: "One" }, { id: "two", displayName: "Two" }];
test("planning filters active board cards by current assignee and searches context", () => {
  const board = { lists: [{ title: "Doing", cards: [card("a", { assigneeIds: ["one", "removed"] }), card("b", { assigneeIds: ["two"] }), card("hidden", { archived: true })] }, { title: "Archive", archived: true, cards: [card("c")] }] };
  assert.deepEqual(planningCards(board, members, { query: " ONE ", memberId: "one" }).map(card => card.id), ["a"]);
  assert.equal(planningCards(board, members)[0].assignees, "One");
  assert.equal(planningCards(board, members, { query: "Doing" }).length, 2);
  assert.equal(planningCards(board, members, { query: "removed" }).length, 0);
});
test("planning date sorting keeps undated cards last in either direction", () => {
  const board = { lists: [{ title: "List", cards: [card("a", { dueDate: "2026-10-02T00:00:00Z" }), card("b"), card("c", { dueDate: "2026-10-01" })] }] };
  assert.deepEqual(planningCards(board, [], { sort: "dueDay", direction: "asc" }).map(card => card.id), ["c", "a", "b"]);
  assert.deepEqual(planningCards(board, [], { sort: "dueDay", direction: "desc" }).map(card => card.id), ["a", "c", "b"]);
});
test("timeline clips inclusive date ranges across leap February and excludes nonintersections", () => {
  const range = timelineRange(card("a", { startDate: "2024-01-30", dueDate: "2024-03-02" }), "2024-02");
  assert.equal(range.days, 29); assert.equal(range.left, 0); assert.equal(range.width, 100); assert.equal(range.clippedStart, true); assert.equal(range.clippedEnd, true);
  const marker = timelineRange(card("b", { dueDate: "2024-02-29T00:00:00Z" }), "2024-02");
  assert.equal(marker.marker, true); assert.equal(marker.width, 100 / 29); assert.equal(marker.left, 28 / 29 * 100);
  assert.equal(timelineRange(card("c", { startDate: "2024-03-01" }), "2024-02"), null);
  assert.equal(timelineRange(card("d"), "2024-02"), null);
  assert.equal(timelineRange(card("e", { startDate: "2024-02-20", dueDate: "2024-02-19" }), "2024-02"), null);
});
