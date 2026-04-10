"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Plus, Video, Settings, Activity } from "lucide-react";
import Link from "next/link";
import { formatProjectTimestamp, type ProjectRecord } from "@/lib/projects-api";
import { loadRecentContentFeed, type RecentContentItem } from "@/lib/recent-content";

export default function DashboardPage() {
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
    [projects]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 mt-2 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 px-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1 text-foreground/90">Welcome back to the Factory.</h2>
          <p className="text-[11px] text-foreground/40 font-medium">Your AI production system is ready for the next run.</p>
        </div>
        <Link href="/projects/new?fresh=1">
          <Button size="sm" className="h-8 px-4 gap-2 shadow-[0_0_15px_-5px_rgba(200,50,250,0.4)] bg-primary/90 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]">
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
        <Card className="glass-card bg-card/20 border-border/20 hover:border-primary/20 transition-all rounded-xl overflow-hidden shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 flex items-center justify-between">
              Total Videos <Video className="w-3 h-3 text-primary/40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-mono text-foreground/80">{recentContent.length}</div>
            <p className="text-[9px] text-foreground/30 font-bold uppercase tracking-tight">Rendered outputs</p>
          </CardContent>
        </Card>

        <Card className="glass-card bg-card/20 border-border/20 hover:border-primary/20 transition-all rounded-xl overflow-hidden shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 flex items-center justify-between">
              Agent Status <Activity className="w-3 h-3 text-primary/40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-mono text-foreground/80">{hasActiveRender ? "BUSY" : "IDLE"}</div>
            <p className="text-[9px] text-foreground/20 font-bold uppercase tracking-tight">
              {hasActiveRender ? "Render queue active" : "System Ready"}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card bg-card/20 border-border/20 hover:border-primary/20 transition-all rounded-xl overflow-hidden shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 flex items-center justify-between">
              Active Projects <Settings className="w-3 h-3 text-orange-500/40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-mono text-foreground/80">{activeProjectsCount}</div>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-tight">{projects.length} total projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-foreground/40">Recent Clips</h3>
          <Link href="/clips">
            <Button variant="link" className="text-primary/60 hover:text-primary h-auto p-0 text-[10px] font-bold uppercase tracking-widest no-underline">
              View all
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card className="glass-card bg-card/30 border-border/30">
            <CardContent className="py-10 text-center text-sm text-foreground/70">Loading recent content...</CardContent>
          </Card>
        ) : recentContent.length > 0 ? (
          <ScrollArea className="max-h-[24rem]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
              {recentContent.slice(0, 3).map((clip) => (
                <Link
                  key={clip.id}
                  href={`/projects/${clip.projectId}`}
                  className="group glass-card bg-card/40 border-border/20 hover:border-primary/40 overflow-hidden relative rounded-xl h-full flex flex-col transition-all"
                >
                  <div className="h-24 bg-black/5 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent z-10" />
                    <Play className="w-6 h-6 text-foreground/10 group-hover:text-primary transition-all group-hover:scale-110 z-20" />
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <h4 className="text-[11px] font-bold text-foreground/60 line-clamp-1">{clip.title}</h4>
                      <span className="text-[7px] uppercase tracking-widest font-black px-1 py-0.5 rounded bg-black/5 text-foreground/20 border border-black/5 shrink-0">
                        {clip.format}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between opacity-60 gap-3">
                      <p className="text-[9px] font-medium truncate text-foreground">{clip.projectTitle}</p>
                      <p className="text-[9px] font-medium text-foreground whitespace-nowrap">{formatProjectTimestamp(clip.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Card className="glass-card bg-card/30 border-border/30">
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground/80">No rendered content yet.</p>
              <p className="text-xs text-muted-foreground">Queue your first render from a project to see completed outputs here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
