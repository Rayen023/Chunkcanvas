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
  description: "Document processing, chunking & vector DB pipeline builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          <ThemeProvider />
          {/* Sidebar — client component with collapse/resize */}
          <Sidebar />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <EnvLoader />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
