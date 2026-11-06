import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS AI - Personal Workspace Mainframe",
  description: "Production-ready AI Workspace Assistant powered by Google Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-jarvis-bg text-gray-100 overflow-hidden relative">
        {/* Holographic scanner overlay */}
        <div className="fixed inset-0 pointer-events-none z-50 hud-scanline opacity-30" />
        {children}
      </body>
    </html>
  );
}
