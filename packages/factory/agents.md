# Production Agents

This file is the single index of the production agents, their role, and the skill file each one must follow.

## Agent 1 — Script Director / Script Analyst

- Stage: `script`
- Role: analyze the script for cinematic production, identify dramatic structure, emotional progression, visual potential and continuity constraints before scene generation
- Skill file: [Script-director/skill.md](./Script-director/skill.md)
- Schema file: [schemas/01-script-analysis.schema.json](./schemas/01-script-analysis.schema.json)

## Agent 2 — Scene Generation Director

- Stage: `scenes`
- Role: transform the analyzed script into visually meaningful scene units with narration, visual intent, emotion, continuity and scene priority
- Skill file: [Scene-director/skill.md](./Scene-director/skill.md)
- Schema file: [schemas/02-scene-generation.schema.json](./schemas/02-scene-generation.schema.json)

## Agent 3 — Cinematic Image Prompt Architect

- Stage: `image-prompts`
- Role: convert each scene into strong and consistent image prompts while preserving visual continuity
- Skill file: [Image-prompt-director/skill.md](./Image-prompt-director/skill.md)
- Schema file: [schemas/03-image-prompt.schema.json](./schemas/03-image-prompt.schema.json)

## Agent 4 — AI Image Generation Director

- Stage: `image-generation`
- Role: optimize the creative image prompt for the target image model while preserving continuity, clarity and downstream animation potential
- Skill file: [Image-generation-director/skill.md](./Image-generation-director/skill.md)
- Schema file: [schemas/04-image-generation.schema.json](./schemas/04-image-generation.schema.json)

## Agent 5 — Image-to-Video Motion Director

- Stage: `motion-video`
- Role: turn an approved image into a cinematic video prompt by taking into account the source script, the source image prompt, the approved image, the scene intention and the emotional tone
- Skill file: [Image-to-video-motion-director/skill.md](./Image-to-video-motion-director/skill.md)
- Schema file: [schemas/05-motion-video.schema.json](./schemas/05-motion-video.schema.json)

## Agent 6 — Voice Director

- Stage: `narration`
- Role: align the selected voice, language and delivery style with the script and project tone
- Skill file: [voice-director/skill.md](./voice-director/skill.md)
- Schema file: [schemas/06-voice-direction.schema.json](./schemas/06-voice-direction.schema.json)

## Agent 7 — Music Director

- Stage: `soundtrack`
- Role: define music and SFX so they support the story, pacing and visual rhythm without overpowering narration
- Skill file: [Music-director/skill.md](./Music-director/skill.md)
- Schema file: [schemas/07-soundtrack-direction.schema.json](./schemas/07-soundtrack-direction.schema.json)

## Agent 8 — Assembly Director

- Stage: `assembly`
- Role: validate readiness, build the final timeline, preserve sync between all layers and prepare render/export
- Skill file: [Assembly-director/skill.md](./Assembly-director/skill.md)
- Schema file: [schemas/08-assembly.schema.json](./schemas/08-assembly.schema.json)

## Notes

- Agent numbering now follows the full visual production chain: analysis, scene design, image prompting, image execution, motion, audio, assembly.
- This index should be updated whenever a new production agent or skill is added.
