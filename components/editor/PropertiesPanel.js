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
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { SIZE_PRESETS, clampDim } from "@/lib/db/projects";
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

          {/* Text effects */}
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Effects
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Shadow</span>
              <Toggle
                title="Toggle shadow"
                active={!!sel.hasShadow}
                onClick={() => c()?.setShadow(!sel.hasShadow, sel.shadowColor)}
              >
                <span className="text-xs font-medium">
                  {sel.hasShadow ? "On" : "Off"}
                </span>
              </Toggle>
            </div>
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
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-slate-600">Grayscale</span>
              <Toggle
                title="Toggle grayscale"
                active={!!sel.grayscale}
                onClick={() =>
                  c()?.setImageAdjustments({ grayscale: !sel.grayscale })
                }
              >
                <span className="text-xs font-medium">
                  {sel.grayscale ? "On" : "Off"}
                </span>
              </Toggle>
            </div>
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
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Shadow</span>
          <Toggle
            title="Toggle shadow"
            active={!!sel.hasShadow}
            onClick={() => c()?.setShadow(!sel.hasShadow, sel.shadowColor)}
          >
            <span className="text-xs font-medium">
              {sel.hasShadow ? "On" : "Off"}
            </span>
          </Toggle>
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
        <input
          type="range"
          min={0}
          max={360}
          value={sel.angle ?? 0}
          onChange={(e) => set("angle", Number(e.target.value))}
          className="w-full accent-brand-600"
        />
      </Row>
    </div>
  );
}
