-- One row per short link. The slug is what follows the address (go.example.com/menu) and
-- never changes once created, so printed codes keep working; the destination can.
CREATE TABLE links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The built-in counter: opens per link, per day (UTC) and per way in (qr = the QR code, link = the plain short link).
-- No visitor data at all.
CREATE TABLE hits (
  slug TEXT NOT NULL,
  day TEXT NOT NULL,
  via TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (slug, day, via)
);

-- Settings typed in the admin page: home_url, analytics_url, analytics_site, analytics_last.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
