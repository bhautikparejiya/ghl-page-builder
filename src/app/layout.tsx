import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageForge for HighLevel",
  description: "Drag-and-drop widget page builder for HighLevel funnels and websites, with CRM-connected forms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
