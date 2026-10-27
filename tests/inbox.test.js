import assert from "node:assert/strict";
import { test } from "node:test";
import { inboxCapture, inboxPayload, openInboxBoards, reorderedInbox, uncertainInboxWrite } from "../src/inbox-data.js";

test("Inbox capture retries retain the original identity and exact notes after an ambiguous response", () => {
  let generated = 0;
  const createId = () => `capture-${++generated}`;
  const first = inboxCapture(null, { title: "  A useful idea  ", description: "  First paragraph\n\nLast paragraph  " }, createId);
  assert.deepEqual(first, { id: "capture-1", title: "A useful idea", description: "  First paragraph\n\nLast paragraph  " });
  assert.equal(inboxCapture(first, { title: "Changed during retry", description: "Other notes" }, createId), first);
  assert.equal(generated, 1);
  const next = inboxCapture(null, { title: "Next idea", description: "" }, createId);
  assert.equal(next.id, "capture-2");
  assert.equal(uncertainInboxWrite(new Error("Offline")), true);
  assert.equal(uncertainInboxWrite({ status: 503 }), true);
  assert.equal(uncertainInboxWrite({ status: 400 }), false);
  assert.equal(uncertainInboxWrite({ status: 409 }), false);
});
test("Inbox ordering preserves every identity, supports either direction and rejects stale targets", () => {
  const items = ["a", "b", "c"].map(id => ({ id }));
  assert.deepEqual(reorderedInbox(items, "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(reorderedInbox(items, "c", "a"), ["c", "a", "b"]);
  assert.equal(reorderedInbox(items, "a", "gone"), null);
  assert.equal(reorderedInbox(items, "a", "a"), null);
  assert.deepEqual(items.map(item => item.id), ["a", "b", "c"]);
});
test("Inbox destinations exclude unavailable boards and drafts reject oversized input without losing content", () => {
  const available = { id: "open", closed: false };
  assert.deepEqual(openInboxBoards([available, { id: "closed", closed: true }, { id: "unavailable", workspaceArchived: true }]), [available]);
  for (const draft of [{ title: " ", description: "notes" }, { title: "x".repeat(201), description: "" }, { title: "Idea", description: "x".repeat(10001) }]) assert.throws(() => inboxPayload(draft));
  assert.deepEqual(inboxPayload({ title: "<script> is text", description: "<b>Not markup</b>" }), { title: "<script> is text", description: "<b>Not markup</b>" });
});
