import type { Env } from "./index";
import { forget, settings } from "./store";

// Link previews (Slack, WhatsApp, iMessage…), search engines and scripts open links too: not people.
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|embedly|quora link|vercel|pingdom|uptime|monitor|curl|wget|python-requests|go-http|axios|node-fetch/i;

const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

// One open of a short link: always added to the built-in daily counter, and sent to the
// owner's Dozokit Analytics as a visit plus a goal (qr_scan or link_click) when it is connected.
export async function count(req: Request, env: Env, url: URL, slug: string, via: "qr" | "link") {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return;
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare("insert into hits (slug, day, via, n) values (?, ?, ?, 1) on conflict (slug, day, via) do update set n = n + 1")
    .bind(slug, day, via)
    .run();

  const cfg = await settings(env);
  if (!cfg.analytics_url || !cfg.analytics_site) return;
  // The visit lands on the short link's own address, tagged when it came from the QR code,
  // so Dozokit Analytics files it under "qr-code" like any campaign.
  const page = `${url.origin}/${slug}${via === "qr" ? "?utm_source=qr-code&utm_medium=qr" : ""}`;
  // A fresh visitor and visit for each open: this app keeps nothing that could recognise someone.
  const base = { site: cfg.analytics_site, v: id(), s: id(), u: page };
  const headers = { "content-type": "text/plain", "user-agent": ua, "accept-language": req.headers.get("accept-language") ?? "" };
  const send = (hit: object) =>
    fetch(new URL("/api/collect", cfg.analytics_url), { method: "POST", headers, body: JSON.stringify({ ...base, ...hit }), signal: AbortSignal.timeout(5000) });
  let status: string;
  try {
    const view = await send({ t: "pageview", n: true, r: req.headers.get("referer") ?? "", ti: `/${slug}`, l: (req.headers.get("accept-language") ?? "").split(/[,;]/)[0] });
    status = String(view.status);
    if (view.ok) status = String((await send({ t: "event", name: via === "qr" ? "qr_scan" : "link_click", p: { link: slug } })).status);
  } catch (err) {
    console.error(err);
    status = "unreachable";
  }
  await remember(env, cfg.analytics_last, status);
}

// The admin page shows how the last send went. Written only when the answer changes, so a
// working connection costs no extra database write per scan.
export async function remember(env: Env, last: string | undefined, status: string) {
  if (last && JSON.parse(last).status === status) return;
  await env.DB.prepare("insert or replace into settings (key, value) values ('analytics_last', ?)")
    .bind(JSON.stringify({ status, at: Date.now() }))
    .run();
  forget();
}
