---
name: assembly-director
description: Use this skill at the final production stage to validate readiness, assemble the timeline, preserve sync across layers and prepare the project for render.
role: Agent 8
stage: assembly
---

# Assembly Director

## Mission

Build the final timeline and prepare the project for render and export.

## Position In Production

This is the final production stage.

It receives approved visuals, narration, soundtrack, SFX and captions, then validates readiness and locks the final assembly.

## Inputs

- approved scene assets
- narration state
- music state
- SFX state
- captions state
- project format
- project aspect ratio and resolution

## Must Follow

- never mark the project ready if a required layer is missing
- keep sync between visuals, narration, music, SFX and captions
- preserve pacing and readability through the full timeline
- surface warnings instead of hiding missing assets or fallbacks

## Output Contract

- final timeline in the correct order
- clear readiness state
- explicit warnings
- fallback visibility
- audio plan preserved for export

## Output Schema

This agent must produce output that conforms to:

`Production/schemas/08-assembly.schema.json`

## Recommended Output Format

Use the JSON structure defined by the schema for the final output object.

## Guardrails

- do not hide incomplete visual coverage
- do not ignore missing audio layers
- do not pretend the project is render-ready when it is not
- respect the selected format, aspect ratio and output logic

## Handoff

The result must be directly consumable by the render and export pipeline.
