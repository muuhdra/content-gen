"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CalendarDays, Play, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatProjectTimestamp } from "@/lib/projects-api";
import { loadRecentContentFeed, type RecentContentItem } from "@/lib/recent-content";

export default function ClipsPage() {
  const router = useRouter();
  const [recentContent, setRecentContent] = useState<RecentContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadClips = async () => {
      try {
        const snapshot = await loadRecentContentFeed();

        if (!isMounted) {
          return;
        }

        setRecentContent(snapshot.recentContent);
      } catch (error) {
        console.error("Unable to load recent content.", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadClips();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 mt-4 pb-10">
      <div className="space-y-4">
        <Link href="/" className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-black tracking-tight text-foreground uppercase">Recent Content</h2>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              Browse the clips and videos already rendered by the factory.
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-card text-muted-foreground uppercase tracking-widest text-[10px] font-mono rounded-none">
            {recentContent.length} items
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-none border border-border bg-card shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground font-mono">Loading rendered content...</CardContent>
        </Card>
      ) : recentContent.length > 0 ? (
      <ScrollArea className="max-h-160">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pr-4">
            {recentContent.map((clip) => (
              <Card key={clip.id} className="rounded-none border border-border bg-card hover:border-primary/50 transition-all overflow-hidden shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-none border border-border bg-background text-primary">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-display leading-tight">{clip.title}</CardTitle>
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono">{clip.projectTitle}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px] rounded-none border-border bg-background font-mono">
                      {clip.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="rounded-none border border-border bg-background p-5 flex items-center justify-center">
                    <Play className="w-8 h-8 text-primary" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span className="font-mono">{formatProjectTimestamp(clip.createdAt)}</span>
                    </div>
                    <span className="font-mono">{clip.duration}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest rounded-none border-border bg-card text-muted-foreground font-mono">
                        {clip.format}
                      </Badge>
                      {clip.renderMode ? (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest rounded-none border-border bg-card text-muted-foreground font-mono">
                          {clip.renderMode.replace(/-/g, " ")}
                        </Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] uppercase tracking-widest rounded-none border-border hover:bg-primary/10 hover:text-foreground font-mono"
                      onClick={() => router.push(`/projects/${clip.projectId}`)}
                    >
                      Open Project
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <Card className="rounded-none border border-border bg-card shadow-none">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80 font-display">No rendered content yet.</p>
            <p className="text-xs text-muted-foreground font-mono">Complete a project render to populate this library.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
