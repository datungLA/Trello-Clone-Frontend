import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ArrowLeft, Check, ClipboardList, Columns3, LayoutDashboard, LockKeyhole, Monitor, PanelsTopLeft, UsersRound } from "lucide-react";

export function AdminIcon({ name, size = 20 }) {
  const icons = { overview: LayoutDashboard, users: UsersRound, workspaces: PanelsTopLeft, boards: Columns3, audit: ClipboardList, lock: LockKeyhole, arrow: ArrowLeft, device: Monitor, check: Check };
  const LucideIcon = icons[name] || LayoutDashboard;
  return <LucideIcon size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
export const dateLabel = value => value ? new Date(value).toLocaleString() : "Not recorded";

export function useRemote(path, revision = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    api(path).then(data => { if (active) setState({ data, loading: false, error: null }); })
      .catch(error => { if (active) setState({ data: null, loading: false, error }); });
    return () => { active = false; };
  }, [path, revision]);
  return state;
}

export function RemoteState({ loading, error, children, onRetry, label = "Loading records" }) {
  if (loading) return <div className="admin-loading" role="status"><div className="admin-skeleton" aria-hidden="true"/><p>{label}...</p></div>;
  if (error) return <div className="admin-empty" role="alert"><AdminIcon name="lock" size={28}/><h3>{error.status === 403 ? "Access is restricted" : "Records could not load"}</h3><p>{error.message}</p>{onRetry && <button onClick={onRetry}>Try again</button>}</div>;
  return children;
}

export function ConfirmDialog({ title, children, confirmLabel, busy, error, onConfirm, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="modal admin-confirm" aria-label={title} onCancel={e => {e.preventDefault(); e.stopPropagation(); if (!busy) onClose();}}>
    <div className="confirm-symbol"><AdminIcon name="lock" size={25}/></div>
    <h2>{title}</h2><div className="admin-confirm-body">{children}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" autoFocus disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy ? "Saving..." : confirmLabel}</button></div>
  </dialog>;
}

export function Pagination({ page, total, pageSize, onPage, loading }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="admin-pagination"><span>{total === 0 ? "No results" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}</span><nav aria-label="Results pages"><button disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span aria-live="polite">Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav></div>;
}
export function EmptyRecords({ title, description }) {
  return <div className="admin-empty"><AdminIcon name="overview" size={28}/><h3>{title}</h3><p>{description}</p></div>;
}
