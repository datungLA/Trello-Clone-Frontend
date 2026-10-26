import assert from "node:assert/strict";
import { test } from "node:test";
import { businessDay, calendarCards, monthCells, shiftMonth } from "../src/board-calendar-data.js";

test("calendar aligns Monday weeks across leap-year and year boundaries", () => {
  const february = monthCells("2024-02");
  assert.equal(february[0].key, "2024-01-29");
  assert.equal(february.filter(day => day.current).length, 29);
  assert.equal(february.at(-1).key, "2024-03-03");
  assert.equal(monthCells("2026-11").length, 42);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("calendar uses due dates before start-only dates and excludes archived data", () => {
  const card = (id, extra = {}) => ({ id, title: id, archived: false, assigneeIds: ["member"], ...extra });
  const board = { lists: [{ title: "Active", archived: false, cards: [card("both", { startDate: "2026-10-01T00:00:00Z", dueDate: "2026-10-20T00:00:00Z" }), card("start", { startDate: "2026-10-05T00:00:00Z" }), card("undated"), card("archived", { archived: true, dueDate: "2026-10-01" }), card("other", { dueDate: "2026-10-02", assigneeIds: ["other"] })] }, { title: "Archived", archived: true, cards: [card("hidden", { dueDate: "2026-10-01" })] }] };
  const cards = calendarCards(board, "member");
  assert.deepEqual(cards.map(card => card.id), ["undated", "start", "both"]);
  assert.equal(cards.find(card => card.id === "both").calendarDate, "2026-10-20");
  assert.equal(cards.find(card => card.id === "start").startOnly, true);
  assert.equal(calendarCards(board).length, 4);
  assert.equal(businessDay("2026-10-25T00:00:00.000Z"), "2026-10-25");
  assert.equal(businessDay(null), "");
});
