import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Mail, MailOpen, Trash2, X } from "lucide-react";
import { api } from "./api";
import { ConfirmDialog } from "./confirm";

export default function Notifications({ userId, onOpenCard }) {
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);
  const dialog = useRef(null);
  const refresh = useCallback(async () => {
    try { setData(await api("/notifications")); setError(""); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => {
    refresh();
    const update = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(update, 60000);
    addEventListener("focus", update);
    return () => { clearInterval(timer); removeEventListener("focus", update); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.showModal(); refresh();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [open, refresh]);
  async function act(path, method, body, message) {
    setBusy(true); setError(""); setNotice("");
    try { await api(path, { method, body }); await refresh(); setNotice(message); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  }
  async function visit(item) {
    if (!await act(`/notifications/${item.id}`, "PATCH", { read: true }, "")) return;
    try { await onOpenCard(item.cardId); setOpen(false); }
    catch (err) { setError(err.message); }
  }
  return <>
    <button className="icon-button notification-trigger" aria-label={`Notifications, ${data.unreadCount} unread`} onClick={() => setOpen(true)}><Bell size={20} aria-hidden="true"/>{data.unreadCount > 0 && <span className="notification-count">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span>}</button>
    {open && <dialog ref={dialog} className="modal notification-dialog" aria-labelledby="notifications-title" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }}>
      <header><h2 id="notifications-title"><Bell size={21} aria-hidden="true"/>Notifications</h2><button className="icon-button" aria-label="Close notifications" disabled={busy} onClick={() => setOpen(false)}><X size={20}/></button></header>
      <div className="notification-toolbar"><span>{data.unreadCount} unread</span><button disabled={busy || !data.unreadCount} onClick={() => act("/notifications/read-all", "PATCH", {}, "All notifications marked as read.")}><CheckCheck size={16} aria-hidden="true"/>Mark all read</button></div>
      {error && <p className="error" role="alert">{error} <button onClick={refresh}>Try again</button></p>}
      {notice && <p className="success" role="status">{notice}</p>}
      {loading ? <p role="status">Loading notifications...</p> : !data.items.length ? <div className="notification-empty"><Bell size={32} aria-hidden="true"/><h3>You are all caught up</h3><p>Assignments and new comments on cards assigned to you appear here.</p></div> : <ul className="notification-list">{data.items.map(item => <li key={item.id} className={item.readAt ? "" : "unread"}>
        <button className="notification-content" disabled={busy} onClick={() => visit(item)}>{!item.readAt && <span className="notification-unread-label">Unread</span>}<strong>{item.actorName} {item.kind === "assigned" ? "assigned you to a card" : "commented on your assigned card"}</strong><span>{item.cardTitle}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></button>
        <div className="notification-actions"><button className="icon-button" aria-label={item.readAt ? "Mark unread" : "Mark read"} disabled={busy} onClick={() => act(`/notifications/${item.id}`, "PATCH", { read: !item.readAt }, item.readAt ? "Marked as unread." : "Marked as read.")}>{item.readAt ? <Mail size={17}/> : <MailOpen size={17}/>}</button><button className="icon-button" aria-label={`Delete notification for ${item.cardTitle}`} disabled={busy} onClick={() => setDeleting(item)}><Trash2 size={17}/></button></div>
      </li>)}</ul>}
      {deleting && <ConfirmDialog title="Delete notification?" message="This removes the alert from your inbox. The card and comments stay available." confirmLabel="Delete notification" busy={busy} error={error} onClose={() => setDeleting(null)} onConfirm={async () => { if (await act(`/notifications/${deleting.id}`, "DELETE", undefined, "Notification deleted.")) setDeleting(null); }}/ >}
    </dialog>}
  </>;
}
