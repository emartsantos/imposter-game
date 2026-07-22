import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMPOSTOR — The Bluffing Party Game",
  description:
    "Multiplayer na laro ng panlilinlang. Tukuyin kung sino ang impostor sa inyong grupo! Play online or pass the phone.",
  keywords: ["imposter", "bluff", "party game", "multiplayer", " Filipino", "Tagalog"],
  openGraph: {
    title: "IMPOSTOR — The Bluffing Party Game",
    description: "Figure out who's bluffing in your group!",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f0f4ff",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tl" className="noise-overlay">
      <body className="antialiased">{children}</body>
    </html>
  );
}
