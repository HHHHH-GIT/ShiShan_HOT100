import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "屎山 Hot100 - AI 时代的实战代码评测基准",
  description: "工业级真实后端缺陷排障靶场，LeetCode 风格极简本地回归评测系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink antialiased selection:bg-accent/20 selection:text-ink">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex h-13 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-surface font-mono text-xs font-bold shadow-xs">
                #
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-base tracking-tight text-ink group-hover:text-accent transition-colors">
                  ShiShan Hot100
                </span>
                <span className="hidden sm:inline-block text-[11px] text-muted">
                  本地工业级排障基准
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5 text-xs">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 font-medium text-ink transition-colors hover:bg-paper"
              >
                题库
              </Link>
              <a
                href="https://github.com/HHHHH-GIT/ShiShan_HOT100"
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md px-3 py-1.5 font-medium text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                GitHub 仓库
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-20 pt-6 sm:pt-8">{children}</main>

        <footer className="border-t border-line/80 bg-surface/50 py-6 text-xs text-muted">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
            <p className="text-[12px] text-muted">
              题目下发到本地 · 判题在本机执行 · 数据不出环境
            </p>
            <p className="font-mono text-[11px] text-muted/80">
              ShiShan Hot100 · Clean & Minimalist
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}