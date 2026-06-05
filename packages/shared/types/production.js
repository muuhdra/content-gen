const CONTENT_TYPES = ["short", "video", "slideshow"];
const PROJECT_STATUSES = ["Draft", "Active", "Rendering", "Completed"];
const RENDER_JOB_STATUSES = ["queued", "processing", "completed", "failed"];

/**
 * Status to apply when a meaningful authoring action happens on a project.
 *
 * Lifecycle:
 *   Draft      → freshly created, nothing authored yet
 *   Active     → being worked on (has content / edited since last render)
 *   Rendering  → a render job is in flight
 *   Completed  → a render finished successfully
 *
 * Any edit means the project is being worked on → "Active", EXCEPT while a
 * render is in flight ("Rendering"), which the render worker owns and we must
 * not stomp. A re-edit of a Completed project correctly drops it back to Active.
 */
function resolveWorkingStatus(currentStatus) {
  if (currentStatus === "Rendering") {
    return "Rendering";
  }
  return "Active";
}

module.exports = {
  CONTENT_TYPES,
  PROJECT_STATUSES,
  RENDER_JOB_STATUSES,
  resolveWorkingStatus,
};
