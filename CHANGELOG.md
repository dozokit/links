# Changelog

How to update your copy: [dozokit.com/links/guide#updating](https://dozokit.com/links/guide#updating).

## 1.0.3 – 2026-10-26

- The update button installs only the latest release, and only once it checks the release is signed with Dozokit's release key, which lives on one computer. A release that isn't signed with it is refused and nothing changes. Before, it took the newest files on GitHub as they were.
- Settings → Updates has Replace it, for copies that added the update button before 1.0.3: press it once to get the signed one.

## 1.0.2 – 2026-10-26

- Your own domain on links and QR codes, even when it isn't on Cloudflare: forward it here at your registrar (path and query kept), then type it in Settings → Your address. Saving checks the forwarding first.
- Settings → Updates adds the update button to your GitHub copy in one click. Cloudflare's Deploy button leaves it out, so copies made with the button need this once.

## 1.0.1 – 2026-10-26

- Admin: the new-link fields sit one below the other.
- Settings: a "Your address" section explains how to use your own domain; "Home page" and "Count scans in Dozokit Analytics" each have their own Save, and "Check the connection" sits with the Analytics fields.

## 1.0.0 – 2026-10-25

- First public release: short links and QR codes in your own Cloudflare account, a password-protected admin page, an editable destination, PNG and SVG QR downloads, a daily scan and click counter, and scans sent to Dozokit Analytics when you connect it.
