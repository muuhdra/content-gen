/**
 * Shared context for the split project routers.
 *
 * Single instances created here are imported by every domain router so they
 * share repositories and the orchestrator queue. This mirrors the previous
 * top-of-file setup in the monolithic routes.js.
 */
const { createProjectsRepository } = require("../repository");
const { createRenderJobsRepository } = require("../../render-jobs/repository");
const { createTemplatesRepository } = require("../../templates/repository");
const { createOrchestratorQueue } = require("@cosyl/orchestrator/queue");
const { composeFinalVideo } = require("../../media/compose");
const { normalizeReferences } = require("../project-model");

const projectsRepository = createProjectsRepository();
const renderJobsRepository = createRenderJobsRepository();
const templatesRepository = createTemplatesRepository();
const orchestratorQueue = createOrchestratorQueue({
  jobsRepository: renderJobsRepository,
  projectsRepository,
  composeVideo: composeFinalVideo,
});

const maxScriptLinkedReferences = 12;

function normalizeScriptLinkedReferences(references) {
  return normalizeReferences(references);
}

function exceedsScriptLinkedReferencesLimit(references) {
  return normalizeScriptLinkedReferences(references).length > maxScriptLinkedReferences;
}

module.exports = {
  projectsRepository,
  renderJobsRepository,
  templatesRepository,
  orchestratorQueue,
  maxScriptLinkedReferences,
  normalizeScriptLinkedReferences,
  exceedsScriptLinkedReferencesLimit,
};
