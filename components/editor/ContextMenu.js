"use client";

import { useEffect, useRef } from "react";
import {
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Group as GroupIcon,
  Ungroup,
  Lock,
  Unlock,
  EyeOff,
  CheckSquare,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

function Item({ icon, label, shortcut, danger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[11px] tabular-nums text-slate-400">{shortcut}</span>
      )}
    </button>
  );
}

const Sep = () => <div className="my-1 h-px bg-slate-100" />;

/**
 * Right-click menu. Positioned at the pointer and clamped to the viewport. The
 * selection has already been set by CanvasStage before this opens.
 */
export default function ContextMenu({ menu, controllerRef, onClose }) {
  const selection = useEditorStore((s) => s.selection);
  const ref = useRef(null);
  const c = () => controllerRef.current;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!menu) return null;

  const run = (fn) => () => {
    fn(c());
    onClose();
  };

  // Clamp so the menu stays on screen (approx 220x320).
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const left = Math.min(menu.x, vw - 230);
  const top = Math.min(menu.y, vh - 330);

  const hasTarget = menu.hasTarget && !!selection;

  return (
    <>
      {/* Invisible backdrop closes the menu on an outside click. We only
          preventDefault the contextmenu here (not close), because the very
          right-click that opened this menu fires its trailing `contextmenu`
          event onto this freshly-mounted backdrop — closing on it would
          dismiss the menu immediately. */}
      <div
        className="fixed inset-0 z-40"
        onMouseDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={ref}
        style={{ left, top }}
        className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
      >
        {hasTarget ? (
          <>
            <Item
              icon={<Copy size={15} />}
              label="Duplicate"
              shortcut="Ctrl+D"
              onClick={run((c) => c?.duplicateActive())}
            />
            {selection.isMultiple && (
              <Item
                icon={<GroupIcon size={15} />}
                label="Group"
                shortcut="Ctrl+G"
                onClick={run((c) => c?.group())}
              />
            )}
            {selection.isGroup && (
              <Item
                icon={<Ungroup size={15} />}
                label="Ungroup"
                shortcut="Ctrl+Shift+G"
                onClick={run((c) => c?.ungroup())}
              />
            )}
            <Sep />
            <Item
              icon={<ArrowUpToLine size={15} />}
              label="Bring to front"
              onClick={run((c) => c?.bringToFront())}
            />
            <Item
              icon={<ArrowUp size={15} />}
              label="Bring forward"
              onClick={run((c) => c?.bringForward())}
            />
            <Item
              icon={<ArrowDown size={15} />}
              label="Send backward"
              onClick={run((c) => c?.sendBackward())}
            />
            <Item
              icon={<ArrowDownToLine size={15} />}
              label="Send to back"
              onClick={run((c) => c?.sendToBack())}
            />
            <Sep />
            <Item
              icon={selection.locked ? <Unlock size={15} /> : <Lock size={15} />}
              label={selection.locked ? "Unlock" : "Lock"}
              onClick={run((c) => c?.toggleLock(selection.id))}
            />
            <Item
              icon={<EyeOff size={15} />}
              label="Hide"
              onClick={run((c) => c?.toggleVisibility(selection.id))}
            />
            <Sep />
            <Item
              icon={<Trash2 size={15} />}
              label="Delete"
              shortcut="Del"
              danger
              onClick={run((c) => c?.deleteActive())}
            />
          </>
        ) : (
          <Item
            icon={<CheckSquare size={15} />}
            label="Select all"
            shortcut="Ctrl+A"
            onClick={run((c) => c?.selectAll())}
          />
        )}
      </div>
    </>
  );
}
