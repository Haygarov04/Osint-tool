import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSINT Lead Tool",
  description: "Генериране на лийдове от OSM и Google Places",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
