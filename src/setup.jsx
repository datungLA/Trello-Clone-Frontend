import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, setAccessToken } from "./api";

export default function SetupPage({ onComplete }) {
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setState("loading");
    try {
      const result = await api("/auth/bootstrap/status");
      setState(result.available ? "open" : "closed");
    } catch (error) { setState(error.status === 404 ? "closed" : "failed"); }
  }
  useEffect(() => { check(); }, []);
  useEffect(() => {
    const onFocus = () => { if (!busy) check(); };
    addEventListener("focus", onFocus);
    return () => removeEventListener("focus", onFocus);
  }, [busy]);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.confirmation) { setError("Passwords must match."); return; }
    delete values.confirmation;
    setBusy(true); setError("");
    try {
      const result = await api("/auth/bootstrap/register", { method: "POST", body: values });
      setState("closed");
      setAccessToken(result.accessToken);
      onComplete(result.user);
    } catch (error) {
      if (error.status === 404) setState("closed");
      else setError(error.message);
    } finally { setBusy(false); }
  }
  return <main className="setup-page"><section className="setup-card">
    {state === "loading" ? <p role="status">Checking setup availability...</p> : state === "closed" ? <><h1>Page not found</h1><p>This page is unavailable.</p><a href="/">Go to sign in</a></> : state === "failed" ? <><h1>Unable to load this page</h1><p role="alert">Check your connection and try again.</p><button onClick={check}>Try again</button></> : <>
      <ShieldCheck size={32} aria-hidden="true"/><span className="eyebrow">APPLICATION SETUP</span>
      <h1>Create the super administrator</h1><p>This one-time setup closes permanently after creation. Keep your credentials safe.</p>
      <form onSubmit={submit}><fieldset className="security-fields" disabled={busy}>
        <label className="field"><span>Private setup token</span><input name="setupToken" type="password" autoComplete="off" required spellCheck={false}/></label>
        <label className="field"><span>Full name</span><input name="displayName" autoComplete="name" required maxLength={80}/></label>
        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required/></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
        <label className="field"><span>Confirm password</span><input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary full">{busy ? "Creating account..." : "Create super administrator"}</button>
      </fieldset></form>
    </>}
  </section></main>;
}
