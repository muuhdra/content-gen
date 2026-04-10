"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Video, Search, Filter, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { fetchProjects, formatProjectTimestamp, deleteProject, type ProjectRecord } from "@/lib/projects-api"

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Projects Factory</h2>
          <p className="text-muted-foreground">Manage your unique video engines and their specific goals.</p>
        </div>
        <Link href="/projects/new?fresh=1">
          <Button size="lg" className="gap-2 shadow-[0_0_15px_-3px_rgba(200,50,250,0.5)]">
            <Plus className="w-5 h-5" />
            Create Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 border-b border-border/40 pb-4">
        <Button variant="outline" className="gap-2 bg-card/50 backdrop-blur-sm border-border/50" onClick={cycleFilter}>
          <Filter className="w-4 h-4" /> {statusFilter}
        </Button>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search projects by name or goal..." 
            className="w-full h-10 pl-10 pr-4 rounded-md border border-border/50 bg-card/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      {projectsError ? (
        <Card className="glass-card bg-card/30 border-border/30">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80">Projects could not be loaded.</p>
            <p className="text-xs text-muted-foreground">{projectsError}</p>
          </CardContent>
        </Card>
      ) : null}

      {isLoadingProjects ? (
        <Card className="glass-card bg-card/30 border-border/30">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80">Loading projects...</p>
          </CardContent>
        </Card>
      ) : (
      <ScrollArea className="max-h-[36rem]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-4">
          {filteredProjects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="glass-card bg-card/40 border-border/40 hover:border-primary/50 cursor-pointer h-full flex flex-col transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id, project.title)}
                        className="p-2 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Badge variant={project.status === "Active" ? "default" : "secondary"} className="bg-primary/20 text-primary hover:bg-primary/30 text-[10px] tracking-wide uppercase font-bold border-none">
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-xl">{project.title}</CardTitle>
                  <CardDescription className="text-xs">{project.type}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="p-3 rounded-lg bg-background/50 border border-border/30 mb-4 flex-1">
                    <p className="text-[10px] font-bold text-primary/80 mb-1 uppercase tracking-wider">Project Objective</p>
                    <p className="text-sm text-foreground/90">{project.goal}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right mt-auto">Created {formatProjectTimestamp(project.createdAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </ScrollArea>
      )}

      {!isLoadingProjects && !projectsError && filteredProjects.length === 0 && (
        <Card className="glass-card bg-card/30 border-border/30">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground/80">No projects match this view.</p>
            <p className="text-xs text-muted-foreground">Try another filter or adjust your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
