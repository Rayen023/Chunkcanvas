"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/lib/store";
import AppInfo from "./AppInfo";
import VllmStatus from "./VllmStatus";
import OllamaStatus from "./OllamaStatus";
import ThemeToggle from "./ThemeToggle";

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

/* ── Inline Reset All button component ─────────────── */
function ResetAllButton() {
  const resetAll = useAppStore((s) => s.resetAll);
  const pineconeSuccess = useAppStore((s) => s.pineconeSuccess);
  const [confirming, setConfirming] = useState(false);

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
          : pineconeSuccess
            ? "border-sandy bg-sandy text-white hover:bg-sandy-dark animate-pulse shadow-md"
            : "border-silver-light bg-card text-silver-dark hover:border-sandy hover:text-sandy"
        }
      `}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {confirming ? "Click again to confirm reset" : "Reset All"}
    </button>
  );
}

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const width = useAppStore((s) => s.sidebarWidth);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const setWidth = useAppStore((s) => s.setSidebarWidth);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  /* ── Resize handling ─────────────────────────────────── */
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
    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, setWidth]);

  /* ── Collapsed state: floating expand button ─────────── */
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center h-9 w-9 rounded-lg bg-card border border-silver-light shadow-md hover:shadow-lg hover:border-sandy transition-all duration-200 cursor-pointer group"
        aria-label="Expand sidebar"
      >
        {/* CC logo mini */}
        <div className="h-6 w-6 rounded-md bg-sandy flex items-center justify-center text-white font-bold text-[9px] group-hover:scale-105 transition-transform">
          CC
        </div>
      </button>
    );
  }

  /* ── Expanded sidebar ────────────────────────────────── */
  return (
    <>
      <aside
        ref={sidebarRef}
        style={{ width }}
        className="relative hidden lg:flex flex-col border-r border-silver-light bg-card sticky top-0 h-screen overflow-hidden select-none flex-shrink-0"
      >
        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-sandy flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              CC
            </div>
            <span className="text-base font-semibold text-gunmetal truncate">
              ChunkCanvas
            </span>
          </div>

          {/* Collapse button */}
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

        {/* ── Scrollable content ──────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <AppInfo />

          <div className="h-px bg-silver-light" />

          <VllmStatus />

          <div className="h-px bg-silver-light" />

          <OllamaStatus />
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-silver-light space-y-3">
          <ThemeToggle />
          <ResetAllButton />
          <p className="text-[10px] text-silver-dark text-center">
            ChunkCanvas &mdash; Rayen Ghali
          </p>
        </div>

        {/* ── Resize handle ───────────────────────────── */}
        <div
          onMouseDown={startResize}
          className={`
            absolute top-0 right-0 w-1 h-full cursor-col-resize
            hover:bg-sandy/40 active:bg-sandy/60 transition-colors
            ${isResizing ? "bg-sandy/60" : "bg-transparent"}
          `}
        />
      </aside>

      {/* Overlay to catch mouse events during resize outside sidebar */}
      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-col-resize" />
      )}
    </>
  );
}
