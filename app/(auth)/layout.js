// Centered, branded shell for all authentication pages. Matches the ATLAS
// Creative Hub look (slate background, brand accents) used across the app.
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atlas-logo.svg" alt="ATLAS Creative Hub" width={200} height={39} className="h-9 w-auto" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Your designs are saved on this device. Signing in enables secure cloud sync.
        </p>
      </div>
    </div>
  );
}
