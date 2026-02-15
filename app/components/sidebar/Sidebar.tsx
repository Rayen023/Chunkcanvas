"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import AppInfo from "./AppInfo";
import VllmStatus from "./VllmStatus";
import OllamaStatus from "./OllamaStatus";
import ChromaStatus from "./ChromaStatus";
import FaissStatus from "./FaissStatus";
import DoclingStatus from "./DoclingStatus";
import ThemeToggle from "./ThemeToggle";
import { useIsLocalMode } from "@/app/lib/local-mode";

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

function ResetButton() {
  const resetAll = useAppStore((s) => s.resetAll);
  const pineconeSuccess = useAppStore((s) => s.pineconeSuccess);
  const chromaSuccess = useAppStore((s) => s.chromaSuccess);
  const faissSuccess = useAppStore((s) => s.faissSuccess);
  const mongodbSuccess = useAppStore((s) => s.mongodbSuccess);
  const [confirming, setConfirming] = useState(false);

  const hasSuccess = !!(pineconeSuccess || chromaSuccess || faissSuccess || mongodbSuccess);

  const handleClick = () => {
    if (confirming) {
      resetAll();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer
        ${confirming
          ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
          : hasSuccess
            ? "border-sandy bg-sandy text-white hover:bg-sandy-dark animate-pulse shadow-md"
            : "border-silver-light bg-card text-silver-dark hover:border-sandy hover:text-sandy"
        }
      `}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {confirming ? "Confirm" : "Reset"}
    </button>
  );
}

function ClearPrefsButton() {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (confirming) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("chunkcanvas-preferences");
        window.location.reload();
      }
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer mt-2
        ${confirming
          ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-silver-light bg-card text-silver-dark hover:border-red-400 hover:text-red-500"
        }
      `}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {confirming ? "Confirm Wipe" : "Clear Preferences"}
    </button>
  );
}

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const setWidth = useAppStore((s) => s.setSidebarWidth);
  const isLocal = useIsLocalMode();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
    },
    [],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, setWidth]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center h-9 w-9 rounded-lg bg-card border border-silver-light shadow-md hover:shadow-lg hover:border-sandy transition-all duration-200 cursor-pointer group"
        aria-label="Expand sidebar"
      >
        <div className="h-6 w-6 rounded-md bg-sandy flex items-center justify-center text-white font-bold text-[9px] group-hover:scale-105 transition-transform">
          CC
        </div>
      </button>
    );
  }

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-gunmetal/20 backdrop-blur-sm lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        ref={sidebarRef}
        style={{ width: "var(--sidebar-width, 288px)" }}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col border-r border-silver-light bg-card transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-30
          ${collapsed ? "-translate-x-full lg:hidden" : "translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-sandy flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              CC
            </div>
            <span className="text-base font-semibold text-gunmetal truncate">
              ChunkCanvas
            </span>
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-silver-light/60 text-silver-dark hover:text-gunmetal transition-colors cursor-pointer flex-shrink-0"
            aria-label="Collapse sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-silver-light mx-4" />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <AppInfo />

          <div>
            <ResetButton />
            <ClearPrefsButton />
          </div>

          <div className="h-px bg-silver-light" />

          {isLocal ? (
            <>
              <VllmStatus />

              <div className="h-px bg-silver-light" />

              <OllamaStatus />

              <div className="h-px bg-silver-light" />

              <DoclingStatus />

              <div className="h-px bg-silver-light" />

              <ChromaStatus />

              <div className="h-px bg-silver-light" />

              <FaissStatus />
            </>
          ) : (
            <div className="rounded-lg border border-silver-light bg-gunmetal/[0.02] dark:bg-white/[0.03] px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-sandy">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Cloud Mode
              </div>
              <p className="text-[10px] text-silver-dark leading-relaxed">
                Local services (vLLM, Ollama, Docling, ChromaDB Local, FAISS) are not available in cloud mode. Use cloud providers or{" "}
                <a href="https://github.com/Rayen023/chunkcanvas" target="_blank" rel="noopener noreferrer" className="text-sandy hover:underline">
                  clone the repo
                </a>{" "}
                to run locally.
              </p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-silver-light space-y-3">
          <ThemeToggle />
          <p className="text-[10px] text-silver-dark text-center">
            ChunkCanvas &mdash; Rayen Ghali
          </p>
        </div>

        <div
          onMouseDown={startResize}
          className={`
            absolute top-0 right-0 w-1 h-full cursor-col-resize hidden lg:block
            hover:bg-sandy/40 active:bg-sandy/60 transition-colors
            ${isResizing ? "bg-sandy/60" : "bg-transparent"}
          `}
        />
      </aside>

      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-col-resize" />
      )}
    </>
  );
}
