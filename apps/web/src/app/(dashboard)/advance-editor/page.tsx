"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchProject, updateProject, uploadProjectReferenceAsset, getProjectReferencePreviewUrl, generateProjectResearch } from "@/lib/projects-api";
import type { ProjectRecord, ProjectReferenceAsset, ProjectResearch } from "@/lib/projects-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Globe, UploadCloud, Link as LinkIcon, FileImage, Bot, Search, FileText, Video, CheckCircle2, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

function AdvanceEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [assets, setAssets] = useState<ProjectReferenceAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [research, setResearch] = useState<ProjectResearch>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) {
      // No project yet → send the user through the project setup flow with
      // Advance Content pre-enabled. We must NOT auto-create a project here:
      // doing so spawned a blank project on every visit to this page.
      router.replace("/projects/new?fresh=1&advance=1");
      return;
    }

    const loadProject = async () => {
      try {
        const data = await fetchProject(projectId);
        setProject(data);
        setInstructions(data.goal || "");
        setLinks(data.advanceLinks || []);
        setAssets(data.advanceAssets || []);
        setResearch(data.research ?? null);
      } catch (err) {
        console.error("Failed to load project", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, router]);

  const handleAddLink = () => {
    if (!newLink.trim()) return;
    try {
      new URL(newLink); // Validate URL
      setLinks((prev) => [...prev, newLink.trim()]);
      setNewLink("");
    } catch {
      alert("Please enter a valid URL (e.g., https://youtube.com/...)");
    }
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectId) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map((file) =>
        uploadProjectReferenceAsset(file, { projectId, label: "style" })
      );
      const results = await Promise.all(uploadPromises);
      const uploadedAssets = results.map((r) => r.asset);
      setAssets((prev) => [...prev, ...uploadedAssets]);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload assets.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  // Step 1: persist sources + instructions, then run the research engine and
  // display the dossier. No project is created or script generated yet.
  const handleRunResearch = async () => {
    if (!projectId || !project || !instructions.trim()) return;
    setIsResearching(true);
    setResearchError(null);

    try {
      await updateProject(projectId, {
        goal: instructions,
        advanceLinks: links,
        advanceAssets: assets,
      });

      const result = await generateProjectResearch(projectId, { topic: instructions });
      setResearch(result);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "The research engine failed.");
    } finally {
      setIsResearching(false);
    }
  };

  // Step 2: once research is ready, head to the script studio. The saved brief
  // grounds script generation automatically.
  const handleGenerateScript = () => {
    if (!projectId) return;
    setIsSubmitting(true);
    router.push(`/editor-lab?tab=script&projectId=${projectId}&from=advance`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 mt-4 text-left pb-20 animate-in fade-in duration-700">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/projects" className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Factory
        </Link>
      </div>

      <div className="space-y-4 border-l-4 border-primary pl-4 mb-10">
        <h1 className="text-4xl font-display uppercase font-black tracking-tight flex items-center gap-3 m-0">
          Advanced Research Studio <Bot className="w-10 h-10 text-primary opacity-50" />
        </h1>
        <p className="text-sm font-mono text-muted-foreground max-w-2xl leading-relaxed">
          Provide your core instructions, web sources, and reference assets. 
          Our Research Agent will scrape, analyze, and synthesize this information 
          to generate a highly accurate and structured script.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
        
        {/* Left Column: Instructions and Links */}
        <div className="space-y-8">
          <Card className="rounded-none border-border bg-card/40 backdrop-blur-sm shadow-sm hover:border-primary/30 transition-colors duration-300">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-display uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" /> 1. Web & Video Sources
                  </Label>
                  <Badge variant="outline" className="rounded-none border-muted font-mono text-[10px] text-muted-foreground">Optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-2">
                  Add URLs to articles, blogs, or YouTube videos for the agent to scrape and summarize.
                </p>
                
                <div className="flex gap-2">
                  <Input
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                    placeholder="https://..."
                    className="rounded-none border-border bg-background/50 font-mono text-sm focus-visible:ring-primary/50"
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddLink}
                    className="rounded-none bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all px-6"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {links.length > 0 && (
                  <div className="mt-4 space-y-2 border border-border p-4 bg-background/30">
                    {links.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <LinkIcon className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="text-xs font-mono truncate text-foreground/80">{link}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveLink(idx)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-6 mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-display uppercase tracking-wider text-foreground">
                    2. Research Instructions
                  </Label>
                  <Badge variant="outline" className="rounded-none border-primary/20 bg-primary/10 text-primary font-mono text-[10px]">Required</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-2">
                  What should the script focus on? What is the core narrative or argument?
                </p>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="E.g., Analyze the latest trends in AI agents, comparing their architectures and predicting the next 5 years of development. Use the attached research papers for data points."
                  className="min-h-[200px] resize-y rounded-none border-border bg-background/50 font-mono text-sm leading-relaxed focus-visible:ring-primary/50 focus-visible:bg-background transition-all"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Assets and Submission */}
        <div className="space-y-8">
          <Card className="rounded-none border-border bg-card/40 backdrop-blur-sm shadow-sm hover:border-primary/30 transition-colors duration-300">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-display uppercase tracking-wider text-foreground flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-primary" /> 3. Reference Assets
                </Label>
                <Badge variant="outline" className="rounded-none border-muted font-mono text-[10px] text-muted-foreground">Optional</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Upload charts, screenshots, or documents for visual context or data extraction.
              </p>

              <div 
                className="border-2 border-dashed border-border p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*,video/*"
                />
                {isUploading ? (
                  <div className="h-6 w-6 rounded-none border-2 border-primary border-t-transparent animate-spin mb-3" />
                ) : (
                  <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                )}
                <span className="font-mono text-xs text-foreground uppercase tracking-wider">
                  {isUploading ? "Uploading..." : "Click to Upload Files"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground mt-2">
                  Supports Images & Videos
                </span>
              </div>

              {assets.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {assets.map((asset) => {
                    const previewUrl = getProjectReferencePreviewUrl(asset);
                    return (
                      <div key={asset.id} className="relative group border border-border bg-background aspect-video overflow-hidden">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewUrl} alt={asset.name} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-muted/30">
                            <FileImage className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveAsset(asset.id); }}
                            className="bg-destructive text-destructive-foreground p-2 hover:bg-destructive/80 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-1 px-2">
                           <p className="text-[9px] font-mono truncate text-muted-foreground">{asset.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="pt-6">
            <Button
              size="lg"
              onClick={handleRunResearch}
              disabled={isResearching || !instructions.trim()}
              className="w-full rounded-none h-16 text-sm font-display uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-primary-foreground border border-primary relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative flex items-center gap-3">
                {isResearching ? (
                  <>
                    <span className="h-4 w-4 rounded-none border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Researching sources…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    {research ? "Re-run Research" : "Launch Research"}
                  </>
                )}
              </span>
            </Button>
            <p className="text-center font-mono text-[10px] text-muted-foreground mt-4">
              {isResearching
                ? "Reading sources, searching the web and synthesising…"
                : "Reads your links, searches the web, and builds a sourced brief."}
            </p>
            {researchError ? (
              <p className="mt-3 text-center font-mono text-[11px] text-destructive">{researchError}</p>
            ) : null}
          </div>
        </div>

      </div>

      {/* Research dossier */}
      {research ? (
        <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between border-l-4 border-primary pl-4">
            <div>
              <h2 className="text-2xl font-display uppercase font-black tracking-tight m-0 flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" /> Research Dossier
              </h2>
              <p className="text-[11px] font-mono text-muted-foreground mt-1">
                {research.status === "completed" ? "Ready" : "Incomplete"} · {research.model} ·{" "}
                {research.sources.filter((s) => s.status === "read").length}/{research.sources.length} sources read
              </p>
            </div>
          </div>

          {/* Sources */}
          {research.sources.length > 0 ? (
            <Card className="rounded-none border-border bg-card/40">
              <CardContent className="p-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sources Analysed</p>
                {research.sources.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 border border-border bg-background/30 p-3">
                    {s.type === "youtube" ? (
                      <Video className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    ) : (
                      <Globe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-foreground/90 truncate">{s.title || s.url}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{s.url}</p>
                      {s.status === "failed" && s.error ? (
                        <p className="text-[10px] font-mono text-destructive mt-1">{s.error}</p>
                      ) : null}
                    </div>
                    {s.status === "read" ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {s.chars ? `${Math.round(s.chars / 1000)}k` : "read"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" /> failed
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Web findings + citations */}
          {research.webSearch?.ok && research.webSearch.summary ? (
            <Card className="rounded-none border-border bg-card/40">
              <CardContent className="p-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-primary" /> Live Web Research
                </p>
                <p className="text-[13px] font-sans leading-relaxed text-foreground/85 whitespace-pre-wrap">
                  {research.webSearch.summary}
                </p>
                {research.webSearch.citations.length > 0 ? (
                  <div className="pt-2 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Citations</p>
                    {research.webSearch.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        title={c.url}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-primary/80 hover:text-primary truncate"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" /> {c.title || c.url}
                      </a>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Synthesised brief */}
          {research.brief ? (
            <Card className="rounded-none border-primary/30 bg-card/40">
              <CardContent className="p-6 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Synthesised Brief
                </p>
                <div className="text-[13px] font-sans leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {research.brief}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Generate script CTA */}
          <Button
            size="lg"
            onClick={handleGenerateScript}
            disabled={isSubmitting || !research.brief}
            className="w-full rounded-none h-14 text-sm font-display uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-primary-foreground border border-primary"
          >
            <span className="flex items-center gap-3">
              {isSubmitting ? "Opening Script Studio…" : "Generate Script from Research"}
              {!isSubmitting && <ArrowLeft className="w-4 h-4 rotate-180" />}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdvanceEditorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <AdvanceEditorContent />
    </Suspense>
  );
}
