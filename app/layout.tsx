import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Latencymap",
  description: "Test public API latency from multiple probe regions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
