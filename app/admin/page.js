import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/roles";
import AdminPanel from "@/components/admin/AdminPanel";

// Server-side role gate: non-admins (and signed-out / disabled users) are
// redirected away before any admin UI is sent. This protects the ADMIN route
// specifically; broader route protection arrives in Phase 4.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.disabled) {
    redirect("/");
  }
  return <AdminPanel adminEmail={profile.email} />;
}
