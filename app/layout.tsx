import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "屎山 Hot100",
  description: "AI 时代的屎山代码题库与本地在线评测系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-serif text-lg tracking-tight text-ink">
                屎山 Hot100
              </span>
              <span className="text-[11px] text-muted transition-colors group-hover:text-accent">
                AI Coding 屎山题 · 本地回归评测
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link href="/" className="transition-colors hover:text-ink">
                题库
              </Link>
              <a
                href="https://github.com"
                rel="noreferrer noopener"
                className="hidden transition-colors hover:text-ink sm:inline"
              >
                使用说明
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 pb-24 pt-8">{children}</main>
        <footer className="border-t border-line py-6">
          <p className="mx-auto max-w-5xl px-5 text-xs text-muted">
            题目下发到本地 · 判题在本机执行 · 所有测试点通过即为 AC
          </p>
        </footer>
      </body>
    </html>
  );
}