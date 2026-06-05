"use client";

import { Button } from "@/components/ui/button";
import { Film, LayoutTemplate, Plus, Video, Image as ImageIcon, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/projects", icon: Video, label: "Projects" },
  { href: "/templates", icon: LayoutTemplate, label: "Templates" },
  { href: "/thumbnail-studio", icon: ImageIcon, label: "Thumbnails" },
];

/** Flyout label shown to the right of a rail icon on hover. */
function RailLabel({ children, accent = "primary" }: { children: React.ReactNode; accent?: "primary" | "amber" }) {
  const accentCls =
    accent === "amber"
      ? "border-amber-400/30 text-amber-300"
      : "border-primary/30 text-foreground";
  return (
    <span
      className={`pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50
        whitespace-nowrap rounded-none border ${accentCls} bg-card px-2.5 py-1
        text-[10px] font-black uppercase tracking-[0.15em] font-mono shadow-2xl
        opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
        transition-all duration-150`}
    >
      {children}
    </span>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      <aside className="w-12 flex-shrink-0 border-r border-border bg-card/95 font-mono flex-col justify-between hidden md:flex transition-all duration-300 z-20">
        <div className="p-2">
          <Link href="/" className="group relative flex items-center justify-center mb-6 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(255,51,0,0.5)] shrink-0">
              <Film className="w-4 h-4 text-primary-foreground" />
            </div>
            <RailLabel>Dashboard</RailLabel>
          </Link>

          <nav className="space-y-3">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

              return (
                <Link key={item.href} href={item.href} className="group relative block" title={item.label}>
                  {isActive && (
                    <div className="absolute left-[-8px] top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                  )}
                  <Button
                    variant="ghost"
                    className={`w-full px-0 justify-center h-8 transition-colors rounded-none ${
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                  </Button>
                  <RailLabel>{item.label}</RailLabel>
                </Link>
              );
            })}

            {/* Advance Content shortcut */}
            <div className="pt-3 mt-3">
              {(() => {
                const isAdvanceActive = pathname?.startsWith("/advance-editor");
                return (
                  <Link href="/projects/new?fresh=1&advance=1" className="group relative block" title="Advance Content">
                    {isAdvanceActive && (
                      <div className="absolute left-[-8px] top-0 bottom-0 w-[2px] bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
                    )}
                    <Button
                      variant="ghost"
                      className={`w-full px-0 justify-center h-8 transition-colors rounded-none ${
                        isAdvanceActive
                          ? "text-amber-400 bg-amber-400/10"
                          : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/5"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    <RailLabel accent="amber">Advance Content</RailLabel>
                  </Link>
                );
              })()}
            </div>

            <div className="pt-3 mt-3">
              <Link href="/projects/new?fresh=1" className="group relative block" title="New Project">
                <Button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 px-0 justify-center h-8 overflow-hidden transition-all rounded-none">
                  <Plus className="w-4 h-4" />
                </Button>
                <RailLabel>New Project</RailLabel>
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-[-25%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary/[0.04] blur-[160px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto z-10 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
