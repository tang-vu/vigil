import type { MetadataRoute } from "next";

const siteUrl = "https://vigil-first-tx-lab.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
