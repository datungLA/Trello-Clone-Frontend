import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AdminIcon, ConfirmDialog, dateLabel, EmptyRecords, Pagination, RemoteState, useRemote } from "./admin-shared";
import "./admin.css";

const sections = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "users", label: "People", icon: "users" },
  { id: "workspaces", label: "Workspaces", icon: "workspaces" },
  { id: "boards", label: "Boards", icon: "boards" },
  { id: "audit", label: "Audit history", icon: "audit" },
];
const sectionFromUrl = () => sections.some(s => s.id === location.pathname.split("/")[2]) ? location.pathname.split("/")[2] : "overview";
const titleFor = section => ({ overview: "A clear view of your application.", users: "People & access", workspaces: "Workspace directory", boards: "Board directory", audit: "An accountable history." })[section];
const descriptionFor = section => ({ overview: "Account and workspace health, without opening private work.", users: "Manage application access. Workspace roles remain separate.", workspaces: "Review memberships and manage workspace availability.", boards: "Review board metadata and open or close a board.", audit: "Review recorded administrator actions and their targets." })[section];

export default function AdminPanel({ user, onBack, onSignedOut }) {
  const [section, setSection] = useState(sectionFromUrl);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [membersWorkspace, setMembersWorkspace] = useState(null);
  useEffect(() => {
    const pop = () => setSection(sectionFromUrl());
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  function navigate(id) {
    setSection(id); setNotice(""); setError("");
    history.pushState({}, "", id === "overview" ? "/admin" : `/admin/${id}`);
  }
  function review(value) { setError(""); setConfirmation(value); }
  async function confirmAction() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api(confirmation.path, { method: "PATCH", body: { ...confirmation.body, confirm: true } });
      if (confirmation.signOut) { onSignedOut(); return; }
      setNotice(confirmation.success); setConfirmation(null); setRevision(v => v + 1);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!user.isAdmin) return <div className="admin-access-page"><AdminIcon name="lock" size={40}/><span className="eyebrow">APPLICATION ADMINISTRATION</span><h1>This area is restricted.</h1><p>Your account does not have application administrator access.</p><p className="muted">Workspace ownership does not grant application administrator access.</p><button className="primary" onClick={onBack}>Back to your boards</button></div>;
  return <div className="admin-shell"><a className="admin-skip-link" href="#admin-main">Skip to administration content</a>
    <header className="admin-topbar"><button className="admin-brand" onClick={onBack}><AdminIcon name="boards" size={24}/><strong>Trello Clone</strong><span>Admin</span></button><span className="admin-topbar-spacer"/><span className="admin-signed-in">{user.displayName}</span><button onClick={onBack}><AdminIcon name="arrow" size={16}/>Back to boards</button></header>
    <div className="admin-layout"><aside className="admin-sidebar"><div className="admin-sidebar-heading"><span className="admin-shield"><AdminIcon name="lock" size={20}/></span><div><strong>Application console</strong><small>Restricted access</small></div></div><nav aria-label="Administration">{sections.map(s => <button key={s.id} className={section === s.id ? "admin-nav active" : "admin-nav"} aria-current={section === s.id ? "page" : undefined} onClick={() => navigate(s.id)}><AdminIcon name={s.icon}/>{s.label}</button>)}</nav><p className="admin-sidebar-note">Private card content stays in its workspace. This console manages accounts and metadata.</p></aside>
      <main className="admin-main" id="admin-main" tabIndex={-1}><div className="admin-page-heading"><div><span className="eyebrow">APPLICATION / {sections.find(s => s.id === section)?.label.toUpperCase()}</span><h1>{titleFor(section)}</h1><p>{descriptionFor(section)}</p></div><button onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
        {notice && <div className="admin-notice" role="status"><AdminIcon name="check" size={18}/><span>{notice}</span><button className="text-button" onClick={() => setNotice("")}>Dismiss</button></div>}
        {section === "overview" ? <Overview revision={revision} onRetry={() => setRevision(v => v + 1)} onNavigate={navigate}/> : <Directory key={section} section={section} revision={revision} onRetry={() => setRevision(v => v + 1)} onReview={review} onMembers={setMembersWorkspace} user={user}/>}
      </main>
    </div>
    {confirmation && <ConfirmDialog title={confirmation.title} confirmLabel={confirmation.label} busy={busy} error={error} onClose={() => setConfirmation(null)} onConfirm={confirmAction}><p>{confirmation.description}</p>{confirmation.warning && <p className="admin-confirm-warning">{confirmation.warning}</p>}</ConfirmDialog>}
    {membersWorkspace && <MembersDialog workspace={membersWorkspace} onClose={() => setMembersWorkspace(null)}/>}
  </div>;
}

function Overview({ revision, onRetry, onNavigate }) {
  const state = useRemote("/admin/overview", revision);
  const stats = state.data;
  const cards = stats ? [
    { label: "People", value: stats.users, detail: `${stats.activeUsers} active accounts`, icon: "users", section: "users" },
    { label: "Suspended", value: stats.suspendedUsers, detail: "Accounts with access paused", icon: "lock", section: "users" },
    { label: "Workspaces", value: stats.workspaces, detail: `${stats.archivedWorkspaces} archived`, icon: "workspaces", section: "workspaces" },
    { label: "Boards", value: stats.boards, detail: `${stats.closedBoards} closed`, icon: "boards", section: "boards" },
  ] : [];
  return <RemoteState {...state} onRetry={onRetry} label="Loading application overview"><div className="admin-stat-grid">{cards.map(c => <button className="admin-stat-card" key={c.label} onClick={() => onNavigate(c.section)}><span className="admin-stat-icon"><AdminIcon name={c.icon} size={22}/></span><span className="admin-stat-label">{c.label}</span><strong>{c.value}</strong><small>{c.detail}</small></button>)}</div><div className="admin-overview-grid"><section className="admin-surface"><span className="admin-section-icon"><AdminIcon name="lock" size={24}/></span><h2>Access with clear boundaries</h2><p><strong>{stats?.admins}</strong> application administrators manage accounts and application availability.</p><p className="muted">Workspace owners manage their own teams. Administrator access does not imply permission to read private cards.</p><button onClick={() => onNavigate("users")}>Review account access</button></section><section className="admin-surface"><span className="admin-section-icon"><AdminIcon name="audit" size={24}/></span><h2>Changes leave a record</h2><p>Sensitive account and availability changes require confirmation and are recorded.</p><p className="muted">Review who changed a resource and when. The server protects the last active administrator.</p><button onClick={() => onNavigate("audit")}>Open audit history</button></section></div></RemoteState>;
}

function Directory({ section, revision, onRetry, onReview, onMembers, user }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [actorInput, setActorInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [auditFilters, setAuditFilters] = useState({ actorId: "", action: "" });
  const pageSize = 20;
  const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
  if (section === "audit") {
    if (auditFilters.actorId) params.set("actorId", auditFilters.actorId);
    if (auditFilters.action) params.set("action", auditFilters.action);
  }
  const state = useRemote(`/admin/${section}?${params}`, revision);
  const rows = state.data?.items || [];
  function searchSubmit(e) { e.preventDefault(); setQuery(search.trim()); setPage(1); setAuditFilters({ actorId: actorInput.trim(), action: actionInput.trim() }); }
  return <section className="admin-surface admin-directory">
    <form className="admin-search-form" onSubmit={searchSubmit}><label className="field"><span>{section === "audit" ? "Search audit history" : `Search ${section}`}</span><input name="q" value={search} onChange={e => setSearch(e.target.value)} maxLength={200} placeholder={section === "users" ? "Name or email" : section === "audit" ? "Actor, action, or target" : "Name or identifier"}/></label>{section === "audit" && <><label className="field"><span>Actor ID</span><input name="actorId" value={actorInput} onChange={e => setActorInput(e.target.value)} placeholder="Optional account ID" maxLength={36}/></label><label className="field"><span>Action</span><input name="action" value={actionInput} onChange={e => setActionInput(e.target.value)} maxLength={100} placeholder="Optional action name"/></label></>}<button className="primary">Search</button>{(query || auditFilters.actorId || auditFilters.action) && <button type="button" onClick={() => {setSearch("");setQuery("");setActorInput("");setActionInput("");setAuditFilters({actorId:"",action:""});setPage(1);}}>Clear</button>}</form>
    <RemoteState {...state} onRetry={onRetry} label={`Loading ${section}`}>
      {rows.length === 0 ? <EmptyRecords title="No matching records" description="Try a different search or clear your filters."/> : <div className="admin-table-scroll" role="region" aria-label={`${section} results`} tabIndex={0}><table className="admin-table"><caption className="sr-only">{section} directory</caption>
        {section === "users" && <><thead><tr><th scope="col">Account</th><th scope="col">Access</th><th scope="col">Created</th><th scope="col">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Identity name={row.displayName} secondary={row.email}/><code className="admin-resource-id">{row.id}</code></td><td><span className={`admin-badge ${row.suspended ? "warning" : "positive"}`}>{row.suspended ? "Suspended" : "Active"}</span><span className="admin-badge">{row.appRole === "super_admin" ? "Super administrator" : row.isAdmin ? "Application admin" : "User"}</span>{row.id === user.id && <small className="admin-you">This is you</small>}</td><td><time dateTime={row.createdAt}>{dateLabel(row.createdAt)}</time></td><td><div className="admin-row-actions"><button onClick={() => onReview({ title: row.suspended ? "Reactivate account?" : "Suspend account?", label: row.suspended ? "Reactivate account" : "Suspend account", description: `${row.suspended ? "Restore application access for" : "Pause application access for"} ${row.displayName} (${row.email}).`, warning: row.suspended ? "The user can sign in again after reactivation." : "All current sessions will end. Their shared content is preserved.", path: `/admin/users/${row.id}`, body: { suspended: !row.suspended }, success: `Account ${row.suspended ? "reactivated" : "suspended"}.`, signOut: row.id === user.id && !row.suspended })}>{row.suspended ? "Reactivate" : "Suspend"}</button><button disabled={row.appRole === "super_admin"} title={row.appRole === "super_admin" ? "Super administrator access cannot be changed here" : undefined} onClick={() => onReview({ title: row.isAdmin ? "Revoke administrator access?" : "Grant administrator access?", label: row.isAdmin ? "Revoke admin access" : "Grant admin access", description: `${row.displayName} (${row.email}): ${row.isAdmin ? "application admin to user" : "user to application admin"}.`, warning: row.isAdmin ? "Current sessions will end. Workspace ownership is unchanged. The last active administrator is protected." : "This grants account management, workspace availability, and audit access across the application.", path: `/admin/users/${row.id}`, body: { isAdmin: !row.isAdmin }, success: `Administrator access ${row.isAdmin ? "revoked" : "granted"}.`, signOut: row.id === user.id && row.isAdmin })}>{row.isAdmin ? "Revoke admin" : "Grant admin"}</button></div></td></tr>)}</tbody></>}
        {section === "workspaces" && <><thead><tr><th scope="col">Workspace</th><th scope="col">Members / boards</th><th scope="col">Availability</th><th scope="col">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong><code className="admin-resource-id">{row.id}</code><small className="admin-cell-note">Created {dateLabel(row.createdAt)}</small></td><td>{row.memberCount} members · {row.boardCount} boards</td><td><span className={`admin-badge ${row.archived ? "warning" : "positive"}`}>{row.archived ? "Archived" : "Active"}</span></td><td><div className="admin-row-actions"><button onClick={() => onMembers(row)}>Review members</button><button onClick={() => onReview({ title: row.archived ? "Restore workspace?" : "Archive workspace?", label: row.archived ? "Restore workspace" : "Archive workspace", description: `${row.archived ? "Restore availability for" : "Archive"} ${row.name}.`, warning: row.archived ? "Members can access this workspace again. Closed boards remain closed." : "Members will lose access while the workspace is archived. Content is preserved for restoration.", path: `/admin/workspaces/${row.id}`, body: { archived: !row.archived }, success: `Workspace ${row.archived ? "restored" : "archived"}.` })}>{row.archived ? "Restore" : "Archive"}</button></div></td></tr>)}</tbody></>}
        {section === "boards" && <><thead><tr><th scope="col">Board</th><th scope="col">Workspace</th><th scope="col">Availability</th><th scope="col">Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.title}</strong><code className="admin-resource-id">{row.id}</code><small className="admin-cell-note">Created {dateLabel(row.createdAt)}</small></td><td>{row.workspaceName}<code className="admin-resource-id">{row.workspaceId}</code>{row.workspaceArchived && <span className="admin-badge warning">Workspace archived</span>}</td><td><span className={`admin-badge ${row.closed ? "warning" : "positive"}`}>{row.closed ? "Closed" : "Open"}</span></td><td><button onClick={() => onReview({ title: row.closed ? "Reopen board?" : "Close board?", label: row.closed ? "Reopen board" : "Close board", description: `${row.closed ? "Reopen" : "Close"} ${row.title}.`, warning: row.closed ? "Members can edit the board again when its workspace is active." : "The board becomes read-only for members. Its content is preserved.", path: `/admin/boards/${row.id}`, body: { closed: !row.closed }, success: `Board ${row.closed ? "reopened" : "closed"}.` })}>{row.closed ? "Reopen" : "Close"}</button></td></tr>)}</tbody></>}
        {section === "audit" && <><thead><tr><th scope="col">When / actor</th><th scope="col">Action</th><th scope="col">Target</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><time dateTime={row.createdAt}>{dateLabel(row.createdAt)}</time><strong className="admin-cell-note">{row.actorEmail || "Recorded administrator"}</strong><code className="admin-resource-id">{row.actorId}</code></td><td><span className="admin-audit-action">{row.action}</span>{row.details?.outcome && <small className="admin-cell-note">{row.details.outcome}</small>}</td><td><span className="admin-badge">{row.targetType}</span><code className="admin-resource-id">{row.targetId}</code></td></tr>)}</tbody></>}
      </table></div>}
      <Pagination page={state.data?.page || page} total={state.data?.total || 0} pageSize={state.data?.pageSize || pageSize} onPage={setPage} loading={state.loading}/>
    </RemoteState>
  </section>;
}
function Identity({ name, secondary }) {
  return <span className="admin-identity"><span className="avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>{secondary}</small></span></span>;
}
function MembersDialog({ workspace, onClose }) {
  const ref = useRef(null);
  const [revision, setRevision] = useState(0);
  const state = useRemote(`/admin/workspaces/${workspace.id}/members`, revision);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="modal wide" aria-label={`Members of ${workspace.name}`} onCancel={onClose}><header><h2>{workspace.name}: members</h2><button type="button" onClick={onClose} autoFocus>Close</button></header><p className="muted">Read-only membership review. Workspace roles are separate from application administrator access.</p><RemoteState {...state} onRetry={() => setRevision(v => v + 1)} label="Loading members">{state.data?.length === 0 ? <EmptyRecords title="No members" description="This workspace has no memberships to display."/> : <ul className="admin-members">{state.data?.map(member => <li key={member.id}><Identity name={member.displayName} secondary={member.email}/><span className="admin-badge">{member.role}</span>{member.suspended && <span className="admin-badge warning">Suspended</span>}</li>)}</ul>}</RemoteState></dialog>;
}
