import type { MetadataRoute } from "next";

const siteUrl = "https://vigil-first-tx-lab.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date("2026-08-13T00:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 1,
      images: [`${siteUrl}/opengraph-image.png`],
    },
  ];
}
