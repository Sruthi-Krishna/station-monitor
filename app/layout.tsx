import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Station Monitor",
  description:
    "Demo dashboard for monitoring simulated instruments: Next.js, TypeScript and GraphQL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
