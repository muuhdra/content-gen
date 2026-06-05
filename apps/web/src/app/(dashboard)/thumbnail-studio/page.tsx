"use client";

import React, { Suspense } from "react";
import ThumbnailStudio from "@/features/thumbnail-studio/components/ThumbnailStudio";

function ThumbnailStudioContent() {
  return (
    <div className="mx-auto mt-4 max-w-400 space-y-8 pb-10 px-4">
      {/* Brutalist Header */}
      <div className="space-y-2 border-l-4 border-primary pl-4">
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-mono">
              Creative Lab
            </p>
            <h2 className="text-3xl font-display uppercase tracking-tight text-foreground m-0">
              Thumbnail Studio
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-xl mt-2 font-mono">
              Generate and curate high-performance video thumbnails. Leverage styles from our curated reference gallery or upload your own visual anchors.
            </p>
          </div>
        </div>
      </div>

      {/* Main Feature Component Workspace */}
      <ThumbnailStudio />
    </div>
  );
}

export default function ThumbnailStudioPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <ThumbnailStudioContent />
    </Suspense>
  );
}
