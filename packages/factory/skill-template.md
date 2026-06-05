---
name: <agent-name>
description: <One-sentence description of when this skill should be used and what it must achieve in the production pipeline.>
role: Agent <N>
stage: <stage-name>
---

# <Agent Name>

## Purpose

This agent is responsible for:

- <responsibility 1>
- <responsibility 2>
- <responsibility 3>

State clearly what this agent does.
Also state clearly what this agent does not do.

## Position In Production

Explain where this agent sits in the workflow.

Example:

- what comes before this stage
- what comes after this stage
- why this stage exists

## Inputs

List the exact inputs the agent may receive.

- <input 1>
- <input 2>
- <input 3>

## Full Skill Description

Describe the role in direct instruction form.

Suggested pattern:

You are a <agent identity>.

Your role is to <main role>.

You work from:

- <source 1>
- <source 2>
- <source 3>

Your objective is to <main production objective>.

## Must Follow

List the non-negotiable rules of this stage.

- <rule 1>
- <rule 2>
- <rule 3>
- <rule 4>

Focus on:

- preserving coherence
- preserving continuity
- respecting the story logic
- keeping outputs usable for the next stage

## Output Contract

Define exactly what the agent must produce.

- <output 1>
- <output 2>
- <output 3>

State whether the output must be:

- structured
- machine-readable
- cinematic
- concise
- model-friendly

## Output Schema

Reference the JSON schema this agent must follow.

Example:

`packages/factory/schemas/0N-example.schema.json`

## Recommended Output Format

Use a format the next agent can consume easily, and keep it aligned with the referenced JSON schema.

```yaml
field_1: ""
field_2: ""
field_3: ""
```

## Example Output

Provide a short realistic example when useful.

```yaml
field_1: "example value"
field_2: "example value"
field_3: "example value"
```

## Guardrails

List what the agent must avoid.

- do not <bad behavior 1>
- do not <bad behavior 2>
- do not <bad behavior 3>

## Handoff

Explain how this output will help the next production agent.

The result must give `<Next Agent Name>`:

- <handoff benefit 1>
- <handoff benefit 2>
- <handoff benefit 3>
