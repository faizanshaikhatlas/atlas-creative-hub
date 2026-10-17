"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/store/editorStore";

export const RULER = 22;

const TICK_COLOR = "#94a3b8";
const LABEL_COLOR = "#64748b";
const BG = "#f8fafc";

function niceInterval(zoom) {
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const s of steps) if (s * zoom >= 64) return s;
  return 5000;
}

/**
 * Non-interactive top + left rulers that track the artboard's position within
 * the scrollable workspace. Values are in canvas pixels and respect zoom.
 * `outerRef` is the fixed container; `artboardRef` wraps the <canvas>;
 * `workspaceRef` is the scroll element.
 */
export default function Rulers({ outerRef, artboardRef, workspaceRef, controllerRef }) {
  const zoom = useEditorStore((s) => s.zoom);
  const pageSize = useEditorStore((s) => s.pageSize);
  const topRef = useRef(null);
  const leftRef = useRef(null);

  function addGuideFromTop(e) {
    const art = artboardRef.current;
    if (!art || !controllerRef?.current) return;
    const a = art.getBoundingClientRect();
    controllerRef.current.addGuide("x", (e.clientX - a.left) / (zoom || 1));
  }
  function addGuideFromLeft(e) {
    const art = artboardRef.current;
    if (!art || !controllerRef?.current) return;
    const a = art.getBoundingClientRect();
    controllerRef.current.addGuide("y", (e.clientY - a.top) / (zoom || 1));
  }

  useEffect(() => {
    let raf = 0;

    function paint(canvas, axis, lengthCss, origin, dim) {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const thick = RULER;
      const w = axis === "h" ? lengthCss : thick;
      const h = axis === "h" ? thick : lengthCss;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = TICK_COLOR;
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
      ctx.lineWidth = 1;

      const interval = niceInterval(zoom);
      // `origin` is the screen position (in this ruler's local coords) of canvas 0.
      for (let c = 0; c <= dim + 0.5; c += interval) {
        const pos = origin + c * zoom;
        if (axis === "h") {
          if (pos < -20 || pos > w + 20) continue;
          ctx.beginPath();
          ctx.moveTo(Math.round(pos) + 0.5, thick);
          ctx.lineTo(Math.round(pos) + 0.5, thick - 7);
          ctx.stroke();
          ctx.fillText(String(c), Math.round(pos) + 2, 9);
        } else {
          if (pos < -20 || pos > h + 20) continue;
          ctx.beginPath();
          ctx.moveTo(thick, Math.round(pos) + 0.5);
          ctx.lineTo(thick - 7, Math.round(pos) + 0.5);
          ctx.stroke();
          ctx.save();
          ctx.translate(9, Math.round(pos) + 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(c), 0, 0);
          ctx.restore();
        }
      }
    }

    function draw() {
      const outer = outerRef.current;
      const art = artboardRef.current;
      if (!outer || !art) return;
      const o = outer.getBoundingClientRect();
      const a = art.getBoundingClientRect();
      // Ruler strips start at offset RULER (top-left corner square is reserved).
      const originX = a.left - o.left - RULER;
      const originY = a.top - o.top - RULER;
      paint(topRef.current, "h", o.width - RULER, originX, pageSize.width);
      paint(leftRef.current, "v", o.height - RULER, originY, pageSize.height);
    }

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    draw();
    const ws = workspaceRef.current;
    ws?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro && outerRef.current) ro.observe(outerRef.current);
    return () => {
      ws?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [zoom, pageSize.width, pageSize.height, outerRef, artboardRef, workspaceRef]);

  return (
    <>
      <div className="pointer-events-none absolute left-0 top-0 z-10 border-b border-r border-slate-200 bg-slate-50" style={{ width: RULER, height: RULER }} />
      <canvas ref={topRef} onClick={addGuideFromTop} title="Click to add a vertical guide" className="absolute top-0 z-10 cursor-pointer border-b border-slate-200" style={{ left: RULER }} />
      <canvas ref={leftRef} onClick={addGuideFromLeft} title="Click to add a horizontal guide" className="absolute left-0 z-10 cursor-pointer border-r border-slate-200" style={{ top: RULER }} />
    </>
  );
}
