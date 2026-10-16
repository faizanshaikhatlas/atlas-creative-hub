"use client";

import { useRef, useState } from "react";
import {
  Type,
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Minus,
  ImagePlus,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

function ElementButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-slate-600 transition hover:border-brand-500 hover:text-brand-700 hover:shadow-sm"
    >
      {children}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function ElementsPanel({ controllerRef }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);
  const setMobilePanel = useEditorStore((s) => s.setMobilePanel);

  const run = (fn) => {
    const c = controllerRef.current;
    if (!c) return;
    fn(c);
    // On mobile, close the sheet after adding so the user sees the canvas.
    setMobilePanel(null);
  };

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const c = controllerRef.current;
    if (!c) return;
    setError(null);
    try {
      await c.addImageFromFile(file);
      setMobilePanel(null);
    } catch (err) {
      setError(err?.message || "Could not add that image.");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Text
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <ElementButton label="Add text" onClick={() => run((c) => c.addText())}>
            <Type size={22} />
          </ElementButton>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Shapes
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <ElementButton label="Rectangle" onClick={() => run((c) => c.addRect())}>
            <Square size={22} />
          </ElementButton>
          <ElementButton label="Circle" onClick={() => run((c) => c.addCircle())}>
            <CircleIcon size={22} />
          </ElementButton>
          <ElementButton label="Triangle" onClick={() => run((c) => c.addTriangle())}>
            <TriangleIcon size={22} />
          </ElementButton>
          <ElementButton label="Line" onClick={() => run((c) => c.addLine())}>
            <Minus size={22} />
          </ElementButton>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Image
        </h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500 transition hover:border-brand-500 hover:text-brand-700"
        >
          <ImagePlus size={24} />
          <span className="text-xs font-medium">Upload from device</span>
          <span className="text-[11px] text-slate-400">PNG, JPG, WebP, GIF</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        {error && (
          <p className="mt-2 text-xs text-rose-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
