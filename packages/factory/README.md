# Production Skills

This folder contains the source-of-truth skills for the production pipeline.

Production flow:

1. `Script-director` — Script Director / Script Analyst
2. `Scene-director` — Scene Generation Director
3. `Image-prompt-director` — Cinematic Image Prompt Architect
4. `Image-generation-director` — AI Image Generation Director
5. `Image-to-video-motion-director` — Image-to-Video Motion Director
6. `voice-director` — Voice Director
7. `Music-director` — Music Director
8. `Assembly-director` — Assembly Director

Each skill should follow the same logic:

- understand its exact stage in the pipeline
- only do its own job
- preserve project coherence
- prepare a clean handoff for the next stage

Shared machine-readable contracts:

- Shared defs: [schemas/shared.schema.json](./schemas/shared.schema.json)
- Pipeline manifest: [schemas/pipeline.manifest.json](./schemas/pipeline.manifest.json)

Each production agent can now produce output against a dedicated JSON schema so the pipeline is easier to validate and automate.

Example payloads:

- [examples/01-script-analysis.example.json](./examples/01-script-analysis.example.json)
- [examples/02-scene-generation.example.json](./examples/02-scene-generation.example.json)
- [examples/03-image-prompt.example.json](./examples/03-image-prompt.example.json)
- [examples/04-image-generation.example.json](./examples/04-image-generation.example.json)
- [examples/05-motion-video.example.json](./examples/05-motion-video.example.json)
- [examples/06-voice-direction.example.json](./examples/06-voice-direction.example.json)
- [examples/07-soundtrack-direction.example.json](./examples/07-soundtrack-direction.example.json)
- [examples/08-assembly.example.json](./examples/08-assembly.example.json)

Local validator:

- Script: [scripts/validate-schemas.js](./scripts/validate-schemas.js)
- Command: `npm run validate:production-schemas`

This validator checks that the example payloads still conform to the shared production schemas.
