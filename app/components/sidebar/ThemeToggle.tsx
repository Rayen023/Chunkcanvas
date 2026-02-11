"use client";

import { useAppStore } from "@/app/lib/store";

export default function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-1 p-1 bg-silver-light/20 rounded-lg">
      <button
        onClick={() => setTheme("light")}
        className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all cursor-pointer ${
          theme === "light"
            ? "bg-card shadow-sm text-sandy"
            : "text-silver-dark hover:text-gunmetal-light"
        }`}
        title="Light Mode"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all cursor-pointer ${
          theme === "dark"
            ? "bg-card shadow-sm text-sandy"
            : "text-silver-dark hover:text-gunmetal-light"
        }`}
        title="Dark Mode"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all cursor-pointer ${
          theme === "system"
            ? "bg-card shadow-sm text-sandy"
            : "text-silver-dark hover:text-gunmetal-light"
        }`}
        title="System Theme"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}
