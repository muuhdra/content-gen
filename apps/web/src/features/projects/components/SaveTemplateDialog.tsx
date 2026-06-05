"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, LayoutTemplate } from "lucide-react";

/**
 * Reusable "Save as Template" dialog — collects a name + description, then calls
 * `onSave`. The parent persists the template and closes the dialog on success;
 * on failure the parent's promise rejects and the error is shown here.
 */
export function SaveTemplateDialog({
  defaultTitle = "",
  defaultDescription = "",
  onSave,
  onClose,
}: {
  defaultTitle?: string;
  defaultDescription?: string;
  onSave: (values: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Give your template a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), description: description.trim() });
      // Parent unmounts the dialog on success.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="w-full max-w-md border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground font-mono">Save as Template</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 pb-2 font-mono">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">Template name</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cyberpunk Tech News"
              autoFocus
              className="h-10 rounded-none border border-border bg-background text-xs font-mono focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for? The style, the format, the use case…"
              className="min-h-20 resize-none rounded-none border border-border bg-background text-xs font-mono focus:ring-primary"
            />
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/60">
            Saves this project&apos;s configuration (type, models, language, tone &amp; visual style) as a reusable template in your library.
          </p>
          {error ? <p className="text-[11px] font-mono text-destructive">{error}</p> : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 bg-background p-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="h-10 rounded-none border-border bg-background px-5 text-[9px] font-black uppercase tracking-widest text-foreground font-mono hover:bg-card"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={busy || !title.trim()}
            className="h-10 rounded-none bg-primary px-6 text-[9px] font-black uppercase tracking-widest text-primary-foreground font-mono hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
