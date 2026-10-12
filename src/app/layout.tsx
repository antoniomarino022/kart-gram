import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kart-gram",
  description: "Endless drift kart game for Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
