import React, { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", requiredText, requirePassword = false, busy = false, error = "", onClose, onConfirm }) {
  const dialog = useRef(null);
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-message" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="confirm-title"><TriangleAlert size={20} aria-hidden="true"/>{title}</h2>
    <p id="confirm-message">{message}</p>
    {requiredText && <label className="field"><span>Type {requiredText} to confirm</span><input autoFocus value={value} onChange={e => setValue(e.target.value)}/></label>}
    {requirePassword && <label className="field"><span>Enter your current password</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="confirm-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="danger" disabled={busy || (requiredText && value !== requiredText) || (requirePassword && !password)} onClick={() => onConfirm({ password })}>{busy ? "Working..." : confirmLabel}</button></div>
  </dialog>;
}
