import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Page Builder Pro for HighLevel",
  description: "Elementor-style visual page builder with advanced widgets for HighLevel funnels and websites.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
