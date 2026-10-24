import React, { useState } from "react";
import { api } from "./api";
import { AdminIcon, ConfirmDialog, dateLabel, EmptyRecords, RemoteState, useRemote } from "./admin-shared";
import "./admin.css";

export default function SessionsPanel({ onSignedOut }) {
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const state = useRemote("/auth/sessions", revision);
  const others = state.data?.filter(session => !session.current) || [];
  async function revoke() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (confirmation.allOthers) await api("/auth/sessions/revoke-others", { method: "POST", body: { confirm: true } });
      else await api(`/auth/sessions/${confirmation.session.id}`, { method: "DELETE" });
      if (confirmation.session?.current) { onSignedOut(); return; }
      setNotice(confirmation.allOthers ? "Other sessions have been signed out." : "Session signed out.");
      setConfirmation(null); setRevision(value => value + 1);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="sessions-panel">
    <p className="muted">Review your active sign-ins. Revoking a session ends its access and prevents renewal.</p>
    <div className="session-toolbar"><button disabled={state.loading || state.error || busy || others.length === 0} onClick={() => {setError("");setConfirmation({allOthers:true});}}>Sign out all other sessions</button><button disabled={state.loading || busy} onClick={() => setRevision(value => value + 1)}>Refresh</button></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <RemoteState {...state} onRetry={() => setRevision(value => value + 1)} label="Loading your active sessions">
      {state.data?.length === 0 ? <EmptyRecords title="No active sessions found" description="Refresh to check your session list again."/> : <ul className="session-list">{state.data?.map(session => <li key={session.id}><span className="session-device-icon"><AdminIcon name="device" size={24}/></span><div className="session-details"><div className="session-title"><strong>{session.current ? "This session" : "Another session"}</strong>{session.current && <span className="admin-badge positive">Current</span>}</div><p className="session-agent">{session.userAgent || "Device information was not recorded"}</p><dl><div><dt>Signed in</dt><dd>{dateLabel(session.createdAt)}</dd></div><div><dt>Last refreshed</dt><dd>{dateLabel(session.lastUsedAt)}</dd></div><div><dt>Expires</dt><dd>{dateLabel(session.expiresAt)}</dd></div></dl></div><button disabled={busy} onClick={() => {setError("");setConfirmation({session});}}>Sign out{session.current ? " here" : ""}</button></li>)}</ul>}
    </RemoteState>
    {confirmation && <ConfirmDialog title={confirmation.allOthers ? "Sign out other sessions?" : confirmation.session.current ? "Sign out this session?" : "Sign out this device?"} confirmLabel={confirmation.allOthers ? "Sign out all others" : "Sign out session"} busy={busy} error={error} onClose={() => setConfirmation(null)} onConfirm={revoke}><p>{confirmation.allOthers ? "Your current session will stay signed in. Every other session will lose access." : confirmation.session.current ? "You will return to the sign-in screen. Save any unfinished work first." : "This session will lose access. The device will need to sign in again."}</p>{confirmation.session?.userAgent && <p className="session-agent">{confirmation.session.userAgent}</p>}</ConfirmDialog>}
  </section>;
}
