import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ChangePassword } from "./Password";
import { TurnOnUpdates } from "./TurnOnUpdates";

interface Config {
  home_url: string;
  link_address: string;
  analytics_url: string;
  analytics_site: string;
  analytics_last: { status: string; at: number } | null;
}

// What Dozokit Analytics' answers mean, in the owner's words.
function connection(last: Config["analytics_last"]) {
  if (!last) return null;
  const when = new Date(last.at).toLocaleString();
  if (last.status === "202") return { ok: true, text: `Connected: Dozokit Analytics accepted the last one (${when}).` };
  if (last.status === "404") return { ok: false, text: `That site id is unknown to this Dozokit Analytics (${when}). Copy it from its Settings: it's the data-site value in the tag.` };
  if (last.status === "403") return { ok: false, text: `Dozokit Analytics refused it: the site's domain doesn't match ${location.hostname} (${when}). Add ${location.hostname} as a website there and use its id.` };
  if (last.status === "unreachable") return { ok: false, text: `No answer from that address (${when}). Check it opens your Dozokit Analytics dashboard.` };
  return { ok: false, text: `Dozokit Analytics answered ${last.status} (${when}).` };
}

export function Settings({ passwordRequired, version }: { passwordRequired: boolean; version?: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "testing" | `${"saving" | "saved" | "failed"}-${"address" | "home" | "analytics"}`>("idle");

  useEffect(() => {
    api<Config>("/api/settings").then(setCfg, (e: Error) => setError(e.message));
  }, []);
  if (!cfg) return <p className={error ? "help help--error" : "help"}>{error ?? "Loading…"}</p>;

  const status = connection(cfg.analytics_last);
  const edit = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCfg({ ...cfg, [k]: e.target.value });
    setState("idle");
    setError(null);
  };
  // Both forms save the whole config; `state` says which one the message belongs to.
  const save = (part: "home" | "analytics") => async (e: React.FormEvent) => {
    e.preventDefault();
    setState(`saving-${part}`);
    setError(null);
    try {
      setCfg(await api<Config>("/api/settings", { method: "PUT", body: JSON.stringify(cfg) }));
      setState(`saved-${part}`);
    } catch (err) {
      setError((err as Error).message);
      setState(`failed-${part}`);
    }
  };
  const homeError = state === "failed-home" ? error : null;
  const analyticsError = state === "failed-analytics" || state === "idle" ? error : null;

  return (
    <div className="settings">
      <form
        className="page-section"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("saving-address");
          setError(null);
          try {
            setCfg(await api<Config>("/api/settings/address", { method: "PUT", body: JSON.stringify({ link_address: cfg.link_address }) }));
            setState("saved-address");
          } catch (err) {
            setError((err as Error).message);
            setState("failed-address");
          }
        }}
      >
        <h2>Your address</h2>
        <p className="lead">
          Links and QR codes use <code>{cfg.link_address || location.host}/</code>. To print your own domain on them instead, like <code>go.example.com</code>, set it up one of
          two ways, then type it here:
        </p>
        <ol className="lead">
          <li>
            Domain on Cloudflare: open this Worker, then Settings → Domains &amp; Routes → Add → Custom domain.
          </li>
          <li>
            Domain anywhere else: at your registrar, forward <code>go.example.com</code> to <code>https://{location.host}</code>, keeping the path and the query (often called
            "forward path" or "keep URL path").
          </li>
        </ol>
        <div className="field-stack">
          <label className="field">
            <span>Address on your links (optional)</span>
            <input type="text" inputMode="url" spellCheck={false} placeholder="go.example.com" value={cfg.link_address} onChange={edit("link_address")} aria-describedby="address-help" />
          </label>
        </div>
        <div className="field-actions">
          <button type="submit" className="btn btn--ink" disabled={state === "saving-address"}>
            {state === "saving-address" ? "Checking" : "Check and save"}
          </button>
        </div>
        <p id="address-help" className={state === "failed-address" ? "help help--error" : "help"} role="status">
          {state === "failed-address"
            ? error
            : state === "saved-address"
              ? cfg.link_address
                ? `Saved: it reaches this page with the path and query kept. New links and QR codes use ${cfg.link_address}; codes already printed keep working.`
                : "Saved: links use this Worker's address."
              : "Saving sends one test request through the address first. Leave it empty to use this Worker's address."}
        </p>
      </form>

      <form className="page-section" onSubmit={save("home")}>
        <h2>Home page</h2>
        <p className="lead">
          Someone who opens <code>{location.host}/</code> with no name after it goes here. Leave it empty to show a blank page.
        </p>
        <div className="field-stack">
          <label className="field">
            <span>Home page address (optional)</span>
            <input type="text" inputMode="url" spellCheck={false} placeholder="https://example.com" value={cfg.home_url} onChange={edit("home_url")} aria-describedby="home-help" />
          </label>
        </div>
        <div className="field-actions">
          <button type="submit" className="btn btn--ink" disabled={state === "saving-home"}>
            {state === "saving-home" ? "Saving" : "Save"}
          </button>
        </div>
        <p id="home-help" className={homeError ? "help help--error" : "help"} role="status">
          {homeError ?? (state === "saved-home" ? "Saved." : "")}
        </p>
      </form>

      <form className="page-section" onSubmit={save("analytics")}>
        <h2>Count scans in Dozokit Analytics</h2>
        <p className="lead">
          Every scan and click is counted here already. If you run{" "}
          <a href="https://dozokit.com/analytics" target="_blank" rel="noopener">
            Dozokit Analytics
          </a>
          , each one also shows there as a visit to <code>{location.host}/name</code> and a goal: <code>qr_scan</code> or <code>link_click</code>, with the link's name.
          There, add <code>{location.hostname}</code> as a website (or use the one whose domain it belongs to), then copy its site id here.
        </p>
        <div className="field-stack">
          <label className="field">
            <span>Dozokit Analytics address</span>
            <input type="text" inputMode="url" spellCheck={false} placeholder="https://stats.example.com" value={cfg.analytics_url} onChange={edit("analytics_url")} />
            <span className="help">Leave it empty to count only here.</span>
          </label>
          <label className="field">
            <span>Site id</span>
            <input type="text" spellCheck={false} placeholder="data-site value" value={cfg.analytics_site} onChange={edit("analytics_site")} />
          </label>
        </div>
        <div className="field-actions">
          <button type="submit" className="btn btn--ink" disabled={state === "saving-analytics"}>
            {state === "saving-analytics" ? "Saving" : "Save"}
          </button>
          {cfg.analytics_url && cfg.analytics_site && (
            <button
              type="button"
              className="btn btn--quiet"
              disabled={state === "testing"}
              onClick={async () => {
                setState("testing");
                setError(null);
                try {
                  setCfg(await api<Config>("/api/settings/test", { method: "POST" }));
                } catch (err) {
                  setError((err as Error).message);
                }
                setState("idle");
              }}
            >
              {state === "testing" ? "Checking" : "Check the connection"}
            </button>
          )}
        </div>
        <p className={analyticsError || (status && !status.ok) ? "help help--error" : "help"} role="status">
          {analyticsError ?? (state === "saved-analytics" ? "Saved." : status?.text ?? "")}
        </p>
      </form>

      {passwordRequired && (
        <section className="page-section">
          <ChangePassword />
        </section>
      )}

      <section className="page-section">
        <h2>Updates</h2>
        <TurnOnUpdates />
      </section>

      <section className="page-section">
        <h2>Version</h2>
        <p className="help">
          Dozokit Links {version}. How to update: <a href="https://dozokit.com/links/guide#updating">dozokit.com/links/guide</a>.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await api("/api/logout", { method: "POST" });
            location.reload();
          }}
        >
          <button type="submit" className="btn btn--quiet">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
