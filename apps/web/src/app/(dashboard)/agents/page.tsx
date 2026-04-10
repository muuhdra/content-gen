"use client";

import { Brain, Layers, Camera, ImageIcon, Film, Mic, Music, Cpu } from "lucide-react"

const agents = [
  {
    id: 1,
    name: "Script Director / Script Analyst",
    role: "Analyse Narrative",
    model: "Claude / GPT / Gemini",
    icon: Brain,
    color: "#9b6dff",
    description: "Analyse le script comme un directeur: fonction dramatique, progression émotionnelle, potentiel visuel et contraintes de continuité avant toute génération.",
    status: "active",
  },
  {
    id: 2,
    name: "Scene Generation Director",
    role: "Découpage Visuel",
    model: "Logique Interne",
    icon: Layers,
    color: "#9b6dff",
    description: "Transforme le script en scènes ou slides prêtes pour la production, avec narration, intention visuelle, émotion, continuité et durée estimée.",
    status: "active",
  },
  {
    id: 3,
    name: "Cinematic Image Prompt Architect",
    role: "Prompting Visuel",
    model: "Claude / GPT",
    icon: ImageIcon,
    color: "#c084fc",
    description: "Convertit chaque scène en prompt image cinématique clair, cohérent et exploitable, tout en préservant le ton, la composition et la continuité.",
    status: "active",
  },
  {
    id: 4,
    name: "AI Image Generation Director",
    role: "Exécution Image",
    model: "Nano Banana / Flux / Kling",
    icon: Camera,
    color: "#c084fc",
    description: "Optimise le prompt créatif pour le moteur d'image cible, protège la lisibilité et la continuité, puis prépare une génération robuste pour chaque scène.",
    status: "idle",
  },
  {
    id: 5,
    name: "Image-to-Video Motion Director",
    role: "Direction Mouvement",
    model: "Kling 3.0 / Seedance 2.0",
    icon: Film,
    color: "#f97316",
    description: "Anime l'image approuvée comme un vrai cinema director en prenant en compte le script, le prompt source, l'image finale et l'intention émotionnelle de la scène.",
    status: "idle",
  },
  {
    id: 6,
    name: "Voice Director",
    role: "Narration & Delivery",
    model: "ElevenLabs",
    icon: Mic,
    color: "#9b6dff",
    description: "Aligne la voix, la langue et la direction de delivery avec le script final pour produire une narration cohérente avec le ton du projet.",
    status: "active",
  },
  {
    id: 7,
    name: "Music Director",
    role: "Soundtrack & SFX",
    model: "Audio Stack / Internal Logic",
    icon: Music,
    color: "#22c55e",
    description: "Définit la musique et les effets sonores pour soutenir le rythme, l'émotion et la progression visuelle sans écraser la narration.",
    status: "active",
  },
  {
    id: 8,
    name: "Assembly Director",
    role: "Timeline & Render Handoff",
    model: "Orchestrateur Interne",
    icon: Cpu,
    color: "#9b6dff",
    description: "Valide la readiness du projet, assemble la timeline finale, préserve la synchro entre toutes les couches et prépare le handoff de rendu.",
    status: "idle",
  },
]

const statusConfig = {
  active: { label: "Actif", color: "#22c55e", pulse: true },
  idle: { label: "En attente", color: "#9b6dff", pulse: false },
  maintenance: { label: "Maintenance", color: "#f59e0b", pulse: false },
}

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-8 mt-4 px-4 pb-10">
      {/* Header */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b6dff]">Pipeline IA</p>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">AI Agent Fleet</h2>
        <p className="text-xs leading-relaxed text-white/40 max-w-lg">
          8 agents spécialisés orchestrés en pipeline pour transformer un script en scènes, visuels, audio et rendu final cohérents.
        </p>
      </div>

      {/* Pipeline visuelle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {agents.map((agent, index) => {
          const status = statusConfig[agent.status as keyof typeof statusConfig];
          return (
            <div
              key={agent.id}
              className="group relative rounded-[20px] border border-white/4 bg-[#08080c] p-5 transition-all duration-500
                hover:border-white/10 hover:shadow-[0_0_30px_-10px_rgba(155,109,255,0.15)] overflow-hidden"
            >
              {/* Numéro Agent */}
              <div className="absolute top-4 right-4 text-[10px] font-black text-white/10 font-mono">
                #{String(agent.id).padStart(2, '0')}
              </div>

              {/* Icône */}
              <div
                className="h-10 w-10 rounded-[14px] flex items-center justify-center mb-4 transition-all duration-500 group-hover:scale-110"
                style={{
                  backgroundColor: `${agent.color}15`,
                  border: `1px solid ${agent.color}30`,
                  color: agent.color,
                  boxShadow: `0 0 20px -5px ${agent.color}40`,
                }}
              >
                <agent.icon className="w-5 h-5" />
              </div>

              {/* Contenu */}
              <div className="space-y-1 mb-3">
                <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-white/90 leading-tight">
                  {agent.name}
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: agent.color }}>
                  {agent.role}
                </p>
              </div>

              <p className="text-[9px] text-white/30 leading-relaxed mb-4">
                {agent.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/4">
                <div>
                  <p className="text-[8px] text-white/20 uppercase font-bold tracking-wider">Modèle</p>
                  <p className="text-[9px] font-mono text-white/50">{agent.model}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${status.pulse ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: status.color }}>
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Indicateur de séquence entre agents */}
              {index < agents.length - 1 && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 hidden xl:flex items-center justify-center">
                  <div className="w-4 h-4 rotate-45 border-r border-t border-white/6 bg-[#08080c]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Légende statuts */}
      <div className="flex items-center gap-6 pt-4 border-t border-white/4">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Légende</p>
        <div className="flex items-center gap-4">
          {Object.entries(statusConfig).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: val.color }} />
              <span className="text-[9px] uppercase font-black tracking-wider" style={{ color: val.color }}>{val.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
