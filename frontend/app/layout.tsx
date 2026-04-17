import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe — music, distilled",
  description: "Upload a song. Discover its vibe.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="fixed top-0 inset-x-0 z-50">
          <nav className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link href="/" className="font-serif text-xl tracking-tight">
              vibe<span className="opacity-40">.</span>
            </Link>
            <div className="flex items-center gap-6 text-sm opacity-80 hover:opacity-100">
              <Link href="/" className="hover:underline underline-offset-4">
                upload
              </Link>
              <Link href="/library" className="hover:underline underline-offset-4">
                library
              </Link>
            </div>
          </nav>
        </header>
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
