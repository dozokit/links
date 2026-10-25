import { RESERVED, type Env } from "./index";
import { remember } from "./count";
import { forget, settings } from "./store";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// No 0/o or 1/l/i, so a name read off a poster is typed right.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function destination(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (!text || text.length > 2000) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text;
  try {
    const u = new URL(text);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : null;
  } catch {
    return null;
  }
}

const note = (raw: unknown) => (typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 200) : null);

async function listLinks(env: Env) {
  const since = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    `select l.slug, l.url, l.note, l.created_at, l.updated_at,
       coalesce(sum(case when h.via = 'qr' then h.n end), 0) as scans,
       coalesce(sum(case when h.via = 'link' then h.n end), 0) as clicks,
       coalesce(sum(case when h.day >= ? then h.n end), 0) as last30
     from links l left join hits h on h.slug = l.slug
     group by l.slug order by l.created_at desc`,
  ).bind(since).all();
  return json(results);
}

async function addLink(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown; slug?: unknown; note?: unknown };
  const url = destination(body.url);
  if (!url) return json({ error: "Type a web address, such as https://example.com/menu." }, 400);
  let slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (slug) {
    if (!SLUG.test(slug)) return json({ error: "Use letters, digits, - or _, up to 64, starting with a letter or digit." }, 400);
    if (RESERVED.has(slug)) return json({ error: `"${slug}" is used by the app itself. Pick another name.` }, 400);
  } else {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    slug = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  }
  const now = Date.now();
  const r = await env.DB.prepare("insert into links (slug, url, note, created_at, updated_at) values (?, ?, ?, ?, ?) on conflict do nothing")
    .bind(slug, url, note(body.note), now, now)
    .run();
  if (!r.meta.changes) return json({ error: `/${slug} is already taken. Pick another name.` }, 409);
  forget(slug);
  return json({ slug, url, note: note(body.note), created_at: now, updated_at: now, scans: 0, clicks: 0, last30: 0 }, 201);
}

// The name never changes, so codes already printed keep working: only where it leads does.
async function editLink(req: Request, env: Env, slug: string) {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown; note?: unknown };
  const url = destination(body.url);
  if (!url) return json({ error: "Type a web address, such as https://example.com/menu." }, 400);
  const r = await env.DB.prepare("update links set url = ?, note = ?, updated_at = ? where slug = ?").bind(url, note(body.note), Date.now(), slug).run();
  if (!r.meta.changes) return json({ error: "There is no such link." }, 404);
  forget(slug);
  return json({ ok: true, url });
}

async function deleteLink(env: Env, slug: string) {
  await env.DB.batch([env.DB.prepare("delete from links where slug = ?").bind(slug), env.DB.prepare("delete from hits where slug = ?").bind(slug)]);
  forget(slug);
  return json({ ok: true });
}

async function days(env: Env, slug: string) {
  const since = new Date(Date.now() - 89 * 86400_000).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare("select day, via, n from hits where slug = ? and day >= ? order by day").bind(slug, since).all();
  return json(results);
}

async function getSettings(env: Env) {
  const s = await settings(env);
  return json({ home_url: s.home_url ?? "", analytics_url: s.analytics_url ?? "", analytics_site: s.analytics_site ?? "", analytics_last: s.analytics_last ? JSON.parse(s.analytics_last) : null });
}

async function putSettings(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const home = typeof body.home_url === "string" && body.home_url.trim() ? destination(body.home_url) : "";
  if (home === null) return json({ error: "The home page has to be a web address, such as https://example.com." }, 400);
  let analytics = "";
  if (typeof body.analytics_url === "string" && body.analytics_url.trim()) {
    const u = destination(body.analytics_url);
    if (!u) return json({ error: "Type your Dozokit Analytics address, such as https://stats.example.com." }, 400);
    analytics = new URL(u).origin;
  }
  const site = typeof body.analytics_site === "string" ? body.analytics_site.trim() : "";
  if (site && !/^[A-Za-z0-9_-]{1,64}$/.test(site)) return json({ error: "The site id is the data-site value in your tracking tag, letters and digits only." }, 400);
  if (Boolean(analytics) !== Boolean(site)) return json({ error: "Fill in both the address and the site id, or neither." }, 400);
  const set = env.DB.prepare("insert or replace into settings (key, value) values (?, ?)");
  const del = env.DB.prepare("delete from settings where key = ?");
  await env.DB.batch([
    home ? set.bind("home_url", home) : del.bind("home_url"),
    analytics ? set.bind("analytics_url", analytics) : del.bind("analytics_url"),
    site ? set.bind("analytics_site", site) : del.bind("analytics_site"),
    del.bind("analytics_last"),
  ]);
  forget();
  return getSettings(env);
}

// Asks Dozokit Analytics whether it knows the site, without recording anything: a "ping"
// for a visit that doesn't exist changes no row.
async function testAnalytics(env: Env) {
  const s = await settings(env);
  if (!s.analytics_url || !s.analytics_site) return json({ error: "Save an address and a site id first." }, 400);
  let status: string;
  try {
    const res = await fetch(new URL("/api/collect", s.analytics_url), {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ site: s.analytics_site, t: "ping", v: "dozokitlinkstest", s: "dozokitlinkstest" }),
      signal: AbortSignal.timeout(5000),
    });
    status = String(res.status);
  } catch (err) {
    console.error(err);
    status = "unreachable";
  }
  await remember(env, s.analytics_last, status);
  return getSettings(env);
}

// This copy's release. Raise it with each tag on github.com/dozokit/links (v1.0.0) and its CHANGELOG.md entry.
const VERSION = "1.0.0";

// The newest release, when it is newer than this copy. GitHub is asked at most once a day
// per Cloudflare location (an hour after a failure); offline or rate-limited means no answer.
async function version() {
  let latest: string | null = null;
  try {
    const res = await fetch("https://api.github.com/repos/dozokit/links/releases/latest", {
      headers: { accept: "application/vnd.github+json", "user-agent": "dozokit-links" },
      signal: AbortSignal.timeout(3000),
      cf: { cacheTtlByStatus: { "200-299": 24 * 3600, "300-599": 3600 }, cacheEverything: true },
    });
    const tag = res.ok ? String(((await res.json()) as { tag_name?: string }).tag_name ?? "").replace(/^v/, "") : "";
    const [a, b] = [tag, VERSION].map((v) => v.split(".").map(Number));
    const i = a.findIndex((n, k) => n !== b[k]);
    if (/^\d+\.\d+\.\d+$/.test(tag) && i !== -1 && a[i] > b[i]) latest = tag;
  } catch {}
  return json({ version: VERSION, latest });
}

type Handler = (req: Request, env: Env, slug: string) => Promise<Response>;

// "METHOD /path": ":slug" stands for one path segment.
const ROUTES: Record<string, Handler> = {
  "GET /links": (_r, env) => listLinks(env),
  "POST /links": (req, env) => addLink(req, env),
  "PATCH /links/:slug": (req, env, slug) => editLink(req, env, slug),
  "DELETE /links/:slug": (_r, env, slug) => deleteLink(env, slug),
  "GET /links/:slug/days": (_r, env, slug) => days(env, slug),
  "GET /settings": (_r, env) => getSettings(env),
  "PUT /settings": (req, env) => putSettings(req, env),
  "POST /settings/test": (_r, env) => testAnalytics(env),
  "GET /version": () => version(),
};

export async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  let slug = "";
  try {
    slug = parts[1] ? decodeURIComponent(parts[1]).toLowerCase() : "";
  } catch {
    return json({ error: "Not found." }, 404);
  }
  const route = `${req.method} /${parts.map((p, i) => (i === 1 && parts[0] === "links" ? ":slug" : p)).join("/")}`;
  const handler = ROUTES[route];
  return handler ? handler(req, env, slug) : json({ error: "Not found." }, 404);
}
