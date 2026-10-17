"use client";

import { useState } from "react";
import { QrCode, Loader2 } from "lucide-react";

// QR codes are generated locally (pure-JS qrcode-generator) and inserted as a
// normal image, so they move, resize, export, and persist like any element.

function renderQrDataUrl(qrcode, text, { dark, light, scale = 8, margin = 4 }) {
  const qr = qrcode(0, "M"); // type 0 = auto-size, error-correction level M
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const size = (count + margin * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dark;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    }
  }
  return canvas.toDataURL("image/png");
}

export default function QRPanel({ controllerRef }) {
  const [text, setText] = useState("https://atlasuniversity.edu.in");
  const [dark, setDark] = useState("#0f172a");
  const [light, setLight] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const c = () => controllerRef.current;

  async function insert() {
    const value = text.trim();
    if (!value) {
      setError("Enter a URL or text to encode.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qrcode = (await import("qrcode-generator")).default;
      const url = renderQrDataUrl(qrcode, value, { dark, light });
      await c()?.addImageFromUrl(url);
    } catch (err) {
      console.error("QR generation failed:", err);
      setError(
        err?.message?.includes("code length overflow") || err?.message?.includes("overflow")
          ? "Too much data for a QR code — try a shorter URL/text."
          : "Could not generate the QR code."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-scroll flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">URL or text</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="https://example.com or any text"
          className="w-full resize-none rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Foreground</label>
          <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-0.5" aria-label="QR foreground color" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Background</label>
          <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-0.5" aria-label="QR background color" />
        </div>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <button
        type="button"
        onClick={insert}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
        {busy ? "Generating…" : "Add QR code"}
      </button>

      <p className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        The QR code is added as an image — move, resize, or recolor by
        regenerating. For reliable scanning keep strong contrast (dark on light).
      </p>
    </div>
  );
}
