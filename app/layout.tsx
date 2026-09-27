import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "屎山 Hot100 - AI 时代的实战代码评测基准",
  description: "工业级真实后端缺陷排障靶场，LeetCode 风格极简本地回归评测系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('shishan_theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && supportDarkMode)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased selection:bg-accent/20 selection:text-ink">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex h-15 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-surface font-mono text-sm font-bold shadow-xs">
                #
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-bold text-lg tracking-tight text-ink group-hover:text-accent transition-colors">
                  ShiShan Hot100
                </span>
                <span className="hidden sm:inline-block text-xs text-muted">
                  本地工业级排障基准
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/"
                className="rounded-md px-3.5 py-1.5 font-semibold text-ink transition-colors hover:bg-paper"
              >
                题库
              </Link>
              <a
                href="https://github.com/HHHHH-GIT/ShiShan_HOT100"
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md px-3.5 py-1.5 font-medium text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                GitHub 仓库
              </a>
              <div className="border-l border-line/80 pl-3">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-24 pt-7 sm:pt-9">{children}</main>

        <footer className="border-t border-line/80 bg-surface/50 py-7 text-xs sm:text-sm text-muted">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-muted">
              题目下发到本地 · 判题在本机执行 · 数据不出环境
            </p>
            <p className="font-mono text-xs text-muted/80">
              ShiShan Hot100 · Clean & Minimalist
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}