import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";

export function AdminIcon({ name, size = 20 }) {
  const paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    workspaces: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    boards: "M3 4h18v16H3zM7 8h3v8H7zM14 8h3v5h-3z",
    audit: "M7 3h10v3H7zM7 5H4v16h16V5h-3M8 11h8M8 15h8",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    arrow: "M19 12H5m6-6-6 6 6 6",
    device: "M3 4h18v13H3zM8 21h8M12 17v4",
    check: "m5 12 4 4L19 6",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.overview}/></svg>;
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
