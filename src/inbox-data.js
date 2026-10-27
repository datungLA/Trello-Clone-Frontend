export function inboxPayload(draft) {
  const title = draft.title.trim();
  if (!title || title.length > 200) throw new Error("Add a title of 1 to 200 characters.");
  const description = draft.description;
  if (description.length > 10000) throw new Error("Keep your notes within 10,000 characters.");
  return { title, description };
}
export function inboxCapture(pending, draft, createId) {
  if (pending) return pending;
  const payload = inboxPayload(draft);
  return { id: createId(), ...payload };
}
export function uncertainInboxWrite(error) {
  return !error.status || error.status >= 500;
}
export function reorderedInbox(items, movingId, targetId) {
  const ids = items.map(item => item.id);
  const from = ids.indexOf(movingId), to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  return ids;
}
export function openInboxBoards(boards) {
  return boards.filter(board => !board.closed && !board.workspaceArchived);
}
