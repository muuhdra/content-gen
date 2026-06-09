"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Cpu, Film, Image as ImageIcon } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import { CardInfoHeader } from "@/features/editor-lab/components/CardInfoHeader";

// ── Model catalogues (mirrors packages/config/models.js) ──────────────────────

type ModelOption = {
  id: string;
  label: string;
  tag: string;
  price: string;
  description: string;
};

const scriptModels: ModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    tag: "Recommandé",
    price: "~$3 / MTok",
    description: "Meilleure qualité narrative, cohérence long-form, compréhension contextuelle profonde. Idéal pour les projets complexes ou les scripts longs.",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    tag: "Alternatif",
    price: "~$2.5 / MTok",
    description: "Solide pour les scripts courts et les formats directs. Légèrement moins cher. Bonne option pour les contenus factuels et les vidéos courtes.",
  },
];

const imageModels: ModelOption[] = [
  {
    id: "qwen-image-plus",
    label: "Qwen-image-plus (Alibaba)",
    tag: "Budget",
    price: "~$0.03 / image",
    description: "#1 AI Arena (évaluation humaine aveugle). Excellente qualité à moindre coût. Idéal pour les projets à grand volume d'images ou les budgets serrés.",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana (Gemini 2.5 Flash)",
    tag: "Budget · Défaut",
    price: "~$0.04 / image",
    description: "Meilleur rapport qualité/prix global. Cohérence visuelle excellente, suit bien les références de style. Recommandé pour la majorité des projets.",
  },
  {
    id: "seedream-4.5",
    label: "Seedream 4.5 (ByteDance)",
    tag: "Photo Premium",
    price: "~$0.04 / image",
    description: "Meilleur photoréalisme du catalogue. Peaux, lumières et textures exceptionnels. Consistance d'identité 9.6/10 — idéal pour les portraits et campagnes visuelles.",
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro (Gemini 3 Pro)",
    tag: "Premium Max",
    price: "~$0.12 / image",
    description: "Qualité maximale disponible. Idéal pour les projets premium exigeant le plus grand niveau de détail sur des scènes complexes.",
  },
];

const videoModels: ModelOption[] = [
  {
    id: "hailuo-2.3-fast",
    label: "Hailuo 2.3 Fast",
    tag: "Budget · Défaut",
    price: "$0.19 / 6s · 768p",
    description: "Meilleur rapport qualité/coût pour la génération vidéo. Natif 768p, mouvement fluide et naturel. Recommandé pour tous les projets hybrides ou full vidéo.",
  },
  {
    id: "wan-2.7",
    label: "Wan 2.7",
    tag: "Budget",
    price: "~$0.40 / 5s · 720p",
    description: "Alternative budget. Bon sur les plans simples. 720p. Moins performant que Hailuo sur les mouvements complexes.",
  },
  {
    id: "kling-2.5-turbo-pro",
    label: "Kling 2.5 Turbo Pro",
    tag: "Premium",
    price: "~$0.46 / 5s · 1080p",
    description: "Meilleure qualité de mouvement disponible. Idéal pour les plans clés, les hero shots et les scènes où la fluidité cinématographique est prioritaire.",
  },
  {
    id: "seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    tag: "Premium",
    price: "~$0.50+ / 5s",
    description: "Modèle premium alternatif. Bon pour certains styles de mouvement spécifiques. Plus cher — à réserver aux projets avec budget élevé.",
  },
  {
    id: "none",
    label: "Pas de motion (statique)",
    tag: "Statique",
    price: "$0 / scène",
    description: "Désactive la génération vidéo. Toutes les scènes resteront en images animées par Ken Burns. Coût vidéo nul — uniquement pour les projets statiques ou slideshows.",
  },
];

// ── Model Selector ─────────────────────────────────────────────────────────────

type ModelSelectorProps = {
  options: ModelOption[];
  selected: string;
  onSelect: (id: string) => void;
};

function ModelSelector({ options, selected, onSelect }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`w-full rounded-none border px-4 py-3.5 text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-[0.18em] font-mono ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[7px] uppercase tracking-[0.16em] rounded-none font-mono border ${
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {option.tag}
                  </Badge>
                </div>
                <p className={`text-[10px] leading-relaxed font-mono ${isSelected ? "text-primary/70" : "text-muted-foreground/60"}`}>
                  {option.description}
                </p>
              </div>
              <div className="flex-shrink-0 text-right space-y-1">
                <span className={`block text-[9px] font-black font-mono ${isSelected ? "text-primary" : "text-muted-foreground/50"}`}>
                  {option.price}
                </span>
                <span className={`block text-[8px] font-black uppercase tracking-[0.14em] font-mono ${isSelected ? "text-primary" : "text-muted-foreground/30"}`}>
                  {isSelected ? "✓ Actif" : "Sélectionner"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ModelsLab() {
  const { projectDraft, setProjectDraft } = useEditorLab();

  const scriptModel   = projectDraft?.scriptAgentModel   ?? "claude-sonnet-4-6";
  const imageModel    = projectDraft?.imageGenerationModel ?? "gemini-2.5-flash-image";
  const videoModel    = projectDraft?.motionEngine        ?? "hailuo-2.3-fast";

  const updateModel = (key: "scriptAgentModel" | "imageGenerationModel" | "motionEngine", value: string) => {
    setProjectDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const selectedScript = scriptModels.find((m) => m.id === scriptModel) ?? scriptModels[0];
  const selectedImage  = imageModels.find((m) => m.id === imageModel)   ?? imageModels[0];
  const selectedVideo  = videoModels.find((m) => m.id === videoModel)   ?? videoModels[0];

  return (
    <div className="mx-auto grid max-w-[94%] grid-cols-1 gap-6 xl:grid-cols-3 animate-in fade-in duration-700">

      {/* Script Model */}
      <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
        <CardInfoHeader
          title="Script Model"
          subtitle="LLM used to write, structure and analyse the script."
          aside={
            <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[7px] uppercase tracking-[0.16em] rounded-none font-mono">
              {selectedScript.tag}
            </Badge>
          }
          info={<>
            <p>Le <span className="text-foreground font-bold">Script Model</span> est le LLM utilisé pour générer le script, analyser les beats narratifs, extraire les scènes et construire le storyboard visuel.</p>
            <p><span className="text-foreground font-bold">Claude Sonnet 4.6</span> — Meilleure compréhension narrative, cohérence sur les scripts longs, gestion fine du ton et du contexte. Recommandé.</p>
            <p><span className="text-foreground font-bold">GPT-4o</span> — Bon pour les scripts courts et factuels. Légèrement moins cher. Alternative viable sur les projets simples.</p>
          </>}
        />
        <CardContent className="p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">
              Actif : {selectedScript.label}
            </span>
          </div>
          <ModelSelector
            options={scriptModels}
            selected={scriptModel}
            onSelect={(id) => updateModel("scriptAgentModel", id)}
          />
        </CardContent>
      </Card>

      {/* Image Model */}
      <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
        <CardInfoHeader
          title="Image Model"
          subtitle="AI engine used to generate all scene visuals."
          aside={
            <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[7px] uppercase tracking-[0.16em] rounded-none font-mono">
              {selectedImage.tag}
            </Badge>
          }
          info={<>
            <p>Le <span className="text-foreground font-bold">Image Model</span> est utilisé pour générer toutes les images de scènes du projet. Il reçoit les références visuelles, le style global et le prompt de chaque scène.</p>
            <p><span className="text-foreground font-bold">Qwen-image-plus</span> — $0.03/img. #1 AI Arena. Meilleur score benchmark pour le prix. Idéal pour les projets à grand volume.</p>
            <p><span className="text-foreground font-bold">Nano Banana (Gemini 2.5 Flash)</span> — $0.04/img. Meilleur rapport qualité/coût global. Suit très bien les références. Recommandé par défaut.</p>
            <p><span className="text-foreground font-bold">Seedream 4.5</span> — $0.04/img. Photoréalisme supérieur (peau, lumière, identité). Pour les portraits et campagnes visuelles exigeantes.</p>
            <p><span className="text-foreground font-bold">Nano Banana Pro</span> — $0.12/img. Qualité maximale pour les projets premium avec scènes très détaillées.</p>
          </>}
        />
        <CardContent className="p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">
              Actif : {selectedImage.label}
            </span>
          </div>
          <ModelSelector
            options={imageModels}
            selected={imageModel}
            onSelect={(id) => updateModel("imageGenerationModel", id)}
          />
        </CardContent>
      </Card>

      {/* Video Model */}
      <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
        <CardInfoHeader
          title="Video Engine"
          subtitle="Image-to-video model for animated scenes."
          aside={
            <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[7px] uppercase tracking-[0.16em] rounded-none font-mono">
              {selectedVideo.tag}
            </Badge>
          }
          info={<>
            <p>Le <span className="text-foreground font-bold">Video Engine</span> transforme les images générées en clips vidéo animés. Il n'est utilisé que sur les scènes dont le mode motion est "Animate" (hybride ou full vidéo).</p>
            <p><span className="text-foreground font-bold">Hailuo 2.3 Fast</span> — $0.19 / 6s à 768p. Le moins cher avec la meilleure qualité budget. Recommandé pour tous les projets.</p>
            <p><span className="text-foreground font-bold">Kling 2.5 Turbo Pro</span> — ~$0.46 / 5s à 1080p. Mouvement cinématographique premium. Pour les plans clés exigeants.</p>
            <p className="text-muted-foreground/50">En mode Budget Clips (Effects LAB), le coût est réduit de ~50% quel que soit le modèle choisi.</p>
          </>}
        />
        <CardContent className="p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Film className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">
              Actif : {selectedVideo.label}
            </span>
          </div>
          <ModelSelector
            options={videoModels}
            selected={videoModel}
            onSelect={(id) => updateModel("motionEngine", id)}
          />
        </CardContent>
      </Card>

    </div>
  );
}
