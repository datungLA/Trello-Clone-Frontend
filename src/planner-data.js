const pad = value => String(value).padStart(2, "0");
export const plannerDayKey = value => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
export function plannerLocalInput(value) {
  const date = new Date(value);
  return `${plannerDayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function dayDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Choose a valid calendar day.");
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || plannerDayKey(date) !== day) throw new Error("Choose a valid calendar day.");
  return date;
}
export function shiftPlannerDay(day, amount) {
  const date = dayDate(day); date.setDate(date.getDate() + amount);
  return plannerDayKey(date);
}
export function plannerWeekStart(day) {
  const date = dayDate(day);
  return shiftPlannerDay(day, -((date.getDay() + 6) % 7));
}
export function plannerRange(day) {
  const first = plannerWeekStart(day), after = shiftPlannerDay(first, 7);
  return { first, days: Array.from({ length: 7 }, (_, index) => shiftPlannerDay(first, index)), from: new Date(`${first}T00:00:00`).toISOString(), to: new Date(`${after}T00:00:00`).toISOString() };
}
export function plannerInputToISO(value, previous) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) throw new Error("Choose valid start and end dates and times.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day); date.setHours(hour, minute, 0, 0);
  if (year < 1000 || year > 9999 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) throw new Error("That local time does not exist. Check the date or daylight-saving clock change.");
  if (previous && Number.isFinite(Date.parse(previous)) && plannerLocalInput(previous) === value) return new Date(previous).toISOString();
  return date.toISOString();
}
export function plannerDraft(block, day = plannerDayKey(new Date())) {
  return block ? { title: block.title, notes: block.notes, startsLocal: plannerLocalInput(block.startsAt), endsLocal: plannerLocalInput(block.endsAt) } : { title: "", notes: "", startsLocal: `${day}T09:00`, endsLocal: `${day}T10:00` };
}
export function plannerPayload(draft, original) {
  const title = draft.title.trim(), notes = draft.notes;
  if (!title || title.length > 200) throw new Error("Add a title of 1 to 200 characters.");
  if (notes.length > 10000) throw new Error("Keep notes within 10,000 characters.");
  const startsAt = plannerInputToISO(draft.startsLocal, original?.startsAt), endsAt = plannerInputToISO(draft.endsLocal, original?.endsAt);
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  if (duration < 60000 || duration > 24 * 60 * 60000) throw new Error("A focus block must last between 1 minute and 24 hours.");
  return { title, notes, startsAt, endsAt };
}
export function plannerCapture(pending, draft, createId) {
  if (pending) return pending;
  const payload = plannerPayload(draft);
  return { id: createId(), ...payload };
}
export function plannerBlocksForDay(blocks, day) {
  const from = new Date(`${day}T00:00:00`).getTime(), to = new Date(`${shiftPlannerDay(day, 1)}T00:00:00`).getTime();
  return blocks.filter(block => Date.parse(block.startsAt) < to && Date.parse(block.endsAt) > from).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
}
export function reschedulePlannerBlock(block, day) {
  dayDate(day);
  if (plannerDayKey(block.startsAt) === day) return null;
  const old = new Date(block.startsAt), local = `${day}T${pad(old.getHours())}:${pad(old.getMinutes())}`;
  const time = Date.parse(plannerInputToISO(local)) + old.getSeconds() * 1000 + old.getMilliseconds();
  return { title: block.title, notes: block.notes, startsAt: new Date(time).toISOString(), endsAt: new Date(time + Date.parse(block.endsAt) - old.getTime()).toISOString(), revision: block.revision };
}
export function plannerPayloadMatches(block, payload) {
  return block && block.title === payload.title && block.notes === payload.notes && Date.parse(block.startsAt) === Date.parse(payload.startsAt) && Date.parse(block.endsAt) === Date.parse(payload.endsAt);
}
export function plannerOverlap(block, blocks) {
  return blocks.some(other => other.id !== block.id && Date.parse(other.startsAt) < Date.parse(block.endsAt) && Date.parse(other.endsAt) > Date.parse(block.startsAt));
}
