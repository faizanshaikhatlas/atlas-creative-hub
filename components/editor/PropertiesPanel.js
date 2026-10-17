"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trash2,
  Copy,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BringToFront,
  SendToBack,
  MousePointerClick,
  FlipHorizontal,
  FlipVertical,
  Link,
  Unlink,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { SIZE_PRESETS, clampDim, listUploads } from "@/lib/db/projects";
import { FONTS } from "@/lib/fonts";

function Row({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorField({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
      />
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
      />
    </div>
  );
}

/**
 * Numeric field that commits only on blur or Enter (so typing "150" doesn't
 * resize through 1 → 15 → 150). Re-syncs if the underlying value changes
 * externally, e.g. when the object is drag-resized on the canvas.
 */
function DimInput({ value, onCommit, ariaLabel }) {
  const [v, setV] = useState(String(value));
  useEffect(() => {
    setV(String(value));
  }, [value]);
  const commit = () => {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1) onCommit(Math.round(n));
    else setV(String(value));
  };
  return (
    <input
      type="number"
      min={1}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
      }}
      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
      aria-label={ariaLabel}
    />
  );
}

function Toggle({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 flex-1 items-center justify-center rounded-md border transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

const CROPS = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
];

const MASKS = [
  { label: "None", value: "none" },
  { label: "Circle", value: "circle" },
  { label: "Rounded", value: "rounded" },
  { label: "Triangle", value: "triangle" },
  { label: "Diamond", value: "diamond" },
];

const ANIMATIONS = [
  ["none", "None"],
  ["fade", "Fade in"],
  ["rise", "Rise up"],
  ["pop", "Pop"],
  ["slide", "Slide in"],
];

const BLEND_MODES = [
  ["source-over", "Normal"],
  ["multiply", "Multiply"],
  ["screen", "Screen"],
  ["overlay", "Overlay"],
  ["darken", "Darken"],
  ["lighten", "Lighten"],
  ["color-burn", "Color burn"],
  ["color-dodge", "Color dodge"],
  ["hard-light", "Hard light"],
  ["soft-light", "Soft light"],
  ["difference", "Difference"],
  ["exclusion", "Exclusion"],
  ["luminosity", "Luminosity"],
];

const DUOTONE_PRESETS = [
  { label: "Indigo", shadow: "#1e1b4b", highlight: "#e0e7ff" },
  { label: "Teal", shadow: "#042f2e", highlight: "#ccfbf1" },
  { label: "Rose", shadow: "#4c0519", highlight: "#ffe4e6" },
  { label: "Amber", shadow: "#451a03", highlight: "#fde68a" },
  { label: "Ocean", shadow: "#0c2d6b", highlight: "#dbeafe" },
  { label: "Mono", shadow: "#0a0a0a", highlight: "#fafafa" },
];

function FillControl({ sel, controllerRef, allowImage }) {
  const c = () => controllerRef.current;
  const fileRef = useRef(null);
  const fillType = sel.fillType || "solid";
  const grad = sel.gradient || {
    type: "linear",
    colors: [typeof sel.fill === "string" ? sel.fill : "#6366f1", "#ec4899"],
    angle: 90,
  };

  const chooseType = (t) => {
    if (t === "solid") {
      c()?.setSolidFill(typeof sel.fill === "string" ? sel.fill : "#6366f1");
    } else if (t === "gradient") {
      c()?.setGradientFill(grad);
    } else if (t === "image") {
      fileRef.current?.click();
    }
  };
  const updateGrad = (patch) => c()?.setGradientFill({ ...grad, ...patch });

  function handleFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) c()?.fillWithImageFromFile(f).catch(() => {});
  }

  const tabs = ["solid", "gradient", ...(allowImage ? ["image"] : [])];
  const tabLabel = { solid: "Solid", gradient: "Gradient", image: "Image" };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => chooseType(t)}
            className={`flex-1 rounded-md border py-1 text-xs font-medium transition ${
              fillType === t
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {fillType === "solid" && (
        <ColorField value={sel.fill} onChange={(v) => c()?.setSolidFill(v)} />
      )}

      {fillType === "gradient" && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Toggle
              title="Linear"
              active={grad.type === "linear"}
              onClick={() => updateGrad({ type: "linear" })}
            >
              <span className="text-xs">Linear</span>
            </Toggle>
            <Toggle
              title="Radial"
              active={grad.type === "radial"}
              onClick={() => updateGrad({ type: "radial" })}
            >
              <span className="text-xs">Radial</span>
            </Toggle>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={grad.colors[0]}
              onChange={(e) => updateGrad({ colors: [e.target.value, grad.colors[1]] })}
              className="h-9 flex-1 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
              aria-label="Gradient start"
            />
            <input
              type="color"
              value={grad.colors[1]}
              onChange={(e) => updateGrad({ colors: [grad.colors[0], e.target.value] })}
              className="h-9 flex-1 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
              aria-label="Gradient end"
            />
          </div>
          {grad.type === "linear" && (
            <div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Angle</span>
                <span className="tabular-nums">{Math.round(grad.angle)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={grad.angle}
                onChange={(e) => updateGrad({ angle: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </div>
          )}
        </div>
      )}

      {fillType === "image" && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Replace image
        </button>
      )}

      {allowImage && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      )}
    </div>
  );
}

function AdjustSlider({ label, value, onChange }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">{pct}</span>
      </div>
      <input
        type="range"
        min={-100}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

function ShadowSlider({ label, min, max, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

/**
 * Drop-shadow editor for the active object (text, shape, or image): an On/Off
 * toggle plus color, blur, and offset controls once enabled. Renders bare so it
 * can be dropped into any "Effects" container.
 */
function ShadowControl({ sel, controllerRef }) {
  const c = () => controllerRef.current;
  const on = !!sel.hasShadow;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">Shadow</span>
        <Toggle
          title="Toggle shadow"
          active={on}
          onClick={() => c()?.setShadow(!on, sel.shadowColor)}
        >
          <span className="text-xs font-medium">{on ? "On" : "Off"}</span>
        </Toggle>
      </div>
      {on && (
        <div className="space-y-2">
          <ColorField
            value={sel.shadowColor}
            onChange={(v) => c()?.setShadowProps({ color: v })}
          />
          <ShadowSlider
            label="Blur"
            min={0}
            max={60}
            value={sel.shadowBlur ?? 10}
            onChange={(v) => c()?.setShadowProps({ blur: v })}
          />
          <ShadowSlider
            label="Offset X"
            min={-60}
            max={60}
            value={sel.shadowOffsetX ?? 4}
            onChange={(v) => c()?.setShadowProps({ offsetX: v })}
          />
          <ShadowSlider
            label="Offset Y"
            min={-60}
            max={60}
            value={sel.shadowOffsetY ?? 4}
            onChange={(v) => c()?.setShadowProps({ offsetY: v })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Two-color duotone editor for an image: preset pairs plus independent shadow /
 * highlight color pickers. Each change re-applies the duotone filter stack.
 */
function DuotoneControl({ sel, controllerRef }) {
  const c = () => controllerRef.current;
  const shadow = sel.duotoneShadow || "#1e1b4b";
  const highlight = sel.duotoneHighlight || "#e0e7ff";
  const apply = (patch) => c()?.setImageAdjustments({ duotone: true, ...patch });
  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-1.5">
        {DUOTONE_PRESETS.map((p) => {
          const active =
            p.shadow.toLowerCase() === shadow.toLowerCase() &&
            p.highlight.toLowerCase() === highlight.toLowerCase();
          return (
            <button
              key={p.label}
              type="button"
              title={p.label}
              onClick={() => apply({ duotoneShadow: p.shadow, duotoneHighlight: p.highlight })}
              className={`h-7 w-7 overflow-hidden rounded-full border transition ${
                active ? "ring-2 ring-brand-500 ring-offset-1" : "border-slate-200 hover:scale-105"
              }`}
            >
              <span
                className="block h-full w-full"
                style={{ background: `linear-gradient(135deg, ${p.shadow} 0 50%, ${p.highlight} 50% 100%)` }}
              />
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[11px] text-slate-500">Shadows</span>
          <input
            type="color"
            value={shadow}
            onChange={(e) => apply({ duotoneShadow: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
            aria-label="Duotone shadow color"
          />
        </div>
        <div>
          <span className="mb-1 block text-[11px] text-slate-500">Highlights</span>
          <input
            type="color"
            value={highlight}
            onChange={(e) => apply({ duotoneHighlight: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
            aria-label="Duotone highlight color"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Replace the active image while keeping its frame. Offers a device file picker
 * and a grid of the user's saved uploads; either path calls replaceActiveImage.
 */
function ReplaceControl({ controllerRef }) {
  const c = () => controllerRef.current;
  const fileRef = useRef(null);
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    let alive = true;
    listUploads()
      .then((u) => alive && setUploads(u || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const replaceWith = (url) => c()?.replaceActiveImage(url).catch(() => {});

  function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type?.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => replaceWith(String(r.result));
    r.readAsDataURL(f);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Upload from device…
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {uploads.length > 0 && (
        <>
          <p className="text-[11px] text-slate-400">From your uploads</p>
          <div className="grid grid-cols-4 gap-1.5">
            {uploads.slice(0, 12).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => replaceWith(u.dataUrl)}
                title={u.name || "Upload"}
                className="aspect-square overflow-hidden rounded-md border border-slate-200 transition hover:ring-2 hover:ring-brand-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.dataUrl} alt={u.name || "Upload"} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PageSizeControl({ onResizePage }) {
  const pageSize = useEditorStore((s) => s.pageSize);
  const [w, setW] = useState(pageSize.width);
  const [h, setH] = useState(pageSize.height);

  // Keep local inputs in sync when the active page changes.
  useEffect(() => {
    setW(pageSize.width);
    setH(pageSize.height);
  }, [pageSize.width, pageSize.height]);

  const presetId =
    SIZE_PRESETS.find((p) => p.width === w && p.height === h)?.id || "custom";

  function applyPreset(id) {
    const preset = SIZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setW(preset.width);
    setH(preset.height);
    onResizePage?.(preset.width, preset.height, false);
  }

  function applyCustom(allPages) {
    const cw = clampDim(w, pageSize.width);
    const ch = clampDim(h, pageSize.height);
    setW(cw);
    setH(ch);
    onResizePage?.(cw, ch, allPages);
  }

  return (
    <Row label="Page size">
      <div className="space-y-2">
        <select
          value={presetId}
          onChange={(e) => e.target.value !== "custom" && applyPreset(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
        >
          <option value="custom">Custom</option>
          {SIZE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.width}×{p.height})
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={50}
            max={5000}
            value={w}
            onChange={(e) => setW(Number(e.target.value) || 0)}
            onBlur={() => applyCustom(false)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom(false)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
            aria-label="Width"
          />
          <span className="text-xs text-slate-400">×</span>
          <input
            type="number"
            min={50}
            max={5000}
            value={h}
            onChange={(e) => setH(Number(e.target.value) || 0)}
            onBlur={() => applyCustom(false)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom(false)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
            aria-label="Height"
          />
        </div>
        <button
          type="button"
          onClick={() => applyCustom(true)}
          className="w-full rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Apply to all pages
        </button>
      </div>
    </Row>
  );
}

export default function PropertiesPanel({ controllerRef, onResizePage }) {
  const sel = useEditorStore((s) => s.selection);
  const pageBackground = useEditorStore((s) => s.pageBackground);
  const c = () => controllerRef.current;
  const set = (k, v) => c()?.setActiveProp(k, v);
  const [lockAspect, setLockAspect] = useState(true);

  if (!sel) {
    return (
      <div className="ds-scroll flex h-full flex-col gap-5 overflow-y-auto p-4">
        <Row label="Page background">
          <ColorField
            value={pageBackground}
            onChange={(v) => c()?.setPageBackground(v)}
          />
        </Row>
        <PageSizeControl onResizePage={onResizePage} />
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-400">
          <MousePointerClick size={28} className="mb-3" />
          <p className="text-sm font-medium text-slate-500">Nothing selected</p>
          <p className="mt-1 text-xs">
            Click an object on the canvas to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  const isText = sel.isText;
  const showFill = !sel.isImage && !sel.isMultiple;
  const showStroke = !sel.isImage && !sel.isMultiple;

  return (
    <div className="ds-scroll flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* Actions */}
      <div className="flex items-center gap-1">
        <span className="mr-auto text-sm font-semibold capitalize text-slate-700">
          {sel.isMultiple ? "Multiple" : isText ? "Text" : (sel.type || "Object")}
        </span>
        <button
          type="button"
          title="Bring forward"
          onClick={() => c()?.bringForward()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <BringToFront size={16} />
        </button>
        <button
          type="button"
          title="Send backward"
          onClick={() => c()?.sendBackward()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <SendToBack size={16} />
        </button>
        <button
          type="button"
          title="Duplicate"
          onClick={() => c()?.duplicateActive()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          title="Delete"
          onClick={() => c()?.deleteActive()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isText && (
        <>
          <Row label="Text">
            <textarea
              value={sel.text ?? ""}
              onChange={(e) => set("text", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
            />
          </Row>

          <div className="grid grid-cols-2 gap-3">
            <Row label="Font">
              <select
                value={sel.fontFamily || FONTS[0].css}
                onChange={(e) => c()?.setActiveFont(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.css}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Size">
              <input
                type="number"
                min={4}
                max={400}
                value={Math.round(sel.fontSize ?? 0)}
                onChange={(e) => set("fontSize", Number(e.target.value) || 1)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
              />
            </Row>
          </div>

          <div className="flex gap-1.5">
            <Toggle
              title="Bold"
              active={String(sel.fontWeight) === "700" || sel.fontWeight === "bold"}
              onClick={() =>
                set(
                  "fontWeight",
                  String(sel.fontWeight) === "700" || sel.fontWeight === "bold"
                    ? "400"
                    : "700"
                )
              }
            >
              <Bold size={16} />
            </Toggle>
            <Toggle
              title="Italic"
              active={sel.fontStyle === "italic"}
              onClick={() =>
                set("fontStyle", sel.fontStyle === "italic" ? "normal" : "italic")
              }
            >
              <Italic size={16} />
            </Toggle>
            <Toggle
              title="Underline"
              active={!!sel.underline}
              onClick={() => set("underline", !sel.underline)}
            >
              <Underline size={16} />
            </Toggle>
          </div>

          <div className="flex gap-1.5">
            <Toggle
              title="Align left"
              active={sel.textAlign === "left"}
              onClick={() => set("textAlign", "left")}
            >
              <AlignLeft size={16} />
            </Toggle>
            <Toggle
              title="Align center"
              active={sel.textAlign === "center"}
              onClick={() => set("textAlign", "center")}
            >
              <AlignCenter size={16} />
            </Toggle>
            <Toggle
              title="Align right"
              active={sel.textAlign === "right"}
              onClick={() => set("textAlign", "right")}
            >
              <AlignRight size={16} />
            </Toggle>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Row label={`Letter spacing (${Math.round(sel.charSpacing ?? 0)})`}>
              <input
                type="range"
                min={-50}
                max={400}
                value={sel.charSpacing ?? 0}
                onChange={(e) => set("charSpacing", Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </Row>
            <Row label={`Line height (${(sel.lineHeight ?? 1.16).toFixed(2)})`}>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={sel.lineHeight ?? 1.16}
                onChange={(e) => set("lineHeight", Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </Row>
          </div>

          <Row label={`Curve (${Math.round(sel.curve ?? 0)})`}>
            <input
              type="range"
              min={-100}
              max={100}
              value={sel.curve ?? 0}
              onChange={(e) => c()?.setTextCurve(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </Row>

          {/* Text effects */}
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Effects
            </p>
            <ShadowControl sel={sel} controllerRef={controllerRef} />
            <div className="border-t border-slate-200/70" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-600">Highlight</span>
              <div className="flex items-center gap-2">
                {sel.textBackgroundColor ? (
                  <input
                    type="color"
                    value={sel.textBackgroundColor}
                    onChange={(e) => set("textBackgroundColor", e.target.value)}
                    className="h-8 w-9 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
                  />
                ) : null}
                <Toggle
                  title="Toggle highlight"
                  active={!!sel.textBackgroundColor}
                  onClick={() =>
                    set(
                      "textBackgroundColor",
                      sel.textBackgroundColor ? "" : "#fde047"
                    )
                  }
                >
                  <span className="text-xs font-medium">
                    {sel.textBackgroundColor ? "On" : "Off"}
                  </span>
                </Toggle>
              </div>
            </div>
          </div>
        </>
      )}

      {sel.isImage && (
        <>
          <Row label="Replace">
            <ReplaceControl controllerRef={controllerRef} />
          </Row>

          <Row label="Position">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => c()?.fitImageToPage("fit")}
                className="rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fit to page
              </button>
              <button
                type="button"
                onClick={() => c()?.fitImageToPage("fill")}
                className="rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fill page
              </button>
            </div>
          </Row>

          <Row label="Flip">
            <div className="flex gap-1.5">
              <Toggle
                title="Flip horizontal"
                active={!!sel.flipX}
                onClick={() => c()?.flipImage("x")}
              >
                <FlipHorizontal size={16} />
              </Toggle>
              <Toggle
                title="Flip vertical"
                active={!!sel.flipY}
                onClick={() => c()?.flipImage("y")}
              >
                <FlipVertical size={16} />
              </Toggle>
            </div>
          </Row>

          <Row label="Crop">
            <div className="grid grid-cols-3 gap-1.5">
              {CROPS.map((cp) => (
                <button
                  key={cp.label}
                  type="button"
                  onClick={() => c()?.setImageCrop(cp.value)}
                  className="rounded-md border border-slate-200 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  {cp.label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Mask">
            <div className="grid grid-cols-3 gap-1.5">
              {MASKS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => c()?.setImageMask(m.value)}
                  className={`rounded-md border py-1.5 text-xs transition ${
                    sel.maskShape === m.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Row>

          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Adjust
            </p>
            <AdjustSlider
              label="Brightness"
              value={sel.brightness}
              onChange={(v) => c()?.setImageAdjustments({ brightness: v })}
            />
            <AdjustSlider
              label="Contrast"
              value={sel.contrast}
              onChange={(v) => c()?.setImageAdjustments({ contrast: v })}
            />
            <AdjustSlider
              label="Saturation"
              value={sel.saturation}
              onChange={(v) => c()?.setImageAdjustments({ saturation: v })}
            />
            {/* Blur: stored 0–0.4 on the filter; shown as 0–100. */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Blur</span>
                <span className="tabular-nums">{Math.round(((sel.blur ?? 0) / 0.4) * 100)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(((sel.blur ?? 0) / 0.4) * 100)}
                onChange={(e) => c()?.setImageAdjustments({ blur: (Number(e.target.value) / 100) * 0.4 })}
                className="w-full accent-brand-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                ["grayscale", "B & W"],
                ["sepia", "Sepia"],
                ["invert", "Invert"],
                ["duotone", "Duotone"],
              ].map(([key, label]) => (
                <Toggle
                  key={key}
                  title={`Toggle ${label}`}
                  active={!!sel[key]}
                  onClick={() => c()?.setImageAdjustments({ [key]: !sel[key] })}
                >
                  <span className="text-xs font-medium">{label}</span>
                </Toggle>
              ))}
            </div>
            {sel.duotone && <DuotoneControl sel={sel} controllerRef={controllerRef} />}
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <ShadowControl sel={sel} controllerRef={controllerRef} />
          </div>
        </>
      )}

      {showFill && (
        <Row label={isText ? "Text fill" : "Fill"}>
          <FillControl
            sel={sel}
            controllerRef={controllerRef}
            allowImage={!isText}
          />
        </Row>
      )}

      {/* Shadow for shapes */}
      {!isText && !sel.isImage && !sel.isMultiple && (
        <div className="rounded-lg bg-slate-50 p-3">
          <ShadowControl sel={sel} controllerRef={controllerRef} />
        </div>
      )}

      {showStroke && (
        <>
          <Row label={isText ? "Outline color" : "Border color"}>
            <ColorField value={sel.stroke} onChange={(v) => set("stroke", v)} />
          </Row>
          <Row
            label={`${isText ? "Outline" : "Border"} width (${Math.round(
              sel.strokeWidth ?? 0
            )})`}
          >
            <input
              type="range"
              min={0}
              max={40}
              value={sel.strokeWidth ?? 0}
              onChange={(e) => set("strokeWidth", Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </Row>
        </>
      )}

      {sel.isRect && (
        <Row label={`Corner radius (${Math.round(sel.rx ?? 0)})`}>
          <input
            type="range"
            min={0}
            max={120}
            value={sel.rx ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              set("rx", v);
              set("ry", v);
            }}
            className="w-full accent-brand-600"
          />
        </Row>
      )}

      <Row label={`Opacity (${Math.round((sel.opacity ?? 1) * 100)}%)`}>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((sel.opacity ?? 1) * 100)}
          onChange={(e) => set("opacity", Number(e.target.value) / 100)}
          className="w-full accent-brand-600"
        />
      </Row>

      {!sel.isMultiple && (
        <Row label="Blend mode">
          <select
            value={sel.blendMode || "source-over"}
            onChange={(e) => c()?.setBlendMode(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          >
            {BLEND_MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Row>
      )}

      {!sel.isMultiple && (
        <Row label="Animation (Present)">
          <select
            value={sel.anim || "none"}
            onChange={(e) => c()?.setActiveAnim(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          >
            {ANIMATIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Row>
      )}

      {!sel.isMultiple && (
      <Row label="Size">
        <div className="flex items-center gap-1.5">
          <DimInput
            value={Math.round(sel.w ?? 0)}
            onCommit={(n) => c()?.setActiveDimension("w", n, lockAspect)}
            ariaLabel="Width"
          />
          <button
            type="button"
            onClick={() => setLockAspect((v) => !v)}
            title={lockAspect ? "Aspect ratio locked" : "Aspect ratio unlocked"}
            aria-pressed={lockAspect}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition ${
              lockAspect
                ? "border-brand-500 bg-brand-50 text-brand-600"
                : "border-slate-200 text-slate-400 hover:bg-slate-50"
            }`}
          >
            {lockAspect ? <Link size={14} /> : <Unlink size={14} />}
          </button>
          <DimInput
            value={Math.round(sel.h ?? 0)}
            onCommit={(n) => c()?.setActiveDimension("h", n, lockAspect)}
            ariaLabel="Height"
          />
        </div>
      </Row>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Row label="X">
          <input
            type="number"
            value={Math.round(sel.left ?? 0)}
            onChange={(e) => set("left", Number(e.target.value) || 0)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </Row>
        <Row label="Y">
          <input
            type="number"
            value={Math.round(sel.top ?? 0)}
            onChange={(e) => set("top", Number(e.target.value) || 0)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </Row>
      </div>

      <Row label={`Rotation (${Math.round(sel.angle ?? 0)}°)`}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={360}
            value={sel.angle ?? 0}
            onChange={(e) => set("angle", Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <button
            type="button"
            title="Rotate 90° left"
            aria-label="Rotate 90° left"
            onClick={() => c()?.rotateBy(-90)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            title="Rotate 90° right"
            aria-label="Rotate 90° right"
            onClick={() => c()?.rotateBy(90)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RotateCw size={15} />
          </button>
        </div>
      </Row>
    </div>
  );
}
