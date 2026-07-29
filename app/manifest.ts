import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vigil — KeeperHub First Transaction Lab",
    short_name: "Vigil",
    description:
      "Aave liquidation guardian, KeeperHub execution proof, and first-transaction onboarding lab.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080a12",
    theme_color: "#7c5cff",
    orientation: "any",
    categories: ["finance", "utilities", "developer"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Replay the rescue",
        short_name: "Rescue proof",
        description: "Inspect Vigil's real KeeperHub Aave rescue receipt.",
        url: "/#receipt",
      },
      {
        name: "First transaction lab",
        short_name: "First tx lab",
        description: "Follow the guarded path to a first KeeperHub transaction.",
        url: "/#lab",
      },
    ],
  };
}
