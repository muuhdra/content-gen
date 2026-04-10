const { MODEL_CONFIG } = require("./models");

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

const DEFAULT_TEMPLATES = [
  {
    id: "manikin-renders",
    title: "3D Manikin Renders",
    type: "short",
    description: "Blender-style manikin story recreations. Famous among Youtube Film Channels.",
    style: "Blender-style cinematic recreations with moody noir lighting.",
    params: ["Short Form", "Moody lighting", "Fast captions", "Animated camera moves"],
    preview: "noir",
    defaults: {
      script: {
        mode: "ai",
        topic: "Cinematic short-form crime story with mannequin characters",
        model: MODEL_CONFIG.script.default,
      },
      settings: {
        scriptAgentModel: MODEL_CONFIG.script.default,
        imageAgentModel: "nano-banana",
        videoAgentModel: "kling-3.0",
        voiceId: "elevenlabs-default",
        projectLanguage: "english",
        tone: "dark, suspenseful, punchy",
        visualStyle: "Noir lighting, rainy streets, cinematic mannequin blocking",
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
      audio: {
        music: {
          mode: "auto",
          mood: "dramatic",
        },
        sfx: {
          enabled: true,
          density: "medium",
        },
      },
      captions: {
        style: {
          animationStyle: "pop",
          colorStyle: "blue",
          typography: "bold",
          wordByWord: true,
          wordHighlight: true,
        },
      },
    },
  },
  {
    id: "horror-cartoon",
    title: "Horror Cartoon Style",
    type: "video",
    description: "Inspired from short-form extremely viral videos on TikTok and Youtube.",
    style: "Illustrated horror storytelling with pulpy character framing.",
    params: ["YouTube Long", "Stylized frames", "Voice-led", "Cartoon textures"],
    preview: "cartoon",
    defaults: {
      script: {
        mode: "ai",
        topic: "Narrated horror breakdown with cartoon framing and viral pacing",
        model: MODEL_CONFIG.script.default,
      },
      settings: {
        scriptAgentModel: "claude",
        imageAgentModel: "nano-banana",
        videoAgentModel: "seedance-2.0",
        voiceId: "elevenlabs-default",
        projectLanguage: "english",
        tone: "eerie, story-driven, high retention",
        visualStyle: "Illustrated horror panels, exaggerated faces, pulpy shadows",
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
      audio: {
        music: {
          mode: "auto",
          mood: "cinematic",
        },
        sfx: {
          enabled: true,
          density: "medium",
        },
      },
      captions: {
        style: {
          animationStyle: "slide",
          colorStyle: "red",
          typography: "bold",
          wordByWord: false,
          wordHighlight: true,
        },
      },
    },
  },
  {
    id: "gelatinous-skeleton",
    title: "Gelatinous Skeleton",
    type: "short",
    description: "Transparent gelatin anatomy style with custom intro hook pipeline.",
    style: "Stylized anatomy visuals with transparent glossy materials.",
    params: ["Short Form", "Clean subject focus", "Blue palette", "Intro hook emphasis"],
    preview: "skeleton",
    defaults: {
      script: {
        mode: "ai",
        topic: "Short viral anatomy hook with surreal gelatin skeleton reveal",
        model: MODEL_CONFIG.script.default,
      },
      settings: {
        scriptAgentModel: "gpt",
        imageAgentModel: "kling-3.0",
        videoAgentModel: "kling-3.0",
        voiceId: "elevenlabs-default",
        projectLanguage: "english",
        tone: "curious, premium, educational",
        visualStyle: "Clean blue environment, translucent anatomy, premium studio framing",
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
      audio: {
        music: {
          mode: "auto",
          mood: "editorial",
        },
        sfx: {
          enabled: true,
          density: "light",
        },
      },
      captions: {
        style: {
          animationStyle: "pop",
          colorStyle: "blue",
          typography: "inter",
          wordByWord: true,
          wordHighlight: true,
        },
      },
    },
  },
  {
    id: "course-vsl-deck",
    title: "Course VSL Deck",
    type: "slideshow",
    description: "Text-first slideshow template for educational VSLs, sales decks and premium explainer presentations.",
    style: "Editorial slide design with strong hierarchy, modern gradients and narration-led pacing.",
    params: ["Slideshow / VSL", "Text-first layout", "Ken Burns fallback", "Narration-led pacing"],
    preview: "deck",
    defaults: {
      script: {
        mode: "ai",
        topic: "Educational VSL with a clear promise, structured benefits and slide-by-slide persuasion",
        model: MODEL_CONFIG.script.default,
      },
      settings: {
        scriptAgentModel: "claude",
        imageAgentModel: "nano-banana",
        videoAgentModel: "seedance-2.0",
        voiceId: "elevenlabs-default",
        projectLanguage: "english",
        tone: "clear, persuasive, premium, educational",
        visualStyle: "Text-first presentation layout, premium diagrams, gradient accents, clean editorial spacing",
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
      audio: {
        music: {
          mode: "auto",
          mood: "editorial",
        },
        sfx: {
          enabled: false,
          density: "light",
        },
      },
      captions: {
        style: {
          animationStyle: "slide",
          colorStyle: "violet",
          typography: "bold",
          wordByWord: false,
          wordHighlight: true,
        },
      },
    },
  },
  {
    id: "project-template",
    title: "My Template",
    type: "video",
    description: "Current project specific resources and style configuration.",
    style: "Project-specific visual direction saved from prior work.",
    params: ["YouTube Long", "Custom assets", "Reusable settings", "Project-specific DNA"],
    preview: "empty",
    defaults: {
      script: {
        mode: "ai",
        topic: "Project-specific reusable narrative structure",
        model: MODEL_CONFIG.script.default,
      },
      settings: {
        scriptAgentModel: MODEL_CONFIG.script.default,
        imageAgentModel: MODEL_CONFIG.image.default,
        videoAgentModel: MODEL_CONFIG.video.default,
        voiceId: MODEL_CONFIG.voice.default,
        projectLanguage: "english",
        tone: "custom brand tone",
        visualStyle: "Reusable visual stack from previous project work",
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
      audio: {
        music: {
          mode: "auto",
          mood: "cinematic",
        },
        sfx: {
          enabled: true,
          density: "medium",
        },
      },
      captions: {
        style: {
          animationStyle: "pop",
          colorStyle: "violet",
          typography: "bold",
          wordByWord: true,
          wordHighlight: true,
        },
      },
    },
  },
];

function listTemplates() {
  return DEFAULT_TEMPLATES.map((template) => ({ ...template }));
}

function getTemplateById(templateId) {
  return DEFAULT_TEMPLATES.find((template) => template.id === templateId) || null;
}

function createTemplateSnapshot(template) {
  if (!template) {
    return null;
  }

  return {
    id: template.id,
    title: template.title,
    type: template.type,
    description: template.description,
    style: template.style,
    params: template.params,
    preview: template.preview,
  };
}

module.exports = {
  DEFAULT_TEMPLATES,
  listTemplates,
  getTemplateById,
  createTemplateSnapshot,
};
