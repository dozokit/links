import qrcode from "qrcode-generator";

// Text goes in as UTF-8, so accents survive (the library's default keeps one byte per character).
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

/** The code's dark modules, row by row. "M" recovers from 15 % damage: enough for print. */
export function matrix(text: string, level: "L" | "M" | "Q" | "H" = "M"): boolean[][] {
  const qr = qrcode(0, level);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

const QUIET = 4; // the blank border scanners need, in modules

export function svg(m: boolean[][], dark = "#000", light = "#fff") {
  const size = m.length + QUIET * 2;
  let d = "";
  m.forEach((row, r) => row.forEach((on, c) => on && (d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

export function png(m: boolean[][], px = 1024): Promise<Blob> {
  const size = m.length + QUIET * 2;
  const scale = Math.max(1, Math.floor(px / size));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  m.forEach((row, r) => row.forEach((on, c) => on && ctx.fillRect((c + QUIET) * scale, (r + QUIET) * scale, scale, scale)));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png"));
}

export function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
