const fs = require("node:fs");
const path = require("node:path");

const { MODEL_CONFIG } = require("../../config/models");
const { selectSceneReferenceAnchors } = require("./referenceAnchors");

const SCHEMAS_ROOT = path.resolve(__dirname, "../../Production/schemas");
const DEFAULT_SCHEMA_VERSION = "1.0.0";

const PRODUCTION_SCHEMAS = {
  script: "01-script-analysis.schema.json",
  scenes: "02-scene-generation.schema.json",
  imagePrompt: "03-image-prompt.schema.json",
  imageGeneration: "04-image-generation.schema.json",
  motionVideo: "05-motion-video.schema.json",
  narration: "06-voice-direction.schema.json",
  soundtrack: "07-soundtrack-direction.schema.json",
  assembly: "08-assembly.schema.json",
};

const PRODUCTION_AGENT_NAMES = {
  script: "Script Director / Script Analyst",
  scenes: "Scene Generation Director",
  imagePrompt: "Cinematic Image Prompt Architect",
  imageGeneration: "AI Image Generation Director",
  motionVideo: "Image-to-Video Motion Director",
  narration: "Voice Director",
  soundtrack: "Music Director",
  assembly: "Assembly Director",
};

let cachedAjv = null;

function resolveAjv2020() {
  const candidates = [
    "ajv/dist/2020",
    path.resolve(process.cwd(), "node_modules/ajv-formats/node_modules/ajv/dist/2020"),
    path.resolve(process.cwd(), "node_modules/@modelcontextprotocol/sdk/node_modules/ajv/dist/2020"),
  ];

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const resolved = require(candidate);
      return resolved.default || resolved;
    } catch {
      // Try the next runtime.
    }
  }

  throw new Error("Ajv 2020 validator not found for Production schema validation.");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAjv() {
  if (cachedAjv) {
    return cachedAjv;
  }

  const Ajv2020 = resolveAjv2020();
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  const sharedSchemaPath = path.join(SCHEMAS_ROOT, "shared.schema.json");
  const sharedSchema = readJson(sharedSchemaPath);
  ajv.addSchema(sharedSchema, sharedSchema.$id);
  ajv.addSchema(sharedSchema, "shared.schema.json");

  Object.values(PRODUCTION_SCHEMAS).forEach((schemaFile) => {
    const schemaPath = path.join(SCHEMAS_ROOT, schemaFile);
    const schema = readJson(schemaPath);
    ajv.addSchema(schema, schema.$id || schemaFile);
    ajv.addSchema(schema, schemaFile);
  });

  cachedAjv = ajv;
  return ajv;
}

function validateProductionOutput(schemaFile, output) {
  const validate = getAjv().getSchema(schemaFile);

  if (!validate) {
    throw new Error(`Production schema is not registered: ${schemaFile}`);
  }

  const valid = validate(output);

  if (valid) {
    return;
  }

  const details = (validate.errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");

  throw new Error(`Production handoff validation failed for ${schemaFile}: ${details || "Unknown validation error."}`);
}

function createValidatedProductionPayload({ schemaFile, output }) {
  validateProductionOutput(schemaFile, output);

  return {
    schema: schemaFile,
    output,
  };
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function splitScriptIntoBeats(scriptContent = "") {
  return scriptContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^generated with\s+/i.test(line))
    .map((line) => line.replace(/^part\s+\d+:\s*/i, "").trim())
    .filter(Boolean);
}

function sanitizeSummaryText(value = "", fallback = "No summary available.") {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function inferNarrativeFunction(block = "", index = 0, total = 1) {
  const normalized = block.toLowerCase();

  if (index === 0) {
    return "setup";
  }

  if (index === total - 1) {
    return "resolution";
  }

  if (/\b(reveal|suddenly|discovers?|notices?)\b/.test(normalized)) {
    return "reveal";
  }

  if (/\b(but|however|instead|turning point|decides?)\b/.test(normalized)) {
    return "turning-point";
  }

  if (/\b(then|next|after|transition)\b/.test(normalized)) {
    return "transition";
  }

  if (/\b(calm|reflect|pause|silence|still)\b/.test(normalized)) {
    return "emotional-pause";
  }

  return "escalation";
}

function inferEmotionalTone(project = {}, text = "") {
  const combined = `${project.settings?.tone || ""} ${text}`.toLowerCase();

  if (/\b(melancholic|grief|sad|loss)\b/.test(combined)) {
    return "melancholic";
  }

  if (/\b(calm|gentle|quiet|steady|reflective)\b/.test(combined)) {
    return "calm";
  }

  if (/\b(tense|threat|disturbing|suspense|fear)\b/.test(combined)) {
    return "tense";
  }

  if (/\b(epic|grand|heroic|awe)\b/.test(combined)) {
    return "awe-filled";
  }

  if (/\b(dream|dreamlike|surreal)\b/.test(combined)) {
    return "dreamlike";
  }

  if (/\b(intimate|personal|close)\b/.test(combined)) {
    return "intimate";
  }

  if (/\b(chaotic|burst|fast|urgent)\b/.test(combined)) {
    return "chaotic";
  }

  return sanitizeSummaryText(project.settings?.tone || "cinematic and clear", "cinematic and clear");
}

function inferVisualImportance(index = 0, total = 1, block = "") {
  const normalized = block.toLowerCase();

  if (index === 0 || index === total - 1) {
    return "essential-visual-scene";
  }

  if (/\b(reveal|suddenly|discovers?|turning point|climax)\b/.test(normalized)) {
    return "essential-visual-scene";
  }

  if (/\b(context|because|explain|background)\b/.test(normalized)) {
    return "context-only";
  }

  return "supporting-visual-scene";
}

function inferCinematicPotential(text = "") {
  const normalized = text.toLowerCase();

  if (/\b(reveal|cliff|sunset|city|battle|storm|close-up|hero|throne)\b/.test(normalized)) {
    return "very-high";
  }

  if (/\b(looks?|walks?|stands?|notices?|turns?)\b/.test(normalized)) {
    return "high";
  }

  if (normalized.length > 80) {
    return "medium";
  }

  return "low";
}

function inferSceneRecommendation(visualImportance = "supporting-visual-scene") {
  if (visualImportance === "essential-visual-scene") {
    return "generate-primary-scene";
  }

  if (visualImportance === "supporting-visual-scene") {
    return "generate-supporting-scene";
  }

  if (visualImportance === "context-only") {
    return "context-only";
  }

  return "skip-direct-visualization";
}

function inferShotSuggestion(scene = {}) {
  const text = `${scene.visualIntent || ""} ${scene.narration || ""}`.toLowerCase();

  if (/\b(aerial|drone|above|sky)\b/.test(text)) {
    return "aerial-shot";
  }

  if (/\b(reveal)\b/.test(text)) {
    return "reveal-shot";
  }

  if (/\b(close|portrait|face|eyes)\b/.test(text)) {
    return "close-up";
  }

  if (/\b(detail|insert)\b/.test(text)) {
    return "detail-shot";
  }

  if (scene.sceneId === 1) {
    return "establishing-shot";
  }

  if ((scene.duration || 0) <= 5) {
    return "medium-shot";
  }

  return "wide-shot";
}

function mapMotionIntensity(energy = "") {
  const normalized = String(energy).toLowerCase();

  if (normalized.includes("punchy")) {
    return "dynamic";
  }

  if (normalized.includes("editorial")) {
    return "moderate";
  }

  if (normalized.includes("calm")) {
    return "subtle";
  }

  return "moderate";
}

function buildContinuityConstraints(project = {}, scene = null) {
  const referenceAnchors = Array.isArray(project.references)
    ? project.references
        .filter((reference) => typeof reference?.name === "string" && reference.name.trim().length > 0)
        .slice(0, 4)
        .map((reference) => `${reference.label || "style"}: ${reference.name.trim()}`)
    : [];
  const constraints = [
    project.settings?.visualStyle ? `preserve ${project.settings.visualStyle} as the visual identity` : null,
    project.settings?.tone ? `maintain a ${project.settings.tone} emotional tone` : null,
    referenceAnchors.length > 0 ? `match the uploaded image references: ${referenceAnchors.join("; ")}` : null,
    scene?.mainSubject ? `keep ${scene.mainSubject} visually stable across adjacent shots` : null,
  ];

  return uniqueStrings(constraints);
}

function buildAgentMetadata(agentName, role, stage) {
  return {
    agent_name: agentName,
    role,
    stage,
    schema_version: DEFAULT_SCHEMA_VERSION,
  };
}

function buildScriptAnalysisHandoff({ topic, project, output }) {
  const beats = splitScriptIntoBeats(output.content);
  const continuityConstraints = buildContinuityConstraints(project);
  const keySubjects = uniqueStrings([
    project.title || topic,
    project.goal,
  ]);
  const keyEnvironments = uniqueStrings([
    project.settings?.visualStyle,
    project.type,
  ]);

  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.script, "Agent 1", "script"),
    global_analysis: {
      title: sanitizeSummaryText(project.title || topic, "Untitled project"),
      core_story_intent: sanitizeSummaryText(project.goal || `Explain ${topic}`, `Explain ${topic}`),
      narrative_summary: sanitizeSummaryText(beats.join(" "), `Script generated around ${topic}.`),
      narrative_structure: beats.length > 1 ? "setup -> development -> payoff" : "single-beat narrative",
      emotional_arc: sanitizeSummaryText(project.settings?.tone || "clear to conclusive", "clear to conclusive"),
      dominant_tone: sanitizeSummaryText(project.settings?.tone || "cinematic and clear", "cinematic and clear"),
      visual_world: sanitizeSummaryText(project.settings?.visualStyle || "coherent branded visuals", "coherent branded visuals"),
      key_subjects: keySubjects.length > 0 ? keySubjects : ["project subject"],
      key_environments: keyEnvironments.length > 0 ? keyEnvironments : ["story environment"],
      continuity_constraints: continuityConstraints.length > 0 ? continuityConstraints : ["maintain consistent subject identity and tone"],
    },
    beat_analysis: beats.map((beat, index) => {
      const visualImportance = inferVisualImportance(index, beats.length, beat);

      return {
        beat_id: `beat_${String(index + 1).padStart(2, "0")}`,
        beat_title: sanitizeSummaryText(beat.split(/\s+/).slice(0, 7).join(" "), `Beat ${index + 1}`),
        narrative_function: inferNarrativeFunction(beat, index, beats.length),
        emotional_tone: inferEmotionalTone(project, beat),
        main_subject: sanitizeSummaryText(project.title || topic, "project subject"),
        visible_action: sanitizeSummaryText(beat, "Narrative development"),
        environment: sanitizeSummaryText(project.settings?.visualStyle || project.type, "story environment"),
        visual_importance: visualImportance,
        cinematic_potential: inferCinematicPotential(beat),
        continuity_notes: continuityConstraints.length > 0
          ? continuityConstraints
          : ["keep subject identity and overall tone stable"],
        scene_generation_recommendation: {
          decision: inferSceneRecommendation(visualImportance),
          reason: visualImportance === "context-only"
            ? "This beat mainly supports exposition and should stay lightweight in the visual pipeline."
            : "This beat has enough narrative or visual value to drive scene generation.",
        },
      };
    }),
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.script,
    output: handoff,
  });
}

function buildSceneGenerationHandoff({ project, output }) {
  const scenes = Array.isArray(output.scenes) ? output.scenes : [];
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.scenes, "Agent 2", "scenes"),
    global_continuity: {
      key_subjects: uniqueStrings([
        project.title,
        project.goal,
      ]).length > 0 ? uniqueStrings([project.title, project.goal]) : ["project subject"],
      key_environments: uniqueStrings([
        project.settings?.visualStyle,
        project.type,
      ]).length > 0 ? uniqueStrings([project.settings?.visualStyle, project.type]) : ["story environment"],
      continuity_constraints: buildContinuityConstraints(project),
      scene_ordering_logic: scenes.length > 1
        ? "Move from setup through progression toward the final payoff while preserving visual continuity."
        : "Use a single scene as the full visual carrier of the script.",
    },
    scenes: scenes.map((scene) => {
      const referenceAnchors = selectSceneReferenceAnchors(project, {
        sceneText: scene.narration,
        visualIntent: scene.visualIntent,
        maxItems: 4,
      }).map((reference) => reference.formatted);

      return {
        scene_id: scene.id,
        source_beat_ids: [`beat_${String(scene.sceneId).padStart(2, "0")}`],
        scene_title: sanitizeSummaryText(scene.narration.split(/\s+/).slice(0, 7).join(" "), `Scene ${scene.sceneId}`),
        narrative_purpose: sanitizeSummaryText(scene.visualIntent, `Visualize scene ${scene.sceneId}`),
        emotional_tone: sanitizeSummaryText(scene.emotion, "cinematic"),
        location_environment: sanitizeSummaryText(project.settings?.visualStyle || project.type, "story environment"),
        main_subject: sanitizeSummaryText(project.title || project.goal, "project subject"),
        visible_action: sanitizeSummaryText(scene.narration, "Narrative beat"),
        visual_composition: sanitizeSummaryText(scene.visualIntent, "Balanced cinematic composition"),
        shot_suggestion: inferShotSuggestion(scene),
        continuity_notes: buildContinuityConstraints(project, {
          mainSubject: project.title || project.goal || "project subject",
        }),
        image_generation_notes: uniqueStrings([
          scene.visualIntent,
          project.settings?.visualStyle ? `match ${project.settings.visualStyle}` : null,
          referenceAnchors.length > 0 ? `reference anchors: ${referenceAnchors.join("; ")}` : null,
          "keep the image readable for later animation",
        ]),
        estimated_duration_seconds: Math.max(1, Math.round(scene.duration || 5)),
      };
    }),
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.scenes,
    output: handoff,
  });
}

function buildImagePromptHandoff({ scene, project, variant }) {
  const referenceAnchors = selectSceneReferenceAnchors(project, {
    sceneText: scene.narration,
    visualIntent: scene.visualIntent,
    maxItems: 4,
  }).map((reference) => reference.name);
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.imagePrompt, "Agent 3", "image-prompts"),
    scene_id: scene.id,
    main_prompt: sanitizeSummaryText(variant.prompt, scene.visualIntent || "Cinematic image prompt"),
    negative_prompt: "blurry subject, distorted anatomy, confusing geometry, cluttered composition, unstable lighting",
    visual_anchors: uniqueStrings([
      project.title || project.goal,
      variant.shot,
      variant.palette ? `${variant.palette} accent` : null,
      project.settings?.visualStyle,
      ...referenceAnchors,
    ]),
    continuity_note: sanitizeSummaryText(
      `${project.settings?.visualStyle || "Keep the visual language stable"} and preserve consistency with the approved scene intent.`,
      "Preserve continuity with the scene plan."
    ),
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.imagePrompt,
    output: handoff,
  });
}

function resolveImageModelTarget(project = {}) {
  const modelKey = project.settings?.imageAgentModel || MODEL_CONFIG.image.default;
  const provider = MODEL_CONFIG.image.providers[modelKey];

  return {
    provider: provider?.adapter || "image-provider",
    model: modelKey,
    aspect_ratio: (project.type || "").toLowerCase().includes("short") ? "9:16" : "16:9",
    format: "still-image",
  };
}

function buildImageGenerationHandoff({ scene, project, variant }) {
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.imageGeneration, "Agent 4", "image-generation"),
    scene_id: scene.id,
    optimized_prompt: sanitizeSummaryText(
      `${variant.prompt} Preserve stable anatomy, readable silhouette, clean perspective and animation-friendly composition.`,
      "Production-ready image prompt"
    ),
    negative_prompt: "warped anatomy, unstable perspective, broken hands, duplicate subjects, muddy lighting, noisy background",
    generation_config: {
      model_target: resolveImageModelTarget(project),
      framing_priority: sanitizeSummaryText(variant.shot, "cinematic framing"),
      stylization_level: sanitizeSummaryText(project.settings?.visualStyle || variant.mood, "cinematic realism"),
      quality_preset: "production-still",
      preserve_identity: true,
    },
    model_notes: sanitizeSummaryText(
      `Prioritize ${variant.shot}, ${variant.mood} tone and stable scene readability for downstream video motion.`,
      "Prioritize subject clarity and stable composition."
    ),
    continuity_protection: sanitizeSummaryText(
      `${project.settings?.visualStyle || "Keep the scene identity stable"} while matching adjacent scenes and references.`,
      "Protect continuity across adjacent scenes."
    ),
    generation_priority: "readability first, subject identity second, atmosphere third",
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.imageGeneration,
    output: handoff,
  });
}

function buildMotionVideoHandoff({ scene, project, variant, approvedImage }) {
  const movementIntensity = mapMotionIntensity(variant.energy);
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.motionVideo, "Agent 5", "motion-video"),
    scene_id: scene.id,
    source_context: {
      script_excerpt: sanitizeSummaryText(scene.narration, "Scene narration"),
      source_image_prompt: sanitizeSummaryText(approvedImage?.prompt || scene.visualIntent, "Approved image prompt"),
      approved_image_reference: sanitizeSummaryText(approvedImage?.id || scene.approvedImageId || `${scene.id}-approved-image`, `${scene.id}-approved-image`),
    },
    scene_analysis: {
      narrative_purpose: sanitizeSummaryText(scene.visualIntent, `Animate scene ${scene.sceneId}`),
      emotional_tone: sanitizeSummaryText(scene.emotion, "cinematic"),
      main_subject: sanitizeSummaryText(project.title || project.goal, "project subject"),
      subject_action: sanitizeSummaryText(scene.narration, "Carry the scene action with restrained motion"),
      environment: sanitizeSummaryText(project.settings?.visualStyle || project.type, "story environment"),
      visual_style: sanitizeSummaryText(project.settings?.visualStyle || variant.energy, "cinematic visual style"),
      energy_level: sanitizeSummaryText(variant.energy, "moderate"),
    },
    motion_direction: {
      camera_movement: {
        type: sanitizeSummaryText(variant.motion, "slow push-in"),
        speed: movementIntensity === "subtle" ? "slow" : movementIntensity === "dynamic" ? "fast" : "moderate",
        intensity: movementIntensity,
        direction: "forward and composition-aware",
        purpose: "translate the approved still image into a cinematic moving shot without breaking continuity",
      },
      subject_motion: {
        type: "believable performance motion",
        intensity: movementIntensity === "dynamic" ? "moderate" : "subtle",
        details: "Keep body, cloth and facial movement coherent with the emotion and the original still composition.",
      },
      environment_motion: {
        type: "ambient environmental motion",
        intensity: movementIntensity === "dynamic" ? "moderate" : "subtle",
        details: "Use only supportive wind, particles, light or atmosphere cues that reinforce the scene tone.",
      },
    },
    cinematic_constraints: {
      preserve: uniqueStrings([
        approvedImage?.id ? `approved image identity from ${approvedImage.id}` : null,
        project.settings?.visualStyle,
        "overall composition readability",
      ]),
      avoid: [
        "chaotic reframing",
        "identity drift",
        "geometry-breaking camera movement",
      ],
    },
    final_video_prompt: sanitizeSummaryText(variant.prompt, "Cinematic motion prompt"),
    negative_prompt: "warped motion, identity drift, perspective collapse, chaotic camera shake, scene reinvention",
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.motionVideo,
    output: handoff,
  });
}

function resolveVoiceSourceType(voiceId = "") {
  if (voiceId === "custom-audio-upload") {
    return "uploaded";
  }

  if (voiceId.startsWith("clone-")) {
    return "cloned";
  }

  return "preset";
}

function resolveVoiceExecutionMode(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";

  if (voiceId === "custom-audio-upload") {
    return typeof audio?.narration?.uploadedSource?.storagePath === "string"
      && audio.narration.uploadedSource.storagePath.length > 0
      ? "keep-existing"
      : "upload";
  }

  return audio?.narration?.status === "generated" ? "keep-existing" : "generate";
}

function resolvePacingProfile(direction = "", language = "") {
  const combined = `${direction} ${language}`.toLowerCase();

  if (/\b(slow|reflective|calm|gentle)\b/.test(combined)) {
    return "slow and deliberate with emotional breathing room";
  }

  if (/\b(energetic|fast|urgent|dynamic)\b/.test(combined)) {
    return "energetic and tightly paced";
  }

  return "balanced cinematic pacing";
}

function buildVoiceDirectionHandoff({ project, audio }) {
  const narration = audio?.narration || {};
  const continuityConstraints = uniqueStrings([
    "keep the same voice identity across all scenes",
    narration.direction ? `preserve ${narration.direction}` : null,
    project.settings?.tone ? `match the project tone: ${project.settings.tone}` : null,
  ]);
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.narration, "Agent 6", "narration"),
    project_id: project.id,
    voice_plan: {
      source_type: resolveVoiceSourceType(narration.voiceId || ""),
      voice_id: sanitizeSummaryText(narration.voiceId || project.settings?.voiceId, MODEL_CONFIG.voice.default),
      language: sanitizeSummaryText(narration.language || project.settings?.projectLanguage, "english"),
      delivery_direction: sanitizeSummaryText(narration.direction || project.settings?.narrationStyle || "clear and coherent delivery", "clear and coherent delivery"),
      pacing_profile: resolvePacingProfile(narration.direction || project.settings?.narrationStyle || "", narration.language || project.settings?.projectLanguage || ""),
      execution_mode: resolveVoiceExecutionMode(audio),
      continuity_constraints: continuityConstraints.length > 0 ? continuityConstraints : ["keep narration style and voice identity stable"],
    },
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.narration,
    output: handoff,
  });
}

function mapSfxDensity(density = "") {
  if (density === "medium") {
    return "balanced";
  }

  if (!density || density === "disabled") {
    return "none";
  }

  return density;
}

function buildSoundtrackDirectionHandoff({ project, audio }) {
  const music = audio?.music || {};
  const sfx = audio?.sfx || {};
  const endingStrategy = music.endingFadeEnabled === false
    ? "hard stop aligned with the final cut"
    : `fade out over ${music.endingFadeDuration || 2.5} seconds`;
  const cueFocus = Array.isArray(sfx.cues) && sfx.cues.length > 0
    ? sfx.cues
    : [
        project.settings?.tone ? `accent cues that support ${project.settings.tone}` : null,
        "scene transition support",
        "environment reinforcement",
      ];
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.soundtrack, "Agent 7", "soundtrack"),
    project_id: project.id,
    music_plan: {
      mode: music.mode === "auto" ? "generate" : music.mode,
      mood: sanitizeSummaryText(music.mood || "cinematic", "cinematic"),
      generation_brief: typeof music.generationBrief === "string" ? music.generationBrief : "",
      ending_strategy: endingStrategy,
      dynamic_volume: typeof music.dynamicVolume === "boolean" ? music.dynamicVolume : true,
    },
    sfx_plan: {
      enabled: typeof sfx.enabled === "boolean" ? sfx.enabled : true,
      density: typeof sfx.enabled === "boolean" && sfx.enabled === false ? "none" : mapSfxDensity(sfx.density || "balanced"),
      cue_focus: uniqueStrings(cueFocus).slice(0, 6),
    },
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.soundtrack,
    output: handoff,
  });
}

function buildAssemblyHandoff({ project, output }) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const handoff = {
    agent_metadata: buildAgentMetadata(PRODUCTION_AGENT_NAMES.assembly, "Agent 8", "assembly"),
    project_id: project.id,
    readiness: {
      has_scenes: Boolean(output.readiness?.hasScenes),
      has_visual_coverage: Boolean(output.readiness?.hasVisualCoverage),
      has_audio: Boolean(output.readiness?.hasAudio),
      has_captions: Boolean(output.readiness?.hasCaptions),
      ready_to_render: Boolean(output.readiness?.readyToRender),
    },
    warnings: Array.isArray(output.warnings) ? output.warnings : [],
    timeline: (Array.isArray(output.timeline) ? output.timeline : []).map((item) => {
      const matchingScene = scenes.find((scene) => scene.sceneId === item.sceneId) || {};
      const sourceRef = item.sourceType === "video"
        ? matchingScene.approvedVideoId
        : item.sourceType === "image"
          ? matchingScene.approvedImageId
          : `${project.id}-scene-${item.sceneId}-placeholder`;

      return {
        scene_id: matchingScene.id || `${project.id}-scene-${item.sceneId}`,
        source_type: item.sourceType,
        source_ref: sanitizeSummaryText(sourceRef, `${project.id}-scene-${item.sceneId}`),
        duration_seconds: Math.max(1, Math.round(item.duration || 1)),
        audio_sync_role: sanitizeSummaryText(item.audioLayer, "scene audio sync"),
        caption_role: output.readiness?.hasCaptions
          ? `Caption support for scene ${item.sceneId}`
          : "No captions attached",
      };
    }),
    render_handoff: {
      output_format: sanitizeSummaryText(output.output?.format, "mp4"),
      aspect_ratio: sanitizeSummaryText(output.aspectRatio, "16:9"),
      resolution: sanitizeSummaryText(output.resolution, "1920x1080"),
      audio_plan_ref: sanitizeSummaryText(
        project.audio?.production?.audioPlanRef || `audio-plan-${project.id}-v1`,
        `audio-plan-${project.id}-v1`
      ),
      status: output.status,
    },
  };

  return createValidatedProductionPayload({
    schemaFile: PRODUCTION_SCHEMAS.assembly,
    output: handoff,
  });
}

module.exports = {
  PRODUCTION_SCHEMAS,
  buildAssemblyHandoff,
  buildImageGenerationHandoff,
  buildImagePromptHandoff,
  buildMotionVideoHandoff,
  buildSceneGenerationHandoff,
  buildScriptAnalysisHandoff,
  buildSoundtrackDirectionHandoff,
  buildVoiceDirectionHandoff,
  createValidatedProductionPayload,
  validateProductionOutput,
};
