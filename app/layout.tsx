import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VELO 바이브코딩 교실",
  description: "말로 설명하면 앱이 만들어지는 바이브코딩 체험",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6d28d9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
