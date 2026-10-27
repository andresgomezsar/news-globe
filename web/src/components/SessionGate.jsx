import React, { useEffect, useState } from "react";

export default function SessionGate({ children }) {
  const [signedIn, setSignedIn] = useState(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/session").then(r => setSignedIn(r.ok)).catch(() => setSignedIn(false));
    const expired = () => { setSignedIn(false); setError("Your session expired. Sign in again."); };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);

  const signIn = async event => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Unable to sign in");
      setToken(""); setSignedIn(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (response.ok || response.status === 401) setSignedIn(false);
    } catch { setError("Unable to sign out. Try again."); }
  };

  if (signedIn) return <>{children}<button className="session-logout chip" onClick={signOut}>Sign out</button></>;
  return (
    <main className="session-screen">
      <form className="panel session-panel" onSubmit={signIn}>
        <div className="brand"><span className="brand-dot" />NEWS GLOBE</div>
        <h1>Welcome back.</h1>
        <p className="tagline">Sign in to create and manage your briefings.</p>
        {signedIn === null ? <p>Checking your session…</p> : <>
          <label className="field-label" htmlFor="access-token">Access token</label>
          <input id="access-token" className="search-input" type="password" autoComplete="current-password"
            value={token} onChange={e => setToken(e.target.value)} required autoFocus />
          {error && <p role="alert">{error}</p>}
          <button className="generate" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </>}
      </form>
    </main>
  );
}
