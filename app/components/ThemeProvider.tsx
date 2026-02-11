"use client";

import { useEffect } from "react";
import { useAppStore } from "@/app/lib/store";

export default function ThemeProvider() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (t: "light" | "dark" | "system") => {
      // Remove both first to ensure no conflict
      root.classList.remove("light", "dark");
      
      if (t === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };

    applyTheme(theme);

    // Listen for system theme changes if set to system
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return null;
}
