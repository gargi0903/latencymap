import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Latencymap",
  description: "Test public API latency from multiple probe regions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
