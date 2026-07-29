import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const siteUrl = "https://vigil-first-tx-lab.vercel.app";
const title = "Vigil — Aave Guardian & KeeperHub First Tx Lab";
const description =
  "Explore Vigil's real KeeperHub execution: an Aave v3 rescue, duplicate-write protection, SHA-256 receipts, x402 payments, and a first-transaction lab.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Vigil",
  authors: [{ name: "Vigil", url: "https://github.com/tang-vu/vigil" }],
  creator: "Vigil",
  publisher: "Vigil",
  category: "technology",
  keywords: [
    "Aave v3 liquidation guardian",
    "KeeperHub",
    "AI agent",
    "x402 payments",
    "DeFi risk monitoring",
    "onchain automation",
    "Ethereum Sepolia",
    "Base USDC",
    "transaction audit receipt",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Vigil",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080a12" },
    { media: "(prefers-color-scheme: light)", color: "#171634" },
  ],
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Vigil",
      alternateName: "KeeperHub First Transaction Lab",
      description,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#application`,
      url: siteUrl,
      name: "Vigil",
      alternateName: "Vigil — KeeperHub First Transaction Lab",
      description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with JavaScript enabled.",
      isAccessibleForFree: true,
      image: `${siteUrl}/opengraph-image.png`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Interactive replay of a real KeeperHub Aave v3 rescue",
        "Duplicate-write protection and notification recovery evidence",
        "KeeperHub first-transaction onboarding lab",
        "Evidence-based KeeperHub error doctor",
        "Onchain x402 payment proof",
        "SHA-256 sealed execution receipts",
      ],
      sameAs: [
        "https://github.com/tang-vu/vigil",
        "https://youtu.be/1a25RRZmkJ8",
      ],
      isPartOf: {
        "@id": `${siteUrl}/#website`,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
          type="application/ld+json"
        />
        {children}
      </body>
    </html>
  );
}
