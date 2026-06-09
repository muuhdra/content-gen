const { MODEL_CONFIG } = require("@cosyl/config/models");
const { generateVoice } = require("@cosyl/media/audio/generateVoice");
const {
  buildSoundtrackDirectionHandoff,
  buildVoiceDirectionHandoff,
} = require("@cosyl/agents/productionHandoff");

function inferMusicTrack(project) {
  const tone = (project.settings?.tone || "").toLowerCase();

  if (tone.includes("motivation") || tone.includes("uplifting")) {
    return "Momentum Pulse";
  }

  if (tone.includes("educational") || tone.includes("clear")) {
    return "Editorial Underscore";
  }

  if (tone.includes("dramatic") || tone.includes("cyberpunk")) {
    return "Noir Voltage Bed";
  }

  return "Factory Signature Bed";
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pickSceneAudioKeyword(scene = {}) {
  const combined = `${scene.narration || ""} ${scene.visualIntent || ""} ${scene.emotion || ""}`.toLowerCase();

  if (/\b(reveal|breakthrough|discover|unlock|launch)\b/.test(combined)) return "reveal accent";
  if (/\b(tension|risk|problem|fear|warning|urgent)\b/.test(combined)) return "tense pulse";
  if (/\b(data|proof|fact|result|stat)\b/.test(combined)) return "precision tick";
  if (/\b(system|process|workflow|steps|build)\b/.test(combined)) return "mechanical transition";
  if (/\b(calm|clarity|trust|confidence|hope)\b/.test(combined)) return "soft lift";

  return "cinematic accent";
}

function describeSceneVisualSync(scene = {}) {
  const approvedVideo = Array.isArray(scene.videoVariants)
    ? scene.videoVariants.find((variant) => variant.id === scene.approvedVideoId)
    : null;
  const approvedImage = Array.isArray(scene.imageVariants)
    ? scene.imageVariants.find((variant) => variant.id === scene.approvedImageId)
    : null;

  if (approvedVideo) {
    return `${approvedVideo.motion || "cinematic movement"} with ${approvedVideo.energy || "balanced"} energy`;
  }

  if (approvedImage) {
    return `${approvedImage.shot || "framed visual"} with ${approvedImage.mood || "cinematic"} mood`;
  }

  return scene.visualIntent || "script-led visual timing";
}

function buildProjectAudioIdentity(project) {
  return [
    normalizeText(project.goal || ""),
    normalizeText(project.settings?.tone || ""),
    normalizeText(project.settings?.visualStyle || ""),
  ].filter(Boolean).join(" | ");
}

function inferSoundtrackMood(project, requestedMood = "") {
  const combined = `${requestedMood} ${project.settings?.tone || ""} ${project.goal || ""}`.toLowerCase();

  if (requestedMood && requestedMood.trim().length > 0) {
    return requestedMood;
  }

  if (/\b(uplifting|motivation|inspire|optimistic)\b/.test(combined)) {
    return "uplifting cinematic";
  }

  if (/\b(education|clear|editorial|explain|course)\b/.test(combined)) {
    return "editorial pulse";
  }

  if (/\b(dark|tense|dramatic|cyberpunk|threat)\b/.test(combined)) {
    return "dark tension";
  }

  if (/\b(premium|luxury|elegant)\b/.test(combined)) {
    return "premium atmospheric";
  }

  return "cinematic";
}

function buildSoundtrackBrief(project, mood) {
  const identity = buildProjectAudioIdentity(project);
  const sceneSummaries = (Array.isArray(project.scenes) ? project.scenes : [])
    .slice(0, 4)
    .map((scene) => `Scene ${scene.sceneId}: ${normalizeText(scene.narration || scene.visualIntent).slice(0, 90)}`)
    .filter(Boolean);

  const lines = [
    `Score direction: ${mood}.`,
    identity ? `Project DNA: ${identity}.` : null,
    project.script?.content ? `Script arc: ${normalizeText(project.script.content).slice(0, 220)}.` : null,
    sceneSummaries.length > 0 ? `Scene anchors: ${sceneSummaries.join(" | ")}.` : null,
    "Keep the soundtrack as a dedicated music stem, leaving narration and SFX on separate layers.",
  ];

  return lines.filter(Boolean).join(" ");
}

function buildSfxCues(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const isSlideshowProject = (project.type || "").toLowerCase().includes("slideshow");

  return scenes.map((scene) => {
    const sceneLabel = `${isSlideshowProject ? "Slide" : "Scene"} ${scene.sceneId}`;
    const narrationAnchor = normalizeText(scene.narration).slice(0, 72) || normalizeText(scene.visualIntent).slice(0, 72) || "script beat";
    const cueType = pickSceneAudioKeyword(scene);
    const visualSync = describeSceneVisualSync(scene);

    return `${sceneLabel} | anchor: ${narrationAnchor} | visual sync: ${visualSync} | cue: ${cueType}`;
  });
}

function buildSfxDesignBrief(project, cues = []) {
  const identity = buildProjectAudioIdentity(project);
  const cuePreview = cues.slice(0, 4).join(" || ");

  return [
    "Design a dedicated SFX stem that follows the script beat-by-beat and locks to the approved visual rhythm.",
    identity ? `Project DNA: ${identity}.` : null,
    cuePreview ? `Priority cues: ${cuePreview}.` : null,
    "Do not print SFX into the narration stem.",
  ].filter(Boolean).join(" ");
}

// ── AI SFX: genre detection ──────────────────────────────────────────────────

function detectProjectGenre(project = {}) {
  const combined = [
    project.goal || "",
    project.title || "",
    project.settings?.tone || "",
    project.settings?.visualStyle || "",
    project.settings?.targetAudience || "",
    (project.script?.content || "").slice(0, 400),
  ].join(" ").toLowerCase();

  if (/\b(crime|murder|detective|investigat|thriller|suspect|police|fbi|cold.?case|heist)\b/.test(combined)) return "crime";
  if (/\b(documentary|nature|wildlife|expedition|explore|journey|habitat|planet|climate)\b/.test(combined)) return "documentary";
  if (/\b(horror|scary|fear|haunt|paranormal|creep|dark|sinister|nightmare)\b/.test(combined)) return "horror";
  if (/\b(luxury|premium|high.?end|elegant|fashion|prestige|exclusive|couture)\b/.test(combined)) return "luxury";
  if (/\b(tech|startup|software|app|digital|ai|data|code|cyber|saas|platform)\b/.test(combined)) return "tech";
  if (/\b(education|learn|course|tutorial|explain|student|teacher|lesson|school)\b/.test(combined)) return "educational";
  if (/\b(corporate|business|brand|enterprise|b2b|company|professional|strategy)\b/.test(combined)) return "corporate";
  if (/\b(sport|athlete|fitness|workout|race|competition|champion|training)\b/.test(combined)) return "sport";
  if (/\b(history|heritage|archive|museum|ancient|civilization|era|century)\b/.test(combined)) return "historical";

  return "cinematic";
}

// ── AI SFX: per-scene prompt builder ─────────────────────────────────────────
// Maps genre + scene cue type → a rich ElevenLabs SFX text prompt.

const AI_SFX_PROMPTS = {
  crime: {
    "reveal accent":       "tense dramatic sting, crime thriller reveal, dark orchestral hit with deep bass drop, suspense",
    "tense pulse":         "dark tension drone, crime investigation atmosphere, low rumbling with dissonant high strings",
    "precision tick":      "typewriter mechanical click, noir evidence detail, sharp rhythmic accent",
    "mechanical transition": "dark cinematic whoosh, crime scene cut, deep bass sweep with metallic tail",
    "soft lift":           "muted string breath, quiet crime drama moment, subtle tension release",
    "cinematic accent":    "noir cinematic impact, crime thriller accent, dramatic bass hit with reverb",
  },
  documentary: {
    "reveal accent":       "orchestral discovery sting, nature documentary reveal, uplifting brass swell",
    "tense pulse":         "deep nature tension, documentary suspense, low environmental drone with subtle percussion",
    "precision tick":      "light documentary percussion tick, factual moment, clean natural accent",
    "mechanical transition": "cinematic whoosh, documentary scene bridge, warm atmospheric sweep",
    "soft lift":           "gentle nature breath, soft orchestral moment, documentary calm and wonder",
    "cinematic accent":    "nature documentary impact, gentle brass accent, atmospheric cinematic hit",
  },
  horror: {
    "reveal accent":       "horror reveal sting, unsettling orchestral hit, dissonant strings with bass drop",
    "tense pulse":         "horror tension drone, low sub-bass rumble, creeping dark atmosphere",
    "precision tick":      "ominous precise tick, horror countdown, eerie rhythmic element",
    "mechanical transition": "dark horror whoosh, disturbing scene cut, creepy bass sweep",
    "soft lift":           "quiet unsettling moment, muted horror calm, subtle eerie breath",
    "cinematic accent":    "horror impact hit, deep terrifying bass drop, dark cinematic accent",
  },
  luxury: {
    "reveal accent":       "elegant luxury reveal, soft chime with warm reverb, premium brand moment",
    "tense pulse":         "subtle luxury ambience, premium atmospheric pulse, refined elegant rhythm",
    "precision tick":      "refined luxury click, elegant detail accent, crystalline precision",
    "mechanical transition": "smooth luxury sweep, elegant cinematic transition, premium warm whoosh",
    "soft lift":           "warm luxury breath, gentle premium tone, sophisticated soft lift",
    "cinematic accent":    "luxury brand impact, elegant cinematic hit, premium orchestral moment",
  },
  tech: {
    "reveal accent":       "digital interface reveal, electronic sting with glitch accent, modern tech moment",
    "tense pulse":         "cyberpunk tension drone, digital ambience, electronic low frequency pulse",
    "precision tick":      "clean UI click, digital precision accent, modern interface interaction",
    "mechanical transition": "digital sweep transition, electronic whoosh, tech scene cut",
    "soft lift":           "digital optimism lift, clean electronic tone, tech forward moment",
    "cinematic accent":    "tech cinematic hit, digital impact with electronic tail, modern accent",
  },
  educational: {
    "reveal accent":       "bright educational discovery chime, learning moment sting, uplifting tone",
    "tense pulse":         "focused study rhythm, warm learning atmosphere, soft educational pulse",
    "precision tick":      "learning progress click, educational step sound, clean positive accent",
    "mechanical transition": "smooth lesson transition, clean educational sweep, chapter bridge",
    "soft lift":           "warm encouragement lift, gentle chime, educational optimism",
    "cinematic accent":    "educational highlight, uplifting warm accent, learning impact",
  },
  corporate: {
    "reveal accent":       "clean corporate reveal, modern business sting, bright professional tone",
    "tense pulse":         "subtle corporate tension, professional meeting ambience, light rhythmic pulse",
    "precision tick":      "clean corporate data click, modern precision, business accuracy accent",
    "mechanical transition": "smooth professional transition, corporate whoosh, clean business sweep",
    "soft lift":           "light corporate optimism, professional warmth, clean business lift",
    "cinematic accent":    "corporate brand impact, clean professional hit, modern business accent",
  },
  sport: {
    "reveal accent":       "powerful sports reveal sting, energetic impact hit, adrenaline accent",
    "tense pulse":         "intense competition rhythm, sports tension, high energy pulse",
    "precision tick":      "athletic precision click, sport data accent, sharp competitive tick",
    "mechanical transition": "fast sports sweep, energetic cut, dynamic transition whoosh",
    "soft lift":           "athletic uplift, motivational soft moment, sports spirit breath",
    "cinematic accent":    "epic sports impact, powerful cinematic hit, championship accent",
  },
  historical: {
    "reveal accent":       "historic orchestral reveal, heritage discovery sting, period drama hit",
    "tense pulse":         "historical tension, period drama atmosphere, ancient resonant drone",
    "precision tick":      "period clock tick, historical archive accent, antiquated mechanical detail",
    "mechanical transition": "historical cinematic sweep, period drama transition, heritage bridge",
    "soft lift":           "historical reflection, gentle period drama breath, heritage calm",
    "cinematic accent":    "epic historical impact, period drama cinematic hit, heritage accent",
  },
  cinematic: {
    "reveal accent":       "cinematic reveal sting, dramatic orchestral hit, impactful discovery moment",
    "tense pulse":         "cinematic suspense drone, dramatic atmosphere, tension pulse",
    "precision tick":      "cinematic precision tick, dramatic sharp accent, film beat",
    "mechanical transition": "cinematic whoosh, dramatic scene cut, powerful sweep",
    "soft lift":           "cinematic emotional breath, gentle orchestral lift, film moment",
    "cinematic accent":    "cinematic impact hit, dramatic orchestral accent, powerful film moment",
  },
};

/**
 * Returns the ElevenLabs SFX text prompt for a given genre + cue type.
 * Falls back to the cinematic defaults when genre or cue type is not mapped.
 */
function buildAiSfxCuePrompt(genre = "cinematic", cueType = "cinematic accent") {
  const genreMap = AI_SFX_PROMPTS[genre] || AI_SFX_PROMPTS.cinematic;
  return genreMap[cueType] || AI_SFX_PROMPTS.cinematic[cueType] || "cinematic accent sound effect, impactful short hit";
}

function resolveGenerationType(overrides = {}) {
  if (overrides.type === "voice" || overrides.type === "music") {
    return overrides.type;
  }

  return "full";
}

function isBuiltCloneVoiceId(voiceId = "") {
  return typeof voiceId === "string" && voiceId.startsWith("clone-");
}

function isUploadOnlyVoiceId(voiceId = "") {
  return voiceId === "custom-audio-upload";
}

function isSupportedNarrationVoiceId(voiceId = "") {
  if (typeof voiceId !== "string" || voiceId.length === 0) return false;
  // Uploaded source is handled by the upload path, not voice generation.
  if (voiceId === "custom-audio-upload") return false;
  // The TTS model is locked (one per AI): any preset id resolves to the default
  // model in resolveVoiceConfig, and clones are valid too — so accept them all.
  return true;
}

function hasUploadedNarrationSource(audio = {}) {
  return typeof audio?.narration?.uploadedSource?.storagePath === "string"
    && audio.narration.uploadedSource.storagePath.length > 0;
}

function isNarrationReady(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";
  const status = audio?.narration?.status || "draft";

  if (isUploadOnlyVoiceId(voiceId)) {
    return status === "uploaded" && hasUploadedNarrationSource(audio);
  }

  return status === "generated";
}

function isMusicReady(audio = {}) {
  const mode = audio?.music?.mode || "auto";

  if (mode === "none") {
    return true;
  }

  if (mode === "uploaded") {
    return Array.isArray(audio?.music?.uploadedTracks)
      && audio.music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0);
  }

  return audio?.music?.status === "generated";
}

function isSfxReady(audio = {}) {
  if (audio?.sfx?.enabled === false) {
    return true;
  }

  return audio?.sfx?.status === "generated";
}

function isAudioStackReady(audio = {}) {
  return isNarrationReady(audio) && isMusicReady(audio) && isSfxReady(audio);
}

function generateAudioStack(project, overrides = {}) {
  const scriptContent = project.script?.content || "";
  const currentAudio = project.audio || {};
  const generationType = resolveGenerationType(overrides);
  const requestedMusicMode = overrides.music?.mode || currentAudio.music?.mode || "auto";
  const soundtrackMood = inferSoundtrackMood(project, overrides.music?.mood || currentAudio.music?.mood || "");
  const resolvedNarrationVoiceId =
    overrides.narration?.voiceId ||
    currentAudio.narration?.voiceId ||
    project.settings.voiceId;
  const hasUploadedNarrationSource = isUploadOnlyVoiceId(resolvedNarrationVoiceId)
    && typeof (overrides.narration?.uploadedSource || currentAudio.narration?.uploadedSource)?.storagePath === "string"
    && (overrides.narration?.uploadedSource || currentAudio.narration?.uploadedSource).storagePath.length > 0;
  const shouldGenerateNarration =
    (generationType === "full" || generationType === "voice") && !hasUploadedNarrationSource;
  const shouldGenerateMusic =
    (generationType === "full" || generationType === "music")
    && requestedMusicMode !== "uploaded"
    && requestedMusicMode !== "none";
  // SFX is regenerated on "full" or "music" generation type.
  // On "voice"-only generation, SFX is preserved as-is so that a previously completed
  // audio stack (narration + music + sfx all generated) remains fully ready.
  const shouldGenerateSfx = generationType === "full" || generationType === "music";

  const resolvedNarrationLanguage =
    overrides.narration?.language ||
    currentAudio.narration?.language ||
    project.settings.projectLanguage;
  const resolvedNarrationDirection =
    overrides.narration?.direction ||
    currentAudio.narration?.direction ||
    project.settings.narrationStyle ||
    `Narrate with a ${normalizeText(project.settings?.tone || "clear cinematic")} delivery that follows the script pacing without background SFX.`;

  if ((generationType === "voice" || generationType === "full") && isUploadOnlyVoiceId(resolvedNarrationVoiceId) && !hasUploadedNarrationSource) {
    throw new Error("Narration is configured for uploaded audio. Upload your custom narration source instead of generating a voice.");
  }

  if (generationType === "voice" && isUploadOnlyVoiceId(resolvedNarrationVoiceId) && hasUploadedNarrationSource) {
    throw new Error("Narration already uses an uploaded source. Replace the uploaded file instead of generating a voice.");
  }

  if (shouldGenerateNarration) {
    if (!isSupportedNarrationVoiceId(resolvedNarrationVoiceId)) {
      throw new Error(`Unsupported narration voice: ${resolvedNarrationVoiceId}`);
    }
  }

  const nextNarration = shouldGenerateNarration
    ? generateVoice({
        scriptContent,
        voiceId: resolvedNarrationVoiceId,
        language: resolvedNarrationLanguage,
        deliveryStyle: resolvedNarrationDirection,
      })
    : {
        ...(currentAudio.narration || {}),
        ...(overrides.narration || {}),
        direction: resolvedNarrationDirection,
        stemType: "dry-voice",
      };

  const nextMusic = shouldGenerateMusic
    ? {
        ...(currentAudio.music || {}),
        ...(overrides.music || {}),
        status: "generated",
        mode: requestedMusicMode,
        trackName: overrides.music?.trackName || currentAudio.music?.trackName || inferMusicTrack(project),
        mood: soundtrackMood,
        generationBrief: buildSoundtrackBrief(project, soundtrackMood),
      }
    : {
        ...(currentAudio.music || {}),
        ...(overrides.music || {}),
        mode: requestedMusicMode,
        trackName: requestedMusicMode === "none" ? "" : currentAudio.music?.trackName || "",
        mood: soundtrackMood,
        generationBrief: overrides.music?.generationBrief || currentAudio.music?.generationBrief || buildSoundtrackBrief(project, soundtrackMood),
        generatedSource:
          requestedMusicMode === "none" || requestedMusicMode === "uploaded"
            ? null
            : currentAudio.music?.generatedSource || null,
        status:
          requestedMusicMode === "none"
            ? "disabled"
            : requestedMusicMode === "uploaded"
              && Array.isArray(currentAudio.music?.uploadedTracks)
              && currentAudio.music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
            ? "uploaded"
              : requestedMusicMode === "uploaded"
              ? "draft"
              : currentAudio.music?.status || "draft",
      };

  const nextSfxCues = typeof overrides.sfx?.enabled === "boolean" && overrides.sfx.enabled === false
    ? []
    : buildSfxCues(project);
  const nextSfx = shouldGenerateSfx
    ? {
        ...(currentAudio.sfx || {}),
        ...(overrides.sfx || {}),
        status: "generated",
        enabled: typeof overrides.sfx?.enabled === "boolean"
          ? overrides.sfx.enabled
          : typeof currentAudio.sfx?.enabled === "boolean"
            ? currentAudio.sfx.enabled
            : true,
        density: overrides.sfx?.density || currentAudio.sfx?.density || "medium",
        cues: nextSfxCues,
        designBrief: buildSfxDesignBrief(project, nextSfxCues),
        generatedSource: null,
      }
    : {
        ...(currentAudio.sfx || {}),
        ...(overrides.sfx || {}),
        designBrief: overrides.sfx?.designBrief || currentAudio.sfx?.designBrief || buildSfxDesignBrief(project, currentAudio.sfx?.cues || []),
      };

  const nextAudio = {
    ...currentAudio,
    ...overrides,
    type: generationType,
    narration: {
      ...(currentAudio.narration || {}),
      ...(overrides.narration || {}),
      ...nextNarration,
      stemType: "dry-voice",
    },
    music: nextMusic,
    sfx: nextSfx,
    generatedAt: null,
  };

  nextAudio.generatedAt = isAudioStackReady(nextAudio) ? new Date().toISOString() : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project,
      audio: nextAudio,
    }),
  };

  return nextAudio;
}

/**
 * Mark the auto-generated audio stems as stale after an upstream change
 * (script edit) that the narration / music / SFX are derived from.
 *
 * Auto-generated stems (generated voice, auto music, enabled SFX) are reset to
 * "draft" so the workflow correctly shows them as needing regeneration and the
 * render gate blocks until they are refreshed. User-provided choices are
 * preserved untouched:
 *   - uploaded narration (voiceId "custom-audio-upload")
 *   - uploaded music tracks (mode "uploaded")
 *   - disabled stems (music mode "none", sfx disabled)
 */
function invalidateAudioForScriptChange(audio = {}) {
  const current = audio || {};
  const narration = current.narration || {};
  const music = current.music || {};
  const sfx = current.sfx || {};

  const nextNarration = isUploadOnlyVoiceId(narration.voiceId)
    ? { ...narration }
    : { ...narration, status: "draft", generatedSource: null };

  const musicPreserved = music.mode === "uploaded" || music.mode === "none";
  const nextMusic = musicPreserved
    ? { ...music }
    : { ...music, status: "draft", generatedSource: null };

  const nextSfx = sfx.enabled === false
    ? { ...sfx }
    : { ...sfx, status: "draft", generatedSource: null };

  return {
    ...current,
    narration: nextNarration,
    music: nextMusic,
    sfx: nextSfx,
    generatedAt: null,
  };
}

module.exports = {
  generateAudioStack,
  invalidateAudioForScriptChange,
  detectProjectGenre,
  buildAiSfxCuePrompt,
  pickSceneAudioKeyword,
};
