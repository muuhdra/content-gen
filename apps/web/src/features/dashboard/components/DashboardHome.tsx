"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, ArrowRight, FileVideo, Play, Plus, Video } from "lucide-react";
import Link from "next/link";
import { formatProjectTimestamp, type ProjectRecord } from "@/lib/projects-api";
import { loadRecentContentFeed, type RecentContentItem } from "@/lib/recent-content";

export function DashboardHome() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [recentContent, setRecentContent] = useState<RecentContentItem[]>([]);
  const [hasActiveRender, setHasActiveRender] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const snapshot = await loadRecentContentFeed();

        if (!isMounted) {
          return;
        }

        setProjects(snapshot.projects);
        setRecentContent(snapshot.recentContent);
        setHasActiveRender(snapshot.hasActiveRender);
      } catch (error) {
        console.error("Unable to load dashboard snapshot.", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProjectsCount = useMemo(
    () => projects.filter((project) => project.status === "Active" || project.status === "Rendering").length,
    [projects],
  );

  // Projects come back sorted by most-recently-updated, so the first one the
  // user can still work on is the natural "continue where you left off" target.
  const lastActiveProject = useMemo(
    () => projects.find((project) => project.status !== "Completed") ?? projects[0] ?? null,
    [projects],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 mt-2 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 px-2">
        <div>
          <h2 className="text-xl font-display font-black uppercase tracking-tight mb-1 text-foreground">Welcome back to the Factory.</h2>
          <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-widest">
            Your AI production system is ready for the next run.
          </p>
        </div>
        <Link href="/projects/new?fresh=1">
          <Button
            size="sm"
            className="h-8 px-4 gap-2 rounded-none bg-primary hover:bg-primary/80 text-primary-foreground text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
        <Card className="technical-card bg-card border-border hover:border-primary/50 transition-all rounded-none overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
              Total Videos <Video className="w-3 h-3 text-primary/60" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-mono text-foreground">{recentContent.length}</div>
            <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tight">Rendered outputs</p>
          </CardContent>
        </Card>

        {/* Continue: jump back into the most recent project still in progress. */}
        {lastActiveProject && !hasActiveRender ? (
          <Link
            href={`/projects/${lastActiveProject.id}`}
            className="group technical-card bg-card border-border hover:border-primary/50 transition-all rounded-none overflow-hidden block"
          >
            <div className="pb-1 pt-3 px-4">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                Continue <ArrowRight className="w-3 h-3 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <div className="px-4 pb-3">
              <div className="text-base font-black font-mono text-foreground truncate group-hover:text-primary transition-colors">
                {lastActiveProject.title}
              </div>
              <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tight">
                {lastActiveProject.status} · pick up where you left off
              </p>
            </div>
          </Link>
        ) : (
          <Card className="technical-card bg-card border-border hover:border-primary/50 transition-all rounded-none overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                {hasActiveRender ? "Render Queue" : "Get Started"} <Activity className="w-3 h-3 text-primary/60" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-black font-mono text-foreground">{hasActiveRender ? "RUNNING" : "READY"}</div>
              <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tight">
                {hasActiveRender ? "Render in progress" : "Create your first project"}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="technical-card bg-card border-border hover:border-primary/50 transition-all rounded-none overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
              Active Projects <FileVideo className="w-3 h-3 text-primary/60" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-mono text-foreground">{activeProjectsCount}</div>
            <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tight">{projects.length} total projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-foreground/40">Recent Clips</h3>
          <Link href="/clips">
            <Button
              variant="link"
              className="text-primary/60 hover:text-primary h-auto p-0 text-[10px] font-bold uppercase tracking-widest no-underline"
            >
              View all
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card className="technical-card bg-card border-border rounded-none">
            <CardContent className="py-10 text-center text-sm text-muted-foreground font-mono">Loading recent content...</CardContent>
          </Card>
        ) : recentContent.length > 0 ? (
          <ScrollArea className="max-h-[24rem]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
              {recentContent.slice(0, 3).map((clip) => (
                <Link
                  key={clip.id}
                  href={`/projects/${clip.projectId}`}
                  className="group technical-card bg-card border-border hover:border-primary/50 overflow-hidden relative rounded-none h-full flex flex-col transition-all"
                >
                  <div className="h-24 bg-secondary/20 relative flex items-center justify-center overflow-hidden technical-grid">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent z-10" />
                    <Play className="w-6 h-6 text-foreground/50 group-hover:text-primary transition-all group-hover:scale-110 z-20" />
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <h4 className="text-[11px] font-bold font-mono text-foreground/80 line-clamp-1">{clip.title}</h4>
                      <span className="text-[7px] uppercase tracking-widest font-black px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {clip.format}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between opacity-60 gap-3">
                      <p className="text-[9px] font-medium font-mono truncate text-foreground">{clip.projectTitle}</p>
                      <p className="text-[9px] font-medium font-mono text-foreground whitespace-nowrap">
                        {formatProjectTimestamp(clip.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Card className="technical-card bg-card border-border rounded-none">
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground/80 font-display">No rendered content yet.</p>
              <p className="text-[13px] text-muted-foreground font-sans">Queue your first render from a project to see completed outputs here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
