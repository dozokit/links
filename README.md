# Dozokit Links

Short links and QR codes that run in your own Cloudflare account, so they keep working whether or not you pay anyone. Change where a printed code leads at any time, and see how many people scanned it.

One Worker answers the short links and serves a password-protected admin page; a D1 database keeps your links and the daily counts. The free Workers plan is enough for about 90,000 scans and clicks a day.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dozokit/links)

## Why

Most QR code services print *their* short address inside your code. When the free trial ends or you stop paying, they turn it off, and every menu, poster and business card you printed stops working. With Dozokit Links the address in the code is yours: it lives in your Cloudflare account, and nobody can switch it off but you.

If you'll never need to change where a code leads or count its scans, you don't need this: a plain QR code that holds the address itself never expires. [dozokit.com/qr-code-generator](https://dozokit.com/qr-code-generator) makes one for free.

## Set it up in five minutes

You need a free Cloudflare account and a GitHub (or GitLab) account.

1. **Click Deploy to Cloudflare** above and sign in to Cloudflare.
2. **Connect GitHub** when asked. Cloudflare copies this repository into your account; that copy is what it builds and deploys.
3. **Fill in the form.** Keep the names it suggests (`dozokit-links`) unless they clash with something you already have, and type a **password of 12 characters or more**: it is the one you will sign in with.
4. **Click Create and deploy** and wait a minute or two while it builds. Cloudflare creates the Worker, its database, and the database's tables.
5. **Open your admin page**: the address Cloudflare shows when it is done, followed by `/admin`, something like `https://dozokit-links.your-name.workers.dev/admin`. Sign in with your password.
6. **Create a link**: paste where it should lead, and optionally give it a name (`menu` gives `…/menu`). Download its QR code as PNG or SVG and print it.

That's it. A few things you may want later:

- **A short address of your own**, such as `go.example.com`. Domain on Cloudflare: open the Worker, then Settings → Domains & Routes → Add → Custom domain. Domain anywhere else: at your registrar, forward it to your `workers.dev` address keeping the path and query. Then type it in the admin page under Settings → Your address: **Check and save** tests the forwarding before links and QR codes use it. Do this **before you print codes**: a code holds the address it was made with. Links made earlier keep working on the `workers.dev` address too.
- **Change where a link leads**: in the admin page, Change where it leads. Codes already printed follow the new address within a minute.
- **See scans in Dozokit Analytics**: if you run [Dozokit Analytics](https://github.com/dozokit/analytics), open Settings in the admin page and give it your analytics address and a site id. Each scan or click then shows there as a visit, plus a goal named `qr_scan` or `link_click` with the link's name. The site's domain there has to match your links' address (add `go.example.com`, or use `example.com`, which covers its subdomains). Settings → Check the connection says whether it works.
- **Change the password**: Settings → Change password. Forgot it? In Cloudflare, open the Worker, then Settings → Variables and Secrets, and edit `PASSWORD`: that password works again.
- **Get updates**: the admin page tells you when a newer version is out. Open your copy on GitHub, then **Actions** → **Update Dozokit Links** → **Run workflow**. It installs the latest release, once it checks the release is signed with Dozokit's release key (a wrong or missing signature stops it and changes nothing), and keeps your `wrangler.jsonc` (it holds your database's id), and Cloudflare rebuilds and deploys within a couple of minutes, database changes included. [CHANGELOG.md](CHANGELOG.md) says what changed. **The first time**, add that button: Cloudflare's Deploy button copies everything except `.github`, so open Settings → Updates in the admin page, paste your copy's address and click **Add the update button**, then **Commit changes** on GitHub. Added it before 1.0.3? Press **Replace it** there instead: GitHub opens the file with the new version on your clipboard, so select everything, paste and **Commit changes**.

## How it counts

- A scan is an open of the address inside a QR code made here: it ends in `?qr`. A click is an open of the plain short link. Both are counted per link and per day (UTC).
- Link previews (Slack, WhatsApp, iMessage…), search engines and scripts are not counted, going by their user agent. Opening a link twice counts twice: nothing remembers who opened it.
- The built-in counter keeps only those daily numbers: no IP address, no cookie, nothing about the person.
- When Dozokit Analytics is connected, the Worker sends it the browser's user agent, language and referrer with each open, as a new visitor every time. Its country and city come from the Cloudflare location that handled the scan, which is usually, but not always, the scanner's own country.

## Run it locally

```bash
npm install
npm run db:migrate   # create the local D1 tables
npm run dev          # http://localhost:5191/admin
```

Locally the admin page opens without a password.

## Put it on Cloudflare by hand

```bash
npx wrangler d1 create dozokit-links --binding DB --update-config   # adds the database id to wrangler.jsonc
npx wrangler secret put PASSWORD                                  # 12 characters or more
npm run deploy                                                    # build, migrate the database, deploy
```

Without a `PASSWORD` secret, or with one under 12 characters, the deployed admin page shows nothing but a page asking for one. Short links keep working. Sign-in allows 5 attempts a minute per address.

## Limits

- A link's name can't change once created (printed codes depend on it); where it leads can. Names are lowercase letters, digits, `-` and `_`.
- A change of destination reaches every Cloudflare location within about 30 seconds.
- Deleting a link deletes its counts, and its codes show "This link doesn't exist".
- Only `http` and `https` destinations.

## Third parties

Short links talk to nobody but your Worker (and your Dozokit Analytics, if you connect it). The admin page loads its General Sans font from Fontshare. Once a day the Worker asks GitHub for the latest release, to tell you when a newer version exists.

## License

[AGPL-3.0](LICENSE). You can run, change and share it; if you offer a changed version to others as a service, share your changes too.
