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
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Recent Content</h2>
            <p className="text-muted-foreground">
              Browse the clips and videos already rendered by the factory.
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary uppercase tracking-widest text-[10px]">
            {recentContent.length} items
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <Card className="glass-card bg-card/30 border-border/30">
          <CardContent className="py-10 text-center text-sm text-foreground/70">Loading rendered content...</CardContent>
        </Card>
      ) : recentContent.length > 0 ? (
      <ScrollArea className="max-h-160">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pr-4">
            {recentContent.map((clip) => (
              <Card key={clip.id} className="glass-card bg-card/40 border-border/30 hover:border-primary/40 transition-all overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight">{clip.title}</CardTitle>
                        <p className="text-[11px] text-muted-foreground mt-1">{clip.projectTitle}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {clip.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/30 bg-background/40 p-5 flex items-center justify-center">
                    <Play className="w-8 h-8 text-primary/60" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{formatProjectTimestamp(clip.createdAt)}</span>
                    </div>
                    <span className="font-mono">{clip.duration}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                        {clip.format}
                      </Badge>
                      {clip.renderMode ? (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                          {clip.renderMode.replace(/-/g, " ")}
                        </Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] uppercase tracking-widest"
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
        <Card className="glass-card bg-card/30 border-border/30">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80">No rendered content yet.</p>
            <p className="text-xs text-muted-foreground">Complete a project render to populate this library.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
