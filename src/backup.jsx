import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, CalendarClock, Check, CheckCircle2, ChevronDown, CircleAlert, CloudUpload, Copy, Database, FileLock2, FolderArchive, History, Link2, LoaderCircle, Play, ShieldCheck, Unplug, X } from "lucide-react";
import { api } from "./api";
import { Select } from "./select";
import { ConfirmDialog, dateLabel, RemoteState } from "./admin-shared";
import { activeBackup, backupDays, backupSettingsBody, backupSize, backupTab, backupTabs, scheduleDescription, settingsDraft } from "./backup-data.js";
import "./backup.css";

const base = "/admin/backup";
const tabMeta = {
  connection: { label: "Connection", icon: Link2 },
  configuration: { label: "Configuration", icon: CalendarClock },
  history: { label: "History", icon: History },
  guide: { label: "Setup guide", icon: BookOpen },
};
const runLabel = status => ({ pending: "Queued", running: "In progress", success: "Successful", failed: "Failed" })[status] || "Not run yet";

export default function BackupPage({ user, revision }) {
  const [tab, setTab] = useState(() => backupTab(location.search));
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [disconnect, setDisconnect] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reload, setReload] = useState(0);
  const tabRefs = useRef({});
  const canAccess = user.appRole === "super_admin";
  const running = runs.some(activeBackup) || activeBackup(settings?.lastRun);

  useEffect(() => {
    const result = new URLSearchParams(location.search).get("backupConnection");
    if (!result) return;
    if (result === "connected") setNotice("Google Drive connected. You can now create your first encrypted backup.");
    else setError("Google Drive was not connected. Check your OAuth configuration and try again.");
    const params = new URLSearchParams(location.search);
    params.delete("backupConnection");
    history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
  }, []);
  useEffect(() => {
    const pop = () => setTab(backupTab(location.search));
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!canAccess) return;
    let current = true;
    setLoadError(null);
    Promise.all([api(`${base}/settings`), api(`${base}/runs?limit=${limit}`)])
      .then(([nextSettings, history]) => {
        if (!current) return;
        setSettings(nextSettings);
        setRuns(Array.isArray(history) ? history : history.items);
        setHasMore(Array.isArray(history) ? history.length >= limit : !!history.hasMore);
      })
      .catch(e => { if (current) setLoadError(e); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [canAccess, revision, limit, reload]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setReload(v => v + 1), 5000);
    return () => clearInterval(timer);
  }, [running]);

  function selectTab(next, focus = false) {
    setTab(next);
    const params = new URLSearchParams(location.search);
    params.set("tab", next);
    history.replaceState({}, "", `${location.pathname}?${params}`);
    if (focus) tabRefs.current[next]?.focus();
  }
  function tabKey(event, current) {
    const index = backupTabs.indexOf(current);
    const next = event.key === "Home" ? 0 : event.key === "End" ? backupTabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % backupTabs.length : event.key === "ArrowLeft" ? (index + backupTabs.length - 1) % backupTabs.length : null;
    if (next === null) return;
    event.preventDefault(); selectTab(backupTabs[next], true);
  }
  async function action(name, task, success) {
    if (busy) return;
    setBusy(name); setError(""); setNotice("");
    try { await task(); if (success) setNotice(success); setReload(v => v + 1); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  }
  function runNow() {
    action("run", async () => {
      await api(`${base}/run`, { method: "POST", body: {} });
      selectTab("history");
    }, "Backup queued. Keep this page open to follow its progress.");
  }
  function connect() {
    action("connect", async () => {
      const { authUrl } = await api(`${base}/gdrive/oauth/start`, { method: "POST", body: {} });
      const url = new URL(authUrl);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com") throw new Error("The server returned an unexpected Google authorization address.");
      location.assign(url.href);
    });
  }
  if (!canAccess) return <div className="backup-restricted" role="alert"><ShieldCheck size={32}/><h2>Super administrator access required</h2><p>Full-system backups contain sensitive application data.</p></div>;
  return <div className="backup-page">
    <RemoteState loading={loading} error={!settings ? loadError : null} onRetry={() => setReload(v => v + 1)} label="Loading backup settings">
      {settings && <>
        <div className="backup-intro"><span className="backup-app-icon"><CloudUpload size={27}/></span><div><h2>System backup</h2><p>Encrypted database and configuration snapshots, safely stored in your Google Drive.</p></div><span className="backup-secure-label"><ShieldCheck size={16}/>Super admin only</span></div>
        {loadError && <div className="backup-message error" role="alert">{loadError.message}<button type="button" onClick={() => setReload(v => v + 1)}>Retry</button></div>}
        {error && <div className="backup-message error" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={17}/></button></div>}
        {notice && <div className="backup-message success" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={17}/></button></div>}
        <div className="backup-summary" aria-label="Backup status">
          <Summary icon={Link2} label="Connection" value={settings.connected ? "Connected" : "Not connected"} detail={settings.accountEmail || "Connect your Google account"} positive={settings.connected}/>
          <Summary icon={History} label="Last backup" value={runLabel(settings.lastRun?.status)} detail={settings.lastRun ? `${dateLabel(settings.lastRun.startedAt)}${settings.lastRun.sizeBytes ? ` · ${backupSize(settings.lastRun.sizeBytes)}` : ""}` : "Your first backup is one click away"}/>
          <Summary icon={CalendarClock} label={settings.enabled ? "Automatic · On" : "Automatic · Off"} value={settings.enabled ? scheduleDescription(settings.schedule) : "Manual backups"} detail={`${settings.retentionCount} backups retained · ${settings.schedule.timezone}`}/>
          <button type="button" className="primary backup-run" onClick={runNow} disabled={!!busy || running || !settings.connected || !settings.ready}><Play size={19}/>{busy === "run" || running ? "Backup in progress" : "Back up now"}</button>
        </div>
        <div className="backup-tablist" role="tablist" aria-label="Backup sections">{backupTabs.map(id => {
          const { label, icon: Icon } = tabMeta[id];
          return <button key={id} type="button" role="tab" id={`backup-tab-${id}`} aria-selected={tab === id} aria-controls={`backup-panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? "active" : ""} ref={element => {tabRefs.current[id] = element;}} onKeyDown={e => tabKey(e, id)} onClick={() => selectTab(id)}><Icon size={17}/>{label}{id === "history" && runs.length > 0 && <span className="backup-tab-count">{runs.length}{hasMore ? "+" : ""}</span>}</button>;
        })}</div>
        <section className="backup-tabpanel" role="tabpanel" id={`backup-panel-${tab}`} aria-labelledby={`backup-tab-${tab}`} tabIndex={0}>
          {tab === "connection" && <Connection settings={settings} connect={connect} onDisconnect={() => setDisconnect(true)} busy={busy} onNotice={setNotice}/>}
          {tab === "configuration" && <Configuration settings={settings} busy={busy} onSave={body => action("save", async () => { const saved = await api(`${base}/settings`, { method: "PUT", body }); setSettings(saved); }, "Backup settings saved.")}/>}
          {tab === "history" && <BackupHistory runs={runs} hasMore={hasMore && limit < 50} busy={busy} onMore={() => setLimit(v => Math.min(50, v + 7))} onDetail={run => action("detail", async () => setDetail(await api(`${base}/runs/${run.id}`)))} onConnect={() => selectTab("connection")} connected={settings.connected}/>}
          {tab === "guide" && <Guide settings={settings} onConnect={() => selectTab("connection")}/>}
        </section>
        <p className="backup-footer"><FileLock2 size={16}/>Encrypted before upload. Your recovery private key stays on your own computer. Existing server backups continue independently.</p>
      </>}
    </RemoteState>
    {disconnect && <ConfirmDialog title="Disconnect Google Drive?" confirmLabel="Disconnect" busy={busy === "disconnect"} error={error} onClose={() => setDisconnect(false)} onConfirm={() => action("disconnect", async () => { await api(`${base}/gdrive/disconnect`, { method: "POST", body: { confirm: true } }); setDisconnect(false); }, "Google Drive disconnected. Existing archives were preserved.")}><p>New Google Drive backups will stop until you reconnect. Existing archives and the independent server backup schedule are preserved.</p></ConfirmDialog>}
    {detail && <RunDetails run={detail} onClose={() => setDetail(null)}/>}
  </div>;
}

function Summary({ icon: Icon, label, value, detail, positive }) {
  return <div className="backup-summary-item"><span className={positive ? "backup-kicker connected" : "backup-kicker"}><Icon size={14}/>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Connection({ settings, connect, onDisconnect, busy, onNotice }) {
  return <div className="backup-connection-grid"><section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><Link2 size={21}/></span><div><h3>Your Google Drive connection</h3><p>A private destination for this environment's backups.</p></div></header>
    <div className={`backup-connection-state ${settings.connected ? "connected" : ""}`}>{settings.connected ? <CheckCircle2 size={25}/> : <CloudUpload size={25}/>}<div><strong>{settings.connected ? "Google Drive is connected" : "Connect once, back up with confidence"}</strong><p>{settings.connected ? settings.accountEmail || "Google account authorized" : "Your Google sign-in grants access to files created by this app, not your entire Drive."}</p></div></div>
    {!settings.credentialConfigured && <p className="backup-warning"><CircleAlert size={17}/>Google OAuth credentials have not been configured on this server.</p>}
    {!settings.configured && settings.credentialConfigured && <p className="backup-warning"><CircleAlert size={17}/><span>Server setup is incomplete. {settings.readiness?.filter(check => !check.ok).map(check => check.label).join(", ") || "Check encryption and backup tools before running a backup."}</span></p>}
    <div className="backup-actions"><button className="primary" onClick={connect} disabled={!!busy || !settings.credentialConfigured}><ArrowUpRight size={17}/>{busy === "connect" ? "Opening Google..." : settings.connected ? "Reconnect Google Drive" : "Connect Google Drive"}</button>{settings.connected && <button onClick={onDisconnect} disabled={!!busy}><Unplug size={17}/>Disconnect</button>}</div>
    <p className="backup-muted">Google will ask you to approve access. Credentials and authorization tokens stay on the server.</p>
  </section><section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><ShieldCheck size={21}/></span><div><h3>Finish Google Cloud setup</h3><p>Use this exact authorized redirect URI.</p></div></header><UriField value={settings.redirectUri} onNotice={onNotice}/><ol className="backup-steps"><li>Open your Google Cloud OAuth client, under <strong>Web application</strong>.</li><li>Add the URI above to <strong>Authorized redirect URIs</strong> and save.</li><li>Enable Google Drive API and add your Google account as a test user if the app is in Testing.</li><li>Return here and choose <strong>Connect Google Drive</strong>.</li></ol><p className="backup-muted">Authorized JavaScript origins are not required for this server-based OAuth flow. A redirect URI includes the full callback path.</p></section></div>;
}
function UriField({ value, onNotice }) {
  const field = useRef(null);
  async function copy() {
    try { await navigator.clipboard.writeText(value); onNotice?.("Redirect URI copied."); }
    catch { field.current?.focus(); field.current?.select(); onNotice?.("Select and copy the redirect URI from the field."); }
  }
  return <div className="backup-uri"><label className="field"><span>Authorized redirect URI</span><input ref={field} value={value || ""} readOnly spellCheck={false} onFocus={e => e.target.select()}/></label><button type="button" onClick={copy} disabled={!value}><Copy size={16}/>Copy URI</button></div>;
}
function Configuration({ settings, busy, onSave }) {
  const [draft, setDraft] = useState(() => settingsDraft(settings));
  const [error, setError] = useState("");
  const baseline = JSON.stringify(settingsDraft(settings));
  const dirty = JSON.stringify(draft) !== baseline;
  const update = (key, value) => { setError(""); setDraft(old => ({ ...old, [key]: value })); };
  const [hour, minute] = draft.time.split(":").map(Number);
  function submit(event) {
    event.preventDefault(); setError("");
    try { onSave(backupSettingsBody(draft)); } catch (e) { setError(e.message); }
  }
  return <form className="backup-config" onSubmit={submit}>
    <section className={`backup-scheduler-state ${draft.enabled ? "enabled" : ""}`}><span className="backup-icon"><CalendarClock size={24}/></span><div><h3>Automatic backup {draft.enabled ? "on" : "off"}</h3><p>{draft.enabled ? `${scheduleDescription({ ...draft, hour, minute })} · ${draft.timezone}` : "Run backups manually, or turn on a recurring schedule."}</p></div><button type="button" className="backup-switch" role="switch" aria-checked={draft.enabled} aria-label="Automatic backups" disabled={!!busy} onClick={() => update("enabled", !draft.enabled)}><span/></button></section>
    <div className="backup-config-grid"><section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><CalendarClock size={21}/></span><div><h3>Schedule</h3><p>Runs in the timezone you select.</p></div></header><div className="backup-frequency" aria-label="Backup frequency">{["daily", "weekly"].map(value => <button type="button" key={value} aria-pressed={draft.frequency === value} className={draft.frequency === value ? "active" : ""} onClick={() => update("frequency", value)}>{value === "daily" ? "Daily" : "Weekly"}</button>)}</div><div className="backup-field-grid"><label className="field"><span>Time</span><input type="time" value={draft.time} required onChange={e => update("time", e.target.value)}/></label>{draft.frequency === "weekly" && <label className="field"><span>Day</span><Select value={draft.dayOfWeek} onChange={e => update("dayOfWeek", e.target.value)}>{backupDays.map((day, i) => <option key={day} value={i}>{day}</option>)}</Select></label>}</div><label className="field"><span>Timezone</span><Select value={draft.timezone} onChange={e => update("timezone", e.target.value)}>{Array.from(new Set([draft.timezone, "America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Ho_Chi_Minh", "UTC"])).map(zone => <option key={zone}>{zone}</option>)}</Select></label><p className="backup-schedule-preview"><CalendarClock size={16}/>{scheduleDescription({ ...draft, hour, minute })}<small>{draft.timezone}</small></p></section>
      <section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><Database size={21}/></span><div><h3>What to back up</h3><p>Only selected application data is included.</p></div></header><Scope checked={draft.scopeDb} onChange={checked => update("scopeDb", checked)} icon={Database} title="PostgreSQL database" description="Accounts, workspaces, boards, cards and application settings."/><Scope checked={draft.scopeConfigs} onChange={checked => update("scopeConfigs", checked)} icon={FileLock2} title="Application configuration" description="An allowlisted snapshot of runtime configuration. Private local credentials are excluded."/><Scope checked={false} disabled icon={FolderArchive} title="File uploads" description="Not available yet. MinIO uploads are not enabled for this project."/></section></div>
    <details className="backup-surface backup-advanced"><summary><span><ShieldCheck size={20}/><strong>Retention & destination</strong><small>Keep {draft.retentionCount} backups in this app's private Drive folder</small></span><ChevronDown size={18}/></summary><div className="backup-advanced-content"><label className="field"><span>Backups to keep</span><input type="number" min={1} max={30} step={1} required value={draft.retentionCount} onChange={e => update("retentionCount", e.target.value)}/></label><div><span className="backup-field-label">Destination folder</span><p className="backup-destination"><FolderArchive size={18}/>{settings.remoteFolder}</p><p className="backup-muted">Retention removes only this app's older backup files after a new upload passes integrity checks. Other Drive files are never included.</p></div></div></details>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="backup-savebar"><span aria-live="polite">{dirty ? "You have unsaved changes" : "All settings saved"}</span><button type="button" onClick={() => {setDraft(settingsDraft(settings)); setError("");}} disabled={!dirty || !!busy}>Discard changes</button><button className="primary" type="submit" disabled={!dirty || !!busy || (draft.enabled && !settings.connected)}><Check size={17}/>{busy === "save" ? "Saving..." : "Save settings"}</button></div>{draft.enabled && !settings.connected && <p className="backup-warning">Connect Google Drive before enabling automatic backups.</p>}
  </form>;
}
function Scope({ checked, disabled, onChange, icon: Icon, title, description }) {
  return <label className={`backup-scope ${checked ? "selected" : ""} ${disabled ? "unavailable" : ""}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)}/><Icon size={21}/><span><strong>{title}</strong><small>{description}</small></span>{disabled && <span className="backup-pending">Planned</span>}</label>;
}
function BackupHistory({ runs, hasMore, busy, onMore, onDetail, onConnect, connected }) {
  if (!runs.length) return <div className="backup-surface backup-empty"><History size={34}/><h3>No backups yet</h3><p>{connected ? "Choose Back up now to create your first encrypted snapshot." : "Connect Google Drive to start protecting this environment's data."}</p>{!connected && <button className="primary" onClick={onConnect}>Set up connection</button>}</div>;
  return <section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><History size={21}/></span><div><h3>Backup history</h3><p>Upload success and restore verification are separate checks.</p></div></header><ol className="backup-history-list">{runs.map(run => <li key={run.id}><span className={`backup-run-icon ${run.status}`}>{activeBackup(run) ? <LoaderCircle size={21}/> : run.status === "success" ? <CheckCircle2 size={21}/> : <CircleAlert size={21}/>}</span><div className="backup-history-description"><strong>{run.kind === "scheduled" ? "Scheduled backup" : "Manual backup"}<span className={`backup-status ${run.status}`}>{runLabel(run.status)}</span></strong><time dateTime={run.startedAt}>{dateLabel(run.startedAt)}</time><small>{run.sizeBytes ? `${backupSize(run.sizeBytes)} · ` : ""}{[run.scopeDb && "Database", run.scopeConfigs && "Configuration"].filter(Boolean).join(" + ") || "Encrypted snapshot"}</small>{run.error && <p className="backup-run-error">{run.error}</p>}</div><button type="button" onClick={() => onDetail(run)} disabled={!!busy}>Details</button></li>)}</ol>{hasMore && <button type="button" className="backup-load-more" onClick={onMore} disabled={!!busy}>Load more backups</button>}<p className="backup-muted">Showing up to 50 recent runs. History may include archives that have expired under your retention policy.</p></section>;
}
function RunDetails({ run, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus(); }, []);
  return <dialog ref={ref} className="modal backup-detail" aria-labelledby="backup-detail-title" onCancel={event => {event.preventDefault(); onClose();}}><header><h2 id="backup-detail-title">Backup details</h2><button type="button" onClick={onClose} aria-label="Close backup details" autoFocus><X size={20}/></button></header><span className={`backup-status ${run.status}`}>{runLabel(run.status)}</span><dl><dt>Started</dt><dd>{dateLabel(run.startedAt)}</dd><dt>Finished</dt><dd>{run.finishedAt ? dateLabel(run.finishedAt) : "Not finished"}</dd><dt>Archive size</dt><dd>{backupSize(run.sizeBytes)}</dd><dt>Archive location</dt><dd>{run.remotePath || "Not uploaded"}</dd><dt>Backup ID</dt><dd>{run.id}</dd>{run.checksum && <><dt>Drive integrity checksum (MD5)</dt><dd>{run.checksum}</dd></>}{run.verifiedAt && <><dt>Upload integrity checked</dt><dd>{dateLabel(run.verifiedAt)}</dd></>}</dl>{run.error && <p className="error" role="alert">{run.error}</p>}<p className="backup-muted">An encrypted archive requires your local recovery private key to restore. Restore only into an isolated target and verify the data before recovery.</p></dialog>;
}
function Guide({ settings, onConnect }) {
  return <div className="backup-guide-grid"><section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><BookOpen size={21}/></span><div><h3>Connect in four steps</h3><p>A one-time Google Cloud setup for your account.</p></div></header><ol className="backup-steps"><li><strong>Enable Google Drive API.</strong> Use the same Google Cloud project as your OAuth client.</li><li><strong>Configure consent.</strong> If your external app is in Testing, add your Google account to its test users. Testing tokens can expire and require reconnection.</li><li><strong>Save the callback.</strong> Add the exact URI from the Connection tab to your Web application client's authorized redirect URIs.</li><li><strong>Authorize, then test.</strong> Connect Google Drive, create a manual backup and inspect History. A successful upload does not prove a successful restore.</li></ol><button type="button" className="primary" onClick={onConnect}>Open connection setup<ArrowUpRight size={16}/></button></section><section className="backup-surface"><header className="backup-section-heading"><span className="backup-icon"><ShieldCheck size={21}/></span><div><h3>Keep recovery possible</h3><p>Private by default, with a separate recovery key.</p></div></header><ul className="backup-guidance"><li>Keep your Google Drive backup folder private and enable two-step verification on your Google account.</li><li>Your server encrypts each archive before upload. The recovery private key stays in your local credential vault; losing it means these archives cannot be decrypted.</li><li>Do not upload your local credential vault or recovery private key to Drive.</li><li>The {settings.retentionCount}-backup retention policy applies only to files created by this backup feature.</li><li>Periodically restore a backup into a disposable isolated database and check accounts, workspaces and permissions.</li><li>Restoring active production data is an operator recovery procedure, not an action on this page.</li></ul></section></div>;
}
