"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Video, Search, Filter, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { fetchProjects, formatProjectTimestamp, deleteProject, type ProjectRecord } from "@/lib/projects-api"

// Status-coloured badge so the grid can be scanned at a glance.
const STATUS_BADGE_CLASS: Record<string, string> = {
  Active: "bg-primary/15 text-primary border-primary/40",
  Rendering: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  Completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  Draft: "bg-white/5 text-muted-foreground border-white/20",
};

function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? STATUS_BADGE_CLASS.Draft;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Draft" | "Completed">("All")

  useEffect(() => {
    void loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const nextProjects = await fetchProjects()
      setProjects(nextProjects)
      setProjectsError(null)
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Unable to load projects")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }

    try {
      await deleteProject(projectId)
      await loadProjects()
    } catch (error) {
      alert("Failed to delete project: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesStatus = statusFilter === "All" || project.status === statusFilter
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        query.length === 0 ||
        project.title.toLowerCase().includes(query) ||
        project.goal.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [projects, searchQuery, statusFilter])

  const cycleFilter = () => {
    setStatusFilter((current) => {
      if (current === "All") return "Active"
      if (current === "Active") return "Draft"
      if (current === "Draft") return "Completed"
      return "All"
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 mt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-primary pl-4">
        <div>
          <h2 className="text-3xl font-display font-black uppercase tracking-tight text-white m-0">Projects Factory</h2>
        </div>
        <Link href="/projects/new?fresh=1">
          <Button size="lg" className="gap-2 rounded-none bg-primary hover:bg-primary/80 font-black uppercase tracking-widest text-primary-foreground text-[11px]">
            <Plus className="w-5 h-5" />
            Create Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 pb-4">
        <Button variant="outline" className="gap-2 rounded-none bg-card border-border font-mono text-xs uppercase" onClick={cycleFilter}>
          <Filter className="w-4 h-4" /> {statusFilter}
        </Button>
        <div className="relative flex-1 max-w-md font-mono">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="w-full h-10 pl-10 pr-4 rounded-none border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      {projectsError ? (
        <Card className="technical-card rounded-none bg-card border-border">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80 font-mono">Projects could not be loaded.</p>
            <p className="text-xs text-muted-foreground font-mono">{projectsError}</p>
          </CardContent>
        </Card>
      ) : null}

      {isLoadingProjects ? (
        <Card className="technical-card rounded-none bg-card border-border">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-[11px] font-black tracking-widest text-primary uppercase font-mono">Loading projects...</p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {filteredProjects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="technical-card bg-card hover:border-primary/40 cursor-pointer h-full flex flex-col transition-colors group rounded-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id, project.title)}
                        className="p-1.5 text-muted-foreground/40 hover:text-red-400 transition-colors rounded-none opacity-0 group-hover:opacity-100"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Badge className={`rounded-none text-[10px] tracking-widest uppercase font-black border px-2 py-0.5 font-mono ${statusBadgeClass(project.status)}`}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-xl font-display uppercase tracking-tight text-foreground/90 group-hover:text-foreground">{project.title}</CardTitle>
                  <CardDescription className="text-[9px] font-mono tracking-widest uppercase text-muted-foreground">{project.type}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-[13px] font-sans text-muted-foreground leading-relaxed flex-1">{project.goal}</p>
                  <p className="text-[9px] font-mono tracking-widest text-muted-foreground/50 uppercase text-right mt-4">{formatProjectTimestamp(project.createdAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
      )}

      {!isLoadingProjects && !projectsError && filteredProjects.length === 0 && (
        <Card className="technical-card rounded-none bg-card border-border">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-[11px] font-black uppercase text-foreground/50 tracking-widest">No projects match this view.</p>
            <p className="text-[9px] uppercase font-mono text-muted-foreground">Try another filter or adjust your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
