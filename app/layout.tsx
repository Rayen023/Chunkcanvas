import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/sidebar/Sidebar";
import EnvLoader from "./components/EnvLoader";
import ThemeProvider from "./components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chunkcanvas.cc"),
  title: {
    default: "ChunkCanvas | Document Processing for RAG",
    template: "%s | ChunkCanvas",
  },
  description:
    "ChunkCanvas is an open-source document processing GUI that transforms raw files into structured, chunked data for vector databases.",
  keywords: [
    "RAG",
    "Retrieval-Augmented Generation",
    "Document Processing",
    "LLM",
    "Vector Database",
    "Chunking",
    "Pinecone",
    "ChromaDB",
    "FAISS",
    "pdf parsing",
    "OpenRouter",
    "Ollama",
    "vLLM",
    "AI",
  ],
  authors: [{ name: "ChunkCanvas" }],
  creator: "ChunkCanvas",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chunkcanvas.cc",
    title: "ChunkCanvas | Document Processing for RAG",
    description:
      "Transform raw files into structured, chunked data for vector databases. Support for PDFs, images, Excel, CSV, audio, and video.",
    siteName: "ChunkCanvas",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChunkCanvas | Document Processing for RAG",
    description:
      "Transform your documents into structured data for LLMs and Vector databases. Local and cloud AI models supported.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2A365",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var width = 288;
                  var storage = localStorage.getItem('chunkcanvas-preferences');
                  if (storage) {
                    var state = JSON.parse(storage).state;
                    if (state && state.sidebarWidth) {
                      width = state.sidebarWidth;
                    }
                  }
                  document.documentElement.style.setProperty('--sidebar-width', width + 'px');
                } catch (e) {}
              })()
            `,
          }}
        />
        <ThemeProvider>
          <div className="flex min-h-screen">
            {/* Sidebar — client component with collapse/resize */}
            <Sidebar />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
              <EnvLoader />
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
