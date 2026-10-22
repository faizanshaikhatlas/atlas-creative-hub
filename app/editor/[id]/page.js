"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, FileQuestion, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiGetProject } from "@/lib/designs/client";

// Fabric.js is browser-only, so the whole editor is loaded client-side only.
const Editor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <FullScreenSpinner label="Loading editor…" />,
});

// Video projects open a separate editor (never the static Fabric design editor).
const VideoEditor = dynamic(() => import("@/components/video/VideoEditor"), {
  ssr: false,
  loading: () => <FullScreenSpinner label="Loading video editor…" />,
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
  const { configured, loading: authLoading, user, active } = useAuth();
  const [state, setState] = useState({ status: "loading", project: null });

  useEffect(() => {
    if (authLoading) return;
    if (!configured) { setState({ status: "error", project: null }); return; }
    if (!user) { router.replace(`/login?next=/editor/${id}`); return; }

    let alive = true;
    setState({ status: "loading", project: null });
    apiGetProject(id, user.id)
      .then((project) => { if (alive) setState({ status: "ready", project }); })
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 403) setState({ status: "pending", project: null });
        else if (err?.status === 404) setState({ status: "notfound", project: null });
        else setState({ status: "error", project: null });
      });
    return () => { alive = false; };
  }, [id, authLoading, configured, user, active, router]);

  if (state.status === "loading") return <FullScreenSpinner label="Opening design…" />;
  if (state.status === "ready") {
    // Route video projects to the video editor; everything else stays on the
    // existing static design editor (unchanged).
    return state.project?.type === "video"
      ? <VideoEditor project={state.project} />
      : <Editor project={state.project} />;
  }

  const messages = {
    pending: { icon: <ShieldAlert size={40} className="text-amber-500" />, title: "Awaiting approval", body: "Your account is awaiting administrator approval before you can open and edit designs." },
    notfound: { icon: <FileQuestion size={40} className="text-slate-400" />, title: "Design not found", body: "This design may have been deleted, or it belongs to a different account." },
    error: { icon: <FileQuestion size={40} className="text-slate-400" />, title: "Something went wrong", body: "We couldn’t open this design. Check your connection and try again." },
  };
  const m = messages[state.status] || messages.error;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      {m.icon}
      <div>
        <p className="text-lg font-semibold text-slate-800">{m.title}</p>
        <p className="mt-1 text-sm text-slate-500">{m.body}</p>
      </div>
      <button type="button" onClick={() => router.push("/")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Back to dashboard
      </button>
    </div>
  );
}
