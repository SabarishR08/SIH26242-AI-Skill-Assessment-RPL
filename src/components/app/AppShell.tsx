"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutDashboard, Route, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/path", label: "Roadmap", icon: Route },
  { href: "/mentor", label: "Mentor", icon: MessagesSquare },
];

export function AppShell({
  children,
  learnerName,
  onReset,
}: {
  children: React.ReactNode;
  learnerName?: string | null;
  onReset?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2 mr-1 sm:mr-2 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-white/5">
              <Compass className="h-4.5 w-4.5 text-primary" />
            </span>
            <span className="font-semibold tracking-tight text-primary">PathFinder</span>
          </Link>
          <nav className="flex items-center gap-1 flex-1 min-w-0">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 text-sm transition-colors shrink-0",
                    active ? "bg-primary/10 text-primary border border-white/5" : "text-muted-foreground hover:text-primary hover:bg-white/5 border border-transparent",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          {learnerName ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-muted-foreground hidden sm:inline">{learnerName}</span>
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 bg-white/5 border border-white/10 rounded px-1.5 py-0.5"
                title="Session progress is stored locally in your browser (no password required)"
              >
                Local Profile
              </span>
              {onReset ? (
                <Button variant="ghost" size="sm" onClick={onReset} className="text-xs h-7 px-2">
                  Start over
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-6 overflow-x-hidden min-w-0">{children}</main>
      <footer className="border-t border-white/5 bg-black/40 py-4 mt-auto">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground text-center sm:text-left">
          <span>PathFinder — built for the AI hackathon</span>
          <div className="flex gap-4">
            <span className="hover:text-primary transition-colors cursor-default">Experimental Build</span>
            <span className="hover:text-primary transition-colors cursor-default">Nexus Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
