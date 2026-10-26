import type { Env } from "./index";

export interface Link {
  slug: string;
  url: string;
}

export type Settings = Partial<Record<"home_url" | "link_address" | "analytics_url" | "analytics_site" | "analytics_last", string>>;

// Each Cloudflare location keeps what it read for half a minute, so a scan rarely waits on
// the database. An edit therefore reaches every location within that half minute.
const TTL = 30_000;
const links = new Map<string, { link: Link | null; at: number }>();
let settingsCache: { value: Settings; at: number } | null = null;

export async function findLink(env: Env, slug: string): Promise<Link | null> {
  const hit = links.get(slug);
  if (hit && Date.now() - hit.at < TTL) return hit.link;
  const link = await env.DB.prepare("select slug, url from links where slug = ?").bind(slug).first<Link>();
  if (links.size > 5000) links.clear();
  links.set(slug, { link, at: Date.now() });
  return link;
}

export async function settings(env: Env): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < TTL) return settingsCache.value;
  const { results } = await env.DB.prepare("select key, value from settings").all<{ key: keyof Settings; value: string }>();
  const value: Settings = Object.fromEntries(results.map((r) => [r.key, r.value]));
  settingsCache = { value, at: Date.now() };
  return value;
}

// What this location changed shows right away here; other locations catch up within TTL.
export function forget(slug?: string) {
  if (slug === undefined) settingsCache = null;
  else links.delete(slug);
}
