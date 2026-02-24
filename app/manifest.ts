import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChunkCanvas",
    short_name: "ChunkCanvas",
    description: "Document processing GUI for RAG applications.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#F2A365",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
