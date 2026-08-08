import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Latency Map",
  description: "Test public API latency from multiple regions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
