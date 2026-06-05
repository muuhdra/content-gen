# COSYL Video Engine — API Server

> The **generative backend & agentic orchestrator** of the COSYL Video Factory.

This is a high-performance Express microservice that acts as the coordinator for multi-agent workflows, media generation pipelines, and rendering job dispatches.

---

## 🎯 Responsibility & Scope

The API Server serves as the orchestrator of the production pipeline, executing the following core operations:
1. **Script Drafting** (via `@cosyl/agents/scriptAgent`)
2. **Scene Segmentation** (via `@cosyl/agents/sceneAgent`)
3. **Visual Frame Prompting** (via `@cosyl/agents/imagePromptAgent` and Kling/Midjourney generative adapters)
4. **Motion Vector & Clip Prompting** (via `@cosyl/agents/videoPromptAgent` and Seedance/Kling generative adapters)
5. **Timeline Assembly Compiler** (via `@cosyl/shared/utils/assemblyHelper`)
6. **Background Render Dispatch** (via BullMQ & Redis queues to `@cosyl/orchestrator` worker nodes)

---

## 📂 Directory Layout

```text
apps/api/
├── index.js                # Microservice entry point
├── package.json            # [NATIVE WORKSPACE] NPM metadata & scripts
├── data/                   # Git-ignored local storage for uploads & media assets
└── src/                    # API Source Code
    ├── media/              # Generative asset generation routes & assets.js adapters
    ├── projects/           # Core Project, Script, Scene, Captions controllers & routes
    ├── render-jobs/        # Queue monitor and render job state routes
    └── templates/          # Aspect ratio, theme, and styling presets
```

---

## 🚀 Running the Server

### Dev Mode
To run the server locally with hot-reloading:
```bash
npm run dev --workspace=@cosyl/api
```

### Production Build
To start the production process:
```bash
npm start --workspace=@cosyl/api
```
