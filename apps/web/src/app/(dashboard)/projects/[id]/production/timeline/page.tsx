"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchProject,
  updateProject,
  type ProjectAssembly,
  type ProjectRecord,
} from "@/lib/projects-api";
import {
  AssemblyTimelineEditor,
  type TimelinePreviewSnapshot,
} from "@/features/projects/components/production/AssemblyTimelineEditor";
import { TimelineLivePreview } from "@/features/projects/components/production/TimelineLivePreview";

export default function ProductionTimelinePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<TimelinePreviewSnapshot | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const nextProject = await fetchProject(projectId);
      setProject(nextProject);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the timeline studio.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const scenePlanIsCurrent = Boolean(project?.sceneProduction);
  const scenePlanApproved = project?.review?.scenePlan?.status === "approved";
  const temporaryAccessUnlocked = searchParams.get("unlock") === "1";

  const handleCommitTimeline = async (nextAssembly: ProjectAssembly) => {
    if (!project) {
      return;
    }

    const previousProject = project;
    setProject({
      ...project,
      assembly: nextAssembly,
    });

    try {
      const updatedProject = await updateProject(projectId, {
        assembly: nextAssembly,
      });
      setProject(updatedProject);
      setError(null);
    } catch (err) {
      setProject(previousProject);
      setError(err instanceof Error ? err.message : "Failed to save the timeline.");
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/40 font-mono">
            Loading Timeline Studio
          </p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
        <Link href={`/projects/${projectId}/production`}>
          <Button variant="outline" className="rounded-none border-border bg-card text-foreground hover:bg-card/80">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Production
          </Button>
        </Link>
        <div className="rounded-none border border-destructive/20 bg-card p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-destructive font-display">Timeline unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground font-mono">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  if (!temporaryAccessUnlocked && (!project.scenes || project.scenes.length === 0)) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
        <Link href={`/projects/${projectId}/production`}>
          <Button variant="outline" className="rounded-none border-border bg-card text-foreground hover:bg-card/80">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Production
          </Button>
        </Link>
        <div className="rounded-none border border-destructive/20 bg-card p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-destructive font-display">Timeline studio locked</p>
          <p className="mt-2 text-sm text-muted-foreground font-mono">
            Generate scenes first before opening the dedicated timeline workspace.
          </p>
        </div>
      </div>
    );
  }

  if (!temporaryAccessUnlocked && (!scenePlanIsCurrent || !scenePlanApproved)) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
        <Link href={`/projects/${projectId}/production`}>
          <Button variant="outline" className="rounded-none border-border bg-card text-foreground hover:bg-card/80">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Production
          </Button>
        </Link>
        <div className="rounded-none border border-amber-500/20 bg-card p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300 font-display">Scene plan approval required</p>
          <p className="mt-2 text-sm text-muted-foreground font-mono">
            Validate the current scene plan before entering the dedicated timeline studio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020204] text-white">
      <div className="flex min-h-full flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/projects/${projectId}/production${temporaryAccessUnlocked ? "?unlock=1" : ""}`}>
            <Button variant="outline" className="h-8 rounded-none border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-white/75 hover:bg-white/10">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Production
            </Button>
          </Link>
        </div>
        <div className="min-h-[620px] overflow-hidden">
          <AssemblyTimelineEditor
            project={project}
            scenes={project.scenes}
            onCommit={handleCommitTimeline}
            onPreviewChange={setPreviewSnapshot}
            mode="studio"
          />
        </div>
        <div className="min-h-[320px] overflow-hidden">
          <TimelineLivePreview
            project={project}
            snapshot={previewSnapshot}
          />
        </div>
      </div>
      {error ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 rounded-none border border-destructive/25 bg-black/85 px-4 py-3 shadow-[0_20px_70px_-40px_rgba(220,38,38,0.95)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-destructive font-mono">Timeline save warning</p>
          <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-white/55 font-mono">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
