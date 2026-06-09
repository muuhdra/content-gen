function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function isWeakReferenceName(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return true;
  }

  if (/^(img|image|photo|picture|screenshot|screen shot|reference|ref|asset|file|final|draft)(\s|\d|$)/.test(normalized)) {
    return true;
  }

  if (/^[a-z]{2,5}\s?\d{2,}$/.test(normalized)) {
    return true;
  }

  return false;
}

function getLabelSemanticTokens(label) {
  if (label === "character") {
    return ["character", "subject", "person", "face", "portrait", "figure", "hero"];
  }

  if (label === "scene") {
    return ["scene", "environment", "location", "setting", "landscape", "room", "city", "map"];
  }

  if (label === "object") {
    return ["object", "prop", "vehicle", "device", "artifact", "product"];
  }

  // motion-graphic references anchor a type-specific visual style (map, data,
  // timeline, diagram, profile…). Scene injection is gated by doesSceneMatchMotionGraphic
  // in motionGraphic.js — NOT by token overlap with the scene text.
  if (label === "motion-graphic") {
    return [
      // map / geo
      "map", "geographic", "cartographic", "country", "city", "location", "region",
      // data / stats
      "chart", "graph", "data", "statistics", "percent", "counter", "infographic",
      // timeline / history
      "timeline", "history", "date", "chronology", "period", "decade",
      // diagram / process
      "diagram", "process", "flow", "step", "system", "workflow",
      // profile / dossier
      "dossier", "profile", "character", "portrait", "biography", "career",
      "person", "figure", "leader", "general", "emperor", "criminal",
    ];
  }

  return ["style", "lighting", "palette", "texture", "mood", "composition", "atmosphere"];
}

function getContextLabelAffinity(label, contextTokens) {
  const semanticTokens = getLabelSemanticTokens(label);
  const overlap = semanticTokens.reduce((count, token) => count + (contextTokens.has(token) ? 1 : 0), 0);

  if (overlap > 0) {
    return overlap * 8;
  }

  if (label === "style") {
    return 4;
  }

  return 0;
}

function analyzeReferenceMatch(reference, contextTokens, exactContextText) {
  const label = String(reference?.label || "style");
  const normalizedName = normalizeText(reference?.name);
  const nameTokens = tokenize(reference?.name);
  const weakName = isWeakReferenceName(reference?.name);
  const semanticTokens = weakName ? getLabelSemanticTokens(label) : [];
  const uniqueTokens = Array.from(new Set(nameTokens));
  const overlap = [...uniqueTokens, ...semanticTokens].reduce(
    (count, token) => count + (contextTokens.has(token) ? 1 : 0),
    0,
  );

  const labelWeight = label === "character"
    ? 4
    : label === "scene"
      ? 3
      : label === "object"
        ? 2
        : 1;

  const labelAffinity = getContextLabelAffinity(label, contextTokens);
  const exactPhraseMatch = normalizedName.length >= 6 && exactContextText.includes(normalizedName);
  const nearPhraseMatch = !exactPhraseMatch
    && normalizedName.length >= 6
    && normalizedName.split(" ").filter((token) => token.length >= 3).length >= 2
    && normalizedName.split(" ").filter((token) => contextTokens.has(token)).length >= 2;

  return {
    label,
    weakName,
    overlap,
    labelWeight,
    labelAffinity,
    exactPhraseMatch,
    nearPhraseMatch,
    score: overlap * 10
      + labelWeight
      + labelAffinity
      + (exactPhraseMatch ? 18 : 0)
      + (nearPhraseMatch ? 8 : 0),
  };
}

function getScriptLinkedPriorityBonus(match) {
  if (!match || match.overlap <= 0) {
    return 0;
  }

  return 6 + Math.min(match.overlap, 2) * 4 + (match.labelAffinity > 0 ? 4 : 0);
}

function formatReferenceAnchor(reference, index = 0) {
  const label = typeof reference?.label === "string" ? reference.label : "style";
  const name = typeof reference?.name === "string" ? reference.name.trim() : "Untitled reference";

  if (isWeakReferenceName(name)) {
    if (label === "character") {
      return `character reference ${index + 1}`;
    }

    if (label === "scene") {
      return `scene environment reference ${index + 1}`;
    }

    if (label === "object") {
      return `object or prop reference ${index + 1}`;
    }

    return `style and mood reference ${index + 1}`;
  }

  return `${label}: ${name}`;
}

function summarizeReferencePurpose(reference) {
  const label = typeof reference?.label === "string" ? reference.label : "style";
  const isFoundation = reference?.referenceSource === "foundation";

  // ── Foundation references (Editor Lab) LOCK the global visual/animation STYLE.
  // They apply to every scene and define the art-direction DNA, regardless of the
  // sub-label (which here describes *which facet* of the style the image shows).
  if (isFoundation) {
    if (label === "character") {
      return "lock the character design language and art style (proportions, rendering, silhouette language) — not a specific identity";
    }
    if (label === "scene") {
      return "lock the environment & architecture style (building shapes, world design, set aesthetic)";
    }
    if (label === "object") {
      return "lock the prop & object design style (materials, shapes, finish language)";
    }
    return "lock the overall visual style — palette, lighting, texture, rendering and mood for the whole project";
  }

  // ── Script-linked references (workflow) preserve a SPECIFIC subject tied to the
  // script: this exact character, this exact place, this exact object.
  if (label === "character") {
    return "preserve this specific character's identity, face, silhouette and wardrobe cues";
  }
  if (label === "scene") {
    return "preserve this specific location's environment, geography, framing and layout";
  }
  if (label === "object") {
    return "preserve this specific prop, vehicle, device or hero object";
  }
  return "preserve atmosphere, palette, lighting and visual texture";
}

function buildReferenceDirective(anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) {
    return "";
  }

  return anchors
    .map((anchor) => `${anchor.formatted} (${anchor.directive})`)
    .join("; ");
}

function collectProjectReferences(project) {
  const foundationReferences = Array.isArray(project?.references)
    ? project.references.map((reference) => ({ ...reference, referenceSource: "foundation" }))
    : [];
  const scriptLinkedReferences = Array.isArray(project?.scriptLinkedReferences)
    ? project.scriptLinkedReferences.map((reference) => ({ ...reference, referenceSource: "script-linked" }))
    : [];

  return {
    foundationReferences,
    scriptLinkedReferences,
  };
}

function selectSceneReferenceAnchors(project, options = {}) {
  const {
    sceneText = "",
    visualIntent = "",
    maxItems = 4,
  } = options;

  const { foundationReferences, scriptLinkedReferences } = collectProjectReferences(project);

  if (foundationReferences.length === 0 && scriptLinkedReferences.length === 0) {
    return [];
  }

  const contextTokens = new Set([
    ...tokenize(sceneText),
    ...tokenize(visualIntent),
    ...tokenize(project?.title),
    ...tokenize(project?.goal),
  ]);
  const exactContextText = normalizeText(`${sceneText} ${visualIntent}`);

  return [...scriptLinkedReferences, ...foundationReferences]
    .filter((reference) => typeof reference?.name === "string" && reference.name.trim().length > 0)
    .map((reference, index) => ({
      reference,
      index,
      ...(() => {
        const match = analyzeReferenceMatch(reference, contextTokens, exactContextText);
        const scriptLinkedBonus = reference.referenceSource === "script-linked"
          ? getScriptLinkedPriorityBonus(match)
          : 0;

        return {
          match,
          score: match.score + scriptLinkedBonus,
        };
      })(),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.match.exactPhraseMatch !== right.match.exactPhraseMatch) {
        return left.match.exactPhraseMatch ? -1 : 1;
      }

      if (left.match.nearPhraseMatch !== right.match.nearPhraseMatch) {
        return left.match.nearPhraseMatch ? -1 : 1;
      }

      if (right.match.overlap !== left.match.overlap) {
        return right.match.overlap - left.match.overlap;
      }

      if (right.match.labelAffinity !== left.match.labelAffinity) {
        return right.match.labelAffinity - left.match.labelAffinity;
      }

      if (left.match.weakName !== right.match.weakName) {
        return left.match.weakName ? 1 : -1;
      }

      if (left.reference.referenceSource !== right.reference.referenceSource) {
        if (left.reference.referenceSource === "script-linked" && left.match.overlap > 0) {
          return -1;
        }

        if (right.reference.referenceSource === "script-linked" && right.match.overlap > 0) {
          return 1;
        }
      }

      return left.index - right.index;
    })
    .slice(0, maxItems)
    .map(({ reference }, index) => ({
      id: reference.id,
      label: typeof reference.label === "string" ? reference.label : "style",
      name: reference.name.trim(),
      source: reference.referenceSource || "foundation",
      formatted: formatReferenceAnchor(reference, index),
      weakName: isWeakReferenceName(reference.name),
      directive: reference.referenceSource === "script-linked"
        ? `${summarizeReferencePurpose(reference)}; use this when the scene directly matches the script-specific subject, place or event`
        : summarizeReferencePurpose(reference),
    }));
}

module.exports = {
  buildReferenceDirective,
  selectSceneReferenceAnchors,
};
