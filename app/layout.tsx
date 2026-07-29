import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "KeeperHub First Transaction Lab — Vigil",
  description:
    "A zero-to-confirmed-transaction onboarding lab and error doctor built from Vigil's real KeeperHub integration.",
  metadataBase: new URL("https://vigil-first-tx-lab.vercel.app"),
  openGraph: {
    title: "KeeperHub First Transaction Lab",
    description:
      "Ship your first KeeperHub transaction with a guided preflight, safe execution path, and evidence-backed error doctor.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
