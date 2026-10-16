"use client";

import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Group as GroupIcon,
  Ungroup,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

function Btn({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}

/**
 * Floating contextual bar for alignment, distribution and grouping. Only shown
 * when something is selected. Alignment targets the page for a single object
 * and the selection's bounding box for a multi-selection.
 */
export default function AlignBar({ controllerRef }) {
  const selection = useEditorStore((s) => s.selection);
  const c = () => controllerRef.current;

  if (!selection) return null;

  const isMulti = selection.isMultiple;
  const isGroup = selection.isGroup;

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur">
      <Btn title="Align left" onClick={() => c()?.align("left")}>
        <AlignHorizontalJustifyStart size={16} />
      </Btn>
      <Btn title="Align center" onClick={() => c()?.align("center-h")}>
        <AlignHorizontalJustifyCenter size={16} />
      </Btn>
      <Btn title="Align right" onClick={() => c()?.align("right")}>
        <AlignHorizontalJustifyEnd size={16} />
      </Btn>
      <Divider />
      <Btn title="Align top" onClick={() => c()?.align("top")}>
        <AlignVerticalJustifyStart size={16} />
      </Btn>
      <Btn title="Align middle" onClick={() => c()?.align("middle-v")}>
        <AlignVerticalJustifyCenter size={16} />
      </Btn>
      <Btn title="Align bottom" onClick={() => c()?.align("bottom")}>
        <AlignVerticalJustifyEnd size={16} />
      </Btn>

      {isMulti && (
        <>
          <Divider />
          <Btn title="Distribute horizontally" onClick={() => c()?.distribute("h")}>
            <AlignHorizontalSpaceAround size={16} />
          </Btn>
          <Btn title="Distribute vertically" onClick={() => c()?.distribute("v")}>
            <AlignVerticalSpaceAround size={16} />
          </Btn>
        </>
      )}

      {(isMulti || isGroup) && <Divider />}
      {isMulti && (
        <Btn title="Group (Ctrl+G)" onClick={() => c()?.group()}>
          <GroupIcon size={16} />
        </Btn>
      )}
      {isGroup && (
        <Btn title="Ungroup (Ctrl+Shift+G)" onClick={() => c()?.ungroup()}>
          <Ungroup size={16} />
        </Btn>
      )}
    </div>
  );
}
