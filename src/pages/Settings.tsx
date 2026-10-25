import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ChangePassword } from "./Password";

interface Config {
  home_url: string;
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
  const [state, setState] = useState<"idle" | "saving" | "saved" | "testing">("idle");

  useEffect(() => {
    api<Config>("/api/settings").then(setCfg, (e: Error) => setError(e.message));
  }, []);
  if (!cfg) return <p className={error ? "help help--error" : "help"}>{error ?? "Loading…"}</p>;

  const status = connection(cfg.analytics_last);
  const edit = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCfg({ ...cfg, [k]: e.target.value });
    setState("idle");
  };

  return (
    <div className="settings">
      <form
        className="page-section"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("saving");
          setError(null);
          try {
            setCfg(await api<Config>("/api/settings", { method: "PUT", body: JSON.stringify(cfg) }));
            setState("saved");
          } catch (err) {
            setError((err as Error).message);
            setState("idle");
          }
        }}
      >
        <h2>Count scans in Dozokit Analytics</h2>
        <p className="lead">
          Every scan and click is counted here already. If you run{" "}
          <a href="https://dozokit.com/analytics" target="_blank" rel="noopener">
            Dozokit Analytics
          </a>
          , each one also shows there as a visit to <code>{location.host}/name</code> and a goal: <code>qr_scan</code> or <code>link_click</code>, with the link's name.
          There, add <code>{location.hostname}</code> as a website (or use the one whose domain it belongs to), then copy its site id here.
        </p>
        <div className="field-row">
          <label className="field">
            <span>Dozokit Analytics address</span>
            <input type="text" inputMode="url" spellCheck={false} placeholder="https://stats.example.com" value={cfg.analytics_url} onChange={edit("analytics_url")} />
          </label>
          <label className="field">
            <span>Site id</span>
            <input type="text" spellCheck={false} placeholder="data-site value" value={cfg.analytics_site} onChange={edit("analytics_site")} />
          </label>
        </div>

        <h2 className="settings-h2">Home page</h2>
        <div className="field-row">
          <label className="field field--wide">
            <span>Where {location.host}/ leads (optional)</span>
            <input type="text" inputMode="url" spellCheck={false} placeholder="https://example.com" value={cfg.home_url} onChange={edit("home_url")} />
          </label>
        </div>

        <div className="field-row settings-save">
          <button type="submit" className="btn btn--ink" disabled={state === "saving"}>
            {state === "saving" ? "Saving" : "Save"}
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
        <p className={error || (status && !status.ok) ? "help help--error" : "help"} role="status">
          {error ?? status?.text ?? (state === "saved" ? "Saved." : "Leave the address empty to count only here.")}
        </p>
      </form>

      {passwordRequired && (
        <section className="page-section">
          <ChangePassword />
        </section>
      )}

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
