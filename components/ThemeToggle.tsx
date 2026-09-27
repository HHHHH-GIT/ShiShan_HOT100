"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("shishan_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("shishan_theme", "light");
    }
  };

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-lg border border-line bg-paper/50" />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-muted transition-colors hover:bg-surface hover:text-ink cursor-pointer"
      title={theme === "dark" ? "切换至亮色模式" : "切换至深色模式"}
      aria-label={theme === "dark" ? "切换至亮色模式" : "切换至深色模式"}
    >
      {theme === "dark" ? (
        // 太阳图标（当前为暗色，点击切亮色）
        <svg
          className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        // 月亮图标（当前为亮色，点击切深色）
        <svg
          className="h-4 w-4 text-muted transition-transform duration-200 hover:-rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
