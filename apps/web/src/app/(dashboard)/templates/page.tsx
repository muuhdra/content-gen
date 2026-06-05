"use client";

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, Trash2, ExternalLink, ChevronRight } from "lucide-react"
import { fetchTemplates, deleteTemplate, type TemplatePreset } from "@/lib/projects-api"
import { applyTemplateToProjectDraft, createProjectDraft, writeProjectDraft } from "@/features/projects/utils/project-draft"

// ── TemplatePreview (mini-render CSS fidèle) ───────────────────────────────

function TemplatePreview({ template }: { template: TemplatePreset }) {
  const preview = template.preview;
  if (preview === "noir") {
    return (
      <div className="relative h-full w-full overflow-hidden border border-border bg-[linear-gradient(180deg,#171d2f_0%,#0b0c12_62%,#07070a_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.18),transparent_18%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_18%)]" />
        <div className="absolute left-[8%] right-[8%] top-[10%] flex items-center justify-between">
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/60">Crime Story</span>
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/40">9:16</span>
        </div>
        <div className="absolute inset-x-[6%] bottom-[8%] rounded-[18px] border border-white/10 bg-black/28 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Night Investigation</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/40">Bold captions • fast reveal</p>
        </div>
        <div className="absolute inset-x-[18%] bottom-0 h-[52%] rounded-t-[999px] bg-[linear-gradient(180deg,rgba(31,38,50,0.9),rgba(11,13,20,0.98))]" />
        <div className="absolute left-1/2 top-[27%] h-[16%] w-[12%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_45%_30%,#f8fafc,#b8c2d6_52%,#5b6472_100%)]" />
        <div className="absolute left-[34%] top-[43%] h-[16%] w-[10%] rotate-18 rounded-full bg-[linear-gradient(180deg,#242a38,#11131b)]" />
        <div className="absolute right-[34%] top-[43%] h-[16%] w-[10%] -rotate-22 rounded-full bg-[linear-gradient(180deg,#242a38,#11131b)]" />
        <div className="absolute inset-x-[10%] bottom-[24%] h-0.5 bg-[linear-gradient(90deg,transparent,rgba(250,204,21,0.8),transparent)]" />
      </div>
    )
  }

  if (preview === "cartoon") {
    return (
      <div className="relative h-full w-full overflow-hidden border border-border bg-[linear-gradient(180deg,#2a2232_0%,#15131b_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_25%)]" />
        <div className="absolute left-[7%] right-[7%] top-[10%] flex items-center justify-between">
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/60">Animated</span>
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/40">Long Form</span>
        </div>
        <div className="absolute left-[7%] top-0 h-full w-[18%] bg-[linear-gradient(180deg,#5a221f,#2c1412)]" />
        <div className="absolute right-[7%] top-0 h-full w-[18%] bg-[linear-gradient(180deg,#4a2a22,#211312)]" />
        <div className="absolute inset-x-[22%] bottom-0 h-[68%] rounded-t-[22px] border border-black/35 bg-[linear-gradient(180deg,#4e3324_0%,#241813_100%)]" />
        <div className="absolute left-1/2 top-[16%] h-[18%] w-[18%] -translate-x-1/2 rounded-[18px] border border-black/35 bg-[#d8c7a6]" />
        <div className="absolute left-1/2 top-[36%] h-[26%] w-[28%] -translate-x-1/2 rounded-[22px] border border-black/35 bg-[#74533c]" />
        <div className="absolute left-[39%] top-[28%] h-[3%] w-[3.5%] rounded-full bg-black" />
        <div className="absolute right-[39%] top-[28%] h-[3%] w-[3.5%] rounded-full bg-black" />
        <div className="absolute inset-x-[8%] bottom-[8%] rounded-[18px] border border-white/10 bg-black/28 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Cartoon Horror Facts</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/40">Stylized frames • narration heavy</p>
        </div>
      </div>
    )
  }

  if (preview === "skeleton") {
    return (
      <div className="relative h-full w-full overflow-hidden border border-border bg-[linear-gradient(180deg,#a8ddff_0%,#79c8ff_52%,#4caaf2_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_28%),linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.08)_100%)]" />
        <div className="absolute left-[8%] right-[8%] top-[10%] flex items-center justify-between">
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/70">Short Form</span>
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/55">Hook Intro</span>
        </div>
        <div className="absolute left-1/2 top-[12%] h-[24%] w-[22%] -translate-x-1/2 rounded-full border border-white/45 bg-[radial-gradient(circle_at_35%_35%,#fff,rgba(231,236,241,0.95)_55%,rgba(177,188,198,0.95)_100%)]" />
        <div className="absolute left-[44%] top-[20%] h-[3.4%] w-[4%] rounded-full bg-[#1f2937]" />
        <div className="absolute right-[44%] top-[20%] h-[3.4%] w-[4%] rounded-full bg-[#1f2937]" />
        <div className="absolute left-1/2 top-[38%] h-[38%] w-[40%] -translate-x-1/2 rounded-t-[999px] border border-white/30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),rgba(216,225,235,0.8)_45%,rgba(182,195,205,0.9)_100%)]" />
        <div className="absolute left-[34%] top-[48%] h-[24%] w-0.5 rotate-28 bg-white/60" />
        <div className="absolute right-[34%] top-[48%] h-[24%] w-0.5 -rotate-28 bg-white/60" />
        <div className="absolute left-1/2 top-[60%] h-[18%] w-0.5 -translate-x-1/2 bg-white/55" />
        <div className="absolute inset-x-[8%] bottom-[8%] rounded-[18px] border border-white/15 bg-black/15 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Gel Anatomy Breakdown</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/45">Clean subject • vivid blue look</p>
        </div>
      </div>
    )
  }

  if (preview === "deck") {
    return (
      <div className="relative h-full w-full overflow-hidden border border-border bg-[linear-gradient(180deg,#141824_0%,#0b0d14_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_22%)]" />
        <div className="absolute left-[8%] right-[8%] top-[10%] flex items-center justify-between">
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/60">VSL Deck</span>
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/40">16:9</span>
        </div>
        <div className="absolute left-[10%] top-[24%] right-[10%] rounded-[22px] border border-white/10 bg-black/20 p-4">
          <p className="text-[8px] uppercase tracking-[0.16em] text-white/40">Module 1</p>
          <p className="mt-2 text-[16px] font-black uppercase tracking-[0.12em] text-white">Build a Repeatable Content System</p>
          <div className="mt-4 space-y-2">
            {["Clear promise", "Text-first pacing", "Slide-led narration"].map((line) => (
              <div key={line} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                <span className="text-[9px] uppercase tracking-[0.12em] text-white/55">{line}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-[10%] left-[10%] right-[10%] flex items-center justify-between rounded-[18px] border border-white/10 bg-black/25 px-3 py-2">
          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">Ken Burns motion</span>
          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/55">Text-first</span>
        </div>
      </div>
    )
  }

  // Default / custom (preview === "empty"): show an INFORMATIVE branded card
  // built from the template's own type + visual style, instead of empty dots.
  const styleLine = (template.style || "Custom production DNA").trim();
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden border border-border bg-[linear-gradient(140deg,#16121d_0%,#0c0a11_60%,#08070b_100%)] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,77,0,0.10),transparent_40%),radial-gradient(#ffffff08_1px,transparent_1px)] bg-size-[100%_100%,16px_16px]" />
      <div className="relative flex items-center justify-between">
        <span className="rounded-none border border-primary/30 bg-primary/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-primary font-mono">
          {typeLabel[template.type] || "Template"}
        </span>
        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25 font-mono">DNA</span>
      </div>
      <div className="relative">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/70 font-display leading-tight line-clamp-2">
          {template.title}
        </p>
        <p className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-white/35 font-mono line-clamp-3 leading-relaxed">
          {styleLine}
        </p>
      </div>
    </div>
  )
}

// ── Type Map ───────────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = {
  short: "Short Form",
  video: "YouTube Video",
  slideshow: "Slideshow / VSL",
}

// ── TemplateCard (shared, fixed height, 16:9 preview) ────────────────────────

function TemplateCard({
  template,
  isHighlighted = false,
  onUse,
  onPreview,
  onDelete,
}: {
  template: TemplatePreset
  isHighlighted?: boolean
  onUse: () => void
  onPreview: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`group flex flex-col overflow-hidden border transition-colors duration-300 rounded-none shadow-none
        ${isHighlighted ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
    >
      {/* 16:9 preview — click to open the full preview */}
      <button onClick={onPreview} className="relative block w-full" title="Aperçu">
        <div className="relative aspect-video w-full overflow-hidden border-b border-border">
          <TemplatePreview template={template} />
          {/* type chip */}
          <span className="absolute left-2 top-2 z-10 rounded-none border border-white/15 bg-black/55 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white/80 font-mono backdrop-blur-sm">
            {typeLabel[template.type] || "Template"}
          </span>
          {/* hover overlay */}
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex items-center gap-2 border border-border bg-background px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-foreground font-mono">
              <ExternalLink className="h-3 w-3" /> Aperçu
            </span>
          </div>
        </div>
      </button>

      {/* Body — flex-1 so the action row aligns across all cards */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-foreground leading-tight font-display">
              {template.title}
            </h3>
            {template.isCustom && (
              <span className="shrink-0 mt-0.5 border border-primary/30 bg-primary/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-primary rounded-none font-mono">
                Créé
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2 font-sans">
            {template.description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            onClick={onUse}
            className="flex-1 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-[9px] font-black uppercase tracking-[0.15em] transition-colors duration-300 rounded-none font-mono"
          >
            Utiliser
          </button>
          <button
            onClick={onPreview}
            title="Aperçu"
            className="h-9 w-9 rounded-none border border-border flex items-center justify-center text-muted-foreground bg-background hover:bg-primary/10 hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Supprimer ce modèle"
            className="h-9 w-9 rounded-none border border-border flex items-center justify-center text-muted-foreground bg-background hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modale Preview ─────────────────────────────────────────────────────────

function PreviewModal({
  template,
  onClose,
  onUse,
  onDelete,
}: {
  template: TemplatePreset;
  onClose: () => void;
  onUse: () => void;
  onDelete?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl border border-border bg-card overflow-hidden shadow-none rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-none border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all font-mono"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Preview agrandi */}
        <div className="h-75 p-4 pb-0">
          <div className="h-full rounded-none overflow-hidden border border-border">
            <TemplatePreview template={template} />
          </div>
        </div>

        {/* Infos */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary font-mono">
                {typeLabel[template.type] ?? template.type}
              </p>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground mt-0.5 font-display">
                {template.title}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-lg font-mono">
                {template.description}
              </p>
            </div>
            {template.isCustom && (
              <span className="shrink-0 bg-primary/10 border border-primary/30 text-primary px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] rounded-none font-mono">
                Créé
              </span>
            )}
          </div>

          {/* Params */}
          {template.params && template.params.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {template.params.map((p) => (
                <span key={p} className="rounded-none border border-border bg-background px-3 py-1 text-[9px] font-mono text-muted-foreground">
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onUse}
              className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-[0.15em] rounded-none font-mono transition-all duration-300 flex items-center justify-center gap-2"
            >
              Utiliser ce Modèle <ChevronRight className="h-4 w-4" />
            </button>

            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onDelete}
                    className="h-10 px-4 rounded-none bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-wider hover:bg-red-500/30 transition-all font-mono"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-10 px-3 rounded-none border border-border text-muted-foreground bg-background text-[9px] font-black uppercase tracking-wider hover:border-primary/50 transition-all font-mono"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="h-10 w-10 rounded-none border border-border bg-background flex items-center justify-center text-muted-foreground hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Supprimer ce modèle"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────────────

function TemplatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [templates, setTemplates] = useState<TemplatePreset[]>([])
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePreset | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await fetchTemplates()

        if (!cancelled) {
          setTemplates(data)
        }
      } catch (error) {
        console.error("Unable to load template catalog.", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const createdTemplateId = searchParams.get("template")
  const createdViewActive = searchParams.get("view") === "created"

  const handleUseTemplate = (template: TemplatePreset) => {
    writeProjectDraft(applyTemplateToProjectDraft(template, createProjectDraft({
      source: "templates-library",
    })))

    if (template.type === "slideshow") {
      router.push(`/projects/new?template=${template.id}`)
      return
    }

    router.push(`/editor-lab?tab=audio&template=${template.id}&from=templates`)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId)
      setPreviewTemplate(null)
      const data = await fetchTemplates()
      setTemplates(data)
    } catch (error) {
      console.error("Failed to delete template.", error)
    }
  }

  const openPreview = (template: TemplatePreset) => {
    setPreviewTemplate(template)
  }

  const customTemplates = templates.filter(t => t.isCustom);
  const standardTemplates = templates.filter(t => !t.isCustom);


  return (
    <div className="mx-auto mt-4 max-w-7xl space-y-10 pb-10 px-4">
      {/* Header */}
      <div className="space-y-2 border-l-4 border-primary pl-4">
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-mono">Template Library</p>
            <h2 className="text-3xl font-display uppercase tracking-tight text-foreground m-0">Production Templates</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground max-w-lg mt-2 font-sans">
              Pick a template, preview its style, then launch it directly into the production workflow.
            </p>
          </div>
          {templates.length > 0 && (
            <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground">{templates.length} templates</span>
          )}
        </div>
      </div>

      {/* Mes Modèles */}
      {customTemplates.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">Mes Modèles</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isHighlighted={createdTemplateId === template.id}
                onUse={() => handleUseTemplate(template)}
                onPreview={() => openPreview(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
              />
            ))}
          </div>
        </div>
      ) : createdViewActive ? (
        <div className="border border-border bg-card p-8 text-center rounded-none shadow-none">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">Aucun modèle créé</p>
          <p className="mt-2 text-[10px] text-muted-foreground/60 font-mono">
            Sauvegardez un projet comme modèle depuis &quot;Nouveau Projet&quot;, il apparaîtra ici.
          </p>
        </div>
      ) : null}

      {/* Templates standard */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {standardTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={() => handleUseTemplate(template)}
            onPreview={() => openPreview(template)}
            onDelete={() => handleDeleteTemplate(template.id)}
          />
        ))}
      </div>

      {/* Modale de Preview */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => handleUseTemplate(previewTemplate)}
          onDelete={() => handleDeleteTemplate(previewTemplate.id)}
        />
      )}
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <TemplatesContent />
    </Suspense>
  );
}
