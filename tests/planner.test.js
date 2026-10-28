import assert from "node:assert/strict";
import { test, after } from "node:test";
import { plannerBlocksForDay, plannerCapture, plannerDraft, plannerInputToISO, plannerLocalInput, plannerOverlap, plannerPayload, plannerPayloadMatches, plannerRange, plannerWeekStart, reschedulePlannerBlock, shiftPlannerDay } from "../src/planner-data.js";

const oldZone = process.env.TZ;
process.env.TZ = "America/Los_Angeles";
after(() => { if (oldZone === undefined) delete process.env.TZ; else process.env.TZ = oldZone; });
const block = { id: "a", title: "Focus", notes: "  exact notes\n", startsAt: "2026-10-27T16:00:00.000Z", endsAt: "2026-10-27T17:30:00.000Z", revision: 1 };

test("Planner week boundaries use local calendar days across leap dates, years and daylight saving", () => {
  assert.equal(plannerWeekStart("2027-01-01"), "2026-12-28");
  assert.equal(shiftPlannerDay("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftPlannerDay("2028-02-29", 1), "2028-03-01");
  const spring = plannerRange("2026-03-08");
  assert.equal(spring.from, "2026-03-02T08:00:00.000Z");
  assert.equal(spring.to, "2026-03-09T07:00:00.000Z");
  assert.equal(Date.parse(spring.to) - Date.parse(spring.from), 167 * 3600000);
  assert.equal(plannerRange("2026-11-01").days.length, 7);
});
test("Planner rejects invalid and nonexistent local times and preserves an existing repeated-hour instant", () => {
  for (const value of ["2026-02-30T09:00", "2026-03-08T02:30", "2026-10-27T24:30", "bad"]) assert.throws(() => plannerInputToISO(value));
  assert.equal(plannerInputToISO("2026-03-08T01:30"), "2026-03-08T09:30:00.000Z");
  assert.equal(plannerInputToISO("2026-11-01T01:30"), "2026-11-01T08:30:00.000Z");
  assert.equal(plannerInputToISO("2026-11-01T01:30", "2026-11-01T09:30:25.000Z"), "2026-11-01T09:30:25.000Z");
  assert.equal(plannerLocalInput(block.startsAt), "2026-10-27T09:00");
});
test("Planner capture retries preserve the full payload and duration validation follows elapsed time", () => {
  let generated = 0;
  const draft = { ...plannerDraft(block), title: "  Focus  " };
  const first = plannerCapture(null, draft, () => `id-${++generated}`);
  assert.equal(first.id, "id-1"); assert.equal(first.notes, block.notes);
  assert.equal(plannerCapture(first, { ...draft, title: "Changed" }, () => `id-${++generated}`), first);
  assert.equal(generated, 1);
  assert.deepEqual(plannerPayload(draft, block), { title: block.title, notes: block.notes, startsAt: block.startsAt, endsAt: block.endsAt });
  for (const change of [{ title: " " }, { title: "x".repeat(201) }, { notes: "x".repeat(10001) }, { endsLocal: draft.startsLocal }, { endsLocal: "2026-10-28T09:01" }]) assert.throws(() => plannerPayload({ ...draft, ...change }, block));
  assert.equal(Date.parse(plannerPayload({ ...draft, startsLocal: "2026-03-08T01:30", endsLocal: "2026-03-08T03:30" }).endsAt) - Date.parse("2026-03-08T09:30:00Z"), 3600000);
});
test("Planner rescheduling preserves local start time, notes and elapsed duration across clock changes", () => {
  const moved = reschedulePlannerBlock(block, "2026-11-02");
  assert.equal(moved.startsAt, "2026-11-02T17:00:00.000Z");
  assert.equal(moved.endsAt, "2026-11-02T18:30:00.000Z");
  assert.equal(moved.notes, block.notes); assert.equal(moved.revision, 1);
  assert.equal(reschedulePlannerBlock(block, "2026-10-27"), null);
  assert.throws(() => reschedulePlannerBlock({ ...block, startsAt: "2026-03-07T10:30:00.000Z", endsAt: "2026-03-07T11:30:00.000Z" }, "2026-03-08"));
  assert.equal(plannerPayloadMatches({ ...block, startsAt: "2026-10-27T16:00:00Z" }, block), true);
  assert.equal(plannerPayloadMatches({ ...block, notes: "Other" }, block), false);
});
test("Planner agenda includes midnight-spanning blocks on both days without treating touching boundaries as overlaps", () => {
  const overnight = { ...block, startsAt: "2026-10-28T06:30:00Z", endsAt: "2026-10-28T08:00:00Z" };
  assert.equal(plannerBlocksForDay([overnight], "2026-10-27").length, 1);
  assert.equal(plannerBlocksForDay([overnight], "2026-10-28").length, 1);
  assert.equal(plannerBlocksForDay([overnight], "2026-10-29").length, 0);
  const touching = { ...block, id: "b", startsAt: block.endsAt, endsAt: "2026-10-27T18:00:00Z" };
  assert.equal(plannerOverlap(block, [block, touching]), false);
  assert.equal(plannerOverlap(block, [block, { ...touching, startsAt: "2026-10-27T17:00:00Z" }]), true);
});
