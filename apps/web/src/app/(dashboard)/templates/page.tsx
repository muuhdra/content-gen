"use client";

import { useEffect, useState, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, Trash2, ExternalLink, ChevronRight } from "lucide-react"
import { fetchTemplates, deleteTemplate, type TemplatePreset } from "@/lib/projects-api"
import { applyTemplateToProjectDraft, createProjectDraft, writeProjectDraft } from "../projects/project-draft"

// ── TemplatePreview (mini-render CSS fidèle) ───────────────────────────────

function TemplatePreview({ preview }: { preview: TemplatePreset["preview"] }) {
  if (preview === "noir") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#171d2f_0%,#0b0c12_62%,#07070a_100%)]">
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
        <div className="absolute left-[34%] top-[43%] h-[16%] w-[10%] rotate-[18deg] rounded-full bg-[linear-gradient(180deg,#242a38,#11131b)]" />
        <div className="absolute right-[34%] top-[43%] h-[16%] w-[10%] -rotate-[22deg] rounded-full bg-[linear-gradient(180deg,#242a38,#11131b)]" />
        <div className="absolute inset-x-[10%] bottom-[24%] h-[2px] bg-[linear-gradient(90deg,transparent,rgba(250,204,21,0.8),transparent)]" />
      </div>
    )
  }

  if (preview === "cartoon") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#2a2232_0%,#15131b_100%)]">
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
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#a8ddff_0%,#79c8ff_52%,#4caaf2_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_28%),linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.08)_100%)]" />
        <div className="absolute left-[8%] right-[8%] top-[10%] flex items-center justify-between">
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/70">Short Form</span>
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/55">Hook Intro</span>
        </div>
        <div className="absolute left-1/2 top-[12%] h-[24%] w-[22%] -translate-x-1/2 rounded-full border border-white/45 bg-[radial-gradient(circle_at_35%_35%,#fff,rgba(231,236,241,0.95)_55%,rgba(177,188,198,0.95)_100%)]" />
        <div className="absolute left-[44%] top-[20%] h-[3.4%] w-[4%] rounded-full bg-[#1f2937]" />
        <div className="absolute right-[44%] top-[20%] h-[3.4%] w-[4%] rounded-full bg-[#1f2937]" />
        <div className="absolute left-1/2 top-[38%] h-[38%] w-[40%] -translate-x-1/2 rounded-t-[999px] border border-white/30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),rgba(216,225,235,0.8)_45%,rgba(182,195,205,0.9)_100%)]" />
        <div className="absolute left-[34%] top-[48%] h-[24%] w-[2px] rotate-[28deg] bg-white/60" />
        <div className="absolute right-[34%] top-[48%] h-[24%] w-[2px] -rotate-[28deg] bg-white/60" />
        <div className="absolute left-1/2 top-[60%] h-[18%] w-[2px] -translate-x-1/2 bg-white/55" />
        <div className="absolute inset-x-[8%] bottom-[8%] rounded-[18px] border border-white/15 bg-black/15 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Gel Anatomy Breakdown</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/45">Clean subject • vivid blue look</p>
        </div>
      </div>
    )
  }

  if (preview === "deck") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#141824_0%,#0b0d14_100%)]">
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

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#111118_0%,#09090d_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute left-[8%] top-[10%] rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
        Project Template
      </div>
      <div className="absolute inset-x-[8%] bottom-[8%] rounded-[18px] border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Custom Project DNA</p>
        <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/18">Assets, prompts and reusable settings</p>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-[28px] border border-white/7 bg-[#08080c] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full border border-white/10 bg-black/40 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Preview agrandi */}
        <div className="h-[300px] p-4 pb-0">
          <div className="h-full rounded-[18px] overflow-hidden border border-white/4">
            <TemplatePreview preview={template.preview} />
          </div>
        </div>

        {/* Infos */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9b6dff]">
                {typeLabel[template.type] ?? template.type}
              </p>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                {template.title}
              </h3>
              <p className="text-[11px] text-white/40 mt-1 leading-relaxed max-w-lg">
                {template.description}
              </p>
            </div>
            {template.isCustom && (
              <span className="shrink-0 rounded-full border border-[#9b6dff]/30 bg-[#9b6dff]/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#9b6dff]">
                Créé
              </span>
            )}
          </div>

          {/* Params */}
          {template.params && template.params.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {template.params.map((p) => (
                <span key={p} className="rounded-full border border-white/6 bg-white/2 px-3 py-1 text-[9px] font-mono text-white/30">
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onUse}
              className="flex-1 h-10 rounded-xl bg-[#5c2d91] hover:bg-[#7140b4] text-white text-[10px] font-black uppercase tracking-[0.15em]
                shadow-[0_0_15px_-5px_rgba(92,45,145,0.5)] hover:shadow-[0_0_25px_0_rgba(155,109,255,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              Utiliser ce Modèle <ChevronRight className="h-4 w-4" />
            </button>

            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onDelete}
                    className="h-10 px-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-wider hover:bg-red-500/30 transition-all"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-10 px-3 rounded-xl border border-white/10 text-white/40 text-[9px] font-black uppercase tracking-wider hover:border-white/20 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="h-10 w-10 rounded-xl border border-white/6 bg-white/2 flex items-center justify-center text-white/20 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
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

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchTemplates()
      setTemplates(data)
    } catch (error) {
      console.error("Unable to load template catalog.", error)
    }
  }, [])


  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

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

    router.push(`/editor-lab?tab=audio&template=${template.id}`)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId)
      setPreviewTemplate(null)
      void loadTemplates()
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
    <div className="mx-auto mt-4 max-w-[1600px] space-y-10 pb-10 px-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b6dff]">Template Library</p>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Production Templates</h2>
            <p className="text-xs leading-relaxed text-white/40 max-w-lg">
              Pick a template, preview its style, then launch it directly into the production workflow.
            </p>
          </div>
          {templates.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">{templates.length} templates</span>
          )}
        </div>
      </div>

      {/* Mes Modèles */}
      {customTemplates.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/4" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Mes Modèles</span>
            <div className="h-px flex-1 bg-white/4" />
          </div>

          <div className="grid grid-cols-1 items-start justify-items-center gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {customTemplates.map((template) => {
              const isHighlighted = createdTemplateId === template.id
              return (
                <div
                  key={template.id}
                  className={`group w-full max-w-[360px] rounded-3xl border overflow-hidden transition-all duration-500
                    ${isHighlighted
                      ? 'border-[#9b6dff]/40 bg-[#9b6dff]/5 shadow-[0_0_40px_-10px_rgba(155,109,255,0.3)]'
                      : 'border-white/4 bg-[#08080c] hover:border-[#9b6dff]/25 hover:shadow-[0_0_30px_-10px_rgba(155,109,255,0.2)]'
                    }`}
                >
                  {/* Thumbnail cliquable */}
                  <button
                    onClick={() => openPreview(template)}
                    className="block w-full p-3 text-left"
                  >
                    <div className="h-[200px] overflow-hidden rounded-2xl border border-white/4 relative group/thumb">
                      <TemplatePreview preview={template.preview} />
                      {/* Overlay hover preview */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
                        <div className="flex items-center gap-2 bg-black/60 border border-white/20 rounded-full px-4 py-2">
                          <ExternalLink className="h-3 w-3 text-white" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-white">Aperçu</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-white/90 leading-tight">{template.title}</h3>
                        <p className="mt-1 text-[10px] leading-relaxed text-white/30 line-clamp-2">{template.description}</p>
                      </div>
                      <span className="shrink-0 mt-0.5 rounded-full border border-[#9b6dff]/30 bg-[#9b6dff]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#9b6dff]">
                        Créé
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* CTA principal */}
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="flex-1 h-9 rounded-xl bg-[#5c2d91] hover:bg-[#7140b4] text-white text-[9px] font-black uppercase tracking-[0.15em]
                          shadow-[0_0_15px_-5px_rgba(92,45,145,0.5)] hover:shadow-[0_0_25px_0_rgba(155,109,255,0.5)] transition-all duration-500"
                      >
                        Utiliser
                      </button>

                      {/* Bouton Supprimer */}
                      <button
                        onClick={() => openPreview(template)}
                        className="h-9 w-9 rounded-xl border border-white/6 flex items-center justify-center text-white/20
                          hover:border-white/10 hover:text-white/40 transition-all"
                        title="Aperçu"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          handleDeleteTemplate(template.id)
                        }}
                        className="h-9 w-9 rounded-xl border border-white/6 flex items-center justify-center text-white/20
                          hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Supprimer ce modèle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : createdViewActive ? (
        <div className="rounded-[20px] border border-white/4 bg-[#08080c] p-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Aucun modèle créé</p>
          <p className="mt-2 text-[10px] text-white/20">
            Sauvegardez un projet comme modèle depuis &quot;Nouveau Projet&quot;, il apparaîtra ici.
          </p>
        </div>
      ) : null}

      {/* Templates standard */}
      <div className="grid grid-cols-1 items-start justify-items-center gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {standardTemplates.map((template) => (
          <div
            key={template.id}
            className="group w-full max-w-[360px] rounded-3xl border border-white/4 bg-[#08080c] overflow-hidden
              transition-all duration-500 hover:border-[#9b6dff]/25 hover:shadow-[0_0_35px_-10px_rgba(155,109,255,0.2)]"
          >
            {/* Thumbnail cliquable → ouvre la preview modale */}
            <button
              onClick={() => openPreview(template)}
              className="block w-full p-3 text-left"
            >
              <div className="h-[200px] overflow-hidden rounded-2xl border border-white/4 relative group/thumb">
                <TemplatePreview preview={template.preview} />
                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
                  <div className="flex items-center gap-2 bg-black/60 border border-white/20 rounded-full px-4 py-2">
                    <ExternalLink className="h-3 w-3 text-white" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-white">Aperçu</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Info */}
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-white/90 leading-tight">{template.title}</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/30 line-clamp-2">{template.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* CTA principal */}
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 h-9 rounded-xl bg-[#5c2d91] hover:bg-[#7140b4] text-white text-[9px] font-black uppercase tracking-[0.15em]
                    shadow-[0_0_15px_-5px_rgba(92,45,145,0.5)] hover:shadow-[0_0_25px_0_rgba(155,109,255,0.5)] transition-all duration-500"
                >
                  Utiliser
                </button>

                {/* Bouton Aperçu */}
                <button
                  onClick={() => openPreview(template)}
                  className="h-9 w-9 rounded-xl border border-white/6 flex items-center justify-center text-white/20
                    hover:border-white/10 hover:text-white/40 transition-all"
                  title="Aperçu"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>

                {/* Bouton Supprimer */}
                <button
                  onClick={() => {
                    handleDeleteTemplate(template.id)
                  }}
                  className="h-9 w-9 rounded-xl border border-white/6 flex items-center justify-center text-white/20
                    hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Supprimer ce modèle"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050507]"><div className="h-8 w-8 rounded-full border-2 border-[#9b6dff] border-t-transparent animate-spin" /></div>}>
      <TemplatesContent />
    </Suspense>
  );
}
