import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// un solo font per tutta la UI: condensato, pesante, maiuscolo (riferimento UI)
const barlow = Barlow_Condensed({
  weight: ["600", "800", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-barlow",
});

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
    <html lang="it" className={`${barlow.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full overflow-hidden">
        {children}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
