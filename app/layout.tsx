import type { Metadata } from "next";
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
  title: "ChunkCanvas",
  description: "Document processing, chunking & vector DB",
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
