"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Poster previews render with Fabric (browser-only), so load the gallery
// client-side — same pattern as the Templates and Social galleries.
const VideoGallery = dynamic(() => import("@/components/video/VideoGallery"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-slate-50">
      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading video templates…
      </span>
    </div>
  ),
});

export default function CreateVideoPage() {
  return <VideoGallery />;
}
