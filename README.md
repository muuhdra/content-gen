# COSYL Video Engine

> Your **Personal AI Video Factory**

COSYL Video Engine is an advanced orchestrator designed to transform ideas and scripts into fully produced, structured videos. Acting as a complete content production pipeline — not just a SaaS or general tool — it leverages a multi-agent architecture and mandatory human-in-the-loop validation steps.

---

## 🎯 Objective
Transform **Idea / Script → Structured Scenes → Visuals → Animated Clips → Final Video** with:
- **Human validation at key stages** to assure quality.
- **Multi-agent orchestration** handling storytelling, prompting, motion extraction, and assembly.
- **Repeatable template system** to maintain stylistic continuity across projects.

## 📦 Supported Formats
Supports multiple video dimensions and styles:
- **Short-form Vertical** (TikTok / Reels / Shorts)
- **Long-form Horizontal** (YouTube)
- **Slideshow Presentations** (Dynamic Slide Sequences)

---

## 🧩 Pipeline Workflow / Core Features

The engine guides your project through a structured, 8-step pipeline:

1. **Project Configuration** — Define content type, aspect ratio, visual templates, and initial styling.
2. **Script Generation (Agent 1/Manual)** — Draft ideas into a full script or upload your own.
3. **Scene Generation (Agent 2)** — Automatically divide the script into visual intervals, mapping narrations to precise visual intents and durations.
4. **Image Engineering (Agent 3 + Media Generation)** — Create several visual variants (3–6) per scene. The user selects/approves the best fit.
5. **Video Engineering (Agent 4 + Media Generation)** — Animate the approved images into multiple video clips predicting camera motion.
6. **Voice Synthesis (Agent 6)** — Generate high-quality narrations matching the scene durations using custom or internal voices.
7. **Soundtrack & SFX (Agent 7)** — Auto-generate or inject corresponding background music and spatial sound effects.
8. **Final Assembly (Agent 5 + Render)** — Combine all approved assets (video, voice, captions, SFX) into a timeline and dispatch to the final rendering engine.

> **💡 Rule of Thumb:** Changes made upstream (e.g., rewriting the script) automatically invalidate downstream steps (e.g., scene segmentation, voiceovers, final assembly) to ensure global synchronization.

---

## 🏗️ Architecture Stack

This is a production-ready monorepo holding the entire AI-driven suite:
- **Frontend:** Next.js (React 19, Tailwind CSS v4, Base UID, TypeScript)
- **Backend API:** Node.js (Express, custom Agent implementations)
- **Worker/Orchestration:** BullMQ & Redis queues handling massive media generation tasks asynchronously.
- **Storage/DB:** Supabase (Remote DB/Storage) with seamless Local Storage/File fallback mode.
- **AI/LLM layer:** Direct LLM integrations with specialized prompt engineering logic (`Structured JSON` required for standard data normalization across the stack).

### Structure Overview
```text
/
├── apps/
│   ├── web/                # Next.js Application (Dashboard & Editor Lab)
│   └── api/                # Express API Backend
├── packages/
│   ├── agents/             # Agent contracts and orchestration helpers
│   ├── config/             # Models and template configuration
│   ├── factory/            # Production schemas, examples and director skills
│   ├── media/              # Image / video / audio generation adapters
│   ├── orchestrator/       # BullMQ queue and workers
│   ├── renderer/           # Final rendering layer
│   └── shared/             # Shared DB clients, types and utilities
├── infra/
│   └── supabase/           # Database schema and storage setup
└── docs/                   # Project and QA documentation
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v20+)
- Redis Server (Required for the BullMQ Orchestrator)
- Provide all necessary `.env` variables located at project roots (API keys for providers).

### Installation
Run the root package installer to grab all workspaces:
```bash
npm install
```

### Running the Environment
You can launch applications individually through the workspace:

#### 1. Start the API & Orchestrator
```bash
npm run dev --workspace=@cosyl/api
```

#### 2. Start the Frontend Application
```bash
npm run dev --workspace=@cosyl/web
```

Open `http://localhost:3000` to access the Control Dashboard and Studio.

---

## 🛠 Active Builder Note
COSYL Video Engine is designed for intensive content generation cycles.
All agents communicate via strictly typed and parsed `JSON`. Modifying existing agents requires high compliance with the contracts described under `packages/agents/contracts.js` to avoid pipeline breakage.

Happy generating!
