"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bot, ExternalLink, Zap } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import { CardInfoHeader } from "@/features/editor-lab/components/CardInfoHeader";
import type { SfxDensity } from "./sounds-lab-preset";

const densityOptions: Array<{
  id: SfxDensity;
  label: string;
  hint: string;
}> = [
  { id: "none", label: "None", hint: "No SFX layer in the final mix." },
  { id: "light", label: "Light", hint: "Only a few accent cues across the edit." },
  { id: "medium", label: "Balanced", hint: "A natural amount of support around key moments." },
  { id: "dense", label: "Heavy", hint: "Frequent accents for a more designed edit." },
];

const cueFocusOptions = [
  { id: "impact", label: "Impact Hits", hint: "For reveals, strong beats and key emphasis." },
  { id: "transition", label: "Transitions", hint: "For scene changes, swipes and motion bridges." },
  { id: "notification", label: "Notifications", hint: "For UI beats, alerts and tech moments." },
  { id: "ambient", label: "Ambient Texture", hint: "For subtle movement underneath the edit." },
  { id: "whoosh", label: "Whooshes", hint: "For motion accents and faster camera energy." },
  { id: "ui", label: "UI Clicks", hint: "For interface demos and product interactions." },
] as const;

export function SoundsLab() {
  const { soundsPreset, setSoundsPreset, setActiveTab } = useEditorLab();
  const selectedDensity = densityOptions.find((option) => option.id === soundsPreset.density) ?? densityOptions[2];

  const toggleCueFocus = (cueId: string) => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: current.cueFocus.includes(cueId)
        ? current.cueFocus.filter((item) => item !== cueId)
        : [...current.cueFocus, cueId],
    }));
  };

  const selectRecommended = () => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: ["impact", "transition", "notification"],
    }));
  };

  const clearCueFocus = () => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: [],
    }));
  };

  return (
    <div className="mx-auto grid max-w-[92%] grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-700">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <CardInfoHeader
            title="SFX Setup"
            subtitle="Configure sound design density and cue focus for the final mix."
            info={<>
              <p>Le layer SFX ajoute des <span className="text-foreground font-bold">effets sonores ponctuels</span> sur les moments clés du montage (transitions, révélations, impacts, textures).</p>
              <p><span className="text-foreground font-bold">AI Sound Effects (activé par défaut)</span> — utilise <span className="text-foreground font-bold">ElevenLabs Sound Effects</span> pour générer un cue IA par scène, adapté au genre du projet : crime, documentaire, corporate, tech, horror, sport, historique…</p>
              <p>Quand l'IA est désactivée, un générateur procédural FFmpeg prend le relais (gratuit, disponible hors-ligne, qualité basique).</p>
              <p className="text-muted-foreground/50">Désactive le layer SFX entièrement si tu veux un montage épuré sans effets sonores.</p>
            </>}
          />
          <CardContent className="space-y-4 p-3.5">
            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                    Enable SFX
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                    Turn the sound design layer on or off for this project.
                  </p>
                </div>
                <Switch
                  checked={soundsPreset.enabled}
                  onCheckedChange={(checked) =>
                    setSoundsPreset((current) => ({
                      ...current,
                      enabled: checked,
                    }))
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className={`rounded-none border p-4 transition-opacity ${!soundsPreset.enabled ? "opacity-40 pointer-events-none" : ""} ${soundsPreset.aiSfx && soundsPreset.enabled ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3 text-primary flex-shrink-0" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                      AI Sound Effects
                    </h4>
                    {soundsPreset.aiSfx && soundsPreset.enabled && (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[7px] uppercase tracking-[0.14em] rounded-none font-mono">
                        Actif
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                    ElevenLabs Sound Effects — cues génératifs par scène, adaptés au genre du projet.
                  </p>
                  {soundsPreset.aiSfx && soundsPreset.enabled && (
                    <p className="text-[10px] text-primary/60 font-mono mt-1">
                      Crime · Documentaire · Corporate · Tech · Horror · Historique…
                    </p>
                  )}
                </div>
                <Switch
                  checked={soundsPreset.aiSfx}
                  onCheckedChange={(checked) =>
                    setSoundsPreset((current) => ({
                      ...current,
                      aiSfx: checked,
                    }))
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="rounded-none border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-none border border-border bg-background">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-foreground font-display">Effects Sync</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                      Reactive motion feels better when SFX and effects are aligned.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-foreground font-mono"
                  onClick={() => setActiveTab("effects")}
                >
                  Effects Lab
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="overflow-hidden rounded-none border border-border bg-black shadow-none">
          <CardInfoHeader
            title="Sound Density"
            subtitle="Frequency of sound design cues across the edit."
            aside={
              <Badge variant="outline" className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
                {selectedDensity.label}
              </Badge>
            }
            info={<>
              <p>Contrôle la <span className="text-foreground font-bold">fréquence globale</span> des effets sonores dans le montage final.</p>
              <p><span className="text-foreground font-bold">None</span> — aucun SFX. <span className="text-foreground font-bold">Light</span> — 2–3 accents sur les moments les plus forts. <span className="text-foreground font-bold">Balanced</span> — support naturel autour des transitions et révélations. <span className="text-foreground font-bold">Heavy</span> — présence forte et régulière pour un montage très designé.</p>
              <p className="text-muted-foreground/50">Combiné au "Cue Focus", le moteur SFX sait où et combien placer d'effets.</p>
            </>}
          />
          <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
            {densityOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!soundsPreset.enabled}
                onClick={() =>
                  setSoundsPreset((current) => ({
                    ...current,
                    density: option.id,
                  }))
                }
                className={`rounded-none border px-4 py-4 text-left transition-all ${
                  !soundsPreset.enabled
                    ? "cursor-not-allowed border-border bg-card opacity-45"
                    : soundsPreset.density === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${soundsPreset.density === option.id ? "text-primary" : "text-muted-foreground"}`}>
                  {option.label}
                </span>
                <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${soundsPreset.density === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                  {option.hint}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <CardInfoHeader
            title="Cue Focus"
            subtitle="Prioritized SFX categories for the generator."
            info={<>
              <p>Définit les <span className="text-foreground font-bold">catégories d'effets sonores</span> que le moteur SFX peut utiliser. Seules les catégories sélectionnées sont activées.</p>
              <p><span className="text-foreground font-bold">Impact Hits</span> — coups et accents forts sur les révélations. <span className="text-foreground font-bold">Transitions</span> — sons de passage entre les plans. <span className="text-foreground font-bold">Notifications</span> — bips et sons UI tech. <span className="text-foreground font-bold">Ambient Texture</span> — nappe sonore douce en arrière-plan. <span className="text-foreground font-bold">Whooshes</span> — accents de vitesse et de mouvement. <span className="text-foreground font-bold">UI Clicks</span> — interactions d'interface pour les projets produit.</p>
              <p className="text-muted-foreground/50">Clic sur "Recommended" pour activer la sélection optimale pour la majorité des contenus.</p>
            </>}
          />
          <div className="px-5 pb-3 flex flex-wrap gap-2 -mt-1">
            <Button
              type="button"
              variant="outline"
              disabled={!soundsPreset.enabled}
              onClick={selectRecommended}
              className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40 font-mono"
            >
              Recommended
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!soundsPreset.enabled}
              onClick={clearCueFocus}
              className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40 font-mono"
            >
              Clear
            </Button>
          </div>
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {cueFocusOptions.map((option) => {
              const isActive = soundsPreset.cueFocus.includes(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!soundsPreset.enabled}
                  onClick={() => toggleCueFocus(option.id)}
                  className={`rounded-none border px-4 py-4 text-left transition-all ${
                    !soundsPreset.enabled
                      ? "cursor-not-allowed border-border bg-card opacity-45"
                      : isActive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {option.label}
                  </span>
                  <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${isActive ? "text-primary/70" : "text-muted-foreground/50"}`}>
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Current Plan
            </h3>
          </div>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {soundsPreset.enabled ? "SFX Enabled" : "SFX Disabled"}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {selectedDensity.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {soundsPreset.cueFocus.length} focus tags
              </Badge>
              <Badge
                variant="outline"
                className={`text-[8px] uppercase tracking-[0.18em] rounded-none font-mono ${soundsPreset.enabled && soundsPreset.aiSfx ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
              >
                {soundsPreset.enabled && soundsPreset.aiSfx ? "AI SFX · ElevenLabs" : "SFX Procédural"}
              </Badge>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                {soundsPreset.enabled
                  ? `SFX generation configured at ${selectedDensity.label.toLowerCase()} density.`
                  : "SFX layer disabled for this project."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
