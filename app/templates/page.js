"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Previews render with Fabric (browser-only), so load the gallery client-side.
const TemplateGallery = dynamic(() => import("@/components/templates/TemplateGallery"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-slate-50">
      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading templates…
      </span>
    </div>
  ),
});

export default function TemplatesPage() {
  return <TemplateGallery />;
}
