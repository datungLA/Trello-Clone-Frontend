import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { changePassword } from "./api";

export default function PasswordSettings({ onSignedOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    if (values.get("newPassword") !== values.get("confirmation")) {
      setError("New passwords must match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(values.get("currentPassword"), values.get("newPassword"));
      onSignedOut("Password updated. All devices were signed out. Log in with your new password.");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="password-settings-title">
    <h3 id="password-settings-title" className="security-heading"><KeyRound size={18} aria-hidden="true"/>Change password</h3>
    <p className="muted" id="password-change-help">Changing your password signs out every device, including this one.</p>
    <form onSubmit={submit} aria-describedby="password-change-help">
      <fieldset className="security-fields" disabled={busy}>
        <label className="field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
        <label className="field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label>
        <label className="field"><span>Confirm new password</span><input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary">{busy ? "Updating password..." : "Update password and sign out"}</button>
      </fieldset>
    </form>
  </section>;
}
