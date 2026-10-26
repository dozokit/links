import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { matrix, png, save, svg } from "../lib/qr";

export interface Link {
  slug: string;
  url: string;
  note: string | null;
  created_at: number;
  updated_at: number;
  scans: number;
  clicks: number;
  last30: number;
}

const short = (slug: string) => `${location.origin}/${slug}`;
// What the QR code holds: the short link plus ?qr, which is how a scan is told from a click.
const coded = (slug: string) => `${short(slug)}?qr`;
const n = (v: number) => v.toLocaleString("en");

function NewLink({ onAdded }: { onAdded: (l: Link) => void }) {
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="page-section"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onAdded(await api<Link>("/api/links", { method: "POST", body: JSON.stringify({ url, slug, note }) }));
          setUrl("");
          setSlug("");
          setNote("");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>New short link</h2>
      <div className="field-stack">
        <label className="field">
          <span>Where it leads</span>
          <input name="url" type="text" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://example.com/menu" required value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="new-help" />
        </label>
        <label className="field">
          <span>Name (optional)</span>
          <span className="prefixed">
            <span className="prefix">{location.host}/</span>
            <input name="slug" type="text" autoComplete="off" spellCheck={false} placeholder="menu" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span>Note (optional)</span>
          <input name="note" type="text" autoComplete="off" placeholder="Poster at the front door" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="field-actions">
        <button type="submit" className="btn btn--ink" disabled={busy}>
          {busy ? "Creating" : "Create link"}
        </button>
      </div>
      <p id="new-help" className={error ? "help help--error" : "help"}>
        {error ?? "Leave the name empty for a random one. The name can't change later, so printed codes keep working; where it leads can."}
      </p>
    </form>
  );
}

function Qr({ slug }: { slug: string }) {
  const m = useMemo(() => matrix(coded(slug)), [slug]);
  return <span className="qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg(m) }} />;
}

function Days({ slug }: { slug: string }) {
  const [rows, setRows] = useState<{ day: string; via: string; n: number }[] | null>(null);
  useEffect(() => {
    api<typeof rows>(`/api/links/${encodeURIComponent(slug)}/days`).then(setRows, () => setRows([]));
  }, [slug]);
  if (!rows) return <p className="help">Loading…</p>;
  const days: { day: string; qr: number; link: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const of = (via: string) => rows.find((r) => r.day === day && r.via === via)?.n ?? 0;
    days.push({ day, qr: of("qr"), link: of("link") });
  }
  const max = Math.max(1, ...days.map((d) => d.qr + d.link));
  return (
    <figure className="days">
      <div className="days-bars" role="img" aria-label={`Opens per day over the last 30 days, ${n(days.reduce((s, d) => s + d.qr + d.link, 0))} in all`}>
        {days.map((d) => (
          <span key={d.day} className="days-bar" title={`${d.day}: ${d.qr} scans, ${d.link} clicks`}>
            <span className="days-link" style={{ height: `${(d.link / max) * 100}%` }} />
            <span className="days-qr" style={{ height: `${(d.qr / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <figcaption className="help">
        Last 30 days (UTC). <span className="key key--qr" /> QR scans <span className="key key--link" /> link clicks
      </figcaption>
    </figure>
  );
}

function Row({ link, onChange, onDelete }: { link: Link; onChange: (l: Link) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(link.url);
  const [note, setNote] = useState(link.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="link-card">
      <div className="link-main">
        <Qr slug={link.slug} />
        <div className="link-text">
          <p className="link-short">
            <a href={short(link.slug)} target="_blank" rel="noopener" className="path">
              {location.host}/{link.slug}
            </a>
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={async () => {
                await navigator.clipboard.writeText(short(link.slug));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </p>
          <p className="link-dest">
            → <span className="path">{link.url}</span>
          </p>
          {link.note && <p className="help">{link.note}</p>}
        </div>
        <dl className="link-figs">
          <div>
            <dt>QR scans</dt>
            <dd className="fig">{n(link.scans)}</dd>
          </div>
          <div>
            <dt>Clicks</dt>
            <dd className="fig">{n(link.clicks)}</dd>
          </div>
          <div>
            <dt>Last 30 days</dt>
            <dd className="fig">{n(link.last30)}</dd>
          </div>
        </dl>
      </div>

      <div className="link-actions">
        <button type="button" className="btn btn--card btn--small" onClick={async () => save(await png(matrix(coded(link.slug))), `qr-${link.slug}.png`)}>
          QR code PNG
        </button>
        <button type="button" className="btn btn--card btn--small" onClick={() => save(new Blob([svg(matrix(coded(link.slug)))], { type: "image/svg+xml" }), `qr-${link.slug}.svg`)}>
          QR code SVG
        </button>
        <button type="button" className="btn btn--quiet btn--small" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          Change where it leads
        </button>
        <button type="button" className="btn btn--quiet btn--small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide days" : "Opens per day"}
        </button>
      </div>

      {open && <Days slug={link.slug} />}

      {editing && (
        <form
          className="link-edit"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await api<{ url: string }>(`/api/links/${encodeURIComponent(link.slug)}`, { method: "PATCH", body: JSON.stringify({ url, note }) });
              onChange({ ...link, url: r.url, note: note.trim() || null, updated_at: Date.now() });
              setUrl(r.url);
              setEditing(false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field-row">
            <label className="field field--wide">
              <span>Where it leads</span>
              <input type="text" inputMode="url" spellCheck={false} required value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={Boolean(error)} />
            </label>
            <label className="field">
              <span>Note</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--ink" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
          </div>
          <p className={error ? "help help--error" : "help"}>{error ?? "Codes already printed lead to the new address within a minute."}</p>
          <div className="danger">
            {confirm ? (
              <>
                <span>Codes and links already shared will show “This link doesn't exist”, and its counts go too.</span>
                <button
                  type="button"
                  className="btn btn--danger btn--small"
                  onClick={async () => {
                    await api(`/api/links/${encodeURIComponent(link.slug)}`, { method: "DELETE" });
                    onDelete();
                  }}
                >
                  Delete /{link.slug}
                </button>
                <button type="button" className="btn btn--quiet btn--small" onClick={() => setConfirm(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--quiet btn--small" onClick={() => setConfirm(true)}>
                Delete this link
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

export function Links() {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Link[]>("/api/links").then(setLinks, (e: Error) => setError(e.message));
  }, []);

  return (
    <div className="links">
      <NewLink onAdded={(l) => setLinks((ls) => [l, ...(ls ?? [])])} />
      <section className="page-section">
        <h2>Your links</h2>
        {error && <p className="help help--error">{error}</p>}
        {links && !links.length && <p className="muted">No link yet. Create one above: it gets a short address and a QR code to print.</p>}
        {links && links.length > 0 && (
          <ul className="link-list">
            {links.map((l) => (
              <Row
                key={l.slug}
                link={l}
                onChange={(next) => setLinks((ls) => ls!.map((x) => (x.slug === next.slug ? next : x)))}
                onDelete={() => setLinks((ls) => ls!.filter((x) => x.slug !== l.slug))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
