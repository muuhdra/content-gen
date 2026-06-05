Perfect — now we’re moving into **real builder mode**.

---

# 📄 1. CLEAN PRD (Product Requirements Document)

---

## 🧠 Product Name (internal)

**COSYL Video Engine** *(or whatever you want later)*

---

## 🎯 Objective

Build a **personal AI video factory** that transforms:

> idea / script → structured scenes → visuals → animated clips → final video

With:

* **human validation at key steps**
* **multi-agent orchestration**
* **repeatable template system**

---

## 👤 Target User

* You (primary)
* Future: creators building faceless content channels

---

## 📦 Supported Content Types (IMPORTANT from your doc)

* Short (TikTok / Reels / Shorts)
* Long Video (YouTube)
* Slideshow

---

## 🧩 Core Features

### 1. Project Creation

User can:

* Create project
* Select:

  * content type (short / long / slideshow)
  * template
* Upload 5–10 reference images (style consistency) 
* Define global style

---

### 2. Script Input System

Two modes:

#### Mode A — Idea → Script

* Input: topic
* Output: generated script (Claude/GPT/Gemini)

#### Mode B — Direct Script

* Input: full script
* Skip generation

---

### 3. Scene Generation

* Script → scenes (Agent 2)
* Each scene includes:

  * narration
  * visual intent
  * emotion
  * duration

---

### 4. Image Generation (Multi-variant)

* 3–6 images per scene
* User can:

  * approve 1
  * regenerate specific ones

---

### 5. Video Generation

* Each approved image → 2–3 video variants
* User selects best clip

---

### 6. Audio System (Audio Lab)

* Voice generation (ElevenLabs)
* Music selection/upload
* SFX (optional)

---

### 7. Captions & Styling

* Fonts
* Colors
* Highlight rules
* Auto-sync with narration

---

### 8. Final Assembly

* Combine:

  * clips
  * voice
  * captions
  * music
* Export final MP4

---

## 🤖 AI Agents

### Agent 1 — Script Agent

→ generates structured story

### Agent 2 — Scene Agent

→ splits into scenes

### Agent 3 — Image Prompt Agent

→ generates 3–6 prompts

### Agent 4 — Video Prompt Agent

→ defines motion

### Agent 5 — Assembly Agent

→ final timeline + render

---

## ⚙️ Functional Requirements

### MUST HAVE (V1)

* Project CRUD
* Script input
* Scene generation
* Image generation (multi)
* Approval system
* Video generation
* Voice generation
* Final export

---

### SHOULD HAVE (V2)

* Template saving
* Style presets
* Batch generation
* One-click full render

---

### NOT NEEDED (V1)

* billing system
* multi-user collaboration
* publishing to YouTube
* analytics

---

## 📊 Success Criteria

* Generate full video from script in < 10 minutes (async)
* User can control each scene
* Output quality consistent across projects

---

---

# 🏗️ 2. FULL SYSTEM ARCHITECTURE

---

## 🔥 GLOBAL ARCHITECTURE

```
[ FRONTEND (Next.js) ]
        ↓
[ API LAYER (Node.js) ]
        ↓
[ ORCHESTRATOR (BullMQ + Redis) ]
        ↓
[ AI AGENTS LAYER ]
        ↓
[ MEDIA GENERATION LAYER ]
        ↓
[ STORAGE (Supabase / S3) ]
        ↓
[ RENDER ENGINE (FFmpeg / Remotion) ]
```

---

## 🧠 PIPELINE FLOW

```
User Input
   ↓
Script Agent
   ↓
Scene Agent
   ↓
Image Prompt Agent
   ↓
Image Generation
   ↓
User Approval
   ↓
Video Prompt Agent
   ↓
Video Generation
   ↓
User Approval
   ↓
Voice Generation
   ↓
Assembly Agent
   ↓
Render Engine
   ↓
Final Video
```

---

## 🔁 JOB QUEUE SYSTEM (CRITICAL)

Each step = async job:

```
generate_script
split_scenes
generate_image_prompts
generate_images
generate_video_prompts
generate_videos
generate_voice
compose_video
export_video
```

---

---

# 📁 3. FOLDER STRUCTURE (PRODUCTION-READY)

---

## 🧱 MONOREPO STRUCTURE

```
/cosyl-video-engine
│
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # Backend API (Node)
│
├── packages/
│   ├── agents/             # AI agents and handoff contracts
│   ├── config/             # AI providers config and templates
│   ├── factory/            # Production schemas, examples and director skills
│   ├── media/              # image/video/audio generation
│   ├── orchestrator/       # BullMQ jobs
│   ├── renderer/           # export layer
│   └── shared/             # shared DB client, types and helpers
│
└── infra/
    └── supabase/
```

---

## 🤖 AGENTS FOLDER

```
/packages/agents/
│
├── scriptAgent.js
├── sceneAgent.js
├── imagePromptAgent.js
├── videoPromptAgent.js
├── assemblyAgent.js
```

---

## 🎨 MEDIA SERVICES

```
/packages/media/
│
├── image/
│   ├── generateImage.js
│   ├── providers/
│       ├── nanoBanana.js
│       ├── kling.js
│
├── video/
│   ├── generateVideo.js
│   ├── providers/
│       ├── kling.js
│       ├── seedance.js
│
├── audio/
│   ├── generateVoice.js
│   ├── providers/
│       ├── elevenlabs.js
```

---

## 🔁 ORCHESTRATOR (IMPORTANT)

```
/packages/orchestrator/
│
├── queue.js
├── workers/
│   ├── render.worker.js
```

---

---

# 🔌 4. API DESIGN

---

## 📌 PROJECT

```
POST   /projects
GET    /projects/:id
DELETE /projects/:id
```

---

## 📌 SCRIPT

```
POST /projects/:id/script/generate
POST /projects/:id/script/manual
```

---

## 📌 SCENES

```
POST /projects/:id/scenes/generate
GET  /projects/:id/scenes
```

---

## 📌 IMAGES

```
POST /scenes/:id/images/generate
POST /images/:id/approve
POST /images/:id/regenerate
```

---

## 📌 VIDEOS

```
POST /scenes/:id/videos/generate
POST /videos/:id/approve
```

---

## 📌 AUDIO

```
POST /projects/:id/audio/generate
```

---

## 📌 RENDER

```
POST /projects/:id/render
GET  /projects/:id/render/status
```

---

---

# 🧠 CRITICAL IMPLEMENTATION RULE (DON’T MISS THIS)

Every agent must output **structured JSON**:

```json
{
  "scene_id": 1,
  "narration": "The world is drowning in debt...",
  "visual_intent": "dark globe, financial collapse",
  "emotion": "dramatic",
  "duration": 4,
  "image_prompts": ["...", "..."]
}
```

👉 This is what makes your system stable.

---

# 🚀 FINAL BUILDER STRATEGY

We are NOT building:
❌ an AI tool
❌ a SaaS

We ARE building:

> ✅ a **content production pipeline**
