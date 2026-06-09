"use client";

import { Info, X } from "lucide-react";
import { useState, type ReactNode } from "react";

type CardInfoHeaderProps = {
  title: string;
  subtitle?: string;
  /** Detailed description revealed on click. Supports string or JSX. */
  info: ReactNode;
  /** Extra content rendered after the subtitle (e.g. a badge). */
  aside?: ReactNode;
};

/**
 * Minimal info toggle — just the ⓘ icon + expandable panel.
 * Use inline, directly after a title or label, when `CardInfoHeader` can't wrap the whole header.
 */
export function SettingInfo({ info }: { info: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-label={open ? "Masquer" : "En savoir plus"}
        onClick={() => setOpen((v) => !v)}
        className={`ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-none border transition-colors ${
          open
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border text-muted-foreground/30 hover:border-primary/40 hover:text-muted-foreground/60"
        }`}
      >
        {open ? <X className="h-2.5 w-2.5" /> : <Info className="h-2.5 w-2.5" />}
      </button>
      {open && (
        <span className="mt-2 block border-l-2 border-primary/40 bg-primary/5 py-2.5 pl-3 pr-2 text-[10px] leading-relaxed text-muted-foreground font-mono space-y-1.5">
          {info}
        </span>
      )}
    </span>
  );
}

/**
 * Section header for Editor LAB cards.
 * Clicking the ⓘ icon reveals a description panel below the subtitle.
 * Replaces the raw <div px-5 py-3.5> + <h3> + <p> pattern used throughout the LABs.
 */
export function CardInfoHeader({ title, subtitle, info, aside }: CardInfoHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
          {title}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {aside}
          <button
            type="button"
            aria-label={open ? "Masquer la description" : "Afficher la description"}
            onClick={() => setOpen((v) => !v)}
            className={`flex h-5 w-5 items-center justify-center rounded-none border transition-colors ${
              open
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground/30 hover:border-primary/40 hover:text-muted-foreground/70"
            }`}
          >
            {open ? <X className="h-2.5 w-2.5" /> : <Info className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
          {subtitle}
        </p>
      )}

      {open && (
        <div className="mt-3 border-l-2 border-primary/40 bg-primary/5 py-2.5 pl-3 pr-2">
          <div className="text-[10px] leading-relaxed text-muted-foreground font-mono space-y-1.5">
            {info}
          </div>
        </div>
      )}
    </div>
  );
}
