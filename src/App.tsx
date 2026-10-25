import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { Login, Setup } from "./pages/Login";
import { Links } from "./pages/Links";
import { Settings } from "./pages/Settings";

// setupNeeded: deployed without a usable PASSWORD, so the admin page stays shut until one is set.
type Auth = { signedIn: boolean; passwordRequired: boolean; setupNeeded: string | null };

export function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [release, setRelease] = useState<{ version: string; latest: string | null } | null>(null);
  const [tab, setTab] = useState<"links" | "settings">(() => (location.hash === "#settings" ? "settings" : "links"));

  const load = useCallback(async () => {
    try {
      setAuth(await api<Auth>("/api/me"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const out = () => setAuth((a) => (a ? { ...a, signedIn: false } : a));
    window.addEventListener("dozokit:signed-out", out);
    return () => window.removeEventListener("dozokit:signed-out", out);
  }, [load]);

  useEffect(() => {
    if (auth?.signedIn) api<typeof release>("/api/version").then(setRelease, () => {});
  }, [auth?.signedIn]);

  if (error && !auth) return <main className="container main"><p className="help help--error">{error}</p></main>;
  if (!auth) return <main className="container main" aria-busy="true" />;
  if (auth.setupNeeded) return <Setup message={auth.setupNeeded} />;
  if (!auth.signedIn) return <Login onDone={load} />;

  const go = (t: "links" | "settings") => {
    setTab(t);
    history.replaceState(null, "", t === "settings" ? "#settings" : location.pathname);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner container">
          <a href="/admin" className="wordmark" onClick={(e) => (e.preventDefault(), go("links"))}>
            <img src="/icon.svg" alt="" width="20" height="20" />
            Dozokit Links
          </a>
          <nav className="nav" aria-label="Sections">
            <a href="/admin" className="nav-link" aria-current={tab === "links" ? "page" : undefined} onClick={(e) => (e.preventDefault(), go("links"))}>
              Links
            </a>
            <a href="#settings" className="nav-link" aria-current={tab === "settings" ? "page" : undefined} onClick={(e) => (e.preventDefault(), go("settings"))}>
              Settings
            </a>
          </nav>
        </div>
      </header>

      {release?.latest && (
        <p className="update container">
          Version {release.latest} is available.{" "}
          <a href="https://dozokit.com/links/guide#updating" target="_blank" rel="noopener">
            What’s new and how to update →
          </a>
        </p>
      )}

      <main className="container main">{tab === "links" ? <Links /> : <Settings passwordRequired={auth.passwordRequired} version={release?.version} />}</main>
    </div>
  );
}
