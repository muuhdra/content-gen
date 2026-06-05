"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateThumbnail as apiGenerateThumbnail,
  fetchThumbnails,
  deleteThumbnail as apiDeleteThumbnail,
  getThumbnailFileUrl,
  fetchThumbnailReferences,
  saveThumbnailReferences,
  type ThumbnailRecord,
} from "@/lib/projects-api";
import { 
  Wand2, 
  Image as ImageIcon, 
  Plus, 
  Copy, 
  Check, 
  Upload,
  Download,
  RefreshCw,
  Sparkles,
  X,
  FileImage,
  Monitor,
  Trash2
} from "lucide-react";

type Category = {
  id: string;
  name: string;
};

type ReferenceThumbnail = {
  id: string;
  title: string;
  prompt: string;
  categoryId: string; // Dynamic Category Reference
  format: "16:9" | "9:16" | "1:1";
  previewGradient: string;
  tags: string[];
  customImage?: string; // Base64 string for user attached/uploaded custom thumbnail reference
};

// The library starts empty. Real categories & reference templates are created by
// the user and persisted server-side (Supabase in prod, local file in dev).
const DEFAULT_CATEGORIES: Category[] = [];

const DEFAULT_REFERENCES: ReferenceThumbnail[] = [];

export default function ThumbnailStudio() {
  // Main Generator States
  const [prompt, setPrompt] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [attachedReference, setAttachedReference] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [generatedThumbnail, setGeneratedThumbnail] = useState<{
    id: string;
    prompt: string;
    format: "16:9" | "9:16" | "1:1";
    imageUrl: string;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [savedThumbnails, setSavedThumbnails] = useState<ThumbnailRecord[]>([]);

  // Load previously generated thumbnails (persisted server-side).
  useEffect(() => {
    let cancelled = false;
    fetchThumbnails()
      .then((list) => { if (!cancelled) setSavedThumbnails(list); })
      .catch(() => { /* gallery stays empty on failure */ });
    return () => { cancelled = true; };
  }, []);

  // Pre-fill from a project hand-off (e.g. "Create Thumbnail" on a project):
  // /thumbnail-studio?prompt=...&format=16:9
  const searchParams = useSearchParams();
  useEffect(() => {
    const incomingPrompt = searchParams.get("prompt");
    const incomingFormat = searchParams.get("format");
    if (incomingPrompt) setPrompt(incomingPrompt);
    if (incomingFormat === "16:9" || incomingFormat === "9:16" || incomingFormat === "1:1") {
      setSelectedFormat(incomingFormat);
    }
    // Only on mount / when the hand-off params change.
  }, [searchParams]);

  // Dynamic Categories States
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  
  // Category CRUD States
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>("");

  // Gallery copied ID
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [referenceThumbnails, setReferenceThumbnails] = useState<ReferenceThumbnail[]>(DEFAULT_REFERENCES);

  // Add Reference Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newPrompt, setNewPrompt] = useState<string>("");
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newFormat, setNewFormat] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [newTagsString, setNewTagsString] = useState<string>("");
  const [newCustomImage, setNewCustomImage] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reference library persistence: load once on mount, then auto-save (debounced)
  // on every change. `libraryHydrated` guards against saving the default seed
  // back over the server before the initial load completes.
  const libraryHydrated = useRef<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    fetchThumbnailReferences()
      .then((library) => {
        if (cancelled) return;
        if (Array.isArray(library.categories) && library.categories.length > 0) {
          setCategories(library.categories);
        }
        if (Array.isArray(library.references)) {
          setReferenceThumbnails(library.references as ReferenceThumbnail[]);
        }
      })
      .catch(() => { /* keep the in-memory defaults on failure */ })
      .finally(() => { if (!cancelled) libraryHydrated.current = true; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!libraryHydrated.current) return;
    const timer = setTimeout(() => {
      saveThumbnailReferences({ categories, references: referenceThumbnails }).catch(() => {
        /* best-effort; the next change will retry */
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [categories, referenceThumbnails]);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Reference Image Upload Handler
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedReference(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachedReference = () => {
    setAttachedReference(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Apply a reference style. If a prompt already exists (e.g. handed off from a
  // project's script), the reference's style is BLENDED in rather than replacing
  // it — so the reference library is "taken into account" on top of the script.
  const handleApplyReference = (ref: ReferenceThumbnail) => {
    setPrompt((current) => {
      const base = current.trim();
      if (!base) return ref.prompt;
      if (base.includes(ref.prompt)) return base; // already applied
      return `${base}\n\nStyle reference — ${ref.title}: ${ref.prompt}`;
    });
    // Only adopt the reference's aspect ratio when starting from scratch;
    // otherwise keep the format already chosen for the project.
    if (!prompt.trim()) setSelectedFormat(ref.format);
    if (ref.customImage) {
      setAttachedReference(ref.customImage);
    } else {
      setAttachedReference("gradient-preset");
    }
  };

  // Clipboard prompt copy
  const handleCopyPrompt = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Dynamic Category CRUD Actions
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newId = `cat-${Date.now()}`;
    const newCat: Category = {
      id: newId,
      name: newCategoryName.trim()
    };
    setCategories(prev => [...prev, newCat]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    setActiveCategoryId(newId); // switch immediately to new category
  };

  const handleStartRename = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const handleSaveRename = () => {
    if (!editingCategoryName.trim() || !editingCategoryId) return;
    setCategories(prev => prev.map(cat => 
      cat.id === editingCategoryId ? { ...cat, name: editingCategoryName.trim() } : cat
    ));
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
    // Remove references belonging to deleted category
    setReferenceThumbnails(prev => prev.filter(ref => ref.categoryId !== catId));
    if (activeCategoryId === catId) {
      setActiveCategoryId("all");
    }
  };


  // Mock Generation Pipeline
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationProgress(15);
    setGenerationStep("Sending prompt to the image engine…");
    setGeneratedThumbnail(null);
    setGenerationError(null);

    // Indeterminate-ish progress while the real request is in flight.
    const progressTimer = setInterval(() => {
      setGenerationProgress((p) => (p < 90 ? p + 5 : p));
    }, 600);

    try {
      const thumbnail = await apiGenerateThumbnail({
        prompt: prompt.trim(),
        format: selectedFormat,
      });

      setGenerationProgress(100);
      setGenerationStep("Finalizing…");
      const imageUrl = getThumbnailFileUrl(thumbnail.id);
      setGeneratedThumbnail({
        id: thumbnail.id,
        prompt: thumbnail.prompt,
        format: thumbnail.format,
        imageUrl,
      });
      setSavedThumbnails((prev) => [thumbnail, ...prev]);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Thumbnail generation failed.");
    } finally {
      clearInterval(progressTimer);
      setIsGenerating(false);
    }
  };

  const handleDownloadGenerated = () => {
    if (!generatedThumbnail) return;
    window.open(getThumbnailFileUrl(generatedThumbnail.id, { download: true }), "_blank");
  };

  // Saved thumbnails gallery: delete a persisted thumbnail (record + file).
  const [deletingThumbnailId, setDeletingThumbnailId] = useState<string | null>(null);
  const handleDeleteSavedThumbnail = async (id: string) => {
    setDeletingThumbnailId(id);
    try {
      await apiDeleteThumbnail(id);
      setSavedThumbnails((prev) => prev.filter((t) => t.id !== id));
    } catch {
      /* leave it in the list on failure */
    } finally {
      setDeletingThumbnailId(null);
    }
  };

  // Export dynamically synthesized thumbnail back to the active library category
  const handleExportToLibrary = () => {
    if (!generatedThumbnail) return;

    const words = generatedThumbnail.prompt.split(" ").slice(0, 3).join(" ");
    const smartTitle = words ? `${words} Remix` : "Custom Remix Layout";

    const newRef: ReferenceThumbnail = {
      id: `exported-ref-${Date.now()}`,
      title: smartTitle,
      prompt: generatedThumbnail.prompt,
      categoryId: activeCategoryId === "all" ? (categories[0]?.id || "") : activeCategoryId,
      format: generatedThumbnail.format,
      previewGradient: "from-zinc-950 via-zinc-900 to-primary/20 border-primary/30",
      tags: ["REMIX", "SYNTHESIZED"],
      customImage: generatedThumbnail.imageUrl,
    };

    setReferenceThumbnails((prev) => [newRef, ...prev]);
  };

  // Add Custom Reference Thumbnail Handlers
  const handleModalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewCustomImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomReference = () => {
    if (!newTitle.trim() || !newPrompt.trim() || !newCategoryId) return;

    const tags = newTagsString
      ? newTagsString.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
      : ["CUSTOM REF"];

    const newRef: ReferenceThumbnail = {
      id: `custom-ref-${Date.now()}`,
      title: newTitle.trim(),
      prompt: newPrompt.trim(),
      categoryId: newCategoryId,
      format: newFormat,
      previewGradient: "from-zinc-950 via-zinc-900 to-zinc-900/50 border-border",
      tags,
      customImage: newCustomImage || undefined
    };

    setReferenceThumbnails(prev => [...prev, newRef]);

    // Reset Modal States
    setNewTitle("");
    setNewPrompt("");
    setNewCategoryId(categories[0]?.id || "");
    setNewFormat("16:9");
    setNewTagsString("");
    setNewCustomImage(null);
    setIsAddModalOpen(false);
  };

  // Filter thumbnails by category and aspect ratio format
  const filteredReferences = referenceThumbnails.filter(ref => {
    if (activeCategoryId !== "all" && ref.categoryId !== activeCategoryId) return false;
    return true;
  });

  return (
    <div className="mt-6 space-y-6">
      
      {/* COCKPIT DECK GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* ========================================================================= */}
        {/* 01. UNIFIED NARRATIVE COMMAND BOX (LEFT COLUMN)                          */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="rounded-none border border-border bg-card shadow-none flex flex-col h-full justify-between">
            <div className="p-4 bg-card/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary font-bold">01.</span>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground font-mono">
                  Narrative Text Prompt
                </h3>
              </div>
              <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
                Unified Engine
              </span>
            </div>
            
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your thumbnail composition. E.g. Large bold technical text saying 'AI REVOLUTION' with sleek glowing laser lines and a highly detailed server cockpit backdrop..."
                className="flex-1 min-h-36 rounded-none border border-border bg-background focus:ring-primary text-xs font-mono resize-none placeholder:text-muted-foreground/35 leading-relaxed p-4"
                disabled={isGenerating}
              />
              
              {/* Pipeline loader hud */}
              {isGenerating && (
                <div className="p-4 border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-widest">
                    <span className="text-primary font-black flex items-center gap-1.5 animate-pulse font-mono">
                      <Sparkles className="w-3.5 h-3.5" /> Pipeline Status
                    </span>
                    <span className="text-muted-foreground font-mono">{generationProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-card border border-border overflow-hidden rounded-none relative">
                    <div 
                      className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_hsl(var(--primary))]"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-[9px] font-mono text-foreground font-medium uppercase tracking-wider select-none leading-none">
                    👉 {generationStep}
                  </p>
                </div>
              )}

              {/* INTEGRATED BUTTONS BAR */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/40">
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Style Reference Button Trigger */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleReferenceUpload}
                  />
                  
                  {!attachedReference ? (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5 rounded-none border-border bg-background hover:bg-primary/5 hover:border-primary/40 text-[9.5px] font-mono uppercase tracking-widest text-foreground transition-all cursor-pointer flex items-center gap-2 group"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      <span>Add Style</span>
                    </Button>
                  ) : (
                    <div className="flex items-center border border-primary/30 bg-primary/5 p-1 gap-2.5 rounded-none relative group/style-badge transition-all">
                      {attachedReference === "gradient-preset" ? (
                        <div className="w-9 h-5.5 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-500/30 shrink-0" />
                      ) : (
                        <img 
                          src={attachedReference} 
                          alt="Active Style Anchor" 
                          className="w-9 h-5.5 object-cover border border-primary/20 shrink-0"
                        />
                      )}
                      <div className="flex flex-col pr-1 select-none leading-none">
                        <span className="text-[6.5px] font-mono text-primary font-black uppercase tracking-widest leading-none flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" /> Style Linked
                        </span>
                        <span className="text-[8px] font-mono text-muted-foreground truncate max-w-[80px] mt-0.5 leading-none">
                          Active Anchor
                        </span>
                      </div>
                      <button 
                        onClick={removeAttachedReference}
                        className="h-5.5 w-5.5 flex items-center justify-center bg-black/60 border border-border/80 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive text-muted-foreground transition-all cursor-pointer rounded-none"
                        title="Remove style reference"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}

                  {/* Vertical Divider */}
                  <div className="w-[1px] h-6 bg-border/40 hidden sm:block" />

                  {/* Segmented Aspect Ratio Selection Track */}
                  <div className="flex items-center border border-border bg-background p-0.5 rounded-none">
                    {[
                      { value: "16:9", label: "16:9", icon: <div className="w-3.5 h-2 border border-current opacity-70" /> },
                      { value: "9:16", label: "9:16", icon: <div className="w-2 h-3.5 border border-current opacity-70" /> },
                      { value: "1:1", label: "1:1", icon: <div className="w-2.5 h-2.5 border border-current opacity-70" /> }
                    ].map((opt) => {
                      const isActive = selectedFormat === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedFormat(opt.value as "16:9" | "9:16" | "1:1")}
                          className={`px-3 py-1.5 text-[8.5px] font-mono font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer rounded-none border ${
                            isActive 
                              ? "bg-primary text-primary-foreground border-primary shadow-[0_0_8px_rgba(255,51,0,0.2)]" 
                              : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.icon}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                </div>

                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="h-9 px-5 rounded-none bg-primary hover:bg-primary/95 text-primary-foreground font-black uppercase tracking-widest text-[9.5px] gap-2 transition-all shadow-[0_0_20px_-5px_hsl(var(--primary))]"
                >
                  {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Synthesize
                </Button>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 03. RENDER PREVIEW HUB (RIGHT COLUMN)                                    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="rounded-none border border-border bg-card shadow-none flex flex-col h-full justify-between">
            <div className="p-4 bg-card/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary font-bold">02.</span>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground font-mono">
                  Render Preview Hub
                </h3>
              </div>
              <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
                Ratio: {selectedFormat}
              </span>
            </div>
            
            <div className="p-6 flex-1 flex flex-col items-center justify-center bg-card/20 min-h-[300px]">
              
              {generatedThumbnail ? (
                /* Real generated thumbnail */
                <div
                  className={`relative overflow-hidden border border-primary/20 shadow-2xl ${
                    generatedThumbnail.format === "16:9"
                      ? "w-full aspect-[16/9]"
                      : generatedThumbnail.format === "9:16"
                        ? "w-44 aspect-[9/16]"
                        : "w-56 aspect-[1/1]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generatedThumbnail.imageUrl}
                    alt={generatedThumbnail.prompt}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                </div>
              ) : generationError ? (
                /* Generation failed */
                <div className="w-full aspect-[16/9] border border-destructive/30 flex flex-col items-center justify-center p-6 text-center bg-destructive/5">
                  <X className="w-8 h-8 text-destructive/60 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-destructive font-mono mb-2">
                    Generation Failed
                  </p>
                  <p className="text-[11px] text-muted-foreground font-sans max-w-sm leading-relaxed">
                    {generationError}
                  </p>
                </div>
              ) : isGenerating ? (
                /* In progress */
                <div className="w-full aspect-[16/9] border border-primary/20 flex flex-col items-center justify-center p-6 text-center bg-background/25">
                  <div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary font-mono">
                    {generationProgress}%
                  </p>
                  <p className="text-[9px] text-muted-foreground/70 mt-1 font-mono">{generationStep}</p>
                </div>
              ) : (
                /* Empty placeholder */
                <div className="w-full aspect-[16/9] border border-dashed border-border/80 flex flex-col items-center justify-center p-6 text-center select-none bg-background/25">
                  <Monitor className="w-8 h-8 text-muted-foreground/15 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/45 font-mono">
                    No thumbnail yet
                  </p>
                  <p className="text-[7.5px] uppercase tracking-widest text-muted-foreground/30 mt-1 font-mono">
                    Write a prompt and click Synthesize
                  </p>
                </div>
              )}

            </div>

            {/* Preview controls footer */}
            <div className="p-4 bg-background border-t border-border/40 flex items-center justify-between gap-3">
              <span className="text-[7.5px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                UHD PNG FORMAT ➔ LIVE PREVIEW STAGE
              </span>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  disabled={!generatedThumbnail}
                  className="h-7 px-3.5 rounded-none border-border bg-background text-[9px] font-mono uppercase tracking-widest hover:border-primary/50 text-foreground cursor-pointer disabled:opacity-40"
                  onClick={handleDownloadGenerated}
                >
                  <Download className="w-3 h-3 mr-1.5" /> Download
                </Button>
                <Button
                  disabled={!generatedThumbnail}
                  className="h-7 px-4 rounded-none bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40"
                  onClick={handleExportToLibrary}
                >
                  <Check className="w-3 h-3 mr-1.5" /> Export
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 02b. GENERATED THUMBNAILS GALLERY (persisted history)                      */}
      {/* ========================================================================= */}
      {savedThumbnails.length > 0 && (
        <div className="rounded-none border border-border bg-card shadow-none">
          <div className="p-5 bg-card flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-black uppercase tracking-widest text-foreground font-mono">
                  Generated Thumbnails
                </h2>
              </div>
              <p className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mt-1">
                Your rendered thumbnails — download or remove them.
              </p>
            </div>
            <Badge className="border border-border bg-background text-[8px] font-mono text-muted-foreground tracking-wider rounded-none uppercase py-0.5 px-2">
              {savedThumbnails.length} saved
            </Badge>
          </div>

          <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {savedThumbnails.map((thumb) => (
              <div
                key={thumb.id}
                className="border border-border bg-background group/saved relative overflow-hidden hover:border-primary/35 transition-all"
              >
                <div className="w-full aspect-[16/9] bg-zinc-950 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getThumbnailFileUrl(thumb.id)}
                    alt={thumb.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm opacity-0 group-hover/saved:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 px-3">
                  <Button
                    size="sm"
                    onClick={() => window.open(getThumbnailFileUrl(thumb.id, { download: true }), "_blank")}
                    className="w-full h-8 bg-primary hover:bg-primary/95 text-primary-foreground font-mono text-[9px] font-black uppercase tracking-widest rounded-none gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingThumbnailId === thumb.id}
                    onClick={() => handleDeleteSavedThumbnail(thumb.id)}
                    className="w-full h-8 border-destructive/30 bg-background text-destructive/90 hover:bg-destructive/10 hover:text-destructive font-mono text-[9px] uppercase tracking-widest rounded-none gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {deletingThumbnailId === thumb.id ? "Removing…" : "Delete"}
                  </Button>
                </div>
                <div className="p-2 flex items-center justify-between">
                  <span className="text-[8px] font-mono text-primary font-bold uppercase tracking-wider">{thumb.format}</span>
                  <span className="text-[8px] font-mono text-muted-foreground/50 truncate max-w-[70%]" title={thumb.prompt}>
                    {thumb.prompt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 03. CURATED DESIGN LIBRARY & DYNAMIC CATEGORIES MANAGER                    */}
      {/* ========================================================================= */}
      <div className="rounded-none border border-border bg-card shadow-none">
        
        {/* Header */}
        <div className="p-5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono text-primary font-bold">03.</span>
              <h2 className="text-xs font-black uppercase tracking-widest text-foreground font-mono">
                Curated Design Library
              </h2>
            </div>
            <p className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mt-1">
              Browse reference layouts, manage custom categories, or copy styling prompt templates.
            </p>
          </div>

          {/* Add Reference Button — needs at least one category to file the template under */}
          <Button
            onClick={() => {
              setNewCategoryId(activeCategoryId !== "all" ? activeCategoryId : (categories[0]?.id || ""));
              setIsAddModalOpen(true);
            }}
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Create a category first" : "Register a new reference template"}
            className="h-8 px-4 rounded-none bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 text-[9px] font-black uppercase tracking-widest transition-all font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Reference
          </Button>
        </div>

        {/* Dynamic Category Switcher Bar (CRUD DECK) */}
        <div className="px-5 py-3 bg-background/50 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={() => setActiveCategoryId("all")}
              className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-widest transition-all font-mono rounded-none border cursor-pointer ${
                activeCategoryId === "all" 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              All Layouts
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-widest transition-all font-mono rounded-none border cursor-pointer ${
                  activeCategoryId === cat.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Category CRUD Actions Container */}
          <div className="flex items-center gap-2">
            
            {/* Inline Add Category form */}
            {isAddingCategory ? (
              <div className="flex items-center gap-1.5 border border-primary/30 bg-background px-2.5 py-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New Category Name..."
                  className="bg-transparent border-none outline-none text-[9.5px] font-mono text-foreground placeholder:text-muted-foreground/35 w-32 p-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                    if (e.key === "Escape") setIsAddingCategory(false);
                  }}
                  autoFocus
                />
                <button onClick={handleAddCategory} className="text-primary hover:text-primary-foreground cursor-pointer p-0.5">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsAddingCategory(false)} className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                onClick={() => setIsAddingCategory(true)}
                className="h-7 px-3 rounded-none bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 text-[8.5px] font-black uppercase tracking-widest transition-all font-mono cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Category
              </Button>
            )}

            {/* Inline Rename and Delete controls for active dynamic category */}
            {activeCategoryId !== "all" && (
              <div className="flex items-center gap-2">
                {editingCategoryId === activeCategoryId ? (
                  <div className="flex items-center gap-1.5 border border-primary/30 bg-background px-2.5 py-1">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="bg-transparent border-none outline-none text-[9.5px] font-mono text-foreground w-32 p-0"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename();
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                      autoFocus
                    />
                    <button onClick={handleSaveRename} className="text-primary hover:text-primary-foreground cursor-pointer p-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingCategoryId(null)} className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => handleStartRename(categories.find(c => c.id === activeCategoryId)!)}
                      className="h-7 px-2.5 rounded-none border-border bg-background hover:bg-card text-[8.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Rename
                    </Button>
                    <Button
                      onClick={() => handleDeleteCategory(activeCategoryId)}
                      className="h-7 px-2.5 rounded-none border-destructive/20 bg-background hover:bg-destructive/10 text-[8.5px] font-mono uppercase tracking-widest text-destructive/80 hover:text-destructive cursor-pointer"
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Reference Grid */}
        <div className="p-5">
          {filteredReferences.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReferences.map((ref) => (
                <div 
                  key={ref.id}
                  className="border border-border bg-background p-4 space-y-3.5 relative overflow-hidden group/ref hover:border-primary/35 transition-all flex flex-col justify-between"
                >
                  {/* Interactive Visual Box Cover */}
                  <div className="w-full aspect-[16/9] relative overflow-hidden border border-border/80 bg-zinc-950">
                    
                    {ref.customImage ? (
                      <img 
                        src={ref.customImage} 
                        alt={ref.title} 
                        className="w-full h-full object-cover grayscale opacity-65 group-hover/ref:grayscale-0 group-hover/ref:opacity-100 transition-all duration-700"
                      />
                    ) : (
                      // Premium conceptual CSS layouts
                      <div className={`w-full h-full bg-gradient-to-br ${ref.previewGradient} flex flex-col justify-between p-3 relative`}>
                        <span className="text-[6px] font-mono text-muted-foreground/60 uppercase tracking-widest self-start">
                          {categories.find(c => c.id === ref.categoryId)?.name || "Preset"}
                        </span>
                        <div className="w-8 h-8 rounded-none border border-white/5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-40 group-hover/ref:opacity-100 transition-opacity">
                          <FileImage className="w-4 h-4 text-muted-foreground/60" />
                        </div>
                        <span className="text-[7.5px] font-mono font-bold text-white/50 truncate max-w-full">
                          Style: {ref.title}
                        </span>
                      </div>
                    )}

                    {/* Interactive hover actions overlay deck */}
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm opacity-0 group-hover/ref:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 px-4 select-none">
                      <Button
                        size="sm"
                        onClick={() => handleApplyReference(ref)}
                        className="w-full h-8 bg-primary hover:bg-primary/95 text-primary-foreground font-mono text-[9px] font-black uppercase tracking-widest rounded-none gap-1.5 shadow-[0_0_12px_rgba(255,51,0,0.4)] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Use as Reference
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyPrompt(ref.id, ref.prompt)}
                        className="w-full h-8 border-border bg-background text-foreground font-mono text-[9px] uppercase tracking-widest rounded-none gap-1.5 hover:border-primary/50 cursor-pointer"
                      >
                        {copiedId === ref.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === ref.id ? "Prompt Copied" : "Copy Prompt"}
                      </Button>
                    </div>
                  </div>

                  {/* Reference metadata description */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-mono font-bold text-foreground truncate max-w-[140px]">
                        {ref.title}
                      </h4>
                      <span className="text-[8px] font-mono text-primary font-bold uppercase tracking-wider">
                        {categories.find(c => c.id === ref.categoryId)?.name || "Custom"}
                      </span>
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground/60 leading-relaxed line-clamp-2 select-all hover:text-foreground/80 transition-colors">
                      {ref.prompt}
                    </p>
                    
                    {/* Interactive badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5 select-none">
                      <Badge 
                        className="border border-primary/20 bg-primary/5 text-[7px] font-mono text-primary tracking-wider rounded-none uppercase py-0 px-1 font-bold"
                      >
                        {ref.format}
                      </Badge>
                      {ref.tags.map((tag, idx) => (
                        <Badge 
                          key={idx} 
                          className="border border-border/80 bg-background text-[7.5px] font-mono text-muted-foreground/50 tracking-wider rounded-none uppercase py-0 px-1.5"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center border border-dashed border-border rounded-none bg-background/25">
              <ImageIcon className="w-8 h-8 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 font-mono">
                {categories.length === 0
                  ? "Your library is empty — add a category to start"
                  : referenceThumbnails.length === 0
                    ? "No reference templates yet — click “Add Reference”"
                    : "No styles found in this category"}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* ADD REFERENCE MODAL COMPONENT (FULL SCREEN BRUTALIST GRID BACKDROP)        */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-border bg-card shadow-2xl relative">
            
            {/* Modal header */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground font-mono">
                  Register Custom Reference Template
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body form */}
            <div className="p-5 space-y-4 font-mono">
              
              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                  Reference Title
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="E.g. Technical Neon Cyber"
                  className="h-10 rounded-none border border-border bg-background focus:ring-primary text-xs font-mono"
                />
              </div>

              {/* Prompt inputs */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                  Styling Text Prompt
                </label>
                <Textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Paste or write the prompt details describing this thumbnail look..."
                  className="min-h-24 rounded-none border border-border bg-background focus:ring-primary text-xs font-mono resize-none"
                />
              </div>

              {/* Category, Format & Tag fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                    Category Type
                  </label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background text-xs font-mono rounded-none focus:ring-primary focus:border-primary text-foreground outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                    Format Ratio
                  </label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as "16:9" | "9:16" | "1:1")}
                    className="w-full h-10 px-3 border border-border bg-background text-xs font-mono rounded-none focus:ring-primary focus:border-primary text-foreground outline-none"
                  >
                    <option value="16:9">Widescreen 16:9</option>
                    <option value="9:16">Portrait 9:16</option>
                    <option value="1:1">Square 1:1</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                    Tags (Comma-separated)
                  </label>
                  <Input
                    value={newTagsString}
                    onChange={(e) => setNewTagsString(e.target.value)}
                    placeholder="E.g. CTR, GLOW, NEON"
                    className="h-10 rounded-none border border-border bg-background focus:ring-primary text-xs font-mono"
                  />
                </div>
              </div>

              {/* Cover Mockup Image Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/80">
                  Reference Visual Mockup
                </label>

                {!newCustomImage ? (
                  <div 
                    onClick={() => modalFileInputRef.current?.click()}
                    className="border border-dashed border-border hover:border-primary/45 bg-background/50 hover:bg-primary/5 transition-all py-5 text-center cursor-pointer group"
                  >
                    <input 
                      type="file" 
                      ref={modalFileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleModalImageUpload}
                    />
                    <Upload className="w-4 h-4 text-muted-foreground/35 mx-auto mb-1 group-hover:text-primary transition-colors" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground font-mono transition-colors">
                      Attach Custom Preview Cover
                    </p>
                  </div>
                ) : (
                  <div className="border border-border bg-background p-2.5 flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                      <img 
                        src={newCustomImage} 
                        alt="Custom Mockup Preview" 
                        className="w-12 aspect-[16/9] object-cover border border-border"
                      />
                      <span className="text-[9.5px] font-bold text-foreground truncate max-w-[180px]">
                        Preview Attached Successfully
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewCustomImage(null)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-none shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

            </div>

            {/* Modal actions */}
            <div className="p-4 bg-background flex justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="h-10 px-5 rounded-none border-border bg-background hover:bg-card text-[9px] font-black uppercase tracking-widest font-mono text-foreground cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomReference}
                disabled={!newTitle.trim() || !newPrompt.trim() || !newCategoryId}
                className="h-10 px-6 rounded-none bg-primary hover:bg-primary/95 text-primary-foreground font-black uppercase tracking-widest text-[9px] font-mono gap-1.5 transition-all shadow-[0_0_15px_-5px_hsl(var(--primary))] disabled:opacity-40"
              >
                <Check className="w-4 h-4" /> Register Style Reference
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
