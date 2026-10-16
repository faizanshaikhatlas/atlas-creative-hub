"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, FileQuestion } from "lucide-react";
import { getProject } from "@/lib/db/projects";

// Fabric.js is browser-only, so the whole editor is loaded client-side only.
const Editor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <FullScreenSpinner label="Loading editor…" />,
});

function FullScreenSpinner({ label }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-slate-100">
      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        {label}
      </span>
    </div>
  );
}

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [state, setState] = useState({ status: "loading", project: null });

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((project) => {
        if (!active) return;
        setState(
          project
            ? { status: "ready", project }
            : { status: "notfound", project: null }
        );
      })
      .catch((err) => {
        console.error("Failed to open project:", err);
        if (active) setState({ status: "error", project: null });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === "loading") {
    return <FullScreenSpinner label="Opening project…" />;
  }

  if (state.status === "ready") {
    return <Editor project={state.project} />;
  }

  // notfound or error
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <FileQuestion size={40} className="text-slate-400" />
      <div>
        <p className="text-lg font-semibold text-slate-800">
          {state.status === "error"
            ? "Something went wrong"
            : "Project not found"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {state.status === "error"
            ? "The project database could not be read in this browser."
            : "This project may have been deleted, or the link is from a different browser."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to projects
      </button>
    </div>
  );
}
