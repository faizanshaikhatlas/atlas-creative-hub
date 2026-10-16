import { fontVariables } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "ATLAS Creative Hub",
  description:
    "ATLAS Creative Hub — a browser-based design editor for YouTube thumbnails, banners, and social posts.",
  applicationName: "ATLAS Creative Hub",
  // Favicon/app icons are provided by the Next.js App Router file convention
  // (app/icon.svg + app/apple-icon.png), so no manual <link> tags are needed.
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#342B7C",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
