"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Keyboard shortcuts, grouped. `Mod` renders as "Ctrl / ⌘" so the same list
// reads correctly on Windows and macOS without platform sniffing.
const GROUPS = [
  {
    title: "Edit",
    items: [
      ["Undo", ["Mod", "Z"]],
      ["Redo", ["Mod", "Shift", "Z"]],
      ["Duplicate", ["Mod", "D"]],
      ["Copy", ["Mod", "C"]],
      ["Paste", ["Mod", "V"]],
      ["Delete", ["Del"]],
      ["Select all", ["Mod", "A"]],
    ],
  },
  {
    title: "Arrange",
    items: [
      ["Group", ["Mod", "G"]],
      ["Ungroup", ["Mod", "Shift", "G"]],
      ["Bring forward", ["Mod", "]"]],
      ["Send backward", ["Mod", "["]],
    ],
  },
  {
    title: "Move & view",
    items: [
      ["Nudge", ["←", "↑", "→", "↓"]],
      ["Nudge 10px", ["Shift", "Arrows"]],
      ["Zoom", ["Mod", "Scroll"]],
      ["Deselect / close", ["Esc"]],
      ["This help", ["?"]],
    ],
  },
];

function Keys({ combo }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {combo.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex min-w-[22px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm"
        >
          {k === "Mod" ? "Ctrl / ⌘" : k}
        </kbd>
      ))}
    </span>
  );
}

export default function ShortcutsOverlay({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map(([label, combo]) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">{label}</span>
                    <Keys combo={combo} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Press <span className="font-medium text-slate-500">?</span> anytime to open this list.
        </p>
      </div>
    </div>
  );
}
