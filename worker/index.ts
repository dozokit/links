import { api, CHECK } from "./api";
import { changePassword, login, logout, passwordRequired, setupNeeded, signedIn } from "./auth";
import { count } from "./count";
import { findLink, settings } from "./store";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PASSWORD?: string;
  LOGIN_LIMIT?: RateLimit;
}

// Addresses that belong to the app itself, so no link can take them.
export const RESERVED = new Set(["admin", "api", "assets", "icon.svg", "robots.txt", "favicon.ico"]);

const page = (status: number, title: string, text: string) =>
  new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#2a2421;background:#f6f1ec"><h1 style="font-size:1.4rem">${title}</h1><p>${text}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      // Writes only from the admin page itself, on top of the SameSite cookie.
      const origin = req.headers.get("origin");
      if (req.method !== "GET" && origin && origin !== url.origin) {
        return Response.json({ error: "Not allowed from another site." }, { status: 403 });
      }
      if (path === "/api/login" && req.method === "POST") return login(req, env);
      if (path === "/api/logout" && req.method === "POST") return logout(req);
      if (path === "/api/me") {
        return Response.json({ signedIn: await signedIn(req, env), passwordRequired: passwordRequired(env), setupNeeded: setupNeeded(req, env) });
      }
      const setup = setupNeeded(req, env);
      if (setup) return Response.json({ error: setup }, { status: 503 });
      if (!(await signedIn(req, env))) return Response.json({ error: "Sign in to see this." }, { status: 401 });
      if (path === "/api/password" && req.method === "POST") return changePassword(req, env);
      try {
        return await api(req, env, url);
      } catch (err) {
        console.error(err);
        return Response.json({ error: "That failed. The details are in the Worker logs." }, { status: 500 });
      }
    }

    // The admin page is a single page app: every address under /admin gets its index.html.
    if (path === "/admin" || path.startsWith("/admin/")) {
      // The sign-in page can't be shown inside another site's frame.
      const html = await env.ASSETS.fetch(new URL("/", url));
      return new Response(html.body, {
        headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "frame-ancestors 'none'", "x-frame-options": "DENY" },
      });
    }
    // The test request Settings sends through a new link address: echoes its nonce.
    if (path === CHECK) return new Response("Dozokit Links", { headers: { "x-dozokit-links": url.searchParams.get("n") ?? "", "cache-control": "no-store" } });
    if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });

    if (path === "/") {
      const { home_url } = await settings(env);
      if (home_url) return Response.redirect(home_url, 302);
      return page(200, "Short links", "This address forwards short links. Its owner manages them at /admin.");
    }

    // A link's name has no dot and no slash: anything else is one of the app's files (or, in
    // development, one of Vite's).
    if (/[./@]/.test(path.slice(1).replace(/\/$/, ""))) return env.ASSETS.fetch(req);

    let slug = "";
    try {
      slug = decodeURIComponent(path.slice(1)).replace(/\/+$/, "").toLowerCase();
    } catch {}
    const link = slug && !RESERVED.has(slug) ? await findLink(env, slug) : null;
    if (!link) return page(404, "This link doesn't exist", "Check the address, or ask whoever gave it to you for a new one.");

    // ?qr marks the address inside the QR codes this app draws: that is how a scan is told from a click.
    if (req.method === "GET") ctx.waitUntil(count(req, env, url, slug, url.searchParams.has("qr") ? "qr" : "link"));
    return new Response(null, { status: 302, headers: { location: link.url, "cache-control": "private, no-store" } });
  },
} satisfies ExportedHandler<Env>;
