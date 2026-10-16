"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Trash2,
  Type,
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Minus,
  Image as ImageIcon,
  Group as GroupIcon,
  Layers as LayersIcon,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

function typeIcon(type) {
  switch (type) {
    case "i-text":
    case "text":
    case "textbox":
      return <Type size={15} />;
    case "rect":
      return <Square size={15} />;
    case "circle":
      return <CircleIcon size={15} />;
    case "triangle":
      return <TriangleIcon size={15} />;
    case "line":
      return <Minus size={15} />;
    case "image":
      return <ImageIcon size={15} />;
    case "group":
      return <GroupIcon size={15} />;
    default:
      return <Square size={15} />;
  }
}

export default function LayersPanel({ controllerRef }) {
  const layers = useEditorStore((s) => s.layers);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const c = () => controllerRef.current;

  function startRename(layer) {
    setEditingId(layer.id);
    setDraft(layer.name);
  }

  function commitRename() {
    if (editingId && draft.trim()) c()?.renameLayer(editingId, draft.trim());
    setEditingId(null);
  }

  if (!layers.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
        <LayersIcon size={26} className="mb-3" />
        <p className="text-sm font-medium text-slate-500">No layers yet</p>
        <p className="mt-1 text-xs">Add elements and they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="ds-scroll flex h-full flex-col overflow-y-auto p-2">
      <ul className="flex flex-col gap-1">
        {layers.map((layer, idx) => (
          <li
            key={layer.id}
            onClick={() => c()?.selectById(layer.id)}
            className={`group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm transition ${
              layer.selected
                ? "border-brand-400 bg-brand-50"
                : "border-transparent hover:bg-slate-50"
            }`}
          >
            <span className="shrink-0 text-slate-400">{typeIcon(layer.type)}</span>

            {editingId === layer.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded border border-brand-400 px-1 py-0.5 text-sm outline-none"
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(layer);
                }}
                className={`min-w-0 flex-1 truncate ${
                  layer.visible ? "text-slate-700" : "text-slate-400 line-through"
                }`}
                title={layer.name}
              >
                {layer.name}
              </span>
            )}

            {/* Reorder */}
            <button
              type="button"
              title="Move up"
              disabled={idx === 0}
              onClick={(e) => {
                e.stopPropagation();
                c()?.moveLayer(layer.id, "up");
              }}
              className="hidden h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 group-hover:inline-flex"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              title="Move down"
              disabled={idx === layers.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                c()?.moveLayer(layer.id, "down");
              }}
              className="hidden h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 group-hover:inline-flex"
            >
              <ChevronDown size={14} />
            </button>

            {/* Lock */}
            <button
              type="button"
              title={layer.locked ? "Unlock" : "Lock"}
              onClick={(e) => {
                e.stopPropagation();
                c()?.toggleLock(layer.id);
              }}
              className={`inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200 ${
                layer.locked ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>

            {/* Visibility */}
            <button
              type="button"
              title={layer.visible ? "Hide" : "Show"}
              onClick={(e) => {
                e.stopPropagation();
                c()?.toggleVisibility(layer.id);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            {/* Delete */}
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                c()?.deleteById(layer.id);
              }}
              className="hidden h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-hover:inline-flex"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
