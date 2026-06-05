/**
 * Aggregator for the project sub-routers.
 *
 * Mount order matters: specific paths must win over the generic `/:id` patterns
 * declared in `projects.routes.js`. Express checks routers in declaration order,
 * so the CRUD router is mounted LAST.
 *
 *   reference-assets  → /reference-assets/*           (specific paths only)
 *   script            → /:id/script[/...]
 *   scenes            → /:id/scenes[/...]
 *   audio             → /:id/audio[/...]
 *   captions          → /:id/captions[/...]
 *   render            → /:id/assembly[/...], /:id/render[/...]
 *   projects (CRUD)   → /, /:id  ← MUST be last
 */
const express = require("express");

const referenceAssetsRouter = require("./reference-assets.routes");
const researchRouter = require("./research.routes");
const thumbnailRouter = require("./thumbnail.routes");
const styleRouter = require("./style.routes");
const scriptRouter = require("./script.routes");
const scenesRouter = require("./scenes.routes");
const audioRouter = require("./audio.routes");
const captionsRouter = require("./captions.routes");
const renderRouter = require("./render.routes");
const projectsRouter = require("./projects.routes");

const router = express.Router();

router.use(referenceAssetsRouter);
router.use(researchRouter);
router.use(thumbnailRouter);
router.use(styleRouter);
router.use(scriptRouter);
router.use(scenesRouter);
router.use(audioRouter);
router.use(captionsRouter);
router.use(renderRouter);
router.use(projectsRouter);

module.exports = { projectsRouter: router };
