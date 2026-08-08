import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./styles.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "Latency Map",
  description: "Test public API latency from multiple probe regions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <body className={ibmPlexMono.className}>{children}</body>
    </html>
  );
}
